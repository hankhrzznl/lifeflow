# LifeFlow 更新日志

## [2.0.0] - 2026-07

### 新增
- 四级目标拆解引擎（Goal→Milestone→WeeklyTask→DailyAtom）
- 全链路回算机制（L4→L3→L2→L1三级加权，<500ms）
- 4种场景模板（备考/运动/习惯/存款）
- 打卡闭环系统（量化完成+进度反馈+CheckInModal便签纸风格）
- PDCA周复盘6步流程
- 目标演化系统（健康度检查+月度再规划+季度回顾）
- AI辅助洞察（纯本地计算：最佳时间/阻力画像/速度趋势/冲突提醒）
- 跨目标冲突检测（时间重叠/容量超限/截止日冲突）
- 每日时间分配4时段+智能匹配+日程视图
- 定时提醒系统（浏览器Notification+Toast+重复调度）
- 完整统计库（财务/健身/睡眠/饮水统计）
- PWA支持（可安装/离线访问/安装提示/更新提示）
- 3种桌面小组件（今日任务/目标进度/习惯打卡）
- 主题个性化（深色模式/布局密度/字体大小/动画开关）
- 数据导出（JSON全量/CSV目标/CSV打卡）+JSON导入恢复
- "织光者的工作台"设计语言（编织主题+KnittingProgress+MascotIllustration）

### 技术
- Next.js 16 + React 19 + TypeScript + TailwindCSS v4
- Dexie.js 独立引擎实例（LifeFlowEngine）
- Framer Motion 动画
- Recharts 图表（动态导入）
- Serwist PWA Service Worker
- Zustand 状态管理
