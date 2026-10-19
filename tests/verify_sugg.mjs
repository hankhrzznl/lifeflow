import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);

const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

const s0 = await page.evaluate(() => ({
  heading: document.querySelector(".sug-head h2")?.textContent.trim(),
  sub: document.querySelector(".sug-head p")?.textContent.trim(),
  n: document.querySelectorAll("#sugList .task-card").length,
  titles: [...document.querySelectorAll("#sugList .task-title")].map((x) => x.textContent.trim()),
  scores: acctScores(),
}));
ok("标题仍写 3 处", s0.heading.includes("3 处"), s0.heading);
ok("初始正好 3 条", s0.n === 3, String(s0.n));
ok("文案改为今天最弱", s0.sub.includes("今天最弱") && s0.sub.includes("「体」"), s0.sub);
ok("最弱为体时优先体", s0.titles.includes("出门走 15 分钟") && s0.titles.includes("补一杯水"), JSON.stringify(s0.titles));

await page.click("#refreshBtn");
await page.waitForTimeout(300);
const s1 = await page.evaluate(() => ({
  n: document.querySelectorAll("#sugList .task-card").length,
  heading: document.querySelector(".sug-head h2")?.textContent.trim(),
  titles: [...document.querySelectorAll("#sugList .task-title")].map((x) => x.textContent.trim()),
}));
ok("刷新后仍是 3 条（修 5 条 bug）", s1.n === 3, String(s1.n));
ok("刷新后标题仍 3 处", s1.heading.includes("3 处"), s1.heading);

const firstTitle = await page.evaluate(() => document.querySelector("#sugList .task-title")?.textContent.trim());
await page.evaluate(() => document.querySelector("#sugList .js-sug-add")?.click());
await page.waitForTimeout(400);
const added = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const all = Object.values(st.todos || {}).flat();
  const hit = all.find((x) => x.t === document.querySelector("#sugList .task-title")?.textContent.trim());
  return {
    titles: [...document.querySelectorAll("#sugList .task-title")].map((x) => x.textContent.trim()),
    n: document.querySelectorAll("#sugList .task-card").length,
    added: all.filter((x) => x.t === firstTitle0).map((x) => ({ t: x.t, dom: x.dom })),
    dom: all.map((x) => ({ t: x.t, dom: x.dom })).filter((x) => x.t === firstTitle0),
  };
}).catch(() => null);
// firstTitle0 not defined in page; redo evaluate with arg
const added2 = await page.evaluate((t) => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const all = Object.values(st.todos || {}).flat();
  return { n: document.querySelectorAll("#sugList .task-card").length, added: all.filter((x) => x.t === t).map((x) => ({ t: x.t, dom: x.dom })) };
}, firstTitle);
ok("加一条后建议仍补到 3 条", added2.n === 3, String(added2.n));
ok("加入待办的建议带 dom", added2.added.length === 1 && !!added2.added[0].dom, JSON.stringify(added2.added));

await page.screenshot({ path: OUT + "p0-suggestions.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n待照见校验：${results.filter((x) => x[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((x) => x[0] === "FAIL") ? 1 : 0);
