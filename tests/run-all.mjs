/**
 * 执灯人 · 富测试一条命令
 *   node tests/run-all.mjs
 *
 * 会在 127.0.0.1:8899 起静态服务，依次跑：
 *   - tests/verify_*.mjs（Playwright 行为测试）
 *   - scripts/test-store.mjs（纯函数）
 *   - scripts/test-light.mjs（内核 51 断言）
 *
 * 环境变量：PLAYWRIGHT_PATH / CHROME_PATH / BASE_URL
 * 截图等产物写到 tests/.artifacts/（已 gitignore）。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "..");
const PAGES = path.join(ROOT, "pages");
const WB = path.join(ROOT, "workbench");
const PORT = 8899;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  /* 根路径给落地页（GitHub Pages 的入口）；/index.html 仍是手机端 */
  if (p === "/") {
    return fs.readFile(path.join(ROOT, "index.html"), (err, data) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(data);
    });
  }
  /* /workbench/* 走项目里的 workbench/，其余走 pages/ */
  let base = PAGES;
  let rel = p;
  if (p === "/workbench" || p.startsWith("/workbench/")) {
    base = WB;
    rel = p.replace(/^\/workbench/, "") || "/index.html";
  }
  const file = path.join(base, rel);
  if (!file.startsWith(base)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
console.log(`[run-all] static http://127.0.0.1:${PORT} (pages/)\n`);

const tests = [
  "verify_landing.mjs",
  "verify_blueprint.mjs",
  "verify_theme.mjs",
  "verify_clock_mood.mjs",
  "verify_a11y.mjs",
  "verify_p16.mjs",
  "verify_modules2.mjs",
  "verify_mood_train.mjs",
  "verify_expense.mjs",
  "verify_plan.mjs",
  "verify_workbench.mjs",
  "verify_loop.mjs",
  "verify_sugg.mjs",
  "verify_gate.mjs",
  "verify_modules.mjs",
  "../scripts/test-store.mjs",
  "../scripts/test-light.mjs"
];

let pass = 0;
let fail = 0;
const failed = [];

for (const t of tests) {
  const file = path.join(DIR, t);
  console.log(`\n=== ${t} ===`);
  const started = Date.now();
  const child = spawn(process.execPath, [file], {
    stdio: "inherit",
    cwd: ROOT,
    env: { ...process.env, BASE_URL: `http://127.0.0.1:${PORT}` }
  });
  /* 必须异步 spawn：spawnSync 会阻塞父进程事件循环，静态服务就跑不动，浏览器全 30s 超时 */
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 240000);
  const code = await new Promise((resolve) => {
    child.on("close", (c) => resolve(c));
    child.on("error", (e) => { console.log(`    (${e.code || e.message})`); resolve(1); });
  });
  clearTimeout(timer);
  if (timedOut) console.log("    (TIMEOUT 240s)");
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  if (code === 0) { pass++; console.log(`--- PASS ${t} (${sec}s)`); }
  else { fail++; failed.push(t); console.log(`--- FAIL ${t} (${sec}s, exit ${code}${timedOut ? ", TIMEOUT" : ""})`); }
}

server.close();
console.log(`\n[run-all] ${pass} suites passed, ${fail} failed${fail ? " → " + failed.join(", ") : ""}`);
process.exit(fail ? 1 : 0);
