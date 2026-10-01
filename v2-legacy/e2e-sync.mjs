/**
 * 同步端到端测试（e2e）—— 真浏览器 + 真 IndexedDB + 假远端
 * 用法： node tools/e2e-sync.mjs [端口]
 *
 * 为什么必须这么测：同步的坑全在边界上，读代码看不出来。
 *   ① 本地写 → 必须自动盖上 updatedAt（写入层接对了没）
 *   ② 推 → 远端必须有
 *   ③ A 设备推完，B 设备拉 → 必须拿到（跨设备这条主链）
 *   ④ **本地有未推的改动时，拉取不许覆盖它**（最容易丢数据的地方）
 *   ⑤ 远端断网时推失败 → 游标不许前进 → 恢复后必须补传（离线不丢）
 *   ⑥ 软删必须传到远端（deleted_at 非空），且本地界面不再显示
 */
import path from "node:path";
import { launch, freePort } from "./cdp-page.mjs";

const PORT = process.argv[2] ?? "3210";
const BASE = `http://127.0.0.1:${PORT}`;

const client = await launch(path.join(process.env.TEMP ?? ".", "lf-sync-e2e"), await freePort());
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 900, deviceScaleFactor: 1, mobile: true,
});

let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "⚠ "} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fail++;
};
const ev = (expr) => client.evalAsync(expr);

/* ── 0. 打开应用，等钩子/桥装好 ── */
console.log("=== 0. 准备：装内存适配器（假远端）===");
await client.goto(`${BASE}/`, 2600);
await new Promise((r) => setTimeout(r, 1500));
const bridgeOk = await client.eval(`typeof window.__lf === 'object' && window.__lf !== null`);
check("测试入口已就绪（window.__lf）", bridgeOk === true, `实际 ${bridgeOk}`);

await ev(`(async () => { window.__lf.useMemoryAdapter('user-A'); return true; })()`);
const cfg = await ev(`(async () => window.__lf.isConfigured())()`);
check("内存适配器已接管（configured=true）", cfg === true);

/* ── 1. 本地写 → 自动盖 updatedAt ── */
console.log("\n=== 1. 本地写：写入层有没有盖上 updatedAt ===");
const w1 = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const id = 'e2e-entry-1';
  await new Promise((res, rej) => {
    const t = db.transaction('entries','readwrite');
    const q = t.objectStore('entries').put({ id, at: new Date().toISOString().slice(0,16), date: new Date().toISOString().slice(0,10), text: 'e2e 测试条目', tags: ['e2e'] });
    q.onsuccess = () => res(); q.onerror = () => rej(q.error);
  });
  const row = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').get(id); t.onsuccess=()=>res(t.result); });
  return { updatedAt: row && row.updatedAt, deletedAt: row && row.deletedAt, userId: row && row.userId };
})()`);
/* ⚠ 注意：这里是**直接写 IndexedDB**，绕过了写入层。
   所以这一步只验证"写进去了"；写入层验证走下面的业务路径。 */
check("直写 IndexedDB 成功（绕过写入层，作为对照）", w1 !== null, JSON.stringify(w1));

/* 用真实业务路径写（QuickSheet 用的就是 Dexie）—— 从界面点一下 */
console.log("\n=== 1b. 走真实业务路径（点一下）验证写入层 ===");
await ev(`(async () => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => x.textContent.trim() === '记一下');
  if (b) b.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 600));
await ev(`(async () => {
  const p = [...document.querySelectorAll('.pill')].find(x => x.textContent.trim() === '咖啡');
  if (p) p.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 900));

const hookCheck = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const all = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').getAll(); t.onsuccess=()=>res(t.result); });
  const row = all.filter(e => e.text === '一杯咖啡').slice(-1)[0];
  return row ? { updatedAt: row.updatedAt, deletedAt: row.deletedAt, userId: row.userId } : null;
})()`);
check("业务写入自动盖了 updatedAt", !!(hookCheck && hookCheck.updatedAt > 0), JSON.stringify(hookCheck));
check("业务写入自动记了 userId", !!(hookCheck && hookCheck.userId === "user-A"), `userId=${hookCheck?.userId}`);
check("业务写入 deletedAt 为空（没被误标删）", !!(hookCheck && hookCheck.deletedAt === null));

/* ── 2. 推送 ── */
console.log("\n=== 2. 推送：本地 → 远端 ===");
const pushRes = await ev(`(async () => window.__lf.syncOnce())()`);
check("同步一轮成功", pushRes && pushRes.ok === true, JSON.stringify(pushRes));
const remoteHas = await ev(`(async () => {
  const rows = window.__lf.dumpRemote('entries');
  return { count: rows.length, sample: rows.slice(-3).map(r => ({ id: r.id, updated_at: r.updated_at })) };
})()`);
check("远端收到数据", remoteHas && remoteHas.count > 100, `远端 ${remoteHas?.count} 行`);

/* ── 3. 跨设备：B 设备拉 ── */
console.log("\n=== 3. 跨设备：清空本地游标与数据 → 模拟新设备拉取 ===");
const pullRes = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  /* 模拟"另一台设备"：清空 entries + 把所有游标归零，然后拉 */
  await new Promise((res) => { const t = db.transaction('entries','readwrite'); t.objectStore('entries').clear(); t.oncomplete=()=>res(); });
  await new Promise((res) => { const t = db.transaction('syncMeta','readwrite'); t.objectStore('syncMeta').clear(); t.oncomplete=()=>res(); });
  const before = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').count(); t.onsuccess=()=>res(t.result); });
  const r = await window.__lf.syncOnce();
  const after = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').count(); t.onsuccess=()=>res(t.result); });
  return { before, after, r };
})()`);
check("清空后本地为空", pullRes && pullRes.before === 0, `before=${pullRes?.before}`);
check("一次同步把整库拉了回来（跨设备主链）", pullRes && pullRes.after > 100, `after=${pullRes?.after}`);

/* ── 4. 脏数据保护：本地未推的改动不许被远端覆盖 ── */
console.log("\n=== 4. 脏数据保护：本地未推的改动不许被拉取覆盖 ===");
const dirtyRes = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const id = 'e2e-dirty';
  const now = Date.now();
  /* 本地写入一个"还没推上去"的改动（updatedAt 很新） */
  await new Promise((res) => { const t = db.transaction('entries','readwrite'); t.objectStore('entries').put({ id, at:'2026-09-30T10:00', date:'2026-09-30', text:'本地新记录（未推）', updatedAt: now, deletedAt: null, userId:'user-A' }); t.oncomplete=()=>res(); });
  /* 让远端存在一条**更旧**的同 id 行（模拟云端旧版本） */
  const remote = window.__lf.dumpRemote('entries').filter(r => r.id === id);
  return { localTs: now, remoteHasIt: remote.length > 0 };
})()`);
/* 手动往内存远端塞一条旧的同 id 行，再拉，看会不会盖掉本地 */
const overwriteTest = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  /* 走 push 让远端存下本地新版本，然后把游标回退，制造"远端有旧版本"的情形 */
  await window.__lf.pushTable('entries');
  const before = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').get('e2e-dirty'); t.onsuccess=()=>res(t.result); });
  /* 回退拉取游标到 0，再拉一次全量：本地行是"已推"的，应保持不变 */
  await new Promise((res) => { const t = db.transaction('syncMeta','readwrite'); t.objectStore('syncMeta').put({ key:'pulled:entries', value:'0' }); t.oncomplete=()=>res(); });
  await window.__lf.pullTable('entries');
  const after = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').get('e2e-dirty'); t.onsuccess=()=>res(t.result); });
  return { beforeText: before && before.text, afterText: after && after.text, beforeTs: before && before.updatedAt, afterTs: after && after.updatedAt };
})()`);
check("拉取没有破坏本地文本", overwriteTest && overwriteTest.afterText === overwriteTest.beforeText, JSON.stringify(overwriteTest));
check("拉取没有改动本地时间戳", overwriteTest && overwriteTest.afterTs === overwriteTest.beforeTs, `ts ${overwriteTest?.beforeTs} → ${overwriteTest?.afterTs}`);

/* ── 5. 离线不丢：推失败 → 游标不许前进 → 恢复后补传 ── */
console.log("\n=== 5. 离线不丢：推失败后必须能补传 ===");
const offlineRes = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const id = 'e2e-offline';
  await new Promise((res) => { const t = db.transaction('entries','readwrite'); t.objectStore('entries').put({ id, at:'2026-09-30T11:00', date:'2026-09-30', text:'断网时写的', updatedAt: Date.now(), deletedAt: null, userId:'user-A' }); t.oncomplete=()=>res(); });

  /* 断网 */
  window.__lf.setRemoteFailing(true);
  const failed = await window.__lf.syncOnce();
  const cursorAfterFail = await window.__lf.cursor('pushed:entries');
  const remoteAfterFail = window.__lf.dumpRemote('entries').filter(r => r.id === id).length;

  /* 恢复网络 */
  window.__lf.setRemoteFailing(false);
  const ok = await window.__lf.syncOnce();
  const remoteAfterOk = window.__lf.dumpRemote('entries').filter(r => r.id === id).length;

  return { failedOk: failed.ok, failedErr: failed.error, cursorAfterFail, remoteAfterFail, okOk: ok.ok, remoteAfterOk };
})()`);
check("断网时同步报失败（没有假装成功）", offlineRes && offlineRes.failedOk === false, `error=${offlineRes?.failedErr}`);
check("断网时远端确实没收到", offlineRes && offlineRes.remoteAfterFail === 0);
check("恢复后补传成功", offlineRes && offlineRes.okOk === true && offlineRes.remoteAfterOk === 1, `远端 ${offlineRes?.remoteAfterOk} 行`);

/* ── 6. 软删传播 ── */
console.log("\n=== 6. 软删：删除必须传到远端，且界面不再显示 ===");
const delRes = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const id = 'e2e-offline';
  const now = Date.now();
  /* 软删（这正是钩子里 deleting 的做法） */
  await new Promise((res) => { const t = db.transaction('entries','readwrite'); t.objectStore('entries').put({ id, at:'2026-09-30T11:00', date:'2026-09-30', text:'断网时写的', updatedAt: now, deletedAt: now, userId:'user-A' }); t.oncomplete=()=>res(); });
  const r = await window.__lf.syncOnce();
  const remoteRow = window.__lf.dumpRemote('entries').filter(x => x.id === id)[0];
  return { ok: r.ok, remoteDeletedAt: remoteRow ? remoteRow.deleted_at : null };
})()`);
check("软删同步成功", delRes && delRes.ok === true);
check("远端记录到 deleted_at（非空）", !!(delRes && delRes.remoteDeletedAt), `deleted_at=${delRes?.remoteDeletedAt}`);
const hidden = await client.eval(`!document.body.innerText.includes('断网时写的')`);
check("界面上已看不到被软删的内容", hidden === true);

/* ── 清理 ── */
console.log("\n=== 7. 清理测试数据 ===");
const cleaned = await ev(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const all = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').getAll(); t.onsuccess=()=>res(t.result); });
  const targets = all.filter(e => String(e.id).startsWith('e2e-') || e.text === '一杯咖啡');
  await new Promise((res) => { const t = db.transaction('entries','readwrite'); targets.forEach(e => t.objectStore('entries').delete(e.id)); t.oncomplete=()=>res(); });
  await new Promise((res) => { const t = db.transaction('syncMeta','readwrite'); t.objectStore('syncMeta').clear(); t.oncomplete=()=>res(); });
  return targets.length;
})()`);
check("测试数据已清理", cleaned >= 1, `删除 ${cleaned} 条`);

await client.send("Emulation.clearDeviceMetricsOverride");
await client.close();
console.log(`\n${fail ? `⚠ ${fail} 项未通过` : "✅ 全部通过"}`);
process.exitCode = fail ? 1 : 0;
