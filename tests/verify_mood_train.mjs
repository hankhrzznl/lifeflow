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

/* 情绪页 → store → 壳灯/心情格 */
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("情绪")).click());
await page.waitForTimeout(3400);
const moodFrame = page.frames().find((f) => f.url().endsWith("v3/mood.html"));
ok("情绪 iframe 打开", !!moodFrame);
ok("情绪页加载 store", await moodFrame.evaluate(() => !!window.LightStore));
await moodFrame.click('#emoji-picker [data-score="5"]');
await moodFrame.click("#mood-save");
await page.waitForTimeout(1200);
const moodStore = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["情绪记录"] || []).length, tone: (d.byMod["情绪记录"] || []).map((r) => r.value) };
});
ok("情绪写入 store 的 tone", moodStore.n >= 1 && moodStore.tone.includes("good"), JSON.stringify(moodStore));
await page.click("#modBack");
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await page.waitForTimeout(500);
const lampMood = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const rows = [...document.querySelectorAll("#acctList .acct-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
  const todayMood = document.querySelector("#moodRow .mood-btn.today");
  return { light: st.light, bond: rows.find((x) => x.startsWith("情")), today: todayMood?.getAttribute("aria-label"), set: document.querySelectorAll("#moodRow .mood-btn.set").length };
});
ok("情绪回壳情账户有分", (lampMood.bond || "").includes("100"), lampMood.bond);
ok("壳心情格与模块同源", lampMood.set === 1 && (lampMood.today || "").includes("还不错"), JSON.stringify(lampMood));
ok("情绪点亮第一缕", lampMood.light === 1, JSON.stringify(lampMood));

/* 训练页 → store → 壳体 */
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("训练")).click());
await page.waitForTimeout(3400);
const trainFrame = page.frames().find((f) => f.url().endsWith("v3/training.html"));
ok("训练 iframe 打开", !!trainFrame);
ok("训练页加载 store", await trainFrame.evaluate(() => !!window.LightStore));
await trainFrame.click("#warmup-done");
await page.waitForTimeout(300);
await trainFrame.click(".train-check");
await page.waitForTimeout(1200);
const trainStore = await page.evaluate(() => {
  const d = window.LightStore.readDay(window.LightStore.today());
  return { n: (d.byMod["运动"] || []).length, mins: (d.byMod["运动"] || []).map((r) => r.value) };
});
ok("训练写入 store 的 minutes", trainStore.n >= 1, JSON.stringify(trainStore));
await page.click("#modBack");
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await page.waitForTimeout(500);
const lampTrain = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const rows = [...document.querySelectorAll("#acctList .acct-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim());
  return { light: st.light, body: rows.find((x) => x.startsWith("体")), verdict: document.querySelector("#dayVerdict")?.textContent };
});
ok("训练回壳体账户有分", (lampTrain.body || "").length > 1, lampTrain.body);
ok("同日仍只涨一档", lampTrain.light === 1, JSON.stringify(lampTrain));

await page.screenshot({ path: OUT + "p2-mood-train.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n情绪/训练校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

