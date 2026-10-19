import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";


const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_RESET")) errors.push("console:" + m.text()); });

const results = [];
const ok = (name, cond, detail = "") => results.push([cond ? "PASS" : "FAIL", name, detail]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);

const boot = await page.evaluate(() => ({
  store: !!(window.LightStore && window.LightStore.record),
  accounts: !!(window.LightAccounts && window.LightAccounts.dayScores),
  theme: document.documentElement.getAttribute("data-theme"),
}));
ok("壳加载 core/store.js", boot.store);
ok("壳加载 core/accounts.js", boot.accounts);

await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("饮水")).click());
await page.waitForTimeout(2600);

const frame = page.frames().find((f) => f.url().endsWith("v3/water.html"));
ok("饮水 iframe 打开", !!frame);
const water0 = await frame.evaluate(() => document.querySelector("#water-total")?.textContent);
ok("饮水初始为 0（无假 1350）", water0 === "0", water0);
ok("饮水页加载 store", await frame.evaluate(() => !!window.LightStore));

await frame.click("#water-drink");
await page.waitForTimeout(300);
await frame.click("#water-drink");
await page.waitForTimeout(500);
const water2 = await frame.evaluate(() => document.querySelector("#water-total")?.textContent);
ok("喝两杯 = 500", water2 === "500", water2);

const store2 = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["饮水"] || []).length, vals: (d.byMod["饮水"] || []).map((r) => r.value) };
});
ok("store 落盘两笔饮水", store2.n === 2, JSON.stringify(store2));

await page.click("#modBack");
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await page.waitForTimeout(400);
const lamp = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const rows = [...document.querySelectorAll("#acctList .acct-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
  return { light: st.light, applied: st.dayApplied?.step, logs: Object.values(st.logs || {}).reduce((a, b) => a + b, 0), rows, body: rows.find((x) => x.startsWith("体")), verdict: document.querySelector("#dayVerdict")?.textContent, foot: document.querySelector("#dayFoot")?.textContent };
});
ok("回壳后灯涨 1 光", lamp.light === 1, JSON.stringify(lamp));
ok("体账户 = 25", (lamp.body || "").includes("25"), lamp.body);
ok("今日判定 = 够涨一缕", lamp.verdict === "够涨一缕", lamp.verdict);
ok("今日已入账", (lamp.foot || "").includes("已入账"), lamp.foot);

/* 工具：只存事实，不动四账户/灯 */
const toolBefore = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, acct: window.LightAccounts.dayScores(window.LightStore.readDay(window.LightStore.today())) };
});
await page.evaluate(() => window.LightStore.record({ mod: "备忘录", metric: "notes", value: 1, meta: { title: "test" } }));
await page.evaluate(() => window.renderStats());
await page.waitForTimeout(300);
const toolAfter = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, acct: window.LightAccounts.dayScores(window.LightStore.readDay(window.LightStore.today())), tools: window.LightAccounts.dayFacts(window.LightStore.readDay(window.LightStore.today())).tools.length };
});
ok("工具记录不改灯", toolAfter.light === toolBefore.light, `${toolBefore.light} → ${toolAfter.light}`);
ok("工具记录不改四账户", JSON.stringify(toolAfter.acct) === JSON.stringify(toolBefore.acct), JSON.stringify(toolAfter.acct));
ok("工具进入 tools", toolAfter.tools === 1, String(toolAfter.tools));

/* 刷新：水页与灯都保留 */
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const saved = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, body: window.LightAccounts.dayScores(window.LightStore.readDay(window.LightStore.today())).body };
});
ok("刷新后灯仍为 1", saved.light === 1, JSON.stringify(saved));
ok("刷新后体仍为 25", saved.body === 25, String(saved.body));

await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("饮水")).click());
await page.waitForTimeout(2400);
const frame2 = page.frames().find((f) => f.url().endsWith("v3/water.html"));
const waterReload = await frame2.evaluate(() => document.querySelector("#water-total")?.textContent);
ok("刷新后饮水仍为 500", waterReload === "500", waterReload);

await page.screenshot({ path: OUT + "p0-water-loop.png" });

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n回路校验：${results.filter((x) => x[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((x) => x[0] === "FAIL") ? 1 : 0);

