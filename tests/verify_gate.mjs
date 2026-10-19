import { chromium, EXE, BASE, OUT, PAGES } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

const build5 = () => page.evaluate(() => {
  const now = new Date();
  const off = (now.getDay() + 6) % 7;
  const logs = {};
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off + i);
    const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    logs[k] = 1;
    days.push(k);
  }
  localStorage.clear();
  localStorage.setItem("zdLight", JSON.stringify({ light: 0, level: 1, logs }));
  return days;
});

await page.goto(BASE + "/index.html", { waitUntil: "load" });
await page.waitForTimeout(300);
let days = await build5();
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
const g1 = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, level: st.level, gate: st.gate, gateSub: document.querySelector("#gateSub")?.textContent, gateTitle: document.querySelector("#gateTitle")?.textContent, week: document.querySelector("#weekTxt")?.textContent };
});
ok("5/5 后灯 +2", g1.light === 2, JSON.stringify(g1));
ok("gate 状态落盘", g1.gate && g1.gate.awarded === 2 && !!g1.gate.weekStart, JSON.stringify(g1.gate));
ok("关卡文案已入账", (g1.gateSub || "").includes("已入账"), g1.gateSub);
ok("本周 5/5", (g1.week || "").includes("5 / 5"), g1.week);

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const g2 = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, gate: st.gate };
});
ok("刷新不重复 +2", g2.light === 2, JSON.stringify(g2));

// 加第 6 天（今天）也不重复
const g3 = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}") || {};
  const d = new Date();
  const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  st.logs = st.logs || {};
  st.logs[k] = (st.logs[k] || 0) + 1;
  localStorage.setItem("zdLight", JSON.stringify(st));
  return k;
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const g4 = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, gate: st.gate, sub: document.querySelector("#gateSub")?.textContent };
});
ok("第 6 天不重复 +2", g4.light === 2, JSON.stringify(g4));
ok("第 6 天仍显示已入账", (g4.sub || "").includes("已入账"), g4.sub);

// 新的一周没有 5 天：不应再给
const g5 = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}") || {};
  const now = new Date();
  const off = (now.getDay() + 6) % 7;
  const logs = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off - 7 + i);
    logs[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = 1;
  }
  st.logs = logs;
  st.gate = null;
  st.light = 0;
  localStorage.setItem("zdLight", JSON.stringify(st));
  return true;
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(800);
const g6 = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("zdLight") || "{}");
  return { light: st.light, week: document.querySelector("#weekTxt")?.textContent };
});
ok("上一周 5 天不算本周", g6.light === 0, JSON.stringify(g6));

console.log(results.map((r) => r[0].padEnd(5) + " " + r[1] + (r[2] ? " · " + r[2] : "")).join("\n"));
console.log(`\n关卡校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
