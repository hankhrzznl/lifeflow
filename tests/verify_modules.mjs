// 全链路校验 · 日程页 15 个模块贴纸 + 穿搭模块行为
// 用法：node tests/verify_modules.mjs
// 自行确保 pages/ 在 http://127.0.0.1:8899 可访问（未起则脚本内起一个）
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";



/* ── 0. 静态检查：wardrobe.html 语法 / 硬编码颜色 / 禁用词 ── */
const wdSrc = readFileSync(PAGES + "v3/wardrobe.html", "utf8");
const reScript = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let sm, wdBad = 0, wdBlocks = 0;
while ((sm = reScript.exec(wdSrc))) {
  wdBlocks++;
  try { new Function(sm[1]); } catch (e) { wdBad++; console.error("SYNTAX wardrobe 块 " + wdBlocks + "：" + String(e).split("\n")[0]); }
}
const styleBlocks = [...wdSrc.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const customCss = styleBlocks[styleBlocks.length - 1];
const hardColors = [...customCss.matchAll(/(?:#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/g)].map((m) => m[0]);
const visibleText = wdSrc.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
const banned = ["加油", "努力", "自律", "坚持", "失败", "掌控", "等等", "航线", "领航", "今日格子", "功候", "心魔", "渡劫", "慧宠", "无相镜"];
const bannedHit = banned.filter((w) => visibleText.includes(w));
const aiHit = /\bAI\b/.test(visibleText);
const syntaxCheck = { blocks: wdBlocks, bad: wdBad };
console.log(`SYNTAX wardrobe.html: ${wdBlocks} 块 / ${wdBad} 错`);
console.log(`CSS 自定义块硬编码颜色: ${hardColors.length ? hardColors.join(",") : "0"}`);
console.log(`禁用词命中: ${bannedHit.length ? bannedHit.join(",") : "0"}${aiHit ? " + AI" : ""}`);

/* ── 1. 静态服务 ── */
const SERVER_CODE = `const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();
http.createServer((rq,rs)=>{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
  const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);return rs.end('nf')}
    const t={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    rs.writeHead(200,{'Content-Type':t});rs.end(d);});}).listen(8899,'127.0.0.1');`;
let server = null;
async function serverUp() {
  try { const r = await fetch(BASE + "/index.html"); return r.ok; } catch { return false; }
}
if (!(await serverUp())) {
  server = spawn(process.execPath, ["-e", SERVER_CODE], { cwd: PAGES, stdio: "ignore" });
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await serverUp()) break;
  }
  if (!(await serverUp())) throw new Error("静态服务起不来");
  console.log("已自起静态服务 127.0.0.1:8899");
} else {
  console.log("复用已在运行的 127.0.0.1:8899");
}

/* ── 2. 浏览器 ── */
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pageErrors = [];
const net4xx = [];
const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("response", (r) => { if (r.status() >= 400) net4xx.push(`${r.status()} ${r.url().replace(BASE, "")}`); });

/* 期望：贴纸名 → v3 页面（来自交接文档 §1） */
const EXPECT = [
  ["情绪", "v3/mood.html"],
  ["睡眠", "v3/sleep.html"],
  ["饮水", "v3/water.html"],
  ["训练", "v3/training.html"],
  ["饮食", "v3/diet.html"],
  ["久坐", "v3/posture.html"],
  ["吃药", "v3/medication.html"],
  ["功法养生", "v3/wellness.html"],
  ["冥想", "v3/wellness.html"],
  ["记账", "v3/expense.html"],
  ["穿搭", "v3/wardrobe.html"],
  ["备忘录", "v3/notes.html"],
  ["倒数日", "v3/countdown.html"],
  ["到点提醒", "v3/reminders.html"],
  ["更多", "v3/more.html"],
];

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail });
  if (!ok && detail) console.error(`  ↳ ${detail}`);
}

async function stickerClick(label) {
  await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
  await page.waitForTimeout(250);
  const loc = page.locator(".ob-wide .mi").filter({ hasText: label });
  if ((await loc.count()) !== 1) throw new Error(`贴纸「${label}」数量=${await loc.count()}`);
  const before = await page.evaluate(() => {
    try { return document.getElementById("modFrame").contentWindow.performance.timeOrigin; } catch (e) { return 0; }
  });
  await loc.click();
  await page.waitForFunction(
    (prev) => {
      const f = document.getElementById("modFrame");
      try {
        const w = f.contentWindow;
        return w && w.performance.timeOrigin !== prev && w.document.readyState === "complete";
      } catch (e) { return false; }
    },
    before,
    { timeout: 25000 }
  );
  await page.waitForTimeout(120);
}

async function getV3Frame(link) {
  for (let i = 0; i < 60; i++) {
    const f = page.frames().find((x) => x.url().endsWith(link));
    if (f) { return f; }
    await page.waitForTimeout(100);
  }
  throw new Error("找不到 iframe: " + link);
}

async function backToToday() {
  await page.click("#modBack");
  await page.waitForFunction(() => document.body.dataset.tab === "profile", { timeout: 6000 });
  await page.waitForTimeout(120);
}

async function openWardrobe() {
  await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
  await page.waitForTimeout(200);
  await stickerClick("穿搭");
  await page.waitForFunction(
    () => {
      const f = document.getElementById("modFrame");
      const d = f.contentDocument;
      return d && d.getElementById("closetBody") && d.getElementById("shell-theme");
    },
    { timeout: 15000 }
  );
  const f = await getV3Frame("v3/wardrobe.html");
  await f.waitForFunction(() => document.querySelectorAll(".wd-hero").length === 1);
  return f;
}

/* ── 3. 首页与 15 个贴纸 ── */
await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => {
  localStorage.removeItem("zdLight");
  localStorage.removeItem("zdWardrobe");
  localStorage.removeItem("lifeflow-theme");
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);

const stickers = await page.evaluate(() =>
  [...document.querySelectorAll(".ob-wide .mi")].map((x) => x.textContent.trim())
);
check("日程页 15 个模块贴纸", stickers.length === 15, `实际 ${stickers.length}: ${stickers.join("/")}`);
check("贴纸顺序与预期一致", JSON.stringify(stickers) === JSON.stringify(EXPECT.map((x) => x[0])), stickers.join("/"));

/* MOD_LINK 表与交接文档一致 */
const modLink = await page.evaluate(() => MOD_LINK);
const modLinkOk = EXPECT.every(([label, link]) => {
  const canonical = { 情绪: "情绪记录", 训练: "运动", 久坐: "休息" }[label] || label;
  return modLink[canonical] === link;
});
check("MOD_LINK 15 项均指向预期页面", modLinkOk);

for (const [label, link] of EXPECT) {
  let err = "";
  try {
    await stickerClick(label);
    const info = await page.evaluate(() => {
      const f = document.getElementById("modFrame");
      const d = f.contentDocument;
      return {
        active: document.querySelector(".screen.active")?.id,
        tab: document.body.dataset.tab,
        title: document.getElementById("modTitle").textContent.trim(),
        src: f.getAttribute("src"),
        innerLen: d && d.body ? d.body.innerText.trim().length : -1,
        dark: d ? d.documentElement.getAttribute("data-theme") : null,
        injected: !!(d && d.getElementById("shell-theme")),
      };
    });
    check(`${label} → 进入模块屏`, info.active === "screen-mod" && info.tab === "mod", JSON.stringify(info));
    check(`${label} → 标题=「${label}」`, info.title === label, info.title);
    check(`${label} → iframe=${link}`, info.src === link, info.src);
    check(`${label} → 内容非空`, info.innerLen > 50, `innerText=${info.innerLen}`);
    check(`${label} → 玄墨暗色注入`, info.dark === "dark" && info.injected, `dark=${info.dark} injected=${info.injected}`);
    await backToToday();
  } catch (e) {
    err = String(e);
    check(`${label} → 全链路`, false, err);
    try { await backToToday(); } catch (e2) {}
  }
  console.log(`${err ? "FAIL" : "PASS"}  ${label} → ${link}`);
}

/* ── 4. 穿搭行为 ── */
let wf = await openWardrobe();
check("穿搭空态引导存在", await wf.evaluate(() => !!document.querySelector("#emptyAdd") && document.body.innerText.includes("衣柜还空着")));
check("空态统计为 0 件 / 0 套 / 0 次", await wf.evaluate(() =>
  document.getElementById("stItems").textContent === "0" &&
  document.getElementById("stOutfits").textContent === "0" &&
  document.getElementById("stWorn").textContent === "0"
));
await page.screenshot({ path: OUT + "wardrobe-empty.png" });

/* 造一张 1200×900 的 PNG（在顶层页面里画） */
const pngB64 = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 900;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 1200, 900);
  g.addColorStop(0, "#2E5BFF"); g.addColorStop(1, "#FF5C8A");
  x.fillStyle = g; x.fillRect(0, 0, 1200, 900);
  for (let i = 0; i < 90; i++) {
    x.fillStyle = "rgba(255,255,255," + (0.04 + Math.random() * 0.22) + ")";
    x.beginPath();
    x.arc(Math.random() * 1200, Math.random() * 900, 16 + Math.random() * 90, 0, Math.PI * 2);
    x.fill();
  }
  return c.toDataURL("image/png").split(",")[1];
});
const pngBuf = Buffer.from(pngB64, "base64");
const photoPath = OUT + "wd-test-photo.png";
writeFileSync(photoPath, pngBuf);
console.log(`测试原图：1200×900 PNG / ${(pngBuf.length / 1024).toFixed(0)} KB`);

/* 4.1 加第一件（带图） */
await wf.click("#emptyAdd");
await wf.waitForFunction(() => document.getElementById("itemSheet").classList.contains("is-open"));
await wf.setInputFiles("#photoInput", photoPath);
await wf.waitForFunction(() => {
  const i = document.getElementById("photoPreview");
  return i && !i.hidden && i.src.indexOf("data:image/jpeg") === 0;
}, { timeout: 20000 });
await wf.fill("#itemName", "白衬衫");
await wf.click('#itemCats [data-cat="上衣"]');
await wf.waitForTimeout(2200);
await page.screenshot({ path: OUT + "wardrobe-item-sheet.png" });
await wf.click("#itemSave");
await wf.waitForFunction(() => document.querySelectorAll(".wd-item").length === 1, { timeout: 5000 });

const w1 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
const img1 = w1.items?.[0]?.img || "";
const dims = await wf.evaluate(async (src) => {
  const im = new Image();
  im.src = src;
  await im.decode();
  return [im.naturalWidth, im.naturalHeight];
}, img1);
check("照片入库为压缩后的 jpeg", img1.indexOf("data:image/jpeg") === 0, img1.slice(0, 30));
check("照片最长边压到 480", Math.max(...dims) === 480, dims.join("×"));
check("压缩后体积小于原图一半", img1.length < pngBuf.length / 2, `${img1.length} vs ${pngBuf.length}`);
check("第一件字段正确", w1.items?.[0]?.name === "白衬衫" && w1.items?.[0]?.cat === "上衣", JSON.stringify(w1.items?.[0] && { name: w1.items[0].name, cat: w1.items[0].cat }));

/* 4.2 加第二件（无图） */
await wf.click("#addTile");
await wf.waitForFunction(() => document.getElementById("itemSheet").classList.contains("is-open"));
await wf.fill("#itemName", "牛仔裤");
await wf.click('#itemCats [data-cat="下装"]');
await wf.click("#itemSave");
await wf.waitForFunction(() => document.querySelectorAll(".wd-item").length === 2, { timeout: 5000 });
const w2 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("无图单品也能存", w2.items?.length === 2 && w2.items[1].img === "" && w2.items[1].cat === "下装", JSON.stringify(w2.items?.[1] && { name: w2.items[1].name, cat: w2.items[1].cat, img: w2.items[1].img }));

/* 4.3 自动命名 + 改名 + 换品类 + 删除 */
await wf.click("#addTile");
await wf.waitForFunction(() => document.getElementById("itemSheet").classList.contains("is-open"));
await wf.click('#itemCats [data-cat="鞋"]');
await wf.click("#itemSave");
await wf.waitForFunction(() => document.querySelectorAll(".wd-item").length === 3, { timeout: 5000 });
const w3 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("名称留空自动叫「鞋 1」", w3.items?.[2]?.name === "鞋 1", w3.items?.[2]?.name);

await wf.locator(".wd-item").filter({ hasText: "鞋 1" }).click();
await wf.waitForFunction(() => document.getElementById("itemSheet").classList.contains("is-open"));
check("点开单品带入原名与原品类", await wf.evaluate(() =>
  document.getElementById("itemName").value === "鞋 1" &&
  document.querySelector('#itemCats [data-cat="鞋"]').classList.contains("is-active")
));
await wf.fill("#itemName", "帆布鞋");
await wf.click('#itemCats [data-cat="配饰"]');
await wf.click("#itemSave");
await wf.waitForFunction(() => document.querySelectorAll(".wd-item").length === 3, { timeout: 5000 });
const w4 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("改名 + 换品类已落库", w4.items?.[2]?.name === "帆布鞋" && w4.items?.[2]?.cat === "配饰", JSON.stringify(w4.items?.[2] && { name: w4.items[2].name, cat: w4.items[2].cat }));

await wf.locator(".wd-item").filter({ hasText: "帆布鞋" }).click();
await wf.waitForFunction(() => document.getElementById("itemSheet").classList.contains("is-open"));
await wf.click("#itemDelete");
check("删除需二次确认", await wf.evaluate(() => document.getElementById("itemDelete").textContent.includes("再点一次")));
await wf.click("#itemDelete");
await wf.waitForFunction(() => document.querySelectorAll(".wd-item").length === 2, { timeout: 5000 });
const w5 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("删除后只剩 2 件", w5.items.length === 2 && !w5.items.some((x) => x.name === "帆布鞋"));

/* 4.4 品类筛选 */
await wf.click('#filterChips [data-cat="下装"]');
await wf.waitForTimeout(200);
const filtered = await wf.evaluate(() => ({
  n: document.querySelectorAll(".wd-item").length,
  name: document.querySelector(".wd-item .wd-item__name")?.textContent,
}));
check("筛「下装」只剩牛仔裤", filtered.n === 1 && filtered.name === "牛仔裤", JSON.stringify(filtered));
await wf.click('#filterChips [data-cat="全部"]');
await wf.waitForTimeout(200);
check("筛回「全部」两件都在", (await wf.evaluate(() => document.querySelectorAll(".wd-item").length)) === 2);
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + "wardrobe-closet.png" });

/* 4.5 拼一套 */
await wf.click("#composeBtn");
await wf.waitForFunction(() => document.getElementById("composeSheet").classList.contains("is-open"));
check("拼一套：未选满 2 件时保存禁用", await wf.evaluate(() => document.getElementById("composeSave").disabled));
await wf.locator(".wd-pick").nth(0).click();
await wf.locator(".wd-pick").nth(1).click();
await wf.waitForTimeout(150);
check("已选 2 件并解锁保存", await wf.evaluate(() =>
  document.getElementById("pickCount").textContent.includes("2") && !document.getElementById("composeSave").disabled
));
await wf.fill("#outfitName", "周末出门");
await wf.waitForTimeout(350);
await page.screenshot({ path: OUT + "wardrobe-compose.png" });
await wf.click("#composeSave");
await wf.waitForFunction(() => document.querySelectorAll(".wd-outfit").length === 1, { timeout: 5000 });
const o1 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("搭配落库：2 件 / 名字正确", o1.outfits?.length === 1 && o1.outfits[0].items.length === 2 && o1.outfits[0].name === "周末出门", JSON.stringify(o1.outfits?.[0] && { name: o1.outfits[0].name, n: o1.outfits[0].items.length }));

/* 4.6 今天穿这套 */
await wf.click("[data-wear]");
await wf.waitForFunction(() => !!document.querySelector(".wd-wear.is-worn"), { timeout: 5000 });
const today = await wf.evaluate(() => {
  const d = new Date();
  const p = (n) => (n < 10 ? "0" + n : "" + n);
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
});
const w6 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("今天穿这套：lastWorn=今天", w6.outfits[0].lastWorn === today, `${w6.outfits[0].lastWorn} vs ${today}`);
check("今天穿这套：wornCount+1", w6.outfits[0].wornCount === 1, String(w6.outfits[0].wornCount));
check("顶部统计「穿过 1 次」", await wf.evaluate(() => document.getElementById("stWorn").textContent === "1"));
check("概览出现今天这套", await wf.evaluate(() =>
  !document.getElementById("todayTag").hidden && document.getElementById("todayLine").textContent.includes("周末出门")
));
await wf.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(2200);
await page.screenshot({ path: OUT + "wardrobe-filled.png" });
await wf.evaluate(() => window.scrollTo(0, document.querySelector(".wd-outfits").offsetTop - 84));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "wardrobe-outfit.png" });
await wf.evaluate(() => window.scrollTo(0, 0));

/* 4.7 同时只能有一套 */
await wf.evaluate(() => document.querySelector("#composeBtn").click());
await wf.waitForFunction(() => document.getElementById("composeSheet").classList.contains("is-open"));
await wf.locator(".wd-pick").nth(0).click();
await wf.locator(".wd-pick").nth(1).click();
await wf.fill("#outfitName", "通勤两件");
await wf.click("#composeSave");
await wf.waitForFunction(() => document.querySelectorAll(".wd-outfit").length === 2, { timeout: 5000 });
await wf.locator(".wd-outfit").nth(1).locator("[data-wear]").click();
await wf.waitForFunction(() => document.querySelectorAll(".wd-wear.is-worn").length === 1, { timeout: 5000 });
const w7 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
const marked = w7.outfits.filter((o) => o.lastWorn === today);
check("同时只有一套被标今天", marked.length === 1 && marked[0].name === "通勤两件", JSON.stringify(w7.outfits.map((o) => ({ n: o.name, lw: o.lastWorn }))));
check("前一套不再算今天，次数回退", w7.outfits[0].lastWorn !== today && w7.outfits[0].wornCount === 0, JSON.stringify(w7.outfits[0] && { lw: w7.outfits[0].lastWorn, wc: w7.outfits[0].wornCount }));
check("合计穿过 1 次", await wf.evaluate(() => document.getElementById("stWorn").textContent === "1"));

/* 4.8 刷新后仍在 */
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
wf = await openWardrobe();
const afterReload = await wf.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("zdWardrobe") || "{}");
  return {
    items: document.querySelectorAll(".wd-item").length,
    outfits: document.querySelectorAll(".wd-outfit").length,
    wornBtns: document.querySelectorAll(".wd-wear.is-worn").length,
    tag: !document.getElementById("todayTag").hidden,
    line: document.getElementById("todayLine").textContent,
    itemsStored: (d.items || []).length,
    outfitsStored: (d.outfits || []).length,
  };
});
check("刷新后 2 件单品仍在", afterReload.items === 2 && afterReload.itemsStored === 2, JSON.stringify(afterReload));
check("刷新后 2 套搭配仍在", afterReload.outfits === 2 && afterReload.outfitsStored === 2, JSON.stringify(afterReload));
check("刷新后「今天穿」标记仍在", afterReload.wornBtns === 1 && afterReload.tag && afterReload.line.includes("通勤两件"), JSON.stringify(afterReload));

/* 4.9 再点取消 / 再点回来 */
await wf.click(".wd-wear.is-worn");
await wf.waitForFunction(() => document.querySelectorAll(".wd-wear.is-worn").length === 0, { timeout: 5000 });
const w8 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("再点取消：lastWorn 清空、次数回退", w8.outfits[1].lastWorn === "" && w8.outfits[1].wornCount === 0, JSON.stringify(w8.outfits[1] && { lw: w8.outfits[1].lastWorn, wc: w8.outfits[1].wornCount }));
check("取消后概览不再显示今天这套", await wf.evaluate(() => document.getElementById("todayTag").hidden));
await wf.locator(".wd-outfit").nth(1).locator("[data-wear]").click();
await wf.waitForFunction(() => document.querySelectorAll(".wd-wear.is-worn").length === 1, { timeout: 5000 });
const w9 = await wf.evaluate(() => JSON.parse(localStorage.getItem("zdWardrobe") || "{}"));
check("再点回来：次数=1", w9.outfits[1].lastWorn === today && w9.outfits[1].wornCount === 1);

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
wf = await openWardrobe();
check("二次刷新后标记仍持久", await wf.evaluate(() => document.querySelectorAll(".wd-wear.is-worn").length === 1));

/* 4.10 4MB 上限：行内提示 + 阻止继续加图（仍可加无图条目） */
await wf.evaluate(() => {
  const big = "data:image/jpeg;base64," + "A".repeat(Math.floor(4.3 * 1024 * 1024));
  localStorage.setItem("zdWardrobe", JSON.stringify({
    items: [{ id: "big1", name: "旧照片", cat: "其他", img: big, createdAt: 1 }],
    outfits: []
  }));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500);
wf = await openWardrobe();
const capWarn = await wf.evaluate(() => ({
  hidden: document.getElementById("fullWarn").hidden,
  text: document.getElementById("fullWarn").textContent.trim(),
  bytes: JSON.stringify(JSON.parse(localStorage.getItem("zdWardrobe"))).length
}));
check("超 4MB 前有条「衣柜快满了」的行内提示", !capWarn.hidden && capWarn.text.includes("衣柜快满了"), JSON.stringify(capWarn));
await wf.click("#addTile");
await wf.waitForFunction(() => document.getElementById("itemSheet").classList.contains("is-open"));
await wf.setInputFiles("#photoInput", photoPath);
await page.waitForTimeout(2200);
const capBlock = await wf.evaluate(() => ({
  previewHidden: document.getElementById("photoPreview").hidden,
  toast: document.getElementById("toast").textContent,
  items: JSON.parse(localStorage.getItem("zdWardrobe")).items.length
}));
check("加图被拦下且提示原因", capBlock.previewHidden && capBlock.toast.includes("衣柜快满了") && capBlock.items === 1, JSON.stringify(capBlock));
await wf.evaluate(() => { localStorage.removeItem("zdWardrobe"); });

/* ── 5. 汇总 ── */
check("全程 15 页无 4xx", net4xx.length === 0, net4xx.slice(0, 5).join(" | "));
check("全程无 pageerror", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
check("wardrobe 脚本语法零错", syntaxCheck.bad === 0, `${syntaxCheck.bad}/${syntaxCheck.blocks}`);
check("wardrobe 自定义样式无硬编码颜色", hardColors.length === 0, hardColors.join(","));
check("禁用词零命中", bannedHit.length === 0 && !aiHit, bannedHit.join(",") + (aiHit ? " AI" : ""));

await browser.close();
if (server) server.kill();

const failed = checks.filter((c) => !c.ok);
for (const c of checks) { if (!c.ok) console.log(`FAIL  ${c.name}`); }
console.log(`\n全链路校验：${checks.length - failed.length}/${checks.length} PASS`);
if (consoleErrors.length) {
  console.log("控制台 error（不计入失败，多为 CDN 网络）：");
  [...new Set(consoleErrors)].slice(0, 4).forEach((x) => console.log("  · " + x));
}
process.exit(failed.length ? 1 : 0);


