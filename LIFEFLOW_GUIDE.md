# LifeFlow v1.0 上线更新日志

## 产品简介

LifeFlow 是一款轻量的个人生活操作系统（Life OS）。它把日程管理、习惯打卡和记账追踪三件事收进一个 App，让你在一个地方看清时间的去向和生活的节奏。

## 核心功能

**日程管理** — 首页一眼看到今天要做什么，时间轴视图按小时安排全天活动。事项可以手动新建、语音录入、或用作息模板自动生成。完成后勾选，计划偏差随时校准，每周复盘回顾完成率。

**习惯打卡** — 饮水、睡眠、训练、饮食、养生、体态拉伸，6 个常驻日常习惯模块覆盖生活全貌。每个模块按天打卡，数据自动汇入复盘总览，一周下来一目了然。**吃药（v2.8+ 维修模式）**：非常驻模块，仅在有用药计划或设置中开启时条件浮现，平时全站隐藏。

**记账追踪** — 支持多账户记录收支，按分类查看消费结构。每月花在哪、剩多少，图表一眼看清。复盘引擎每周自动汇总，帮你守住预算底线。

**AI 助手** — 用自然语言记录事项、查询日程、生成复盘。说一句话就完成录入，不用翻页面。

## 与同类产品有什么不同

市面上的日程 App、习惯 App、记账 App 各管一摊，数据彼此孤立。LifeFlow 用统一的数据层把它们串起来——你不需要打开五个 App 才知道今天过得怎么样。复盘引擎跨模块聚合数据，给你一个完整的"这周过得如何"的答案。

LifeFlow v1.0，一个讲道理的生活助手。

---

## 设计约定（v1.1+ 持续更新）

### 日程时间轴

- **饮水事项作为普通事项显示**（v2.3+）：`sourceType="water"` 的事项以普通卡片形式显示在时间轴中，拥有与其他事项完全一致的行为（勾选完成、长按删除、校准、备注、快捷操作）。~~v1.1 的左侧独立水滴指示列已废弃删除~~，不再有水滴列，点击水滴跳转 `/more/water` 的入口已移除
- **小时块折叠显示**（v2.3+）：
  - 每个小时块（06:00-07:00 等）默认**只显示第一个事项**（按 `plannedStart` 升序）
  - 该时间段有多个事项时，第一个事项下方显示「+N 项 详情」展开入口（N = 事项总数 - 1）
  - 点击「+N 项」或「详情」→ 内联展开该小时块全部事项；再点「收起」折叠
  - **多个时间段可同时展开**，各自独立展开/收起（状态用 `Set<string>` 管理小时块 key）
  - 展开后的事项支持现有全部卡片交互（勾选、长按删除、校准、备注、快捷操作）

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

### 目标-阶段-任务-事项 层级 [已下线 v2.4+]

> T16 起 v1 目标系统完全下线：`LifeFlowEfficiency` 的 `projects`/`phases` 表已物理删除（version 20），`goals` 表历史数据已清空；旧路由全部 308 重定向到 v2。仅 `goals`/`scheduleTasks` 两表结构保留——供训练计划生成器（title 匹配存「强健体魄」体系 Goal）与作息同步/日历/日程时间轴活跃依赖。

- 目标 > 阶段（Phase，含日期范围）> 任务（ScheduleTask）> 事项（Item）
- 阶段可并行，任务只能归属一个阶段，事项可归属阶段或任务
- 目标进度 = 该目标下所有事项的完成数/总数
- **路由下线**：`/tasks`、`/efficiency`、`/efficiency/:path*`（排除 `/efficiency/schedule`）、`/more/projects` 全部 308 → `/efficiency-v2` 或 `/more`，见 `src/proxy.ts`
- **数据下线**：projects/phases 物理删除；goals 6 条历史数据清空后由 `training-plan-generator.ts` 自动重建；scheduleTasks 为活跃写入表，**禁止清空**
- **AI 助手**：目标创建/查询/更新/删除全部落 GoalV2（`goal-v2.db`），习惯打卡落 `life.db` Habit，任务拆解落 daylog items（sourceType='goal'）

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

- 底部导航栏为 **3-tab（v2.10+ T20，原 4-tab 首页/目标/日程/长期主义）**：首页/目标/长期主义，AI 助手通过全局悬浮球访问，导航栏不再保留助手入口；日程页（`/efficiency/schedule`）路由保留，入口移至首页「今日执行」卡片右上角图标
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
  - 支持 **仅 1 种粒度：`daily`（v2.10+ T20 收敛，原 daily/weekly 2 种，weekly 已移除）**
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

- 入口：底部导航栏第 3 个 tab（Leaf 图标），路由 `/longtermism`
- **v2.10+ T20 精简：金字塔模块卡片全部下线**（原 E1 能量底座/E2 目标执行/E3E4 折叠区 16 卡已移除，`LAYER_GROUPS` 分组逻辑删除），模块入口统一收敛到 `/more` 目录，**避免双入口重复**
- 页面仅保留：顶部复盘时间轴 + 底部「历史复盘」折叠区
- **吃药（v2.8+）不在此页展示**：遵循维修模式规则，有用药计划/设置开启时才条件浮现（位于 `/more` 目录「身体养护」组）

### 长期主义复盘时间轴（v2.3+）— 数据叙事风

- 复盘区域位于长期主义页面 Header 下方，以独立卡片呈现
- 顶部标题行 + **2 粒度切换器（周/月，v2.10+ T20 收敛，原 4 粒度日/周/月/年，日/年已移除）**，`ReviewPeriod` 类型定义在 `reviewer.ts`
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

**入口**：仅通过 `/more` 目录「工作/学习」组的「记忆复习」模块进入（v2.10+ T20 起，原「长期主义模块卡片」入口随金字塔卡片下线），底部导航栏和首页不新增入口

### 首页布局精简（v2.2+）

- **v2.8+ T18-3 起重构为「今日驾驶舱」**，本节 v2.2 的「下一个事项+今日待办合并卡片」约定被下述结构替代：
  - 顶部 **E1 能量区**：睡眠 / 饮水 / 作息 三合一健康卡组（最大视觉权重，实时数据），点击跳对应模块
  - 中部 **E2 今日执行**：目标日行动 + 日程待办合并为一条时间流（未完成优先，可按时间段展开），**v2.10+ T20 起卡片右上角新增日程页入口图标**（原底部导航日程 tab 已移除，日程经此处进入）
  - 底部 **复盘洞察**：保留 `HomeReview` Top 4，**仅日粒度**
- **v2.10+ T20 新增驾驶舱概览条「习惯 X · 目标 Y」**：展示活跃习惯数（`life.db Habit` 活跃数）与目标数（GoalV2 active goals 数），点击分别跳 `/more/habits` 与 `/efficiency-v2`
- **E3/E4 入口收敛为小图标行**；吃药维修模式入口不在首页出现
- 首页不再展示「今日提醒条」（pendingReminders UI），提醒后台调度 + `/reminders` 页面不受影响
- 首页不再展示 AI 快捷指令三按钮（今日提醒/安排日程/本周复盘），AI 助手通过全局悬浮球访问
- 删除上述 UI 时仅限渲染层，不触碰功能代码

### 饮水数据口径（v2.4+）— waterLogs 为唯一流水源

- **数据源裁决**：`healthDB.waterLogs` 是唯一流水源（实际饮水量 ml）；`daylog.items(sourceType="water")` 仅承担「待办提醒」展示
- **统一读取**：首页 / 长期主义 / 饮水页的 ml 一律读取 waterLogs（当日 logs 求和），禁止再按 daylog 完成杯数 × 杯量推算
- **勾选同步**：日程页与饮水页勾选/取消 daylog 饮水待办时，调用 `syncWaterLogOnToggle(date, completed)` 同步 ±100ml 到 waterLogs（取消时回退，不足 0 归零）
- **AI 记水**：Agent `handleRecordWater` 直接写 waterLogs（当日单条累加 amount），天然与页面口径一致
- 饮水页面 SVG 环形进度显示：`{totalWaterMl} / {dailyTarget} ml`（ml 来自 waterLogs）
- 首页饮水按钮副标题显示：`已开启 · {todayWaterMl}/{dailyTarget} ml`
- 饮水页「饮水历史（近 30 天）」ml 来自 waterLogs 按天聚合，杯数/待办完成数仍来自 daylog

### T15 饮水时段目标制（v2.7+）— 替代每小时提醒

- **每小时提醒已删除**（T15a）：`WaterReminderSheet` 组件移除、首页不再生成 hourly 待办；旧 `sourceType="water"` 的 daylog items 与关联 reminders 由 `ClientProviders` 一次性清理（幂等）
- **三时段目标制**：上午 `[wakeStart, 12:00)` · 下午 `[12:00, 18:00)` · 晚上 `[18:00, wakeEnd-2h)`；**睡前 2 小时内为夜间**，不计入目标
- **占比配置**：`WaterGoal.morningPercent/afternoonPercent/eveningPercent`（默认 35/40/25），晚上自动补齐 100%；时段目标 = 每日目标 × 占比
- **流水口径（强化）**：每次饮水一条独立 waterLogs 记录（`amount`=单次杯量、`timestamp`=时刻）；**禁止**再出现「每日单条累加」写法；按 `timestamp` 归属时段聚合（`getWaterMlByPeriod`）
- **录入入口**：饮水页「喝了一杯」→ `addWaterCup(date?, cupMl?)`（读 goal 杯量），饮水页与首页/长期主义同步刷新
- **复盘口径**：`reviewer.ts` 饮水模块全量改读 waterLogs（`_analyzeWater` 达标判定 = 每日 ml ≥ dailyTarget，薄弱时段按 hourlyMl 相对均值）
- **旧口径勘误**：上方 v2.4+ 节中「勾选同步 syncWaterLogOnToggle / AI 记水单条累加」均为 T15 前旧约定，T15 起不再适用（函数保留但无调用点）

### T15 课堂节奏作息 45+5（v2.7+）

- `RoutineType` 新增 `'focus'`（课堂节奏）：`splitFocusSlots(start,end)` 按「45 分钟上课 + 5 分钟休息」循环切分，末尾不足 45 分钟作为最后一节上课
- `generateRoutineItems` 对 focus 模板生成多条 Items，`sourceId = ${r.id}#${i}` 序号化去重；休息 Item 专属文案「起身活动 · 顺便喝水」（防久坐方案X，不复用 water sourceType，**不承担饮水语义**）
- focus 作息**不进 ScheduleTask**（`routineSync.ts` 对 `type==='focus'` 直接 return），仅落时间轴 Items
- 作息管理页（/more/schedule/routines）表单含「类型」选择：普通作息 / 课堂节奏·45+5；删除子项时按 `sourceId === id || startsWith(id+"#")` 联动清除全部切分 Items
- 饮水由独立流水与页面承载，作息时间轴仅做执行展示

### T15 训练体系整合（v2.7+，T15b）— 训练中心单入口

- **入口合并**：`/more/fitness` 升级为「训练中心」，顶层三 Tab：训练 / 体态拉伸 / 功法养生；`/more` 目录与长期主义卡片仅保留「训练中心」单入口
- **组件抽取**：体态拉伸内容 → `src/components/fitness/PostureTab.tsx`、功法养生内容 → `src/components/fitness/WellnessTab.tsx`（均去掉独立 header，由 fitness 容器嵌入）
- **路由兼容**：`/more/posture` → `redirect('/more/fitness?tab=posture')`、`/more/wellness` → `redirect('/more/fitness?tab=wellness')`；fitness 页用 `useEffect` 读 `?tab=` 初始化顶层 Tab（旧数据/深链不丢）
- **数据不变**：三块数据模型不动（`workoutSessions` / `stretchLogs` / `wellnessLogs` 各写各表），仅 UI 容器合并；复盘模块 `wellness`/`posture` 仍独立分析

### T15 全系统清理与入口重规划（v2.7+，T15c）— 第一性原理审计

- **原理**：人生管理系统本质 = 帮用户实现目标 → 最小闭环「方向(目标)→计划→执行→记录→反馈→回到方向」→ 三条铁律：①每类用户动作只有一条主路径（单一入口）；②无价值页面不占任何入口；③页面入口必须闭环可达
- **已删除页面/组件（19 个，数据不动）**：`/focus` 空壳页、`/exercise`+`MusclePage`（旧 Muscle 体系）、`/offline`、`/efficiency/settings` stub、`/more/review/{water,sleep,fitness,goals}` 4 占位页、`/plans/[planId]`（v1 遗留断链）、7 个 plugins 代理页、`TabBar.tsx` 死组件、`plugin-config.ts` 死代码
- **清理边界**：删除仅限页面/组件/死代码文件，**数据库表与数据一律不动**（plans 数据保留在库中，仅删入口）
- **proxy.ts 断链规则归零**：仅保留 `/focus`→`/more/focus` 与 `/plugins*` 兜底重定向；凡指向不存在路由的规则一律删除（如 /goals/*、/projects/*）
- **快捷专注 query 预填**：日程页快捷专注跳 `/more/focus?title=&duration=`，focus 页 `useEffect` 读取预填（duration 1-180 过滤）
- **复盘目录收敛**：`/more/review` 仅保留有真实复盘内容的模块（finance/schedule），无内容模块不再占入口

### 产品定位（v2.3+）

- LIFEFLOW 定位为「目标驱动的个人管理系统」（Life OS），非待办清单
- 主线用户路径：定目标（五层拆解）→ 排计划 → 每日执行（日程）→ 记录习惯（长期主义）→ 复盘洞察
- 主画像：有明确长期目标的自我提升者（备考/健身/理财/技能成长）

### 产品优化规划（v2.3+）

- `LIFEFLOW_OPTIMIZATION_PLAN.md` 是产品级优化总文档（审计+架构+路线图）
- 重大架构变更/新模块引入前，应先在该文档中登记再实施，保持单一事实来源

### 架构经验（v2.3+）

- 单一入口原则：同一功能只保留一个入口、一套数据、一条路由；旧版功能（plugins/efficiency v1）隐藏入口但保留路由与数据
- 数据口径在引入新表时统一裁决，避免同一域多表并存（如饮水 waterLogs vs daylog items）

### 旧表归档与冻结（v2.4+，T7/T8 → T13 已物理删除）

- **health.db 旧表归档（T7，已删除）**：`waterRecords`/`sleepRecords`/`fitnessRecords`/`exercises`/`muscleGroups` 曾以 hook 只读保护，**T13 起已物理删除**（记录数核实为 0），hook 与旧 CRUD 均已移除
- **efficiency.db 软冻结（T8，已删除）**：`habits`/`tasks` 曾以 hook 冻结，**T13 起已物理删除**（记录数核实为 0），冻结 hook 与旧 CRUD 均已移除；`goals`/`scheduleTasks`/`projects`/`phases` 仍活跃
- 冻结/归档阶段使用 Dexie `hook('creating'/'updating'/'deleting')` 拦截抛错；确认无数据后由 T13 物理删除

### 数据全量归一（v2.6+，T13）

- **成果**：效率库 6→4 表（v19，删 tasks/habits）、健康库 17→12 表（v12，删 waterRecords/sleepRecords/fitnessRecords/exercises/muscleGroups），应用运行无报错
- **⚠️ Dexie 删表机制（核心经验，勿再踩坑）**：
  - 每个 `version(N).stores()` 的 dbschema 是**历史全部 stores() 声明的累积并集**——仅"最新版本不再列出某表"**不会**让该表消失，`deleteRemovedTables` 永不触发
  - 必须**显式声明 `表名: null`** 覆盖历史声明，该表才会从累计 schema 移除并被物理 drop
  - **版本号必须递增**：IndexedDB 原生版本 = 逻辑版本 ×10；若 IDB 已到当前代码最大版本，后续打开**不再触发 versionchange 升级**，删表不执行
  - 本地验证时务必**干净重启 dev server**（Turbopack HMR 反复重估模块会导致 Dexie 实例/版本号与 schema 不同步，出现"版本已升但表未删"假象）
- **删表前提**：目标表记录数核实为 0（无数据风险）后方可删除；CRUD/Table 声明/hook 一并清理

### 目标系统深度集成（v2.6+，T14）

- **同步主链路**：GoalV2 日行动（DailyActionV2）→ 日程 Item（`sourceType='goal'`，sourceId=DA.id，icon=Target）→ 首页/日程展示；复盘 reviewer 直接读 DA 完成率 + KR 进度生成洞察
- **计划即入日程**：`syncDailyActionToItem`（goal-v2-engine）对**未完成** DA 也会创建 Item（isCompleted 跟随 DA）；取消完成不再删除 Item，仅更新状态（保留用户在日程侧的矫正数据）
- **双向勾选**：目标详情页勾选 DA → 同步 Item 状态；首页勾选 goal 来源 Item → 反向回写 `DA.isCompleted` + `recalculateGoalProgress`（page.tsx `handleToggle`）
- **sourceType 隔离（勿混淆）**：目标行动一律用 `'goal'`，与习惯模块的 `'habit'` 彻底区分；旧逻辑（T14 前）生成的 `habit` 型目标 Item 会在下次同步时被 `removeModuleItems(date,'habit',da.id)` 自动清理
- **级联清理**：`deleteGoalV2`/`deleteStrategyV2`/`deleteWeeklyTaskV2`/`deleteDailyActionV2` 均先清理关联的 goal Item（`removeDailyActionItems`）
- **历史补同步**：`syncAllDailyActionsForGoal`（幂等）在目标详情页挂载时执行；`syncAllDailyActionsByDate` 在目标创建流程（new/page.tsx）中调用
- **⚠️ React Hooks 顺序坑（勿再踩）**：详情页「目标不存在」404 的提前 `return` 必须置于**所有 hooks（useState/useEffect/useCallback/useMemo）之后**，否则目标数据未加载时 hooks 提前退出、加载后 hook 数量变化，触发 `Rendered more hooks than during the previous render` 崩溃；hooks 区对可能为 undefined 的数据一律用可选链（`goal?.color`）；若本地首次进详情页仍偶发该报错且重进即好，为 dev 模式 Fast Refresh 竞态，干净重启 dev server 即可

### v1 → v2 目标数据迁移工具（v2.6+，T9）【已下线，v2.7+ T16】

- **⚠️ 已退役（T16）**：v1 目标系统整体下线，6 目标 + 21 项目数据已确认直接删除，迁移工具 `v1-goal-migration.ts`、`V1GoalMigrationDialog.tsx` 及设置页入口均已移除。本节仅保留作历史记录，不再适用。
- **原则**：v1 数据永不删除（迁移只复制）；全程可重入（注册表 `lifeflow_migration_v1v2_goals` 记录 v1Id→v2Id，已迁移自动跳过）；可回滚（仅删除本次迁移创建的 v2 目标，v1 完好）；首次迁移自动生成 v1 完整快照备份，可下载 JSON
- **字段映射**：title→title、note→vision、deadline→vision「截止」行、color/status/progress/createdAt 直传；`archived`→`paused`
- **习惯打卡迁移**：以 `daysLog` 有无打卡为准判断（⚠️ 应用启动清理会把 goalType 统一改写为 'task'，不得再用 goalType 判断习惯数据）；打卡记录按周日起始周分组 → Strategy「习惯打卡」+ WeeklyTask + DailyAction(isCompleted=true)

### 新用户引导（v2.6+，T10）

- **主线路径**：设立目标（/efficiency-v2）→ 安排日程（/efficiency/schedule）→ 复盘成长（/longtermism），3 步闭环
- **入口**：首页头部下方 `OnboardingCard`（`src/components/ui/OnboardingCard.tsx`），仅首次（未完成）显示，支持「去试试」（跳转并标记完成）/「跳过」（推进下一步）/「X」（completeAll 永久关闭）
- **进度持久化**：`GuideBrain`（`src/lib/brains/guide.ts`）→ localStorage `lifeflow_guide_progress`（已完成 id 数组）；重新实现时保持该键兼容

### /more 目录搜索（v2.6+，T11）

- `/more/page.tsx` 顶部搜索框，按**模块名 / 路径 / 分组名**实时过滤（`MODULE_GROUPS` 静态目录不落库）
- 无结果显示空状态（SearchX +「未找到相关模块」）；清空恢复全部分组；新增模块只需在 `MODULE_GROUPS` 注册即可被检索

### /more 目录 8+8+8 分组（v2.10+，T20）— 时间地图替代能量金字塔

- **背景**：原 E1-E4 能量金字塔分组（能量底座/目标执行/过程记录/成长储备/维修/系统）与用户「8+8+8」时间观不符，整体重构为六组，卡片大小 = 模块占据时间的可视化映射（**时间地图**）
- **六组映射**（`MODULE_GROUPS` 重排）：
  - **睡觉**（XL）：睡眠
  - **工作/学习**（XL/L）：专注计时（L）、记忆复习（M）、课程表（M）
  - **身体养护**（L/M/S）：训练中心（L）、饮食（M）、作息模板（M）、饮水（M）、吃药提醒（S，维修模式条件激活，repair 由组级降条目级）
  - **生活**（M/S）：记账（M）、心愿（S）、倒数日（S）、备忘录（S）
  - **计划与复盘**（M）：理想日蓝图、习惯打卡、复盘总览
  - **系统**（S）：提醒、提醒设置、设置
- **时间权重尺寸档位**（/more 与首页概览条通用）：XL 大图块（8h 级）→ L 标准卡（1-5h 级）→ M 小卡（轻量高频）→ S 紧凑行（系统工具）
- **日历隐藏**：`/more` 目录移除日历入口，`/more/calendar` 路由与数据保留（proxy 不新增重定向），符合「数据不丢」铁律
- **勿回归**：勿将金字塔分组/长期主义模块卡片重新引入；新增模块按 8+8+8 语义放入对应组

### plugins 路由下线（v2.6+，T12）

- **重定向载体**：`src/proxy.ts`（⚠️ Next.js 16 起 `middleware.ts` 约定已废弃，重定向逻辑一律写 proxy；物理旧页面保留但不直接可达）
- **映射表**（308 永久）：`/plugins`→`/more`、`/plugins/finance`→`/more/accounting`、`/plugins/focus-timer`→`/more/focus`、`/plugins/habit(/detail)`→`/more/habits`、`/plugins/task-inbox`→`/pending`、`/plugins/timeline`→`/efficiency/schedule`；其余 `/plugins/*` 兜底→`/more`
- **⚠️ 勿再引入链式重定向**：目标必须直达新版页面（如 `/plugins/focus-timer` 直连 `/more/focus`，而非 `/focus`→`/today`→日程页），避免旧路由接力导致落页错误
- **内部链接一致性**：专注页唯一正式地址为 `/more/focus`（旧 `/focus` 亦 308 至该页）；全站入口（OverviewHeader、TaskDetail、AgentProvider、more/projects）已统一指向 `/more/focus`
- **agent 隐藏页判断**：`AgentProvider` 的 `isHiddenPage` 已同步为 `/more/focus`

### v1 目标系统退役（v2.7+，T16）— 单一化收尾

- **背景**：v1 目标系统（`/efficiency` 系列页面 + `LifeFlowEfficiency` 库）与 GoalV2 双轨并存 → 用户决策「v1 数据 6 目标 + 21 项目直接删除」，整体下线
- **路由下线**：`/efficiency`、`/efficiency/create`、`/efficiency/goals/*`、`/efficiency/review*` 由 `src/proxy.ts` 308 重定向到 `/efficiency-v2`；**`/efficiency/schedule` 是活跃日程模块，proxy 兜底必须排除该前缀**（勿再改回全量 `/efficiency/:path*` 重定向）
- **数据库处置（v19→v20）**：`projects`/`phases` 表物理删除（`表名: null`，21 项目数据删除）；`goals`/`scheduleTasks` 表**保留**（训练计划生成器按 title 匹配 goals、作息同步/日历/日程读 scheduleTasks），upgrade 回调清空 v1 历史数据（goals 6 条，删后由 `initializeTrainingPlans` 自动重建「强健体魄」体系 Goal）
- **AI 助手动作已迁移**（`AgentProvider.tsx`）：习惯打卡→`life.db Habit`（/more/habits 同源，undo 按 `habitName` 精确定位）；创建/查询/更新/批量删除目标→GoalV2 API；AI 目标拆解任务→daylog items（`sourceType='goal'`，sourceId=goalId）；navigate_review→`/more/review`（复盘模块现位于此处，非 /efficiency/review）
- **已删除**：/efficiency 6 页面 + Review 4 组件、`efficiencyStore.ts`、`v1-goal-migration.ts`、`V1GoalMigrationDialog.tsx`、`components/efficiency/` 孤儿组件；设置页「迁移 v1 目标数据」入口同步移除
- **ClientProviders**：移除 v1 旧任务清理 + goalType 统一逻辑（T13 遗留，v1 数据已清空无需再跑）
- **eslint**：`eslint.config.mjs` 增加 `dist/**` 忽略（早期 Vite 产物含超大 JS 导致 formatter 崩溃）
- **⚠️ 勿再引入**：任何新代码不得写入 `efficiencyDB.goals` 的 v1 语义数据（该表仅训练体系生成器专用）；不得再创建 `projects`/`phases` 表引用（类型已删）

### 理想日系统（v2.9+，T19）— 理想的一天的行为闭环

- **入口**：`/more/ideal-day` 配置页（「功能模块」→「计划与复盘」组 → 理想日蓝图），GUIDE 约束单一入口、430px 容器
- **配置存储**：`userSettings.idealDayConfig`（IdealDayConfig，`src/lib/types.ts`）；读 `getIdealDayConfig`（合并默认值）/ 写 `saveIdealDayConfig`
- **排程引擎**（`src/lib/ideal-day.ts`）：`buildStudySlots` 双目标学习分段（省考≥四级 2 倍，绕开午睡窗口）；`syncIdealDayRoutines` 写回作息模板（wake/nap/sleep 三型）；`isTrainingDay` 复用训练计划 `weeklyDays`（无计划回退 [1,3,5]）；`generateIdealDayItems` 幂等生成（`sourceType='ideal'`，sourceId=`ideal-study-{primary|secondary}-{i}` / `ideal-workout` / `ideal-leisure`）；`applyIdealDayBlueprint` 保存后自动排今起 7 天
- **学习/训练/留白用独立 `sourceType='ideal'` 事项，不写 GoalV2**（避免污染目标系统、不删旧）；作息走模板链（`generateRoutineItems`）
- **执行引导**（`src/lib/ideal-day-guide.ts`，`useIdealDayGuidance` hook）：块前 10 分钟提醒（学习/训练横幅）+ 自由时间执行意图弹窗（localStorage key `lifeflow_ideal_day_intention_{date}`）+ 娱乐配额超时卡片飘红（`overdue` prop：红底 #FFE4E2 + 左边框 #FF3B30）；纯页面内轮询，不依赖休眠的 reminder 调度
- **达成率复盘**（`src/lib/brains/reviewer.ts` `_analyzeIdeal`）：四维 = 睡眠（夜间按时 + 午睡完成）/ 学习（ideal-study 块完成分钟）/ 饮水（waterLogs≥蓝图 waterTargetMl）/ 配额（leisure 块完成率），四维平均得整体达成率 + 薄弱维度发现；module=`ideal`（色 #FF2D55，icon Sparkles），首页 MODULE_ROUTES → `/more/ideal-day`，长期主义随 insights 自动展示
- **数据清理**：蓝图关闭仅清今日之后的 ideal 事项（`clearFutureIdealItems`），历史记录保留
- **⚠️ 勿新增**：勿把学习块写回 GoalV2 DA（已决策独立 ideal 来源）；勿在 effect 内同步 setState（react-hooks/set-state-in-effect lint）

### 痛点驱动重构（v2.11+，T21）— 理想日操作系统（备考引擎）

> 核心转向：**不是拿现有功能凑方案，而是从痛点出发重新设计功能**（第一性原理）。方案已登记 PLAN 第九章，本节约定在实施前生效。

- **用户画像**：备考学生（四级 2026.12.12 + 省考 2027.3.15），痛点排序：熬夜 → 拖延 → 锻炼没排进日程 → 吃药 → 记账 → 目标规划
- **每日学习分配**（由课表倒排，不硬编码比例）：省考 **4h/天** + 四级 **2h/天** ≈ 6h；省考科目**顺序学完制**（判断→政治→申论→言语→资料→数量，不轮换）；四级**周一至五刷视频、周六周日复习**
- **备考计划引擎**（核心新增，T21-1/2）：`ExamPlan` = { 考试名, 考试日, 阶段[阶段名, 视频清单, 总时长, 顺序] }；`LessonProgress` = { 课时ID, 完成, 完成日 }；倒排算法 = 剩余课时 ÷ 剩余天数；省考 60 课时 127h 须 **9/16 前**学完（4h/天 ≈ 32 天，硬约束）；四级三阶段视频 102h 顺序推进不跳段
- **省考课表（硬数据）**：判断12×2.5h=30h / 政治6×2h=12h / 申论20×1.5h=30h / 言语9×2.5h=22.5h / 资料8×2.5h=20h / 数量5×2.5h=12.5h
- **四级课表（硬数据）**：① 夯实基础《你还在背单词吗》45 视频 36h（195 词群 + 4 类巧记 + 2190+ 例句，每天 1-2 Lesson）② 专项突破《就这样过四级》50 视频 32h（写/翻/听/读四合一：88 句语法 + 18 大技巧 + 77 篇真题详解）③ 提升能力《真题+模拟》136 视频 34h（1 自测 + 12 真题 + 9 冲刺 + 3 模拟预测 + 附赠素材）④ 冲刺 12/1 起核心词速背 + 急救课 3 视频（素材背诵复用③附赠 30 范文 + 30 翻译预测）
- **睡前仪式**（T21-3）：环境营造提醒（21:00 开暖色灯/放手机）→ 倒计时（21:30）→ 入睡打卡（22:00）三机制；**渐进式目标**：从 23:30 起步逐周提前 30 分钟，**禁止一步到位**；localStorage 存储
- **今日三件事**（T21-4）：每日自动生成「今日学习任务清单」落到理想日学习块 + 手动可调；完成联动进度
- **坐姿健康**（T21-5）：喝水 + 提肛 + 久坐休息合并单一功能（30-45 分钟休息提醒），数据迁移不删旧
- **功能增减**（T21-6 训练 4 Tab 合并单入口；T21-9 删除倒数日/心愿/课程表入口 + 记账每周一句话总结，均隐藏入口、数据与路由保留、不主推统计表）
- **双作息**（T21-7）：理想日配置支持「暑假/开学」两套存储 + 一键切换（开学模板预置，开学后细化）
- **⚠️ 勿新增**：省考 9/16 硬约束不得放宽；四级阶段不得跳段；熬夜治理禁止一步到位；所有删除仅隐藏入口、数据与路由保留

### 理想日操作系统（v2.12+，T22）— 8+8+8 时间轴 · 底导 4-tab · 三层架构

> 核心转向：理想日从配置页升级为底部导航一级页面，以「8+8+8 时间轴模板」组织一天。每个时间段绑定**多个功能**（一对多），点击功能进入规划页安排具体内容，规划完成后日程页时间轴自动显示具体事项。

- **底部导航 4-tab**：首页 / 目标 / 日程 / 理想日（新增 `/ideal-day` 路由，Sun 图标）。旧 `/more/ideal-day` 由 `src/proxy.ts` 308 至 `/ideal-day`（数据不丢）
- **三层架构**：L1 理想日（功能层：8+8+8 模板块 + 功能图标）→ L2 规划页（规划层：`/ideal-day/plan/[feature]`，阶段一落地 study/workout）→ L3 日程页（执行层：`generateIdealDayItems` 自动消费）
- **数据模型**（`src/lib/types.ts`，向后兼容，不新建表）：
  - `IdealDayFeature`：固定功能集 12 项（sleep/study/workout/posture/wellness/water/diet/focus/leisure/notes/routine/medication），每项对应固定 lucide 图标 + 跳转路由（`FEATURE_META`）
  - `IdealDayTemplateBlock`：时间段块（id/label/start/end/group/features[]），group 为 8+8+8 三组（sleep 睡眠区 / fight 战斗区 / life 生活区）
  - `IdealDayTemplate`：多模板（id/name/daysOfWeek?/blocks[]），工作日（周一~五）与周末（六日）默认按星期自动匹配，支持手动切换、复制、重命名、自定义副本
  - `IdealDayPlanItem`：L2 规划数据（blockId/feature/content/detail/start/end/isCompleted），存 `userSettings.idealDayPlans`（key=日期）
- **引擎**（`src/lib/ideal-day-templates.ts`）：`ensureTemplates` 旧配置缺省时从旧字段派生默认模板并回填；`selectTemplate` 按日期自动匹配 + 手动激活兜底；规划读写 `getIdealDayPlans/saveIdealDayPlans/upsertIdealDayPlan`
- **生成器**（`ideal-day.ts generateIdealDayItems` 升级）：按激活模板 blocks 生成块级事项（`sourceId=ideal-block-{tpl}-{block}`）+ 规划具体事项（`sourceId=ideal-plan-{block}-{feature}`）；T19 旧 study/workout/leisure 单块生成逻辑已移除
- **规划页交互**：理想日执行区点击功能图标 → `study/workout` 进规划页（其余直接跳模块页）；规划页保存 → 写 `idealDayPlans` + 重排当日 → 日程页自动显示
- **整段勾选**：执行区点击时间段主体 = 整段完成（仅当该块有规划项时生效，无规划提示先安排）
- **⚠️ 勿新增**：勿新建 Dexie 表存规划（userSettings 足够）；勿删除 `/more` 目录既有入口（双入口保留）；时段自由配置不硬编码 8h 均分；训练中心三 Tab（训练/体态拉伸/功法养生）保持单入口 + `?tab=` 参数兼容，理想日分别绑定三个 feature
- **备考计划并入目标（v2.12+，T22）**：「备考计划」更名为「备考目标」（主/次目标归根到底是目标）；`/more` 目录条目改名 + 换 Target 图标（路由 `/more/exam-plan` 与数据保留）；理想日 study feature 图标由 GraduationCap 换为 Target（学习内容来自目标拆解）；goal-engine 模板名、ThreeThingsCard 文案同步改名

### 理想日 5 大段 + 一页一段（v2.12+，T22.1）— 时间段隔离重构

> 核心转向：理想日从「8+8+8 三组直展」重构为「5 大段两步向导 + 一页一段规划」。每个时间段的功能只对该时间段负责，规划数据按 blockId+feature 严格隔离。

- **5 大段分组**（`IdealDayBlockGroup`）：`sleep`（独特段）/ `morning` / `noon` / `afternoon` / `evening`；旧 3 组（sleep/fight/life）读取时按块 start 时间迁移映射（06-12→morning、12-14→noon、14-18→afternoon、其余→evening）
- **独特睡眠段**：夜间 22:30-06:00 + 午睡 12:30-13:00（共 8h），**仅允许 sleep 功能、不可追加、不可删段**（时间可改）
- **8+8+8 推荐配额**（`SEGMENT_META.quotaHint` + `EIGHT_EIGHT_EIGHT_HINT`，均可调非硬编码）：睡眠 8h（7.5+0.5）· 目标 8h（上午3+下午3+晚上2）· 生活 8h（上午2+下午2+晚上4）；配额 = Step 2 槽位默认时长来源，槽位允许跨段放置，最终以独立起止时间为准
- **两步向导**（理想日页编辑态）：Step 1 五段勾选功能 + 段边界可调（睡眠段锁定）→ Step 2 每段每功能「出现次数 N = 生成 N 个独立时间槽」+ 每槽独立起止时间（可增删、可改）；保存时槽位扁平化为 blocks（一槽一功能，`features:[f]`）
- **一页一段规划路由**：`/ideal-day/plan/[blockId]/[feature]`；旧 `/ideal-day/plan/[feature]` 单段路由 308 → `/ideal-day`（proxy.ts）
- **可规划功能**（进一页一段）：study/workout/sleep/diet/water/focus 共 6 个；其余（posture/wellness/leisure/notes/routine/medication）由理想日页直接跳模块页
- **页内详细引导**（`PLAN_GUIDE`）：每功能 = 说明区 + 1-2-3 规划步骤 + 填写项（内容必填带校验/补充可选）+ 2-3 条可点击回填的示例参考
- **L3 消费**：`generateIdealDayItems` 按模板块（`sourceId=ideal-block-{tpl}-{block}`）+ 规划项（`sourceId=ideal-plan-{block}-{feature}`）生成，槽位独立起止直接消费
- **⚠️ 勿新增**：勿恢复旧 3 组 UI 硬分组（8+8+8 仅作推荐/总览提示）；勿在睡眠段追加功能；勿新建 Dexie 表；规划页一律一页一段（blockId+feature 定位）

### 规划形态重构（v2.13+，T22.2）— 12 功能三种形态

> 12 个理想日功能不再全是独立规划页，按用户决议分为：独立页 / 内嵌底部表单 / 删除或跳模块。

- **独立规划页（3）**：`study`（改名「目标规划」：目标选择器 + 进度联动）/ `sleep`（丰富引导 + 保存写 `addSleepLog`）/ `medication`（保存写 `upsertMedicineLog`，按时段映射 morning/noon/evening/bedtime）
- **内嵌底部表单（4）**：`workout` / `wellness` / `posture` / `routine` —— 点击功能图标在理想日页弹底部表单（样式同功能模块），保存写 `userSettings.idealDayPlans` 并重排；`handleFeatureClick` 分发：`PLAN_PAGE_FEATURES`（3 独立页）→ `INLINE_SHEET_FEATURES`（4 表单）→ 其余跳模块页
- **训练动作清单结构化（T22.2）**：`workout` 表单渲染结构化动作清单（多行：动作名 + `-` `sets×reps` `+` stepper + 删除），10 个快捷动作预设（杠铃卧推/高位下拉/深蹲/硬拉等）；`detail` 存 `JSON.stringify(actions)`，`content` 存文本 `"杠铃卧推 3×12 · 高位下拉 4×10"`；历史单行内容用 `parseActions` 兼容解析回填；保存校验"至少一个动作"
- **功法养生动作模板（T22.2）**：`wellness` 表单结构化（多行：项目名 + `-` `N分钟` `+` 时长 stepper + 删除），8 个模板预设（八段锦 12 分钟/五禽戏 15 分钟/太极拳 20 分钟/站桩/腹式呼吸/冥想/经络拍打/肩颈放松）；`detail` 存 JSON `[{name, minutes}]`，`content` 存 `"八段锦 · 12分钟"`；`parseWellness` 兼容历史
- **作息例行清单分项（T22.2）**：`routine` 表单结构化（多行：分项名 + 删除），8 个常用例行预设（洗漱/早餐/整理书包/出门准备/午餐/晚餐/饭后散步/睡前洗漱）；`detail` 存 JSON `[{name}]`，`content` 存 `"洗漱 · 早餐"`；`parseRoutine` 兼容历史
- **三色环形表动态化（T22.2）**：首页/理想日 8+8+8 推荐条改为 `computeDayDistribution(template)` 实时计算——按 blocks 的 `features` 归类（sleep→紫 #5856D6 / study→蓝 #0A84FF / 其余→绿 #34C759），`conic-gradient` 角度 = 各色分钟/总时长×360°，图例时长与段名列表动态生成，中心显示已安排总小时；切换模板/编辑段即时联动
- **体态拉伸结构化清单（T22.2）**：`posture` 表单结构化（多行：动作名 + `-` `N秒` `+` 时长 stepper（5 秒步进，5~120）+ 删除），8 个常用拉伸预设（肩颈拉伸 30 秒/斜方肌拉伸 30 秒/猫式伸展 60 秒/坐姿转体 45 秒/站立前屈 60 秒/蝴蝶式 60 秒/小腿拉伸 45 秒/手腕放松 30 秒）；`detail` 存 JSON `[{name, seconds}]`，`content` 存 `"肩颈拉伸 30秒 · 猫式伸展 60秒"`；`parsePosture` 兼容历史
- **删除/跳模块（5）**：`water` → `/more/water`；`diet` → `/more/diet`；`focus` → `/more/focus`（目标事项旁加「专注」按钮）；`notes` → `/more/notes`；`leisure` → toast 留白提示（无模块）
- **专注按钮（T22.2）**：日程页 + 首页「今日待办」的目标事项（`sourceType==='goal'`）行内常驻紫色 Timer 圆钮 → `/more/focus`；日程页 `onFocus()` 带 `?title=&duration=` 预填
- **路由**：`/ideal-day/plan/[blockId]/[feature]` 仅 study/sleep/medication 可达；其余 feature 访问返回 null（由理想日页分发）
- **画布**：独立页 3 + 底部表单展示页 1（`ideal-day-sheet.html`，训练表单展开态）+ 编辑两步向导 2 屏 + 5 主页面 = 12 页；`plan-medication` 为维修模式条件功能，理想日执行页无图标、不注册交互

### 理想日 ↔ 日程 双向打通（T22.2）

> 单向生成升级为双向联动：完成态互写、点击互跳、来源可识别。

- **正向（理想日→日程）**：规划保存/整段勾选后 `generateIdealDayItems(today)` 重生成日程项（块级 `ideal-block-{templateId}-{blockId}` + 规划级 `ideal-plan-{blockId}-{feature}`）；`handleToggleBlock` 完成态同步日程（toast「日程已同步」）
- **反向（日程→理想日）**：日程页勾选 `ideal-plan-*` 项 → 正则 `^ideal-plan-(.+)-([a-z]+)$` 解析 blockId+feature（blockId 为 uuid 含连字符，不可 split）→ 回写 `userSettings.idealDayPlans` 对应 isCompleted；goal 类回写 DailyAction 逻辑不变
- **点击互跳**：日程页点击 ideal-plan 项 → study/sleep/medication 跳对应规划页，其余跳 `/ideal-day?block=<blockId>`；ideal-block 块级项 → 定位该时段；理想日页 `?block=` 支持 scrollIntoView 定位 + 2s 紫框高亮闪烁
- **来源识别**：日程页所有 ideal 项显示紫色 `Sparkles + 理想日` 徽标

