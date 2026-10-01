/**
 * app-v2 交互自测（e2e-lite）—— 一条真实链路：点一下 → 落盘 → 冷启动还在
 * 用法： node tools/e2e-v2.mjs [端口]
 *
 * 为什么必须有这一步：页面"看着对"不等于"能用"。
 * 走一遍：记一笔（点一下）→ 读 IndexedDB 确认写入 → 重新加载 → 界面还在 → 清理
 */
import path from "node:path";
import { launch, freePort } from "./cdp-page.mjs";

const PORT = process.argv[2] ?? "3210";
const BASE = `http://127.0.0.1:${PORT}`;

const client = await launch(path.join(process.env.TEMP ?? ".", "lf-v2-e2e"), await freePort());
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 900, deviceScaleFactor: 1, mobile: true,
});

let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "⚠ "} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fail++;
};

const countEntries = `(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const n = await new Promise((res, rej) => { const t = db.transaction('entries','readonly').objectStore('entries').count(); t.onsuccess=()=>res(t.result); t.onerror=()=>rej(t.error); });
  const meta = await new Promise((res) => { const t = db.transaction('meta','readonly').objectStore('meta').getAll(); t.onsuccess=()=>res(t.result); t.onerror=()=>res([]); });
  const latest = await new Promise((res) => { const t = db.transaction('entries','readonly').objectStore('entries').getAll(); t.onsuccess=()=>res(t.result.slice(-1)[0]||null); t.onerror=()=>res(null); });
  return { n, meta, latest };
})()`;

/* ── 1. 打开首页，等播种 ── */
console.log("=== 1. 首开：播种 ===");
await client.goto(`${BASE}/`, 2600);
await new Promise((r) => setTimeout(r, 1200));
const s1 = await client.evalAsync(countEntries);
check("播种完成（有记录）", s1 && s1.n > 100, `entries=${s1?.n}`);
check("种子版本已记", !!s1?.meta?.find((m) => m.key === "seed"), `seed=${s1?.meta?.find((m) => m.key === "seed")?.value}`);
const before = s1?.n ?? 0;

/* ── 2. 点开「记一下」→ 点一个常用项 ── */
console.log("\n=== 2. 点一下记一笔 ===");
const opened = await client.eval(`(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => x.textContent.trim() === '记一下');
  if (!b) return false;
  b.click();
  return true;
})()`);
check("打开记一笔面板", opened === true);
await new Promise((r) => setTimeout(r, 600));

const tapped = await client.eval(`(() => {
  const pills = [...document.querySelectorAll('.pill')];
  const p = pills.find(x => x.textContent.trim() === '咖啡');
  if (!p) return null;
  p.click();
  return p.textContent.trim();
})()`);
check("点中「咖啡」快捷项", tapped === "咖啡", `点到：${tapped ?? "无"}`);
await new Promise((r) => setTimeout(r, 900));

const s2 = await client.evalAsync(countEntries);
check("落盘 +1 条", (s2?.n ?? 0) === before + 1, `${before} → ${s2?.n}`);
check("落盘内容正确", s2?.latest?.text === "一杯咖啡", `text=${s2?.latest?.text}`);

/* ── 3. 冷启动：重新加载后还在 ── */
console.log("\n=== 3. 冷启动 ===");
await client.goto(`${BASE}/log`, 2600);
await new Promise((r) => setTimeout(r, 1200));
const s3 = await client.evalAsync(countEntries);
check("重载后条数不变", (s3?.n ?? 0) === before + 1, `entries=${s3?.n}`);
const onScreen = await client.eval(`document.body.innerText.includes('一杯咖啡')`);
check("界面上能看到这条", onScreen === true);

/* ── 4. 指标跟着动（单点计算）── */
console.log("\n=== 4. 指标 === ");
await client.goto(`${BASE}/past`, 2600);
await new Promise((r) => setTimeout(r, 1200));
const metrics = await client.eval(`(() => {
  const t = document.body.innerText;
  return { hasGroups: t.includes('稳了') || t.includes('掉了') || t.includes('没动'), hasBottleneck: t.includes('备'), len: t.length };
})()`);
check("回看有三组", metrics.hasGroups === true);

/* ── 5. 清理：把测试写入的那条删掉 ── */
console.log("\n=== 5. 清理测试数据 ===");
const cleaned = await client.evalAsync(`(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('lifeflow-v7'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const db = await open();
  const all = await new Promise((res) => { const t = db.transaction('entries','readwrite').objectStore('entries').getAll(); t.onsuccess=()=>res(t.result); t.onerror=()=>res([]); });
  const targets = all.filter(e => e.text === '一杯咖啡');
  await new Promise((res) => { const t = db.transaction('entries','readwrite'); targets.forEach(e => t.objectStore('entries').delete(e.id)); t.oncomplete=()=>res(); t.onerror=()=>res(); });
  return targets.length;
})()`);
check("测试写入已清理", cleaned >= 1, `删除 ${cleaned} 条`);

await client.send("Emulation.clearDeviceMetricsOverride");
await client.close();
console.log(`\n${fail ? `⚠ ${fail} 项未通过` : "✅ 全部通过（" + 5 + " 组）"}`);
process.exitCode = fail ? 1 : 0;
