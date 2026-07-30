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

### 饮水历史展开详情

- 展开详情的 `motion.div` **禁止使用 `overflow-hidden`**，framar-motion 内部会自行处理动画期间的裁剪，设置 `overflow-hidden` 会导致浏览器无法正确计算滚动高度，使部分事项记录被裁剪不可见
- 外层滚动容器的 `max-h` 需足够容纳展开后的内容（建议 600px 以上），当前默认 600px

### PWA / DB 相关

- `addDays` 函数必须使用 `getFullYear/getMonth/getDate` 拼接，**禁止 `toISOString()`**（UTC 时区导致东八区日期回退）
- DB 升级时默认播种数据需谨慎评估是否会自动生成不必要的种子数据
- **Dexie 版本升级必须保留旧版本定义**：新增字段时通过新增 `this.version(N).stores(...)` 实现，**绝对不能**直接修改已有版本的 stores 定义或替换版本号。否则已有用户浏览器中的旧版 DB 会初始化失败导致页面崩溃。

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

- 底部导航栏为 **4-tab**（首页/目标/日程/长期主义），AI 助手通过全局悬浮球访问，导航栏不再保留助手入口
- Bottom Sheet / 弹出面板：操作按钮（确认/取消等）必须固定在底部，**放在滚动容器之外**，使用 `flex flex-col` + 独立的 `shrink-0` 按钮区域，确保始终可见
- 多步向导页面：底部导航栏**禁止使用 `fixed` 定位**，应采用 `flex flex-col h-screen` + 内容区 `flex-1 overflow-y-auto` + 底部 `shrink-0` 的自然流布局，避免 z-index 层叠问题导致按钮被遮挡
  - **注意**：外层容器必须使用 `h-screen`（锁定视口高度）而非 `min-h-screen`（最小高度），否则内容撑高后底部按钮仍会被推出视口
- 所有 `fixed` 定位的底部操作栏必须改为 flex 自然流布局，除非有特殊原因

### 数据查询口径约定

- 首页「饮水提醒」按钮展示的杯数使用独立的 `todayWaterItems` liveQuery（`daylogDB.items.where("date").equals(today).filter(i => i.sourceType === "water")`），与饮水页面数据口径一致
- 首页「今日待办」统计的是所有类型事项（含饮水），不应等同于饮水杯数
- 首页「今日待办」勾选事项必须加 try/catch 兜底，写入失败时 `showToast` 提示用户
- 首页「今日待办」勾选需做乐观更新（乐观更新 Set），确保即时视觉反馈
- 饮水页面历史记录列表展开后，同一天的 items 必须按 `plannedStart` 升序排列

### 目标 V2 空状态（v2.2+）

- 当 `goalList.length === 0` 时，空状态卡片内除了「新建目标」按钮，还需包含「复制提示词」和「导入计划」两个按钮
- 「导入对话框」抽为独立组件 `ImportDialog`，空状态和有状态共用同一组件实例

### 策略阶段系统（GoalV2 v2.1+）

**数据模型增强：**
- `StrategyV2` 新增字段：`startDate/endDate`（策略活跃日期范围）、`cycleType`（`'daily' | 'weekly'`）、`cycleConfig`（JSON 序列化的周期配置）
- DB 版本 2：`goalV2Strategies` 索引不变，新增字段为可选非索引字段

**周期配置格式：**
- `cycleType: 'daily'` → `cycleConfig` = `[{ "title": "...", "time": "08:00", "duration": 30 }, ...]`（**数组**，支持多个时段）
  - 兼容旧版单对象格式：读取时自动检测是否为数组，非数组则包装为单元素数组
  - 时段通过 `sortOrder` 区分，去重使用 `strategyId + title` 组合键
- `cycleType: 'weekly'` → `cycleConfig` = `{ "0": { "title": "...", "time": "08:00", "duration": 30, "enabled": true }, "1": {...}, ... }`（key 为 `getDay()` 值，0=周日~6=周六）

**引擎函数：**
- `getActiveStrategies(goalId, dateStr?)` — 获取指定日期活跃的策略（按 startDate/endDate 过滤）
- `getDailyActionsForDate(strategy, dateStr)` — 返回某日该策略的所有日行动 `DailyCycleItem[]`
- `ensureDailyActionsForDate(goalId, dateStr)` — 为目标指定日期自动生成缺失的日行动（按 strategyId+title 去重）

**创建向导行为：**
- Step 3 每条策略可独立配置日期范围 + 每日固定/按周循环
  - 每日固定模式支持**添加/删除多个时段行**，一个策略可以有多个不同时间段的行动
- Step 5 按周期配置生成当天日行动预览（每个时段生成独立的一条日行动）
- handleSubmit 自动生成跨多周周任务 + 未来 7 天日行动

**详情页行为：**
- 策略卡片展示日期范围、周期类型标签、活跃/待开始/已结束状态
- 活跃策略的日行动由 `ensureDailyActionsForDate` 在访问时自动生成

**使用规范：**
- 如果某件事需要每天在同一策略下拆分多个时间段执行（如「早读磨耳朵」「晚间主学」「睡前复盘」），不应拆成多条独立策略，而应使用同一个策略的多个时段配置

### AI 提示词强制约束（v2.3+）

- `GOAL_V2_AI_PROMPT` 中 `dailyActions` 的 `time` 和 `duration` 已标记为 **必填**（`"HH:MM（必填）"`、`"时长分钟数（必填）"`），AI 输出必须包含这两个字段
- 字段说明中明确标注 `dailyActions` 支持多个时段（如早读、主学、复盘各一条）
- `weeklyPattern` 在 `cycleType: "weekly"` 时**必须提供**，键名使用英文星期名（`monday`/`tuesday`/…），且必须包含完整的 7 天示例
- `parseImportedGoal()` 解析器中新增 `weeklyPattern` 归一化逻辑：支持数字索引（0-6）和英文星期名两种格式，统一转为数字索引存储

### 时间冲突检测（v2.3+）

**纯函数引擎**（`src/lib/conflict-detector.ts`）：
- `detectTimeConflicts(items: ConflictItem[])` — 按 date 分组后检测同一天内所有 Items 的时间重叠，返回冲突列表（含重叠起止时间）
- `checkNewConflict(newItem, existing)` — 检查单个新时段是否与已有列表冲突
- 重叠判定规则：`aStart < bEnd && aEnd > bStart`（端点相等不视为重叠）
- 无任何 React/Next.js 依赖，纯函数可跨模块复用

**集成点**：
- **创建向导**（`/efficiency-v2/new`）：`handleSubmit` 中检测所有 `dailyActions` 的时间重叠，发现冲突时弹出 `window.confirm` 让用户选择「仍然创建」或取消
- **日程页**（`/efficiency/schedule`）：使用 `useMemo` 实时计算当前日期的冲突 ID 集合，`ItemCard` 对有冲突的事项显示红色边框阴影（`0 0 0 1.5px #FF3B30`）

**注意事项**：
- 当前仅做同一天内的简单时间重叠检测，不考虑缓冲区、精力管理等高级因素
- 冲突检测仅在创建目标时触发，修改策略后尚未自动重新检测

### AI 提示词 & 一键导入（v2.2+）

- `src/lib/goal-v2-import-parser.ts` 提供 `GOAL_V2_AI_PROMPT` 常量（完整的五层拆解法提示词）+ `parseImportedGoal()` 解析器 + `validateImportedGoal()` 验证器
- 提示词包含五层拆解法介绍、输出 JSON 格式模板、字段说明和重要规则
- 目标列表页（`/efficiency-v2`）顶部右侧有「复制提示词」和「导入」按钮
  - 「复制提示词」将提示词复制到剪贴板，用户可粘贴发给任意 AI
  - 「导入」打开粘贴框，接收 AI 返回的 JSON，解析后跳转到创建向导并自动填充所有步骤
- 创建向导（`/efficiency-v2/new`）支持从 URL 参数 `?import=` 读取编码后的导入数据
- 导入数据填充后，自动生成每日行动预览并跳转到 Step 5（预览页），用户确认后点击「完成创建」
- 导入的 JSON 格式：`{ title, vision?, color?, keyResults: [{description, targetValue, unit, deadline?}], strategies: [{name, description?, startDate?, endDate?, cycleType, dailyActions: [{title, time, duration}], weeklyTasks: [{title, deliverable}], weeklyPattern? }] }`
  - `weeklyPattern` 键名支持两种格式：数字索引（0=周日, 1=周一, …）或英文星期名（`monday`, `tuesday`, …），导入时会自动归一化  
  - Step 5（每日行动预览）展示所有策略的全部行动（含日期范围），按策略分组显示；weekly 策略不显示时间/时长字段
- **导入数据传递方式**：使用 `sessionStorage`（key: `'import_goal'`）而非 URL query param，避免大型 JSON 被 URL 长度限制截断
  - 源页面写入后 `router.push('/efficiency-v2/new?import=1')`
  - 目标页面 useEffect 读取后立即 `sessionStorage.removeItem('import_goal')` 清理

### 饮水提醒开关（v2.2+）

- 饮水提醒的开关移动到设置页面（`/settings`），使用 `WaterGoal.reminderInterval` 控制
  - `reminderInterval > 0` 表示开启，`reminderInterval === 0` 表示关闭
  - 默认值 0（关闭）
- 首页饮水提醒卡片根据开关状态显示不同内容：
  - 开启且有数据：显示「已开启 · X/Y 杯」→ 点击打开 `WaterReminderSheet`
  - 开启无数据：显示「点击开启喝水提醒」→ 点击打开 `WaterReminderSheet`
  - 关闭：显示「开启或关闭饮水提醒请前往设置」→ 点击跳转 `/settings`
- 饮水页面（`/more/water`）设置卡片底部新增「生成饮水提醒」按钮，点击后：
  - 清理未来 7 天的旧饮水数据
  - 根据当前 `wakeStart/wakeEnd` 重新生成时段（每个整点过 30 分钟，入睡前 2 小时截止）
- `WaterReminderSheet.handleConfirm` 和饮水页面「生成饮水提醒」按钮执行成功后均会同步写入 `reminderInterval: 60`，确保开关状态与实际数据一致

### 首页复盘洞察（v2.3+）— 替代旧仪表盘

- 首页「节奏」仪表盘已被「复盘洞察」（`HomeReview` 组件）取代
- **引擎**：统一使用 `UnifiedReviewer`（`src/lib/brains/reviewer.ts`），`dashboard-summary.ts` 已删除
- **组件**（`src/components/dashboard/HomeReview.tsx`）：
  - 卡片洞察流风格（Apple Health 趋势页风格）
  - 支持 2 种粒度：`daily / weekly`
  - 每张洞察卡片：左侧模块色条 + 模块标签 + 趋势箭头 + headline + detail 描述
  - 底部「行动建议」区域 + 「查看完整复盘」跳转 `/longtermism`
  - 无数据态和加载态（骨架屏）兜底
  - 点击卡片跳转对应模块详情页

### 目标删除 / 重置（v2.2+）

- 目标列表页每张卡片右上角有删除按钮（始终可见，移除 hover 触发），确认后级联删除目标及相关所有数据
- 目标详情页顶部已有删除按钮（`Trash2` 图标）
- 设置页（`/settings`）「数据」区域新增「重置目标数据」按钮，确认后清空全部 5 张 GoalV2 表（goals/keyResults/strategies/weeklyTasks/dailyActions）

### UI 布局（v2.2+）

- `efficiency-v2` 页面的「新建目标」FAB 固定位置为 `bottom-[180px] z-40`，避免与 AI 助手全局 FAB（`bottom-24` ≈ 96px）重叠
- AI 助手全局 FAB 位置保持 `bottom-24 right-5 z-40`

### 长期主义页面（v2.2+）

- 入口：底部导航栏第 4 个 tab（Leaf 图标），路由 `/longtermism`
- 8 张模块卡片（单列列表布局），每张卡片结构：
  - 左侧：主题色图标（44px 圆角容器）
  - 右侧：模块标签（小号）→ 核心数据（17px 加粗）→ 行动引导（12px 灰色）
- 卡片点击跳转对应模块页（`/more/water`、`/more/sleep` 等）
- 数据查询：
  - 饮水 → `daylogDB.items`（`sourceType === "water"`）+ `getWaterGoal()`
  - 睡眠 → `getSleepLogByDate(yesterday)`
  - 记账 → `getTransactionsByMonth(year, month)`
  - 训练 → `getWorkoutSessions(7)`
  - 饮食 → `getDietLogsByDate(today)`
  - 养生 → `getWellnessLogsByDate(today)`
  - 体态拉伸 → `healthDB.stretchLogs.where("date").between(weekStart, weekEnd)`
  - 心愿 → `getWishes()`
- 无数据时显示 `--`，行动引导显示 `「去记录」`

### 长期主义复盘时间轴（v2.3+）— 数据叙事风

- 复盘区域位于长期主义页面 Header 下方、8 张模块卡片上方，以独立卡片呈现
- 顶部标题行 + 4 粒度切换器（日/周/月/年），`ReviewPeriod` 类型定义在 `reviewer.ts`
- 主体内容（数据叙事风格）：
  - Hero 区：大号 headline + 概览文案（`overviewText`）
  - 模块洞察卡片（最多 6 个模块）：模块色条 + 标签 + 趋势箭头 + headline + 所有次发现（findings.slice(1)）
  - 「行动建议」区域（底部，分隔线上方）
- 底部「历史复盘」折叠区域（展示前 4 个周期的 headline + overviewText）
- 数据来源：`UnifiedReviewer.generateReview(period, offset)` + `.getHistoricalReviews(period, 4)`
- 切换粒度时重新加载，有 loading 态和空数据态兜底

### UnifiedReviewer 复盘引擎（v2.3+）— 替代旧 ReviewerBrain

- `ReviewPeriod` 类型：`"daily" | "weekly" | "monthly" | "yearly"`
- `UnifiedReviewer.generateReview(period, offset?)` — 生成指定周期复盘，`offset=0` 为当前周期
- `UnifiedReviewer.getHistoricalReviews(period, count)` — 获取过去 N 个周期的复盘数据
- 输出结构包含 `ReviewResult`：
  - `headline` — Hero 大标题
  - `overviewText` — 概览文案（向后兼容旧格式）
  - `summaries` — 旧格式模块摘要（向后兼容）
  - `insights: ModuleInsight[]` — 按优先级排序的模块级洞察（供首页和长期主义使用）
  - `allFindings: ReviewFinding[]` — 完整发现列表（排序后）
  - `suggestions: string[]` — 行动建议（最多 4 条）
  - `hasData` — 是否有数据
- `ReviewFinding` 类型：含 `id / module / moduleLabel / type / title / description / metric / trend / priority / action`
- 新引擎能力（对比旧 ReviewerBrain）：
  1. **多周期趋势分析**：当前 vs 上一周期各模块数据对比
  2. **日内/周内模式分析**：饮水黑洞时段、入睡波动标准差、周末vs工作日社交时差、训练间隔、消费高峰日、漏餐模式、效率低谷日
  3. **跨模块关联**：饮水达标 vs 入睡时间关联
  4. **行动建议**：基于 low-priority findings 自动生成具体可执行的建议
  5. **优先级排序**：按 `priority` 评分排序 findings，首页只展示 Top 4
  6. **文案变体**：使用 `pick()` 函数随机选择不同表述，避免千篇一律
- 所有模块（goals/finance/water/sleep/fitness/diet/wellness/posture/schedule/medication）均查询真实数据
- `dashboard-summary.ts` 已删除，旧 `LifeDashboard.tsx` 已删除，统一由 `HomeReview.tsx` 替代
- 旧 `ReviewerBrain` 保留为内部 `_OldReviewer` 类，仅用于 `_buildSummaries` 向后兼容

### 艾宾浩斯记忆复习模块（v2.3+）

**数据模型** — 新增 `LifeFlowEbbinghaus` 数据库（`src/lib/db/ebbinghaus.db.ts`），3 张表：

| 表 | 关键字段 | 说明 |
|----|---------|------|
| `decks` | id, name, curveConfig(JSON), createdAt | 卡组，curveConfig 自定义复习曲线 |
| `cards` | id, deckId, front, back, currentRound, nextReviewDate, mastered | 闪卡，每张卡片独立追踪轮次 |
| `reviewLogs` | id, cardId, round, result, reviewedAt | 复习记录流水 |

**标准曲线**：0/1/2/4/7/15 天共 6 轮，per-deck 可自定义（增减轮次、修改间隔天数）

**复习规则**：
- `currentRound = 0` 为首次学习，当天需要复习
- 记住了 → `currentRound += 1`，`nextReviewDate = 今天 + curveConfig.rounds[nextRound].interval`
- 没记住 → `currentRound = 0`，重置到第 1 轮
- 完成全部轮次 → `mastered = true`，不再出现在复习列表
- 曲线修改仅对新复习生效，已排期的卡片不受影响

**页面结构**：
- 卡组列表 `/more/ebbinghaus`：展示所有卡组及今日待复习数，支持新建/删除
- 卡组详情 `/more/ebbinghaus/[deckId]`：两个 Tab — 「今日复习」（翻卡+记住/没记住+进度条）和「所有卡片」（列表+单条/批量添加+删除）
- 批量添加格式：每行 `正面内容 | 背面内容`，支持 `|` 或制表符分隔

**入口**：仅通过长期主义页面（`/longtermism`）的「记忆」模块卡片进入，底部导航栏和首页不新增入口

### 首页布局精简（v2.2+）

- 「下一个事项」卡片与「今日待办」合并为同一卡片。卡片底部有下拉按钮（ChevronDown），点击展开今日待办事项列表
  - 默认折叠。展开后直接显示事项列表（简化为一层，无中间折叠）
  - 展开后顶部显示「今日待办」标题 + 完成计数徽章 + 「完整时间轴」链接
- 首页不再展示「今日提醒条」（pendingReminders UI），提醒后台调度 + `/reminders` 页面不受影响
- 首页不再展示 AI 快捷指令三按钮（今日提醒/安排日程/本周复盘），AI 助手通过全局悬浮球访问
- 删除上述 UI 时仅限渲染层，不触碰功能代码

### 饮水数据展示统一口径（v2.2+）

- 饮水页面 SVG 环形进度内只显示毫升：`{totalWaterMl} / {dailyTarget} ml`，不再显示杯数 `{completedCount}/{totalCount}`
- 饮水页面「今日统计」卡片已移除
- 长期主义页面饮水卡片统一为毫升口径：`{completedWaterMl} / {dailyTarget} ml`
  - `waterCompletedCount = waterItems.filter(i => i.isCompleted).length`
  - `completedWaterMl = waterCompletedCount * 100`
  - `dailyTargetMl = waterGoal.dailyTarget`

