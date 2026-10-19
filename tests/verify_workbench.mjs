import { chromium, EXE, BASE, OUT } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();

await page.goto(BASE + "/workbench/index.html", { waitUntil: "load" });
await page.evaluate((today) => {
  localStorage.setItem("zdLight", JSON.stringify({
    v: 2, light: 5, moods: { [today]: "good" }, logs: {}, todos: {},
    plan: { anytime: [], morning: [{ id: 911, t: "工作台只读计划", m: 45, dom: "智识", dates: [today], done: false }], noon: [], day: [], evening: [] }
  }));
}, today);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const wb = await page.evaluate(() => ({
  title: document.title,
  brand: document.querySelector(".brand-t")?.textContent,
  sub: document.querySelector(".brand-s")?.textContent,
  light: document.querySelector("#miniLight")?.textContent,
  mood: document.querySelector("#miniMood")?.textContent,
  nav: document.querySelectorAll("#nav .nav-i").length,
}));
ok("工作台标题是执灯人", /执灯人/.test(wb.title || ""), wb.title);
ok("工作台品牌是执灯人 · 个人工作台", wb.brand === "执灯人" && wb.sub === "个人工作台", JSON.stringify(wb));
ok("工作台只读手机灯值 5 光", wb.light === "5 光", wb.light);
ok("工作台只读手机心情", wb.mood === "好", wb.mood);
ok("工作台保留自己的导航", wb.nav === 4, String(wb.nav));

/* 今日计划：只读电脑端 zdLight.plan */
const plan = await page.evaluate(() => ({
  rows: document.querySelectorAll("#view-today .plan-card .ps-row").length,
  task: document.querySelector("#view-today .plan-card .ps-t")?.textContent,
  note: [...document.querySelectorAll(".sec-h .h")].map((x) => x.textContent).find((t) => /只读/.test(t || "")) || "",
}));
ok("工作台今日计划读到电脑端的任务", plan.rows === 1 && plan.task === "工作台只读计划", JSON.stringify(plan));
ok("工作台今日计划标注只读", /只读/.test(plan.note), plan.note);

/* 今日日程：6 条时间轴，最多一个「此刻」 */
const tl = await page.evaluate(() => ({
  rows: document.querySelectorAll("#view-today .tl-row").length,
  now: document.querySelectorAll("#view-today .tl-now").length,
  noon: getComputedStyle(document.documentElement).getPropertyValue("--slot-noon").trim(),
}));
ok("工作台时间轴 6 条", tl.rows === 6, JSON.stringify(tl));
ok("时间轴最多一个「此刻」", tl.now <= 1, String(tl.now));
ok("暗色中午时段色是月白", tl.noon === "#E8EAF2", tl.noon);

/* 日复盘：一天尺度，不再做周复盘 */
await page.click('#nav [data-view="review"]');
await page.waitForTimeout(500);
const rv = await page.evaluate(() => ({
  title: document.querySelector(".tb-title")?.textContent,
  text: document.querySelector("#view-review")?.innerText || "",
  plan: document.querySelectorAll("#view-review .ps-row").length,
}));
ok("工作台复盘是日尺度", rv.title === "日复盘" && !/七天走势|本周关卡/.test(rv.text), JSON.stringify({ title: rv.title }));
ok("日复盘含明天先做与今日计划", /明日先做/.test(rv.text) && /今日计划/.test(rv.text) && rv.plan === 1, JSON.stringify({ plan: rv.plan }));
await page.click('#nav [data-view="today"]');
await page.waitForTimeout(300);

/* 工作台日夜：与手机/桌面共用 lifeflow-theme */
await page.click("#themeToggle");
await page.waitForTimeout(300);
const wbLight = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  key: localStorage.getItem("lifeflow-theme"),
  bg: getComputedStyle(document.body).backgroundColor,
  noon: getComputedStyle(document.documentElement).getPropertyValue("--slot-noon").trim(),
}));
ok("工作台可切日间并落 lifeflow-theme", wbLight.theme === "light" && wbLight.key === "light", JSON.stringify(wbLight));
ok("工作台日间底色=暖奶油", wbLight.bg === "rgb(247, 244, 239)", wbLight.bg);
ok("日间中午时段色不再是月白", wbLight.noon === "#26221E", wbLight.noon);
await page.click("#themeToggle");
await page.waitForTimeout(300);
ok("工作台可切回夜间", (await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark");

/* 键盘可达：Tab 到的按钮有焦点环 */
await page.evaluate(() => document.body.focus());
await page.keyboard.press("Tab");
const focus = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = el ? getComputedStyle(el) : null;
  return { tag: el?.tagName, outline: cs?.outlineStyle, width: cs?.outlineWidth };
});
ok("工作台键盘焦点有可见轮廓", focus.tag === "BUTTON" && focus.outline === "solid", JSON.stringify(focus));

await page.screenshot({ path: OUT + "workbench.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n工作台校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);

