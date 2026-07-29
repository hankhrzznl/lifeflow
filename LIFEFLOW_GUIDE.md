# LifeFlow v1.0 上线更新日志

## 产品简介

LifeFlow 是一款轻量的个人生活操作系统（Life OS）。它把日程管理、习惯打卡和记账追踪三件事收进一个 App，让你在一个地方看清时间的去向和生活的节奏。

## 核心功能

**日程管理** — 首页一眼看到今天要做什么，时间轴视图按小时安排全天活动。事项可以手动新建、语音录入、或用作息模板自动生成。完成后勾选，计划偏差随时校准，每周复盘回顾完成率。

**习惯打卡** — 饮水、睡眠、训练、吃药、饮食、养生、体态拉伸，7 个日常习惯模块覆盖生活全貌。每个模块按天打卡，数据自动汇入复盘总览，一周下来一目了然。

**记账追踪** — 支持多账户记录收支，按分类查看消费结构。每月花在哪、剩多少，图表一眼看清。复盘引擎每周自动汇总，帮你守住预算底线。

**AI 助手** — 用自然语言记录事项、查询日程、生成复盘。说一句话就完成录入，不用翻页面。

## 与同类产品有什么不同

市面上的日程 App、习惯 App、记账 App 各管一摊，数据彼此孤立。LifeFlow 用统一的数据层把它们串起来——你不需要打开五个 App 才知道今天过得怎么样。复盘引擎跨模块聚合数据，给你一个完整的"这周过得如何"的答案。

LifeFlow v1.0，一个讲道理的生活助手。

---

## 设计约定（v1.1+ 持续更新）

### 日程时间轴

- 饮水事项（sourceType="water"）不在时间轴右侧普通事项列表中出现，改为**左侧独立水滴指示列**
- 每个整点格有饮水事项 → 显示水蓝色水滴；没有 → 浅灰水滴（opacity 0.22）
- 点击水滴跳转 `/more/water`

### 作息模板

- 预置两套模板组："工作日模板"（默认激活，周一~周五）和"周末模板"（默认激活，周六~周日）
- 每个模板组有独立开关（`enabled`）+ 日期配置（`daysOfWeek: number[]`，0=周日~6=周六）
- 子项级 `isActive` 与组级 `enabled` 两级串联：组关闭则不生成任何子项
- 关闭模板组开关时，删除当天及未来日期的已生成事项，历史数据保留
- 开启模板组开关时，为当天及未来 7 天重新生成事项
- 修改日期配置（去掉某个星期几）时，清理当天及未来该星期几的事项
- 子项的增删改逻辑不变：删除子项时清理未来 7 天对应 Item；新增子项默认 `isActive=true`
- `generateRoutineItems` 使用内存级防重入锁 + 事务内原子读写防止并发重复，生成前检查组 enabled + daysOfWeek + createdAt 边界
- **创建日期边界**：模板组的 `createdAt` 决定了该模板的事项从哪天开始生成。`dateStr < 组创建日期 YYYY-MM-DD` 的日期不会生成该模板的任何事项
- 模板组列表视图和详情视图均展示创建时间（格式 `YYYY-MM-DD`）

### 目标-阶段-任务-事项 层级 [已废弃]

> v2.0 起被「目标五层拆解」系统替代，旧 efficiency.db 中的数据不被迁移，仅保留代码避免编译报错。

- 目标 > 阶段（Phase，含日期范围）> 任务（ScheduleTask）> 事项（Item）
- 阶段可并行，任务只能归属一个阶段，事项可归属阶段或任务
- 目标进度 = 该目标下所有事项的完成数/总数

### 目标五层拆解（GoalV2）

**数据模型** — 5 张表存储在 `goalV2DB`（LifeFlowGoalV2 Dexie 实例）：

| 层 | 表 | 说明 |
|----|-----|------|
| L1 愿景 | goalV2Goals | title + vision（愿景画面）+ color + status + progress（引擎计算） |
| L2 关键结果 | goalV2KeyResults | description + targetValue/currentValue + unit + deadline |
| L3 策略 | goalV2Strategies | name + description（能力线描述） |
| L4 周任务 | goalV2WeeklyTasks | title + weekStart(ISO周日) + deliverable(交付物) |
| L5 日行动 | goalV2DailyActions | title + date + time + duration + isCompleted + itemId(FK) |

**进度引擎**（`goal-v2-engine.ts`）：
- Goal progress = 所有 KeyResult 的 `currentValue/targetValue` 平均值
- 无 KeyResult 时回退到 Strategy → DailyAction 的完成率聚合
- DailyAction 完成/取消完成自动同步写入/删除 Item 表（`syncDailyActionToItem`）

**预置策略模板**：
- 四种目标类型（`fitness/skill/finance/career`）各有 3 条预置策略 + 对应周任务/日行动示例
- 用户创建目标时可选模板快速填充

**创建向导**（`/efficiency-v2/new`）：
5 步不可跳过：愿景 → 关键结果 → 策略模块 → 周任务预览 → 日行动预览

**入口**：`/efficiency-v2` → 目标列表 → 详情页（`/efficiency-v2/goals/[id]`）

### 饮水模块

- 饮水事项改为**用户主动确认后才生成**，不再页面加载时自动生成
- 首页感知卡片区域下方新增「饮水提醒」按钮
- 点击按钮弹出 Bottom Sheet 确认面板：
  - 摘要视图：显示提醒次数、时段、总水量、每日目标
  - 编辑视图：用户可增/删/开关每个具体时段（按小时）
- 确认后清理所有旧数据并生成未来 7 天的 Items + Reminders
- 饮水页面（`/more/water`）移除"今日事项"卡片，新增"饮水历史记录"（近 30 天按天汇总）
- 饮水完成勾选在首页"今日待办"中手动操作
- 提醒走浏览器原生 Notification（手机通知栏），不在首页感知卡片/提醒条中展示

### PWA / DB 相关

- `addDays` 函数必须使用 `getFullYear/getMonth/getDate` 拼接，**禁止 `toISOString()`**（UTC 时区导致东八区日期回退）
- DB 升级时默认播种数据需谨慎评估是否会自动生成不必要的种子数据

### 事项提醒

- Item 新增可选字段 `reminderEnabled` / `reminderMinutes`（v6），写入 daylogDB
- 提醒数据存储在 LifeFlowDB.reminders 表，`moduleType='item'` + `linkedModuleId=item.id` 建立关联
- 寿命联动：Item 开启/关闭/删除/完成/修改时间时，自动同步 Reminder 表
- 默认提醒配置存储于 localStorage（key: `lifeflow_reminder_defaults`），按 sourceType 区分
- 默认值：routine 提前5min、course 提前15min、water 到点、manual/habit 不提醒、task 提前5min
- `syncItemReminder` 回退逻辑：当 `item.reminderEnabled` 为 undefined 时，回退到该 sourceType 的默认配置判断（`getDefaultForType`）。这使自动生成的事项（如饮水）无需手动设置 reminderEnabled 也能生效
- 自动生成的事项（如饮水）在 `ensureModuleItem` 创建 Item 后立即调用 `syncItemReminder`，确保提醒记录自动创建
- Item详情弹窗(TimelineView)支持开关提醒 + 选择提前分钟(0/5/10/15/30)
- `/reminders` 页面区分展示 moduleType='item' 的提醒（显示事项颜色+时间）
- 默认提醒配置入口：`/more/reminder-settings`

### 执行流程约定

- 用户发出需求 → 先读取 LIFEFLOW_GUIDE.md → 引导式提问澄清模糊部分 → 整理成正式任务提示词 → **等待用户确认后才执行**
- 禁止跳过确认环节直接动手

### UI 布局原则（v1.1+）

- Bottom Sheet / 弹出面板：操作按钮（确认/取消等）必须固定在底部，**放在滚动容器之外**，使用 `flex flex-col` + 独立的 `shrink-0` 按钮区域，确保始终可见
- 多步向导页面：底部导航栏**禁止使用 `fixed` 定位**，应采用 `flex flex-col h-screen` + 内容区 `flex-1 overflow-y-auto` + 底部 `shrink-0` 的自然流布局，避免 z-index 层叠问题导致按钮被遮挡
- 所有 `fixed` 定位的底部操作栏必须改为 flex 自然流布局，除非有特殊原因

### 数据查询口径约定

- 首页「饮水提醒」按钮展示的杯数使用独立的 `todayWaterItems` liveQuery（`daylogDB.items.where("date").equals(today).filter(i => i.sourceType === "water")`），与饮水页面数据口径一致
- 首页「今日待办」统计的是所有类型事项（含饮水），不应等同于饮水杯数
