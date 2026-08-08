const fs = require('fs');
const path = 'd:/hankkk/lifeflow/lifeflow-home-redesign/lifeflow-home-redesign.design';
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const valid = new Set(d.data.map((n) => n.id));
const node = d.data.find((n) => n.id === 'page-ideal-day');
node.devMetadata.interactions = [
  { domId: 'nav-home', targetPageId: 'page-home-day', hideEdge: true, transitionLabel: '底部导航 · 首页' },
  { domId: 'nav-goals', targetPageId: 'page-goals', hideEdge: true, transitionLabel: '底部导航 · 目标' },
  { domId: 'nav-schedule', targetPageId: 'page-schedule', hideEdge: true, transitionLabel: '底部导航 · 日程' },
  { domId: 'plan-study', targetPageId: 'page-plan-study', hideEdge: true, transitionLabel: '目标规划' },
  { domId: 'plan-workout', targetPageId: 'page-ideal-day-sheet', hideEdge: true, transitionLabel: '训练规划 · 底部表单' },
  { domId: 'plan-sleep', targetPageId: 'page-plan-sleep', hideEdge: true, transitionLabel: '睡眠规划' },
  { domId: 'plan-posture', targetPageId: 'page-ideal-day-sheet', hideEdge: true, transitionLabel: '体态拉伸规划 · 底部表单' },
  { domId: 'plan-wellness', targetPageId: 'page-ideal-day-sheet', hideEdge: true, transitionLabel: '功法养生规划 · 底部表单' },
  { domId: 'plan-routine', targetPageId: 'page-ideal-day-sheet', hideEdge: true, transitionLabel: '作息规划 · 底部表单' },
  { domId: 'edit-ideal', targetPageId: 'page-ideal-day-edit-step1', hideEdge: true, transitionLabel: '编辑模板 · 第一步' },
];
let cleaned = 0;
for (const n of d.data) {
  const ints = n.devMetadata?.interactions;
  if (!ints) continue;
  const next = ints.filter((it) => { const ok = valid.has(it.targetPageId); if (!ok) cleaned++; return ok; });
  if (next.length !== ints.length) n.devMetadata.interactions = next;
}
fs.writeFileSync(path, JSON.stringify(d, null, 2), 'utf8');
console.log('design fixed. cleaned:', cleaned, '| nodes:', d.data.length);
