import { chromium, EXE, BASE, OUT } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

const today = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.evaluate((today) => {
  localStorage.setItem("zdLight", JSON.stringify({
    v: 2, light: 5, moods: {}, logs: {},
    plan: { anytime: [], morning: [{ id: 901, t: "周计划测试任务", m: 30, dom: "体能", dates: [today], done: false }], noon: [], day: [], evening: [] },
    todos: { high: [], mid: [], low: [], inbox: [] }
  }));
}, today);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
const mobile = await page.evaluate(() => ({
  task: document.querySelector("#p-morning .task-title")?.textContent,
  light: JSON.parse(localStorage.getItem("zdLight") || "{}").light,
}));
ok("手机端读到计划任务", mobile.task === "周计划测试任务", JSON.stringify(mobile));

/* 手机端「本周计划」只读 */
await page.evaluate(() => { try { go('today'); } catch (e) {} });
await page.waitForTimeout(300);
await page.click("#openWeek");
await page.waitForTimeout(400);
const weekPlan = await page.evaluate(() => ({
  rows: document.querySelectorAll("#sheetBox .wk-row").length,
  task: document.querySelector("#sheetBox .wk-task span")?.textContent,
  sub: document.querySelector("#sheetBox .sheet-sub")?.textContent,
}));
ok("手机端本周计划 7 行", weekPlan.rows === 7, JSON.stringify(weekPlan));
ok("手机端本周计划读到同一条任务", weekPlan.task === "周计划测试任务", weekPlan.task);
ok("手机端本周计划标注只读", /只读/.test(weekPlan.sub || ""), weekPlan.sub);
await page.evaluate(() => { try { closeSheet(); } catch (e) {} });

/* 电脑端：读同一份 zdLight 的 plan/todos */
await page.goto(BASE + "/desktop.html", { waitUntil: "load" });
await page.waitForTimeout(1100);
const desk = await page.evaluate(() => ({
  realm: document.querySelector(".gn-realm")?.textContent,
  blk: document.querySelector("#stage-day .blk .b-t")?.textContent,
  head: document.querySelector("#stage-day .dy-head .dh")?.textContent,
}));
ok("电脑端显示手机灯值 5", /5 光/.test(desk.realm || ""), desk.realm);
ok("电脑端今天读手机计划任务", desk.blk === "周计划测试任务", JSON.stringify(desk));
ok("电脑端日视图是今天", (desk.head || "").includes(String(new Date().getDate())), desk.head);

/* 电脑端勾完成 → persist 写回 zdLight.plan */
await page.click("#stage-day .blk");
await page.waitForTimeout(500);
const after = await page.evaluate(() => {
  const z = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { done: !!z.plan?.morning?.[0]?.done, hasPlan: !!z.plan, hasTodos: !!z.todos };
});
ok("电脑端勾完成写回 zdLight.plan", after.done === true && after.hasPlan && after.hasTodos, JSON.stringify(after));

/* 电脑端日夜：与手机共用 lifeflow-theme */
const deskTheme = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  hasToggle: !!document.getElementById("themeToggle"),
}));
ok("电脑端有日夜切换", deskTheme.hasToggle === true, JSON.stringify(deskTheme));
await page.click("#themeToggle");
await page.waitForTimeout(300);
const deskLight = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  key: localStorage.getItem("lifeflow-theme"),
  bg: getComputedStyle(document.body).backgroundColor,
}));
ok("电脑端切日间并落 lifeflow-theme", deskLight.theme === "light" && deskLight.key === "light", JSON.stringify(deskLight));
ok("电脑端日间底色=暖奶油", deskLight.bg === "rgb(247, 244, 239)", deskLight.bg);
await page.click("#themeToggle");
await page.waitForTimeout(300);
ok("电脑端可切回夜间", (await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark");

/* 回手机端：已完成任务默认被过滤，先打开「显示已完成」再断言（要在拖走任务之前） */
await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.waitForTimeout(900);
await page.evaluate(() => { if (typeof toggleViewDone === "function") toggleViewDone(); });
await page.waitForTimeout(300);
const mobileDone = await page.evaluate(() => {
  const card = document.querySelector("#p-morning .task-card");
  return { cls: card?.className, title: card?.querySelector(".task-title")?.textContent };
});
ok("手机端看到任务已完成", /done/.test(mobileDone.cls || ""), JSON.stringify(mobileDone));
/* 再回电脑端做周视图/拖拽 */
await page.goto(BASE + "/desktop.html", { waitUntil: "load" });
await page.waitForTimeout(900);

/* 电脑端本周：周视图 7 列、可翻下周、可回今天 */
await page.click('#segDW [data-v="week"]');
await page.waitForTimeout(400);
const week = await page.evaluate(() => ({
  cols: document.querySelectorAll("#stage-week .wk-col").length,
  sub: document.querySelector("#vSub")?.textContent,
  week: document.querySelector("#v-week")?.className,
}));
ok("电脑端周视图 7 列", week.cols === 7, JSON.stringify(week));
await page.click("#wNext");
await page.waitForTimeout(400);
const nextWeek = await page.evaluate(() => ({
  sub: document.querySelector("#vSub")?.textContent,
  cols: document.querySelectorAll("#stage-week .wk-col").length,
}));
ok("电脑端可翻到下周", (nextWeek.sub || "") !== (week.sub || "") && nextWeek.cols === 7, JSON.stringify(nextWeek));
await page.click("#wThis");
await page.waitForTimeout(400);
const backToday = await page.evaluate(() => document.querySelector("#vSub")?.textContent);
ok("电脑端可回到今天", (backToday || "").includes(String(new Date().getDate())), backToday);

/* 周视图点某一天 → 进那天的日视图 */
await page.click('#segDW [data-v="week"]');
await page.waitForTimeout(300);
await page.click("#stage-week .wk-col:nth-child(3)");
await page.waitForTimeout(400);
const picked = await page.evaluate(() => ({
  dayVisible: !!document.querySelector("#v-day")?.classList.contains("on"),
  head: document.querySelector("#stage-day .dy-head .dh")?.textContent,
  sub: document.querySelector("#vSub")?.textContent,
}));
ok("周视图点某天进入日视图", picked.dayVisible === true, JSON.stringify(picked));
ok("日视图标题是选中的那天", /月/.test(picked.head || "") && /\d/.test(picked.head || ""), picked.head);
ok("顶栏副标题跟随选中的那天", /月/.test(picked.sub || "") && /\d/.test(picked.sub || ""), picked.sub);

/* 周视图拖墨点到另一天 → 写回 zdLight.plan */
await page.click('#segDW [data-v="week"]');
await page.waitForTimeout(300);
const dragId = await page.evaluate(() => document.querySelector("#stage-week .wk-dot[data-id]")?.dataset.id);
if (dragId) {
  await page.dragAndDrop(`#stage-week .wk-dot[data-id="${dragId}"]`, "#stage-week .wk-col:nth-child(5)");
  await page.waitForTimeout(500);
  const moved = await page.evaluate(() => {
    const z = JSON.parse(localStorage.getItem("zdLight") || "{}");
    const hits = [];
    for (const g in (z.plan || {})) (z.plan[g] || []).forEach((x) => { if (String(x.id) === "901") hits.push({ g, d: x.dates && x.dates[0] }); });
    return hits;
  });
  ok("周视图拖墨点换天写回 zdLight", moved.length === 1 && moved[0].d !== today, JSON.stringify(moved));
}

/* 月视图：42 格、标出今天、点某天回日视图、可翻月 */
await page.click('#segDW [data-v="month"]');
await page.waitForTimeout(400);
const month = await page.evaluate(() => ({
  cells: document.querySelectorAll("#stage-month .mo-cell").length,
  today: document.querySelectorAll("#stage-month .mo-cell.today").length,
  cap: document.querySelector("#stage-month .mo-cap")?.textContent,
  sub: document.querySelector("#vSub")?.textContent,
}));
ok("电脑端月视图 42 格", month.cells === 42, JSON.stringify(month));
ok("月视图标出今天且只标一个", month.today === 1, JSON.stringify(month));
ok("月视图顶栏是本月的年月", /年/.test(month.sub || "") && /月/.test(month.sub || ""), month.sub);
const moSum = await page.evaluate(() => {
  const cells = [...document.querySelectorAll("#stage-month .mo-cell:not(.out)")];
  const total = cells.reduce((a, c) => a + Number(c.querySelector(".mo-n")?.textContent || 0), 0);
  return { total, sum: document.querySelector("#stage-month .mo-sum")?.textContent || "" };
});
ok("月视图汇总与格子条数一致", moSum.total > 0 && moSum.sum.replace(/\s+/g, "").includes(`${moSum.total}项`), JSON.stringify(moSum));
ok("月视图汇总含完成率", /完成率/.test(moSum.sum), moSum.sum);
await page.click("#wNext");
await page.waitForTimeout(400);
const nextMonth = await page.evaluate(() => document.querySelector("#vSub")?.textContent);
ok("月视图可翻到下月", (nextMonth || "") !== (month.sub || ""), nextMonth);
await page.click("#stage-month .mo-cell:not(.out)");
await page.waitForTimeout(400);
const monthPicked = await page.evaluate(() => ({
  day: !!document.querySelector("#v-day")?.classList.contains("on"),
  head: document.querySelector("#stage-day .dy-head .dh")?.textContent,
}));
ok("月视图点某天进入日视图", monthPicked.day === true && /月/.test(monthPicked.head || ""), JSON.stringify(monthPicked));

/* IA：电脑端只留 日/周/月 + 成长，方向/四域归手机端产品模型 */
const deskNav = await page.evaluate(() => [...document.querySelectorAll(".nav .nv[data-v]")].map((b) => b.dataset.v));
ok("电脑端不再有方向/四域", !deskNav.includes("goals") && !deskNav.includes("domains"), JSON.stringify(deskNav));
ok("电脑端导航只有日周月成长", deskNav.join(",") === "day,week,month,growth", JSON.stringify(deskNav));

await page.screenshot({ path: OUT + "plan-desktop.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n计划回路校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
