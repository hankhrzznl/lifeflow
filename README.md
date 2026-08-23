# LifeFlow v3 · 旧版全量（留档版）

> 版本定位：v3 旧版全量画布，**留档对照用**，不再演进。
> 现行主版本为 `../lifeflow-v5/`（等级制重做版）。

## 快速开始

双击 `start-server.bat`，自动启动本地预览（http://localhost:8103）并打开总览页 `index.html`。

## 版本构成

| 部分 | 内容 |
|---|---|
| 页面 40 | 旧版全量页面（目标/睡眠/饮水/训练/专注/回顾/备忘/设置等，含旧版 home 与历史页） |
| 画布 | `lifeflow-v3.design`（40 节点） |
| 设计令牌 | `colors_and_type.css` |
| 资产 | `assets/lucide.min.js` |

## 页面背景方案

与 v5 一致采用纯 CSS 背景（暖米底 + 渐变光晕），无位图依赖；留档页保持原始形态，未做 v5 化改造。

## 文档（docs/）

v3 演进期的方案文档（v1/v2 版推倒重做方案、等级制 v1/v2、六句话重构、用户体验架构等），供追溯设计决策历史。

## 校验状态

- 画布格式校验：通过（0 阻断错误）
- 说明：37 项导航契约提示为旧版页面固有结构（未按 v5 契约改造），不影响画布渲染，v3 定位为留档不再修复

## 目录结构

```
lifeflow-v3/
├── lifeflow-v3.design      # 画布入口
├── colors_and_type.css     # 设计令牌
├── pages/                  # 40 个页面
├── assets/                 # lucide.min.js
├── docs/                   # v1-v2 历史方案文档
├── index.html              # 总览页（40 页卡片）
├── compare-v3-v4-v5.html   # v3 / v5 同屏对比页
└── start-server.bat        # 一键预览
```
