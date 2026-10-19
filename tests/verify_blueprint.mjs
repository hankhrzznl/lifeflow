// 蓝本两端终检 · 四屏 IA 版
// 用法：node tests/verify_blueprint.mjs（需先在 pages/ 起 http://127.0.0.1:8899）
import { readFileSync } from "node:fs";
import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";


/* ── 1. 语法块逐块校验 ── */
const syntax = [];
for (const file of ["index.html", "desktop.html"]) {
  const src = readFileSync(PAGES + file, "utf8");
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0, bad = 0;
  while ((m = re.exec(src))) {
    n++;
    try { new Function(m[1]); } catch (e) { bad++; console.error(`SYNTAX ${file} 第 ${n} 块：${String(e).split("\n")[0]}`); }
  }
  syntax.push({ file, n, bad });
  console.log(`SYNTAX ${file}: ${n} 块 / ${bad} 错`);
}

const browser = await chromium.launch({ executablePath: EXE });

async function openPage(url, viewport) {
  const page = await browser.newPage({ viewport });
  const errs = [], net = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.status() >= 400) net.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(700);
  return { page, errs, net };
}

/* ===== 手机端：四屏 ===== */
const m = await openPage(BASE + "/index.html", { width: 390, height: 844 });
await m.page.evaluate(() => localStorage.removeItem("zdLight"));
await m.page.reload({ waitUntil: "load" });
await m.page.waitForTimeout(600);

const tabs = await m.page.evaluate(() =>
  [...document.querySelectorAll(".tabbar .tab")].map((b) => b.getAttribute("aria-label"))
);
const todoInfo = await m.page.evaluate(() => ({
  title: document.querySelector(".sug-head h2")?.textContent,
  count: document.querySelectorAll("#sugList .task-card").length,
  pageTitle: document.title,
}));

// 勾一件 → 光要真的涨
await m.page.evaluate(() => document.querySelector(".js-check")?.click());
await m.page.waitForTimeout(400);
const afterCheck = await m.page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, applied: st.dayApplied?.step, shifted: !!(st.shiftLog && Object.keys(st.shiftLog).length) };
});

// 灯页
await m.page.evaluate(() => document.querySelector('[data-tab="lamp"]').click());
await m.page.waitForTimeout(500);
const lamp = await m.page.evaluate(() => ({
  sub: document.querySelector("#lampSub")?.textContent,
  gap: document.querySelector("#lampGap")?.textContent,
  now: document.querySelector("#lampNow")?.textContent,
  verdict: document.querySelector("#dayVerdict")?.textContent,
  foot: document.querySelector("#dayFoot")?.textContent,
  acctN: document.querySelectorAll(".acct-row").length,
  weekCells: document.querySelectorAll(".wk-d").length,
  gate: document.querySelector("#gateTitle")?.textContent,
  hasMood: !!document.querySelector("#screen-lamp #moodRow"),
}));
await m.page.screenshot({ path: OUT + "final-lamp.png", fullPage: true });

// 情绪打卡（灯页）→ 进 logs
const logsBefore = await m.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("zdLight") || "{}").logs || {}).reduce((a, b) => a + b, 0));
await m.page.evaluate(() => document.querySelector(".mood-btn.today")?.click());
await m.page.waitForTimeout(400);
const logsAfter = await m.page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("zdLight") || "{}").logs || {}).reduce((a, b) => a + b, 0));

// 记一笔
await m.page.evaluate(() => document.querySelector("#avatarBtn").click());
await m.page.waitForTimeout(400);
await m.page.fill("#recInput", "终检：写一句看它落不落库");
await m.page.evaluate(() => document.querySelector('[data-tone="good"]')?.click());
await m.page.evaluate(() => document.querySelector("#recSave").click());
await m.page.waitForTimeout(500);
const rec = await m.page.evaluate(() => ({
  cnt: document.querySelector("#recCount")?.textContent,
  rows: [...document.querySelectorAll(".rec-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()),
  saved: Object.values(JSON.parse(localStorage.getItem("zdLight") || "{}").notes || {}).flat().length,
  back: !!document.querySelector("#assistantBack"),
}));
await m.page.screenshot({ path: OUT + "final-record.png", fullPage: true });

// 我的
await m.page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await m.page.waitForTimeout(400);
const prof = await m.page.evaluate(() => ({
  tier: document.querySelector("#planetTier")?.textContent,
  days: document.querySelector("#planetDays")?.textContent,
  tierline: document.querySelector("#tierLine")?.textContent,
  streak: document.querySelector("#st-streak")?.textContent,
  week: document.querySelector("#st-done")?.textContent,
  all: document.querySelector("#st-all")?.textContent,
  hasMood: !!document.querySelector("#screen-profile #moodRow"),
  hasGate: !!document.querySelector("#screen-profile .gate-row"),
  rules: document.querySelectorAll(".rule-card li").length,
}));
await m.page.screenshot({ path: OUT + "final-profile.png", fullPage: true });

// 方向层残留
const legacy = await m.page.evaluate(() => ({
  goalsScreen: !!document.querySelector("#screen-goals"),
  words: ["目标在这里", "归属方向", "减脂 5 公斤", "方向"].filter((w) => document.body.innerText.includes(w)),
}));

if (m.errs.length) console.error("手机端控制台:", m.errs);
if (m.net.length) console.error("手机端 4xx:", m.net);

/* ===== 电脑端：成长视图（未改动，做回归） ===== */
const d = await openPage(BASE + "/desktop.html", { width: 1440, height: 900 });
await d.page.click('.nv[data-v="growth"]');
await d.page.waitForTimeout(800);
const g = await d.page.evaluate(() => ({
  seal: document.querySelector(".gh-seal")?.textContent,
  realm: document.querySelector(".gn-realm")?.textContent,
  track: [...document.querySelectorAll(".g-name")].map((x) => x.textContent),
  templates: typeof REALM_SVGS !== "undefined" ? REALM_SVGS.length : -1,
  paths: document.querySelectorAll(".gh-right svg path").length,
  title: document.title,
}));
if (d.errs.length) console.error("电脑端控制台:", d.errs);
if (d.net.length) console.error("电脑端 4xx:", d.net);
await browser.close();

/* ── 结论 ── */
const checks = [
  ["四屏为 待办/今天/我的/灯", JSON.stringify(tabs) === JSON.stringify(["待办", "今天", "我的", "灯"])],
  ["手机端标题为「执灯人 · 手机端」", todoInfo.pageTitle === "执灯人 · 手机端"],
  ["待照见 3 处", todoInfo.count === 3],
  ["勾一件 → 光真的涨一缕", afterCheck.light === 1 && afterCheck.applied === 1],
  ["光的走向进 shiftLog", afterCheck.shifted],
  ["灯页有段位与光", /拾光|凝露|悬河|鉴台/.test(lamp.sub ?? "")],
  ["灯页距离=4-光", Number(lamp.gap) === 4 - afterCheck.light],
  ["灯页本级读数一致", (lamp.now ?? "").includes(String(afterCheck.light))],
  ["灯页判定结论存在", !!lamp.verdict && !!lamp.foot],
  ["灯页四账户行=4", lamp.acctN === 4],
  ["灯页本周点阵=7 格", lamp.weekCells === 7],
  ["灯页承载周关卡", /本周关卡/.test(lamp.gate ?? "")],
  ["情绪卡已迁到灯页", lamp.hasMood],
  ["情绪打卡 → logs 增加", logsAfter === logsBefore + 1],
  ["记一笔列表=1 条", rec.cnt === "1 条"],
  ["记一笔正文落库", (rec.rows[0] ?? "").includes("终检")],
  ["记一笔写入 notes", rec.saved === 1],
  ["我的页段位 v2.0", /拾光|凝露|悬河|鉴台/.test(prof.tier ?? "")],
  ["我的页有段位区间", /第 \d+–\d+ 级/.test(prof.tierline ?? "")],
  ["我的页不再承载情绪卡", !prof.hasMood],
  ["我的页不再承载周关卡", !prof.hasGate],
  ["我的页有规则说明 5 条", prof.rules === 5],
  ["方向屏已下线", !legacy.goalsScreen],
  ["方向文案零残留", legacy.words.length === 0],
  ["手机端控制台零错", m.errs.length === 0],
  ["手机端无 4xx", m.net.length === 0],
  ["电脑端标题为「执灯人 · 电脑端」", g.title === "执灯人 · 电脑端"],
  ["电脑端境印「段位 · 段内级」", /（拾光|凝露|悬河|鉴台） · /.test(g.seal ?? "")],
  ["电脑端四段位轨迹", g.track.length === 4],
  ["电脑端四张立绘模板齐备", g.templates === 4 && g.paths >= 20],
  ["电脑端控制台零错", d.errs.length === 0],
  ["电脑端无 4xx", d.net.length === 0],
  ["语法块零错", syntax.every((s) => s.bad === 0)],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\n终检：${checks.length - failed.length}/${checks.length} PASS`);
process.exit(failed.length ? 1 : 0);
