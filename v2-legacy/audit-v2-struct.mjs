/**
 * app-v2 结构自检 —— 断言关键结构存在/不存在
 * 用法： node tools/audit-v2-struct.mjs [端口]
 *
 * 存在的理由：截图只能肉眼看，断言才能防回归。
 *   · 底栏必须 4 格（定稿 §8.2）
 *   · 「备考期」不许出现在「掉了」里（它是时期 = 多因素目标容器，走报瓶颈）
 *   · 手机宽度不许横向溢出（三档布局的下限）
 */
import path from "node:path";
import { launch, freePort } from "./cdp-page.mjs";

const PORT = process.argv[2] ?? "3210";
const BASE = `http://127.0.0.1:${PORT}`;

const client = await launch(path.join(process.env.TEMP ?? ".", "lf-v2-struct"), await freePort());

let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✅" : "⚠ "} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fail++;
};

/* ── 手机档 ── */
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 900, deviceScaleFactor: 1, mobile: true,
});

for (const [name, route] of [["此刻", "/"], ["刚过去", "/past"], ["往后", "/future"], ["工具", "/tools"]]) {
  await client.goto(`${BASE}${route}`, 2000);
  await new Promise((r) => setTimeout(r, 900));
  const r = await client.eval(`(() => {
    const vw = window.innerWidth;
    let over = 0;
    document.querySelectorAll('body *').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return;
      if (b.right > vw + 1) over++;
    });
    return {
      tabbar: document.querySelectorAll('.tabbar__item').length,
      /* ⚠ 判"可见"要用 offsetParent / 祖先链，不能只看元素自身的 computed display：
         手机上 .railnav 自己被 display:none 的**父级** .shell__rail 包着，
         它自身的 computed display 仍是 block ⟹ 只看自身会误判成"可见"。 */
      railVisible: (() => {
        const e = document.querySelector('.railnav');
        return !!e && e.offsetParent !== null;
      })(),
      overflow: over,
      h1: (document.querySelector('h1') || {}).textContent || null,
      text: document.body.innerText.length,
    };
  })()`);
  check(`手机 ${name} 底栏 4 格`, r.tabbar === 4, `实际 ${r.tabbar}`);
  check(`手机 ${name} 横向溢出 0`, r.overflow === 0, `实际 ${r.overflow}`);
  check(`手机 ${name} 侧导航隐藏`, r.railVisible === false);
  check(`手机 ${name} 有内容`, r.text > 150, `${r.text} 字`);
}

/* ── 「备考期」不许出现在"掉了"里 ── */
await client.goto(`${BASE}/past`, 2000);
await new Promise((r) => setTimeout(r, 900));
const g = await client.eval(`(() => {
  const cards = [...document.querySelectorAll('.card')];
  const find = (t) => cards.find(c => (c.querySelector('.t-bold') || {}).textContent === t);
  const slip = find('掉了');
  const solid = find('稳了');
  const stale = find('没动');
  return {
    slippingText: slip ? slip.innerText : null,
    solidCount: solid ? solid.innerText.split('\\n').length : 0,
    staleText: stale ? stale.innerText : null,
  };
})()`);
check("「掉了」不含备考期", !(g.slippingText || "").includes("备考期"), (g.slippingText || "").replace(/\n/g, " / ").slice(0, 70));

/* ── 按时期：必须有"报瓶颈" ── */
const period = await client.eval(`(() => {
  const btns = [...document.querySelectorAll('.pill')];
  const t = btns.find(b => b.textContent === '按时期');
  if (!t) return null;
  t.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 500));
const pv = await client.eval(`(() => {
  const t = document.body.innerText;
  return { hasBottleneck: t.includes('现在卡在'), hasPeriod: t.includes('备考期'), raw: t.slice(0, 0) };
})()`);
check("按时期 显示「现在卡在」（报瓶颈口径）", !!period && pv.hasBottleneck);
check("按时期 显示备考期", pv.hasPeriod);

/* ── iPad / 电脑：侧导航可见、底栏隐藏 ── */
for (const [name, w, h] of [["iPad", 834, 1000], ["电脑", 1280, 900]]) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: 1, mobile: false,
  });
  await client.goto(`${BASE}/`, 2000);
  await new Promise((r) => setTimeout(r, 900));
  const r = await client.eval(`(() => {
    const tb = document.querySelector('.tabbar');
    const rn = document.querySelector('.railnav');
    const ar = document.querySelector('.shell__aside');
    const cols = getComputedStyle(document.querySelector('.shell__body')).gridTemplateColumns;
    const visible = (e) => !!e && e.offsetParent !== null;
    return {
      tabbarHidden: tb ? getComputedStyle(tb).display === 'none' : true,
      railVisible: visible(rn),
      asideVisible: visible(ar),
      cols,
    };
  })()`);
  check(`${name} 底栏隐藏`, r.tabbarHidden);
  check(`${name} 侧导航可见`, r.railVisible);
  check(`${name} 右栏可见`, r.asideVisible);
  console.log(`     列宽 ${r.cols}`);
}

await client.send("Emulation.clearDeviceMetricsOverride");
await client.close();
console.log(`\n${fail ? `⚠ ${fail} 项未通过` : "✅ 全部通过"}`);
process.exitCode = fail ? 1 : 0;
