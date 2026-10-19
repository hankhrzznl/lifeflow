import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION_RESET")) errors.push("console:" + m.text()); });
globalThis.__page = page;

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);

const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

const s0 = await page.evaluate(() => {
  const now = new Date();
  const p = (n) => (n < 10 ? "0" + n : "" + n);
  const today = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
  const pads = [...document.querySelectorAll(".wd")].map((x) => x.textContent.replace(/[^\d]/g, ""));
  return {
    today,
    title: document.querySelector("#dayTitle")?.textContent,
    month: document.querySelector("#monthBtn")?.textContent.trim(),
    week: pads,
    selected: document.querySelector(".wd.sel")?.getAttribute("data-date"),
    planTitles: [...document.querySelectorAll("#p-morning .task-title, #p-evening .task-title, #p-anytime .task-title")].map((x) => x.textContent.trim()),
    status: document.querySelector(".sb-time span")?.textContent,
    moodLabels: [...document.querySelectorAll("#moodRow .mood-col span")].map((x) => x.textContent),
    moodToday: document.querySelectorAll("#moodRow .mood-btn.today").length,
    moodFuture: document.querySelectorAll("#moodRow .mood-btn.is-future").length,
    moods: JSON.parse(localStorage.getItem("zdLight") || "{}").moods,
  };
});
ok("今天屏选中今天", s0.selected === s0.today, JSON.stringify({ selected: s0.selected, today: s0.today }));
ok("周条跟今天（周一–周日 7 格）", s0.week.length === 7, JSON.stringify(s0.week));
ok("周条含今天", s0.week.includes(String(+s0.today.split("-")[2])), s0.week.join(","));
ok("标题是今天星期", s0.title === ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][new Date().getDay()], s0.title);
ok("月份是当前月", s0.month.includes(new Date().getFullYear() + " 年") && s0.month.includes((new Date().getMonth() + 1) + " 月"), s0.month);
ok("种子任务在今天的日程里", s0.planTitles.includes("拉伸") && s0.planTitles.includes("散步"), JSON.stringify(s0.planTitles));
ok("状态栏是真实时间", /^\d{2}:\d{2}$/.test(s0.status) && s0.status !== "01:02", s0.status);
ok("心情周一–周日", JSON.stringify(s0.moodLabels) === JSON.stringify(["一","二","三","四","五","六","日"]), JSON.stringify(s0.moodLabels));
ok("只有今天可编辑", s0.moodToday === 1, String(s0.moodToday));
ok("旧 mood 数组已迁移为空", !s0.moods || typeof s0.moods === "object", JSON.stringify(s0.moods));

/* 点今天心情 → 记录 +1；点未来/过去不改 */
const logs0 = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("zdLight") || "{}").logs || {}).reduce((a, b) => a + b, 0));
await page.evaluate(() => document.querySelector("#moodRow .mood-btn.today")?.click());
await page.waitForTimeout(400);
const afterToday = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const d = new Date();
  const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  return { logs: Object.values(st.logs || {}).reduce((a, b) => a + b, 0), mood: st.moods?.[k], set: document.querySelector("#moodRow .mood-btn.set")?.getAttribute("data-date") };
});
ok("点今天 → logs +1", afterToday.logs === logs0 + 1, JSON.stringify({ before: logs0, after: afterToday.logs }));
ok("点今天 → moods[today] 有值", !!afterToday.mood, JSON.stringify(afterToday));
const pastBtn = await page.evaluate(() => {
  const today = document.querySelector("#moodRow .mood-btn.today")?.getAttribute("data-date");
  const btns = [...document.querySelectorAll("#moodRow .mood-btn")];
  const idx = btns.findIndex((b) => b.getAttribute("data-date") === today);
  return btns[idx - 1]?.getAttribute("data-date") || "";
});
const pastBefore = await page.evaluate((d) => JSON.parse(localStorage.getItem("zdLight") || "{}").moods?.[d] || null, pastBtn);
const logsBeforePast = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("zdLight") || "{}").logs || {}).reduce((a, b) => a + b, 0));
if (pastBtn) await page.evaluate((d) => document.querySelector(`#moodRow .mood-btn[data-date="${d}"]`)?.click(), pastBtn);
await page.waitForTimeout(300);
const pastAfter = await page.evaluate((d) => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { mood: st.moods?.[d] || null, logs: Object.values(st.logs || {}).reduce((a, b) => a + b, 0) };
}, pastBtn);
ok("点过去 → 不改 mood", pastAfter.mood === pastBefore, JSON.stringify({ before: pastBefore, after: pastAfter.mood }));
ok("点过去 → 不加 logs", pastAfter.logs === logsBeforePast, JSON.stringify({ before: logsBeforePast, after: pastAfter.logs }));

/* 记录页 tone 写同一个 moods */
await page.evaluate(() => document.querySelector("#avatarBtn").click());
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#recChips .rec-chip[data-tone="good"]')?.click());
await page.evaluate(() => { const i = document.querySelector("#recInput"); i.value = "P1-4 mood test"; i.dispatchEvent(new Event("input", { bubbles: true })); });
await page.evaluate(() => document.querySelector("#recSave")?.click());
await page.waitForTimeout(400);
const recMood = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const d = new Date();
  const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  return { mood: st.moods?.[k], set: document.querySelector("#moodRow .mood-btn.set")?.getAttribute("data-date") };
});
ok("记录 tone 写入 moods[today]", recMood.mood === "good", JSON.stringify(recMood));
ok("记录后今天格是 set", recMood.set === s0.today, JSON.stringify(recMood));

/* 刷新保留 */
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const persisted = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const d = new Date();
  const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  return { mood: st.moods?.[k], set: document.querySelector("#moodRow .mood-btn.set")?.getAttribute("data-date") };
});
ok("刷新后 mood 保留", persisted.mood === "good", JSON.stringify(persisted));

await page.screenshot({ path: OUT + "p1-mood.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n时钟/心情校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
