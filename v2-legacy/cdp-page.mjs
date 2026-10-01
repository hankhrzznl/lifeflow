/**
 * 通过 CDP（Chrome DevTools Protocol）驱动，替代 `--dump-dom`
 * 用法： import { withPage } from './cdp-page.mjs'
 *
 * ── 为什么必须换掉 --dump-dom ────────────────────────────────────
 * 三个 agent 独立复现了同一个现象：**同一场景连跑多次，丢的是不同的步骤**
 * （growth: 14/14 · 14/14 · 13/14 · 13/14 · 12/14 · 9/14；
 *   cross: 32/32 但要加 1.2s 落盘等待才稳；notes: 10/10 · 9/10 · 8/10 · 6/10 · 5/10）。
 * 根因：**Chrome 往 localStorage 落盘是异步的**，而 `--dump-dom` 拿到 DOM 就退出，
 * 于是"上一步写成功、下一步冷启动读不到"，报成断言失败 —— 冤枉被测页面。
 * 我一开始误判为"探针写法问题"，花了很久测 12 个表达式、4 种包装、2 个注入位置，
 * 全是白费：**问题在进程生命周期，不在探针。**
 *
 * CDP 的好处：由我们控制"导航 → 等 → 读"的节奏，可以显式等落盘完成。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 取一个空闲端口（不要用 require —— 本文件是 ESM，踩过） */
export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

/**
 * 启一个带调试端口的 chrome，返回极简 CDP 客户端。
 * @param {string} profile  user-data-dir（同一次运行内复用 ⟹ localStorage 共享）
 * @param {number} port     调试端口
 */
export async function launch(profile, port) {
  fs.mkdirSync(profile, { recursive: true });
  const child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--disable-extensions', '--no-default-browser-check',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
    '--window-size=500,1200', 'about:blank',
  ], { stdio: 'ignore' });

  /* 等调试端口起来 */
  let target = null;
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      target = list.find((t) => t.type === 'page');
      if (target && target.webSocketDebuggerUrl) { break; }
    } catch { /* 还没起来 */ }
  }
  if (!target) { try { child.kill('SIGKILL'); } catch { /* */ } throw new Error('CDP 端口没起来'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) { rej(new Error(msg.error.message)); } else { res(msg.result); }
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const myId = ++id;
    pending.set(myId, { res, rej });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  return {
    child,
    send,
    /** 导航并等 load */
    async goto(url, settleMs = 1500) {
      const loaded = new Promise((resolve) => {
        const h = (ev) => {
          let m; try { m = JSON.parse(ev.data); } catch { return; }
          if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); resolve(); }
        };
        ws.addEventListener('message', h);
      });
      await send('Page.navigate', { url });
      await Promise.race([loaded, sleep(15000)]);
      await sleep(settleMs);       /* ⚠ 关键：让页面的 setTimeout 与落盘都完成 */
    },
    /** 在页面里求值，返回 JSON */
    async eval(expr) {
      const r = await send('Runtime.evaluate', {
        expression: `(function(){ try { return JSON.stringify(${expr}); } catch(e){ return JSON.stringify({__err:String(e&&e.message||e)}); } })()`,
        returnByValue: true, awaitPromise: false,
      });
      const v = r && r.result && r.result.value;
      if (v === undefined || v === null) { return null; }
      try { return JSON.parse(v); } catch { return null; }
    },
    /** 同上，但会 await 表达式返回的 Promise（读 IndexedDB 这类异步必须用它）
     *  ⚠ 别用 eval() 去跑 async —— returnByValue 拿到的是一个 Promise，JSON.stringify 出来是 {}。 */
    async evalAsync(expr) {
      const r = await send('Runtime.evaluate', {
        expression: `(async function(){ try { return JSON.stringify(await (${expr})); } catch(e){ return JSON.stringify({__err:String(e&&e.message||e)}); } })()`,
        returnByValue: true, awaitPromise: true,
      });
      const v = r && r.result && r.result.value;
      if (v === undefined || v === null) { return null; }
      try { return JSON.parse(v); } catch { return null; }
    },
    async close() {
      try { ws.close(); } catch { /* */ }
      try { child.kill('SIGKILL'); } catch { /* */ }
      await sleep(250);
    },
  };
}
