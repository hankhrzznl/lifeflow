/**
 * light.js 验收：既对照「改动前旧实现」的实测输出，也独立钉住规格边界。
 * 用法：node scripts/test-light.mjs（fixture 已入库到 tests/fixtures/eq-before.json）
 */
import fs from 'node:fs';

const src = fs.readFileSync('pages/core/light.js', 'utf8');
new Function(src)();
const LC = globalThis.LightCore;

const before = JSON.parse(fs.readFileSync('tests/fixtures/eq-before.json', 'utf8'));

let pass = 0, fail = 0;
const rows = [];
function ok(name, cond, detail) {
  if (cond) { pass++; rows.push(['PASS', name, detail || '']); }
  else { fail++; rows.push(['FAIL', name, detail || '']); }
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------- 1. 与旧实现的实测输出逐一对照 ---------- */
/* 旧文件里的字面量，作为漂移护栏 */
const OLD_REQ = [4,5,5,6,6,7,8,8,9,10,11,12,13,14,15,16,18,19,21,23,25,27,30,33,36,39,42,46,50,55,60,65,71,77,84,92];
const OLD_W = { body: 300, bond: 250, mind: 250, means: 200 };

ok('LIGHT_REQ 与旧文件逐值一致', JSON.stringify(LC.LIGHT_REQ) === JSON.stringify(OLD_REQ));
ok('W_PM 与旧文件逐值一致', JSON.stringify(LC.W_PM) === JSON.stringify(OLD_W));

for (const [name, s] of Object.entries(before.scenarios)) {
  if (s.error) { ok(`基线可用 ${name}`, false, s.error); continue; }
  const r = LC.settle(s.light0, s.level, s.delta, false);
  ok(`档位一致 ${name}`, r.step === s.step, `新 ${r.step} vs 旧 ${s.step}`);
  ok(`光值一致 ${name}`, r.light === s.light1, `新 ${r.light} vs 旧 ${s.light1}`);
  ok(`等级一致 ${name}`, LC.levelOf(s.light1) === s.level, `${LC.levelOf(s.light1)} vs ${s.level}`);
  ok(`段位一致 ${name}`, LC.tierOf(s.level) === s.tier, `${LC.tierOf(s.level)} vs ${s.tier}`);
  ok(`累计光一致 ${name}`, JSON.stringify(LC.CUM.slice(0, 6)) === JSON.stringify(s.cum));
  ok(`d10 与 D 自洽 ${name}`, Math.abs(r.d10 - LC.dOf(s.delta) * 10) <= 0.5, `d10=${r.d10} D=${LC.dOf(s.delta)}`);
}

/* ---------- 2. 规格边界（不依赖基线） ---------- */
const D = (body = 0, bond = 0, mind = 0, means = 0) => ({ body, bond, mind, means });
const step = (body, bond, mind, means) => LC.stepOf(LC.d10Of(D(body, bond, mind, means)), false);

ok('体 +6 不涨', step(6) === 0, 'd10=' + LC.d10Of(D(6)));
ok('体 +7 才涨', step(7) === 1, 'd10=' + LC.d10Of(D(7)));
ok('志 +10 卡门上', step(0, 0, 0, 10) === 0, 'd10=' + LC.d10Of(D(0, 0, 0, 10)));
ok('志 +11 才涨', step(0, 0, 0, 11) === 1, 'd10=' + LC.d10Of(D(0, 0, 0, 11)));
ok('体 −26 不缩', step(-26, 0, 0, 0) === 0, 'd10=' + LC.d10Of(D(-26)));
ok('体 −27 才缩', step(-27, 0, 0, 0) === -1, 'd10=' + LC.d10Of(D(-27)));
ok('量级：D 不是 10D', near(LC.dOf(D(7)), 2.1), 'dOf(体+7)=' + LC.dOf(D(7)));
ok('量级：d10 是 10D', LC.d10Of(D(7)) === 21, 'd10Of(体+7)=' + LC.d10Of(D(7)));
ok('单日不叠加：已落档再涨也只 0', LC.stepOf(LC.d10Of(D(9)), true) === 0);
ok('等级不下降：9 光缩档后仍是 9', LC.settle(9, 3, D(-27), false).light === 9);
ok('36 级封顶：满级光数 1062', LC.CUM[36] === 1062, 'CUM[36]=' + LC.CUM[36]);
ok('四段位光数 58/128/276/600', JSON.stringify(LC.TIER_LIGHT) === '[58,128,276,600]');
ok('段位表与累计光自洽',
  LC.CUM[9] === 58 && LC.CUM[18] - LC.CUM[9] === 128 && LC.CUM[27] - LC.CUM[18] === 276 && LC.CUM[36] - LC.CUM[27] === 600);

/* ---------- 输出 ---------- */
const w = (s, n) => String(s).padEnd(n).slice(0, n);
for (const [st, name, detail] of rows) {
  console.log(`${w(st, 5)} ${w(name, 30)} ${detail}`);
}
console.log(`\n${pass} passed, ${fail} failed  (${rows.length} assertions)`);
process.exit(fail ? 1 : 0);
