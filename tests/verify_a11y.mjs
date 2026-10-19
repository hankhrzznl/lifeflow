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
await page.waitForTimeout(800);

const payload = '<img src=x onerror="window.__xss=1">';

/* 1. 输入框 XSS */
await page.fill('.qadd[data-g="inbox"] input', payload);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
const xss1 = await page.evaluate(() => {
  const card = [...document.querySelectorAll("#g-inbox .task-card")].find((c) => c.querySelector(".task-title")?.textContent.includes("img"));
  return { flag: window.__xss === 1, imgs: document.querySelectorAll("#g-inbox img").length, title: card ? card.querySelector(".task-title").textContent : "" };
});
ok("输入标题不执行 HTML", !xss1.flag, String(xss1.flag));
ok("标题按文本显示", xss1.title === '<img src=x onerror="window.__xss=1">', xss1.title);
ok("没有注入 img 元素", xss1.imgs === 0, String(xss1.imgs));

/* 2. 旧任务（带 dom/mod）打开详情不执行 */
await page.evaluate((p) => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}") || {};
  st.todos = st.todos || {};
  st.todos.inbox = st.todos.inbox || [];
  st.todos.inbox.push({ id: 99999, ic: "i-pin", t: p, m: 5, dom: "体能", mod: "饮水" });
  localStorage.setItem("zdLight", JSON.stringify(st));
}, payload);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const task = await page.evaluate(() => {
  const card = document.querySelector('#g-inbox .task-card[data-id="99999"]');
  return card ? { id: card.dataset.id } : null;
});
ok("带 dom/mod 的恶意任务已渲染", !!task, JSON.stringify(task));
await page.evaluate(() => {
  document.querySelector('#g-inbox .task-card[data-id="99999"] .task-ic')?.click();
});
await page.waitForTimeout(400);
const xss2 = await page.evaluate(() => ({
  flag: window.__xss === 1,
  imgs: document.querySelectorAll("#sheetBox img").length,
  title: document.querySelector("#sheetBox .det-title")?.textContent || "",
}));
ok("模块详情不执行 HTML", !xss2.flag, String(xss2.flag));
ok("详情标题按文本显示", xss2.title === '<img src=x onerror="window.__xss=1">', xss2.title);
ok("详情没有注入 img", xss2.imgs === 0, String(xss2.imgs));
await page.evaluate(() => { try { closeSheet(); } catch (e) {} });

/* 3. 可访问名：五个 tab + 记一笔 */
const tabs = ["todo", "today", "profile", "lamp", "assistant"];
const noName = [];
for (const t of tabs) {
  if (t === "assistant") await page.evaluate(() => document.querySelector("#avatarBtn")?.click());
  else await page.evaluate((tab) => document.querySelector(`[data-tab="${tab}"]`)?.click(), t);
  await page.waitForTimeout(300);
  const list = await page.evaluate(() => {
    const vis = (el) => {
      if (!el.offsetParent) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };
    return [...document.querySelectorAll("button")].filter(vis).filter((b) => {
      const txt = (b.textContent || "").trim();
      return !txt && !b.getAttribute("aria-label") && !b.getAttribute("title");
    }).map((b) => (b.className || "").toString().slice(0, 40));
  });
  noName.push(...list.map((x) => t + ":" + x));
}
ok("可见按钮都有可访问名", noName.length === 0, JSON.stringify([...new Set(noName)]));

await page.evaluate(() => document.querySelector('[data-tab="profile"]')?.click());
await page.waitForTimeout(300);
const stickers = await page.evaluate(() => ({
  tag: document.querySelector(".ob-wide .mi")?.tagName,
  n: document.querySelectorAll(".ob-wide button.mi").length,
  labels: [...document.querySelectorAll(".ob-wide .mi")].map((x) => x.textContent.trim()),
}));
ok("15 个贴纸都是 button", stickers.tag === "BUTTON" && stickers.n === 15, JSON.stringify(stickers));
await page.evaluate(() => document.querySelector('[data-tab="lamp"]')?.click());
await page.waitForTimeout(300);
const moodA11y = await page.evaluate(() => ({
  labels: [...document.querySelectorAll("#moodRow .mood-btn")].map((b) => b.getAttribute("aria-label")),
  today: document.querySelector("#moodRow .mood-btn.today")?.getAttribute("aria-label"),
  week: [...document.querySelectorAll("#weekStrip .wk-d")].length,
}));
ok("心情按钮有可访问名", moodA11y.labels.every((x) => !!x), JSON.stringify(moodA11y.labels.slice(0, 3)));
ok("今天心情标明今天", (moodA11y.today || "").includes("今天"), moodA11y.today);
await page.evaluate(() => document.querySelector('[data-tab="profile"]')?.click());
await page.waitForTimeout(300);
const weekAria = await page.evaluate(() => [...document.querySelectorAll("#weekstrip .wd")].map((b) => b.getAttribute("aria-label")));
ok("周条按钮有日期名", weekAria.length === 7 && weekAria.every((x) => !!x), JSON.stringify(weekAria));

/* 4. 焦点可见 */
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press("Tab");
const focus = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = getComputedStyle(el);
  return { tag: el?.tagName, cls: (el?.className || "").toString().slice(0, 30), visible: el?.matches?.(":focus-visible"), outline: cs.outlineStyle + " " + cs.outlineWidth, outlineColor: cs.outlineColor };
});
ok("键盘焦点有 outline", focus.visible && focus.outline.includes("solid") && !focus.outline.includes("0px"), JSON.stringify(focus));

/* 5. 减少动效 */
await page.emulateMedia({ reducedMotion: "reduce" });
const rm = await page.evaluate(() => {
  const el = document.querySelector(".toast") || document.querySelector(".fade-up") || document.querySelector(".task-card");
  const cs = getComputedStyle(el);
  return { transition: cs.transitionDuration, animation: cs.animationDuration };
});
ok("prefers-reduced-motion 生效", parseFloat(rm.transition) <= 0.001 && parseFloat(rm.animation) <= 0.001, JSON.stringify(rm));
await page.emulateMedia({ reducedMotion: "no-preference" });

/* 6. 对比度 / 热区 / 状态栏 */
const contrast = async (theme) => page.evaluate((t) => {
  document.querySelector(`#screen-todo .theme-toggle`)?.click();
  return null;
}, theme).catch(() => null);
// 先回到日间
const isLight = await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "light");
if (!isLight) await page.evaluate(() => document.querySelector("#screen-todo .theme-toggle")?.click());
await page.waitForTimeout(300);
const colorData = async () => page.evaluate(() => {
  const parse = (c) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  const lum = (c) => { const [r, g, b] = parse(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg); return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)); };
  const inp = document.querySelector("#screen-todo .qadd input");
  const ph = getComputedStyle(inp, "::placeholder").color;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#FAF6F0";
  const txt3 = getComputedStyle(document.documentElement).getPropertyValue("--txt3").trim();
  return { theme: document.documentElement.getAttribute("data-theme"), ph, bg, txt3 };
});
const lightC = await colorData();
ok("日间占位符对比度 ≥ 4.5", (() => {
  const toRgb = (c) => { if (String(c).startsWith("#")) { const h = c.slice(1); const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h; return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]; } return (String(c).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); };
  const lum = (c) => { const [r, g, b] = toRgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return ratio(lightC.ph, lightC.bg) >= 4.5;
})(), JSON.stringify(lightC));
await page.evaluate(() => document.querySelector("#screen-todo .theme-toggle")?.click());
await page.waitForTimeout(300);
const darkC = await colorData();
ok("夜间占位符对比度 ≥ 4.5", (() => {
  const toRgb = (c) => { if (String(c).startsWith("#")) { const h = c.slice(1); const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h; return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]; } return (String(c).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); };
  const lum = (c) => { const [r, g, b] = toRgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return ratio(darkC.ph, darkC.bg) >= 4.5;
})(), JSON.stringify(darkC));

const tap = await page.evaluate(() => {
  const after = (sel) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el, "::after"); return cs.content + " inset " + cs.top + " " + cs.left; };
  return { check: after(".ring-check"), add: after(".js-add"), more: after(".js-more"), status: document.querySelector(".statusbar")?.getAttribute("aria-hidden") };
});
ok("小控件有扩热区", (tap.check || "").includes("inset") && !(tap.check || "").includes("0px") && (tap.more || "").includes("inset"), JSON.stringify(tap));
ok("状态栏是装饰层", tap.status === "true", String(tap.status));

await page.screenshot({ path: OUT + "p1-a11y.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n安全/可访问性校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);


