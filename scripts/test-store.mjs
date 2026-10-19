/**
 * 执灯人 · store/accounts 纯函数验收
 *   node scripts/test-store.mjs
 * 不需要浏览器：mock localStorage，验证事实层与四账户/工具的边界。
 */
import fs from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};

new Function(fs.readFileSync('pages/core/store.js', 'utf8'))();
new Function(fs.readFileSync('pages/core/accounts.js', 'utf8'))();

const S = globalThis.LightStore;
const A = globalThis.LightAccounts;

let pass = 0, fail = 0;
const rows = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; rows.push(['PASS', name, detail]); }
  else { fail++; rows.push(['FAIL', name, detail]); }
}

const D = '2026-10-17';
const day = () => S.readDay(D);

ok('store 暴露 record/readDay', !!(S && S.record && S.readDay));
ok('accounts 暴露 dayScores', !!(A && A.dayScores));

ok('训练别名 → 运动 → 体', A.canonical('训练') === '运动' && A.accountOf('训练') === 'body');
ok('久坐别名 → 休息 → 体', A.accountOf('久坐') === 'body');
ok('情绪别名 → 情绪记录 → 情', A.accountOf('情绪') === 'bond');
ok('饮水 → 体', A.accountOf('饮水') === 'body');
ok('记账 → 志', A.accountOf('记账') === 'means');

ok('备忘录是工具', A.info('备忘录').kind === 'tool' && A.accountOf('备忘录') === null);
ok('倒数日是工具', A.isTool('倒数日'));
ok('到点提醒是工具', A.isTool('到点提醒'));
ok('更多是工具', A.isTool('更多'));

const w1 = S.record({ mod: '饮水', date: D, metric: 'ml', value: 250, meta: { period: 'afternoon' } });
ok('写入一条饮水', !!w1 && day().records.length === 1);
ok('按模块分组', (day().byMod['饮水'] || []).length === 1);
ok('饮水 250 → 12.5%', Math.abs(A.normalize('饮水', day().byMod['饮水']) - 0.125) < 1e-9);
ok('模块分 13', A.dayScores(day()).body === 13, JSON.stringify(A.dayScores(day())));

S.record({ mod: '饮水', date: D, metric: 'ml', value: 1750, meta: { period: 'afternoon' } });
ok('饮水 2000 → 100%', A.normalize('饮水', day().byMod['饮水']) === 1);
ok('模块分 100', A.dayScores(day()).body === 100);

const beforeTools = JSON.stringify(A.dayScores(day()));
S.record({ mod: '备忘录', date: D, metric: 'notes', value: 1 });
const afterTools = JSON.stringify(A.dayScores(day()));
ok('工具记录不改变四账户分', beforeTools === afterTools, beforeTools + ' → ' + afterTools);
ok('工具进入 tools 而不进入账户', A.dayFacts(day()).tools.length === 1 && A.dayFacts(day()).body.every((x) => x.mod !== '备忘录'));

S.record({ mod: '情绪', date: D, metric: 'tone', value: 'bad' });
ok('情绪 bad → 0.3', Math.abs(A.normalize('情绪记录', day().byMod['情绪']) - 0.3) < 1e-9);
ok('情绪记到 情', A.dayScores(day()).bond === 30);

const last = day().records[day().records.length - 1];
ok('remove 情绪', S.remove(last.id) && !(day().byMod['情绪'] || []).length);
ok('remove 后情回到 null', A.dayScores(day()).bond === null);

S.record({ mod: '睡眠', date: D, metric: 'hours', value: 7 });
S.record({ mod: '睡眠', date: D, metric: 'hours', value: 7.6 });
ok('睡眠取最后一晚 7.6/8', Math.abs(A.normalize('睡眠', day().byMod['睡眠']) - 0.95) < 1e-9);
ok('睡眠不把两晚相加', A.normalize('睡眠', day().byMod['睡眠']) < 1);

ok('空账户是 null 而不是 0', A.dayScores({ byMod: {} }).mind === null);
ok('没有记录时 normalize 是 null', A.normalize('睡眠', []) === null);

ok('clearDay', S.clearDay(D) && day().records.length === 0);
ok('版本号', S.VERSION === 1 && S.KEY === 'lifeflow-days-v1');

for (const r of rows) console.log(r[0].padEnd(5), r[1], r[2] ? '· ' + r[2] : '');
console.log(`\nstore 校验：${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
