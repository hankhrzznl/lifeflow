---
name: lifeflow-design
description: Use this skill to generate well-branded interfaces for LifeFlow (织光者的工作台). Contains colors, type, fonts, assets, and UI kit for prototyping app UIs.
user-invocable: true
---
# LifeFlow Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts, copy assets out and create static HTML files. If working on production code, read the rules here to become an expert in designing with this brand.

## Quick map

- `README.md` — brand context, content fundamentals, visual foundations (read first)
- `colors_and_type.css` — drop-in CSS variables for colors, type, radius, shadow, spacing
- `css.json` — structured token understanding source
- `components/index.json` — component index + cross-component patterns
- `components.css` — aggregated component CSS with DOM anatomy comments
- `library-consumption.json` — recommended downstream read order
- `preview/` — small HTML cards illustrating foundations and components

## Essentials at a glance

- Warm, handcrafted visual identity — 毛线橙 #E88D67 primary, 编织棕 #8B6F5E secondary. No cool colors.
- Radius 4/8/12/16/9999 — progressive rounding, pill shapes for avatars/FAB only.
- 4px spacing unit, 16–24px component padding, 48px max sectional gap.
- Type: ZCOOL KuaiLe / LXGW WenKai for display; -apple-system/BlinkMacSystemFont stack for body; ui-monospace for data.
- Voice: Chinese-first, warm and encouraging, handcrafted metaphor ("织" for scheduling, "针" for tasks). No corporate jargon.
- Shadows warm-earth: 4 levels from subtle (1px blur, rgba(61,52,46,0.05)) to modal (8px/16px, rgba(61,52,46,0.12)). Knit card has 0 2px 0 #C4B5A5 bottom border.
- Knitting metaphor throughout: progress bar is woven fabric grid, empty states show tangled yarn, task completion is "织完这一针".

## Components

| Slug | Name | Key Insight |
|------|------|-------------|
| button | 按钮 | 4 variants — primary毛线橙, secondary编织棕边框, ghost透明, icon圆形. Success state turns松叶绿. |
| goal-card | 目标卡片 | 布料底卡片嵌编织进度条，手写体标题，底部操作栏. |
| task-card | 任务卡片 | 紧凑列表，编织网格checkbox，逾期红色虚线边框. |
| stat-card | 统计卡片 | 大手写数字+小标签，品牌浅色背景，三种状态配色. |
| knitting-progress | 编织进度条 | 核心差异化组件 — 编织网格底+毛线色填充+毛线球动画+手写体百分比. |
| mascot-illustration | 小织插画 | CSS手绘狐狸5状态：等待/编织/完成/困惑/庆祝，毛线橙线条，歪扭造型. |
| empty-state | 空状态 | 居中小织+手写体鼓励文案+主按钮，无数据时温暖引导. |
| bottom-navigation | 底部导航 | 5 Tab + 中心圆形FAB，木桌底+编织纹理顶边，首页有吉祥物徽章. |
| check-in-panel | 打卡面板 | 便签纸风格弹窗，胶带贴角，10步心情评分，'织完这一针'主按钮. |
