// 日间 / 夜间主题 · 全链路校验（5 个 tab + 模块页 iframe 同步）
// 用法：node tests/verify_theme.mjs
import { spawn } from "node:child_process";
import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";



const SERVER_CODE = `const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();
http.createServer((rq,rs)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
  const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);return rs.end('nf')}
    const t={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    rs.writeHead(200,{'Content-Type':t});rs.end(d);});}).listen(8899,'127.0.0.1');`;
let server = null;
async function up() {
  try { const r = await fetch(BASE + "/index.html"); return r.ok; } catch { return false; }
}
if (!(await up())) {
  server = spawn(process.execPath, ["-e", SERVER_CODE], { cwd: PAGES, stdio: "ignore" });
  for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 200)); if (await up()) break; }
  if (!(await up())) throw new Error("静态服务起不来");
}

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pageErrors = [];
const net4xx = [];
page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) net4xx.push(r.status() + " " + r.url()); });

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail });
  if (!ok && detail) console.error("  ↳ " + detail);
}

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);

/* 1. 默认夜间 */
const dark = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  key: localStorage.getItem("lifeflow-theme"),
  toggles: document.querySelectorAll(".theme-toggle").length,
  bg: getComputedStyle(document.querySelector(".task-card")).backgroundColor,
  text: getComputedStyle(document.querySelector(".task-title")).color,
}));
check("无存档时默认夜间", dark.theme === "dark" && dark.key === null, JSON.stringify(dark));
check("六处主题入口（5 屏 + 模块顶栏）", dark.toggles === 6, String(dark.toggles));

/* 2. 切日间 */
await page.click("#screen-todo .theme-toggle");
await page.waitForTimeout(500);
const light = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  key: localStorage.getItem("lifeflow-theme"),
  icon: document.querySelector("#screen-todo .theme-toggle use").getAttribute("href"),
  body: getComputedStyle(document.body).backgroundColor,
  card: getComputedStyle(document.querySelector(".task-card")).backgroundColor,
  title: getComputedStyle(document.querySelector(".task-title")).color,
  tabbar: getComputedStyle(document.querySelector(".tabbar")).backgroundColor,
  status: getComputedStyle(document.querySelector(".statusbar")).backgroundColor,
  statusFilter: getComputedStyle(document.querySelector(".statusbar svg")).filter,
  iconColor: getComputedStyle(document.querySelector(".task-ic")).color,
  tileFilter: getComputedStyle(document.querySelector(".ob-wide .mi svg")).filter,
}));
check("点一下切到日间", light.theme === "light" && light.key === "light", JSON.stringify(light));
check("日间壳底色=暖奶油", light.body === "rgb(242, 236, 227)", light.body);
check("日间卡片=白 / 正文=暖墨", light.card === "rgb(255, 255, 255)" && light.title === "rgb(38, 34, 30)", JSON.stringify({ card: light.card, title: light.title }));
check("日间底栏=白玻璃", light.tabbar === "rgba(255, 255, 255, 0.88)", light.tabbar);
check("日间状态栏=浅底 + 图标反色", light.status === "rgb(251, 247, 241)" && light.statusFilter === "invert(1)", JSON.stringify({ status: light.status, filter: light.statusFilter }));
check("日间图标随主题反色 / 去提亮", light.iconColor === "rgb(38, 34, 30)" && light.tileFilter === "none", JSON.stringify({ iconColor: light.iconColor, tileFilter: light.tileFilter }));
check("日间按钮图标切换为月亮", light.icon === "#i-moon", light.icon);

/* 3. 持久化 */
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(600);
const persisted = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  icon: document.querySelector("#screen-todo .theme-toggle use").getAttribute("href"),
}));
check("刷新后仍在日间", persisted.theme === "light" && persisted.icon === "#i-moon", JSON.stringify(persisted));

/* 4. 五屏都保留主题 */
for (const tab of ["today", "profile", "lamp"]) {
  await page.evaluate((t) => document.querySelector(`[data-tab="${t}"]`).click(), tab);
  await page.waitForTimeout(250);
  const t = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  check(`日间 · ${tab} 屏保持`, t === "light", t);
}
await page.evaluate(() => document.querySelector("#avatarBtn").click());
await page.waitForTimeout(350);
check("日间 · 记一笔保持 + 有主题入口", await page.evaluate(() =>
  document.documentElement.getAttribute("data-theme") === "light" && !!document.querySelector("#screen-assistant .theme-toggle")
));

/* 5. 模块页跟随 + 壳内切换 */
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(250);
await page.evaluate(() => [...document.querySelectorAll(".ob-wide .mi")].find((x) => x.textContent.includes("穿搭")).click());
await page.waitForTimeout(2200);
const modLight = await page.evaluate(() => {
  const d = document.getElementById("modFrame").contentDocument;
  const sh = d.getElementById("shell-theme");
  return {
    iframe: d.documentElement.getAttribute("data-theme"),
    key: localStorage.getItem("lifeflow-theme"),
    body: getComputedStyle(d.body).backgroundColor,
    card: d.querySelector(".wd-hero") ? getComputedStyle(d.querySelector(".wd-hero")).backgroundColor : null,
    hero: !!d.querySelector(".wd-hero"),
    darkTokens: sh ? sh.textContent.includes("--bg:#0B0F1A") : null,
    chrome: sh ? sh.textContent.includes("display:none") : null,
    topbar: d.querySelector(".topbar") ? getComputedStyle(d.querySelector(".topbar")).display : null,
    toggle: !!document.querySelector(".mod-theme"),
    green: getComputedStyle(d.documentElement).getPropertyValue("--life-green").trim(),
    red: getComputedStyle(d.documentElement).getPropertyValue("--expense-red").trim(),
  };
});
check("日间 · 模块页 iframe 跟随", modLight.iframe === "light" && modLight.key === "light", JSON.stringify(modLight));
check("日间 · 模块页白卡 / 米底", modLight.body === "rgb(250, 246, 240)" && modLight.card === "rgb(255, 255, 255)", JSON.stringify({ body: modLight.body, card: modLight.card }));
check("日间 · 模块页不注入暗色令牌 / 顶栏仍隐藏", modLight.darkTokens === false && modLight.topbar === "none", JSON.stringify({ darkTokens: modLight.darkTokens, topbar: modLight.topbar }));
check("日间 · 模块页语义色是四域日间色", modLight.red === "#B7791F", JSON.stringify({ red: modLight.red, green: modLight.green }));
check("模块顶栏有主题入口", modLight.toggle);

await page.click(".mod-theme");
await page.waitForTimeout(500);
const modDark = await page.evaluate(() => {
  const d = document.getElementById("modFrame").contentDocument;
  const sh = d.getElementById("shell-theme");
  return {
    shell: document.documentElement.getAttribute("data-theme"),
    iframe: d.documentElement.getAttribute("data-theme"),
    body: getComputedStyle(d.body).backgroundColor,
    darkTokens: sh ? sh.textContent.includes("--bg:#0B0F1A") : null,
    key: localStorage.getItem("lifeflow-theme"),
    icon: document.querySelector(".mod-theme use").getAttribute("href"),
  };
});
check("模块内切夜间 · 壳与 iframe 同步", modDark.shell === "dark" && modDark.iframe === "dark" && modDark.body === "rgb(11, 15, 26)", JSON.stringify(modDark));
check("模块内切夜间 · 暗色令牌回来", modDark.darkTokens === true && modDark.key === "dark" && modDark.icon === "#i-sun", JSON.stringify(modDark));
await page.screenshot({ path: OUT + "theme-mod-dark.png" });

await page.click(".mod-theme");
await page.waitForTimeout(500);
check("模块内再切日间", await page.evaluate(() =>
  document.documentElement.getAttribute("data-theme") === "light" &&
  document.getElementById("modFrame").contentDocument.documentElement.getAttribute("data-theme") === "light"
));
await page.screenshot({ path: OUT + "theme-mod-light.png" });

/* 6. 回夜间并持久化 */
await page.click("#modBack");
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
await page.click("#screen-profile .theme-toggle");
await page.waitForTimeout(400);
check("我的页主题入口可切回夜间", await page.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark"));
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(600);
check("刷新后夜间持久", await page.evaluate(() =>
  document.documentElement.getAttribute("data-theme") === "dark" && localStorage.getItem("lifeflow-theme") === "dark"
));

/* 7. 网络 / 错误 */
check("主题链路无 4xx", net4xx.length === 0, net4xx.slice(0, 4).join(" | "));
check("主题链路无 pageerror", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (server) server.kill();

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
console.log(`\n主题校验：${checks.length - failed.length}/${checks.length} PASS`);
process.exit(failed.length ? 1 : 0);

