import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_RESET")) errors.push("console:" + m.text()); });
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);

/* 睡眠页 → store → 壳 */
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("睡眠")).click());
await page.waitForTimeout(3400);
const sleepFrame = page.frames().find((f) => f.url().endsWith("v3/sleep.html"));
ok("睡眠 iframe 打开", !!sleepFrame);
await sleepFrame.waitForFunction(
  () =>
    !!window.LightStore &&
    getComputedStyle(document.documentElement).getPropertyValue("--life-green").trim() === "#FF5C4D",
  null,
  { timeout: 12000 }
);
const sleepEnv = await sleepFrame.evaluate(() => ({
  store: !!window.LightStore,
  fab: document.querySelector(".fab-wrap") ? getComputedStyle(document.querySelector(".fab-wrap")).display : "no-fab",
  green: getComputedStyle(document.documentElement).getPropertyValue("--life-green").trim(),
}));
ok("睡眠页加载 store", sleepEnv.store, JSON.stringify(sleepEnv));
ok("v3 AI 悬浮球已隐藏", sleepEnv.fab === "none" || sleepEnv.fab === "no-fab", sleepEnv.fab);
ok("体能语义色变成四域色", sleepEnv.green === "#FF5C4D", sleepEnv.green);
await sleepFrame.click("#sleep-in-btn");
await page.waitForTimeout(1200);
const sleepStore = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["睡眠"] || []).length, hours: (d.byMod["睡眠"] || []).map((r) => r.value), logs: JSON.parse(localStorage.getItem("zdLight") || "{}").logs };
});
ok("睡眠写入 store 的 hours", sleepStore.n >= 1 && sleepStore.hours.every((h) => Number(h) > 0), JSON.stringify(sleepStore));
await page.click("#modBack");
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await page.waitForTimeout(400);
const lampSleep = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const rows = [...document.querySelectorAll("#acctList .acct-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
  return { light: st.light, body: rows.find((x) => x.startsWith("体")) };
});
ok("睡眠回壳后体账户有分", (lampSleep.body || "").includes("90"), lampSleep.body);
ok("睡眠点亮第一缕", lampSleep.light === 1, JSON.stringify(lampSleep));

/* 饮食页 → store */
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("饮食")).click());
await page.waitForTimeout(2400);
const dietFrame = page.frames().find((f) => f.url().endsWith("v3/diet.html"));
ok("饮食 iframe 打开", !!dietFrame);
ok("饮食页加载 store", await dietFrame.evaluate(() => !!window.LightStore));
await dietFrame.fill("#rec-input", "米饭");
await dietFrame.click("#rec-save");
await page.waitForTimeout(1200);
const dietStore = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["饮食"] || []).length, meals: (d.byMod["饮食"] || []).map((r) => r.value) };
});
ok("饮食写入 store 的 meals", dietStore.n >= 1, JSON.stringify(dietStore));
await page.click("#modBack");
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await page.waitForTimeout(400);
const lampDiet = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const rows = [...document.querySelectorAll("#acctList .acct-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
  return { light: st.light, body: rows.find((x) => x.startsWith("体")), verdict: document.querySelector("#dayVerdict")?.textContent };
});
ok("饮食+睡眠后体账户仍有效", (lampDiet.body || "").length > 1, lampDiet.body);
ok("同一天只涨一档", lampDiet.light === 1, JSON.stringify(lampDiet));

/* 视觉残留：Get Pro / 模块详情关闭 / fab */
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
const noPro = await page.evaluate(() => !document.body.innerHTML.includes("Get Pro"));
ok("页面无 Get Pro", noPro);
await page.evaluate(() => openTE({ mode: "todo", group: "inbox", title: "x", min: 5 }));
await page.waitForTimeout(400);
const te = await page.evaluate(() => ({
  hasPro: document.querySelector("#teOverlay")?.innerText.includes("Get Pro"),
  hasSplit: document.querySelector("#teOverlay")?.innerText.includes("拆解"),
}));
ok("任务编辑器无 Get Pro、有拆解", !te.hasPro && te.hasSplit, JSON.stringify(te));
await page.evaluate(() => { try { closeTE(); } catch (e) {} });
await page.waitForTimeout(300);

/* 模块详情关闭 */
await page.evaluate(() => {
  const card = [...document.querySelectorAll("#screen-today .task-card")].find((c) => c.querySelector(".task-title")?.textContent.trim() === "拉伸");
  card?.querySelector(".task-ic")?.click();
});
await page.waitForTimeout(400);
const sheet = await page.evaluate(() => ({
  open: document.querySelector("#sheetMask")?.classList.contains("show"),
  x: !!document.querySelector("#sheetBox .x"),
}));
ok("模块详情有 .x", sheet.open && sheet.x, JSON.stringify(sheet));
await page.evaluate(() => document.querySelector("#sheetBox .x")?.click());
await page.waitForTimeout(300);
ok("模块详情 .x 能关闭", await page.evaluate(() => !document.querySelector("#sheetMask")?.classList.contains("show")));

await page.screenshot({ path: OUT + "p2-modules.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n模块/视觉校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

