import { chromium, EXE, BASE } from "./_env.mjs";
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const ok = (n, c, d = "") => results.push([c ? "PASS" : "FAIL", n, d]);

const resp = await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForTimeout(300);
const landing = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector("h1")?.textContent || "",
  links: [...document.querySelectorAll(".grid a")].map((a) => a.getAttribute("href")),
  kickers: [...document.querySelectorAll(".grid .kicker")].map((x) => x.textContent.trim()),
}));
ok("根路径返回落地页", resp.status() === 200 && /执灯人/.test(landing.title), `${resp.status()} ${landing.title}`);
ok("落地页三个入口齐全", landing.links.join(",") === "pages/index.html,pages/desktop.html,workbench/index.html", JSON.stringify(landing.links));
ok("三个时间尺度齐全", landing.kickers.join("|") === "当下|一周 / 一月|一天", JSON.stringify(landing.kickers));

/* 链接目标在部署后的相对路径下成立（这里验服务端对应文件可达） */
const reach = await page.evaluate(async () => {
  const out = {};
  for (const h of ["/index.html", "/desktop.html", "/workbench/index.html"]) {
    try { const r = await fetch(h, { method: "HEAD" }); out[h] = r.status; } catch (e) { out[h] = -1; }
  }
  return out;
});
ok("三个入口文件可达", Object.values(reach).every((s) => s === 200), JSON.stringify(reach));

/* 日夜：与三端共用 lifeflow-theme */
await page.click("#themeToggle");
await page.waitForTimeout(250);
const light = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute("data-theme"),
  key: localStorage.getItem("lifeflow-theme"),
  bg: getComputedStyle(document.body).backgroundColor,
}));
ok("落地页切日间并落 lifeflow-theme", light.theme === "light" && light.key === "light", JSON.stringify(light));
ok("落地页日间底色=暖奶油", light.bg === "rgb(247, 244, 239)", light.bg);

for (const r of results) console.log(r[0].padEnd(5), r[1], r[2] ? "· " + r[2] : "");
console.log(`\n落地页校验：${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
console.log("pageerrors:", errors.length ? [...new Set(errors)] : "none");
await browser.close();
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
