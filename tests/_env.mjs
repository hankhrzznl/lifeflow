/**
 * 测试公共环境：本地 Playwright / Chromium / 静态服务地址 / 产物目录。
 * 换机器时用 PLAYWRIGHT_PATH / CHROME_PATH / BASE_URL 覆盖，不写死。
 */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const req = createRequire(
  process.env.PLAYWRIGHT_PATH || "C:/Users/86189/.workbuddy/binaries/node/workspace/"
);
export const { chromium } = req("playwright-core");

export const EXE =
  process.env.CHROME_PATH ||
  "C:/Users/86189/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";

export const BASE = process.env.BASE_URL || "http://127.0.0.1:8899";

export const ROOT = path.resolve(__dirname, "..");
export const PAGES = path.join(ROOT, "pages") + path.sep;
export const OUT = path.join(__dirname, ".artifacts") + path.sep;
fs.mkdirSync(OUT, { recursive: true });
