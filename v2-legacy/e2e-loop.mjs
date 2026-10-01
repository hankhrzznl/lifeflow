/**
 * 记录 → 指标 闭环测试
 * 用法： node tools/e2e-loop.mjs [端口]
 *
 * 为什么必须有这个测试：
 *   「记一笔」如果不能记到**规则**上，回看里的「睡稳 30/30」这类数字永远不会动，
 *   整个产品就退化成一个记事本。这是最容易悄悄断掉的一环 ——
 *   界面看着正常、点击也有反馈，但指标不动。
 */
import path from "node:path";
import { launch, freePort } from "./cdp-page.mjs";

const PORT = process.argv[2] ?? "3210";
const BASE = `http://127.0.0.1:${PORT}`;

const client = await launch(path.join(process.env.TEMP ?? ".", "lf-loop-e2e"), await freePort());
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 900, deviceScaleFactor: 1, mobile: true,
});

let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "⚠ "} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fail++;
};
const ev = (e) => client.evalAsync(e);

/* 在页面里读「今天某条规则的记录数 + 累计值」 */
const probe = `(async () => {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('lifeflow-v7');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const db = await open();
  const all = await new Promise((res) => {
    const t = db.transaction('entries','readonly').objectStore('entries').getAll();
    t.onsuccess = () => res(t.result);
  });
  const d = new Date();
  const p = (n) => String(n).padStart(2,'0');
  const today = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
  const w = all.filter((e) => e.ruleId === 'r-water' && e.date === today && !e.deletedAt);
  return {
    total: all.filter((e) => !e.deletedAt).length,
    waterToday: w.length,
    waterSum: w.reduce((s, e) => s + (e.value || 0), 0),
    last: w.slice(-1)[0] || null,
  };
})()`;

console.log("=== 1. 打开首页 ===");
await client.goto(`${BASE}/`, 2600);
await new Promise((r) => setTimeout(r, 1500));
const before = await ev(probe);
check("读到基准数据", before && before.total > 100, `总 ${before?.total} 条 · 今天喝水 ${before?.waterToday} 条`);

console.log("\n=== 2. 打开「记一下」面板 ===");
const opened = await client.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '记一下');
  if (!b) return false;
  b.click();
  return true;
})()`);
check("面板打开", opened === true);
await new Promise((r) => setTimeout(r, 800));

const pills = await client.eval(
  `[...document.querySelectorAll('.pill')].map(x => x.textContent.trim())`,
);
check(
  "面板里有「在养的」规则可点",
  Array.isArray(pills) && pills.some((t) => t.includes("喝水")),
  `选项：${JSON.stringify(pills)}`,
);

console.log("\n=== 3. 点「喝水 记满」——应记到 r-water 且恰好记满 ===");
const tapped = await client.eval(`(() => {
  const p = [...document.querySelectorAll('.pill')].find(x => x.textContent.includes('喝水'));
  if (!p) return null;
  p.click();
  return p.textContent.trim();
})()`);
check("点中规则", !!tapped, `点到：${tapped}`);
await new Promise((r) => setTimeout(r, 1300));

const after = await ev(probe);
check("记录数 +1", after && after.waterToday === before.waterToday + 1, `${before?.waterToday} → ${after?.waterToday}`);
/* 语义已定为「点一下 = 这条记满」：点完当天累计必须**恰好等于**目标，不能超。
   早先拿目标当增量，结果 1500 + 2000 = 3500 超了一整天目标 —— 这条断言就是防它。 */
const target = 2000;
check(
  `点满后累计恰好等于目标 ${target}（不超记）`,
  after && after.waterSum === target,
  `${before?.waterSum} → ${after?.waterSum} ml`,
);
check("确实挂在 r-water 上（不是无归属的流）", after?.last?.ruleId === "r-water", `ruleId=${after?.last?.ruleId}`);

console.log("\n=== 4. 指标页跟着动（回看）===");
await client.goto(`${BASE}/past`, 2600);
await new Promise((r) => setTimeout(r, 1400));
const pastText = await client.eval(`document.body.innerText`);
check("回看里能看到喝水这一条", typeof pastText === "string" && pastText.includes("喝水"));
const pct = (pastText.match(/喝水[\s\S]{0,60}?(\d+)%/) || [])[1];
check("喝水显示了达标率", !!pct, `读到 ${pct ?? "无"}%`);

console.log("\n=== 5. 清理（软删刚写的那条）===");
const cleaned = await ev(`(async () => {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('lifeflow-v7');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const db = await open();
  const all = await new Promise((res) => {
    const t = db.transaction('entries','readonly').objectStore('entries').getAll();
    t.onsuccess = () => res(t.result);
  });
  const d = new Date();
  const p = (n) => String(n).padStart(2,'0');
  const today = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
  /* 播种的喝水条目 text 固定是「一杯水 250ml」；测试写入的是「喝水 <差额><单位>」。
     所以按 text 前缀删，别写死某个数字（差额会随当天已记的量变）。 */
  const w = all.filter((e) => e.ruleId === 'r-water' && e.date === today && !e.deletedAt && /^喝水 /.test(e.text || ''));
  await new Promise((res) => {
    const t = db.transaction('entries','readwrite');
    w.forEach((e) => t.objectStore('entries').delete(e.id));
    t.oncomplete = () => res();
  });
  return w.length;
})()`);
check("测试写入已清理", cleaned >= 1, `删除 ${cleaned} 条`);

await client.send("Emulation.clearDeviceMetricsOverride");
await client.close();
console.log(`\n${fail ? `⚠ ${fail} 项未通过` : "✅ 全部通过"}`);
process.exitCode = fail ? 1 : 0;
