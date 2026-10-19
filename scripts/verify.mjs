/**
 * 执灯人 · 一条命令跑完全部验证
 *   node scripts/verify.mjs
 *
 * 覆盖：
 *   A 静态   sw.js 语法 + 预缓存清单 + manifest 身份 + .design 引用
 *   B 内核   light.js 的 51 项断言（调 scripts/test-light.mjs）
 *   C 渲染   两端首页真的能打开、标题对、无项目内 404
 *
 * 零依赖：用系统里的 Chromium 主动跑 --dump-dom。
 * 想指定浏览器：set CHROME_PATH=...
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PAGES = path.join(ROOT, 'pages');
const PORT = 8916;

let pass = 0, fail = 0;
const rows = [];
function ok(name, cond, detail = '') {
  cond ? pass++ : fail++;
  rows.push([cond ? 'PASS' : 'FAIL', name, detail]);
}

/* ---------------- 浏览器 ---------------- */
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  try {
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      const p = path.join(base, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return 'chrome';
}
const CHROME = findChrome();

/* ---------------- A 静态 ---------------- */
const swSrc = fs.readFileSync(path.join(PAGES, 'sw.js'), 'utf8');
try { new Function(swSrc); ok('sw.js 语法', true); }
catch (e) { ok('sw.js 语法', false, e.message); }

const assetsBlock = (swSrc.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
const assets = [...assetsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
ok('sw.js 有预缓存清单', assets.length > 0, assets.length + ' 条');
for (const a of assets) {
  const rel = a.replace(/^\.\//, '');
  const target = rel === '' ? PAGES : path.join(PAGES, rel);
  ok(`预缓存存在 ${a}`, fs.existsSync(target));
}

const manifest = JSON.parse(fs.readFileSync(path.join(PAGES, 'manifest.json'), 'utf8'));
ok('manifest 名称', manifest.name === '执灯人 · 一天一盏灯', manifest.name);
ok('manifest 主题色', manifest.theme_color.toUpperCase() === '#0B0F1A', manifest.theme_color);
ok('manifest 背景色', manifest.background_color.toUpperCase() === '#0B0F1A', manifest.background_color);
for (const ic of manifest.icons) {
  ok(`manifest 图标 ${ic.src}`, fs.existsSync(path.join(PAGES, ic.src)));
}

const design = JSON.parse(fs.readFileSync(path.join(ROOT, '.design'), 'utf8'));
ok('.design 可解析', Array.isArray(design.data), design.data.length + ' 条');
for (const d of design.data) {
  const ref = d.devMetadata.htmlSrc || d.devMetadata.imageSrc;
  ok(`.design 引用存在 ${d.id}`, fs.existsSync(path.join(ROOT, ref)), ref);
}

/* ---------------- B 内核 ---------------- */
const t = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'test-light.mjs')], { encoding: 'utf8' });
const summary = (t.stdout || '').trim().split('\n').pop();
ok('light.js 51 项断言', t.status === 0, summary || (t.stderr || '').slice(0, 120));

/* ---------------- C 渲染 ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const notFound = [];

function serve(dir, port) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://l');
      let rel = decodeURIComponent(u.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const f = path.join(dir, rel);
      fs.readFile(f, (e, b) => {
        if (e) { notFound.push(rel); res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        res.end(b);
      });
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

function dump(url, timeoutMs = 90000) {
  return new Promise((resolve) => {
    const cp = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars', '--virtual-time-budget=6000', '--dump-dom', url], { windowsHide: true });
    let out = '';
    let done = false;
    cp.stdout.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { if (!done) { done = true; try { cp.kill('SIGKILL'); } catch {} resolve(''); } }, timeoutMs);
    cp.on('close', () => { if (done) return; done = true; clearTimeout(timer); resolve(out); });
  });
}

const titleOf = (h) => (h.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [, ''])[1].trim();

const EXPECT = {
  'index.html': '执灯人 · 手机端',
  'desktop.html': '执灯人 · 电脑端'
};

if (!fs.existsSync(CHROME) && CHROME !== 'chrome') {
  ok('找到浏览器', false, CHROME);
} else {
  const server = await serve(PAGES, PORT);
  for (const [page, want] of Object.entries(EXPECT)) {
    let dom = await dump(`http://127.0.0.1:${PORT}/${page}`);
    if (!dom) dom = await dump(`http://127.0.0.1:${PORT}/${page}`); // 冷启动重试一次
    ok(`渲染 ${page}`, dom.length > 50000, dom.length + ' 字节');
    ok(`标题 ${page}`, titleOf(dom) === want, titleOf(dom) || '(空)');
  }
  // 手机端首页的四个 tab 都在
  const indexDom = await dump(`http://127.0.0.1:${PORT}/index.html`);
  for (const tab of ['todo', 'today', 'profile', 'lamp']) {
    ok(`tab 存在 ${tab}`, indexDom.includes(`data-tab="${tab}"`));
  }
  server.close();
}

const stray = [...new Set(notFound)].filter((p) => p !== '/favicon.ico');
ok('无项目内 404', stray.length === 0, stray.join(', '));

/* ---------------- 输出 ---------------- */
const w = (s, n) => String(s).padEnd(n).slice(0, n);
for (const [st, name, detail] of rows) console.log(`${w(st, 5)} ${w(name, 34)} ${detail}`);
console.log(`\n${pass} passed, ${fail} failed  (${rows.length} assertions)`);
process.exit(fail ? 1 : 0);
