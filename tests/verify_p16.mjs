import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);
const today = (() => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); })();

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);

/* 1. 桌面端读手机同一盏灯 */
await page.evaluate(() => {
  localStorage.setItem("zdLight", JSON.stringify({ v: 2, light: 5, level: 1 }));
});
const desk = await context.newPage();
await desk.goto(BASE + "/desktop.html", { waitUntil: "load" });
await desk.waitForTimeout(700);
const deskLight = await desk.evaluate(() => ({
  realm: document.querySelector(".gn-realm")?.textContent || "",
}));
ok("桌面端显示手机灯值 5", deskLight.realm.includes("5 光") && !deskLight.realm.includes("173"), JSON.stringify(deskLight));
await desk.close();

/* 2. 手机 schema v1 → v2 迁移 */
await page.evaluate((t) => {
  const wd = new Date().getDay();
  const mood = [0, 0, 0, 0, 0, 0, 0]; mood[wd] = 1;
  localStorage.setItem("zdLight", JSON.stringify({ light: 2, moodDate: t, mood }));
}, today);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const migrated = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  const d = new Date();
  const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  return { v: st.v, light: st.light, moods: st.moods, oldMood: "mood" in st, oldDate: "moodDate" in st, today: st.moods?.[k] };
});
ok("zdLight 升到 v2", migrated.v === 2, JSON.stringify(migrated));
ok("旧 mood 迁成 moods[today]", migrated.today === "flat", JSON.stringify(migrated));
ok("旧 mood/moodDate 已删除", !migrated.oldMood && !migrated.oldDate, JSON.stringify(migrated));

/* 3. 设置 → 导出 */
await page.evaluate(() => document.querySelector('[data-tab="profile"]').click());
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector("#settingsBtn").click());
await page.waitForTimeout(300);
const settings = await page.evaluate(() => ({
  open: !!document.querySelector("#sheetBox #dataExport"),
  importBtn: !!document.querySelector("#sheetBox #dataImportBtn"),
  reset: !!document.querySelector("#sheetBox #dataReset"),
  file: !!document.querySelector("#sheetBox #dataFile"),
}));
ok("设置面板含导出/导入/重置", settings.open && settings.importBtn && settings.reset && settings.file, JSON.stringify(settings));
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#sheetBox #dataExport")]);
const dlPath = await download.path();
const exported = JSON.parse(fs.readFileSync(dlPath, "utf8"));
ok("导出 JSON 有版本/数据键", exported.v === 2 && !!exported.data && !!exported.data.zdLight, JSON.stringify({ v: exported.v, keys: Object.keys(exported.data || {}) }));
ok("导出含模块/衣柜/主题键", ["zdLight", "lifeflow-days-v1", "zdWardrobe", "lifeflow-theme"].every((k) => k in exported.data), JSON.stringify(Object.keys(exported.data)));

/* 4. 导入：把灯改成 7，回读 */
const snap = JSON.parse(JSON.stringify(exported));
const z = JSON.parse(snap.data.zdLight);
z.light = 7; z.level = 1;
snap.data.zdLight = JSON.stringify(z);
const tmp = path.join(os.tmpdir(), "lifeflow-import-test.json");
fs.writeFileSync(tmp, JSON.stringify(snap));
await page.setInputFiles("#sheetBox #dataFile", tmp);
await page.waitForTimeout(1200);
await page.goto(BASE + "/index.html#lamp", { waitUntil: "load" });
await page.waitForTimeout(900);
const imported = await page.evaluate(() => ({
  light: JSON.parse(localStorage.getItem("zdLight") || "{}").light,
  sub: document.querySelector("#lampSub")?.textContent || "",
}));
ok("导入后灯值 = 7", imported.light === 7, JSON.stringify(imported));
ok("导入后灯页显示 7 光", imported.sub.includes("7 光"), imported.sub);

/* 5. 多标签同源：另一页点任务，这一页刷新 */
const page2 = await context.newPage();
await page2.goto(BASE + "/index.html#lamp", { waitUntil: "load" });
await page2.waitForTimeout(700);
const before2 = await page2.evaluate(() => document.querySelector("#lampSub")?.textContent || "");
await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.waitForTimeout(700);
const lightBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("zdLight") || "{}").light || 0);
await page.evaluate(() => document.querySelector("#screen-todo .js-check")?.click());
await page.waitForTimeout(1500);
const after2 = await page2.evaluate(() => ({
  light: JSON.parse(localStorage.getItem("zdLight") || "{}").light,
  sub: document.querySelector("#lampSub")?.textContent || "",
}));
ok("另一标签页收到 storage 并刷新", after2.light === lightBefore + 1, JSON.stringify({ before: before2, lightBefore, after2 }));
ok("另一标签页灯页同步", after2.sub.includes("8 光"), after2.sub);

await page.screenshot({ path: OUT + "p1-6-settings.png" });
for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n双端/数据校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
