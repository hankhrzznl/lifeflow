# LifeFlow 回顾模块技术文档

## 一、功能概述

回顾模块是 LifeFlow 的周期性复盘中心，基于 PDCA（Plan-Do-Check-Act）循环理念设计，帮助用户对任务执行情况进行周期性总结和持续改进。

**核心功能点：**
- 周度/月度周期切换
- 执行概况统计（任务完成率、日均完成、过期任务）
- 优先级分布可视化（四象限分布）
- 目标达成分析（短期事件、每日习惯）
- 项目完成进度
- 结构化回顾记录（亮点、问题、改进点）
- 闭环行动（将改进点转为待办任务）
- AI周报生成（基于数据的智能分析与建议）

## 二、页面结构

### 2.1 入口位置

回顾功能位于独立页面，路由为 `/review`。

### 2.2 UI 布局

页面采用卡片式设计，包含多个统计模块和编辑区域。

```
┌─────────────────────────────────────────┐
│  标题：回顾                              │
│  副标题：周期性复盘，持续改进              │
├─────────────────────────────────────────┤
│  [周度] [月度] ◀ 7/6 - 7/12 ▶ [今天]     │  ← 周期切换器
├─────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┐    │
│  │ 任务完成 │ 完成率   │ 过期任务 │    │  ← 执行概况卡片
│  │    12    │   85%    │     2    │    │
│  └──────────┴──────────┴──────────┘    │
│  ┌──────────────────────────────────┐   │
│  │ 优先级分布                       │   │  ← 优先级分布
│  │ ■ 重要紧急   ████████ 8 (40%)   │   │
│  │ ■ 重要不紧急 ██████    6 (30%)   │   │
│  │ ■ 紧急不重要 ████      4 (20%)   │   │
│  │ ■ 不紧急不重 ██        2 (10%)   │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │ 目标达成                         │   │
│  │ ┌─────────────────────────────┐  │   │
│  │ │ 🎯 短期事件                 │  │   │
│  │ │ 完成率 80% | 过期率 10%     │  │   │
│  │ └─────────────────────────────┘  │   │
│  │ ┌─────────────────────────────┐  │   │
│  │ │ ✨ 每日习惯                 │  │   │
│  │ │ 完成率 75% | 连续7天        │  │   │
│  │ └─────────────────────────────┘  │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │ 项目完成                         │   │  ← 项目进度条
│  │ LifeFlow开发 ████████ 80%       │   │
│  │ 健身计划     ████      40%       │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │ 周期回顾                         │   │
│  │ 💡 亮点                          │   │  ← 亮点列表
│  │   • 完成了3个核心功能             │   │
│  │   • + 添加亮点项                 │   │
│  │ 🔴 问题                          │   │  ← 问题列表
│  │   • 进度落后2天                   │   │
│  │   • + 添加问题项                 │   │
│  │ 🚀 改进点                        │   │  ← 改进点列表
│  │   • 优化时间管理                  │   │
│  │   • + 添加改进点                 │   │
│  │ [保存回顾]                        │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │ ⚡ 闭环行动                       │   │
│  │ 将改进点转化为待办任务            │   │
│  │ [生成本期待办 (2项)]              │   │
│  └──────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │ ✨ AI周报                        │   │  ← AI周报组件
│  │ [生成周报]                       │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 三、核心功能详解

### 3.1 周期切换

**功能说明：**
- 支持周度/月度两种周期类型切换
- 支持前后周期导航（上一周/下一周，上月/下月）
- 快速返回当前周期（"今天"按钮）
- 自动计算周期范围和日期标签

**周期计算逻辑：**

**周度：**
- 以周一为一周的开始
- 当前周：本周一 00:00:00 到本周日 23:59:59
- 标签格式：`7/6 - 7/12`（月/日格式）
- dateKey：`week-YYYY-MM-DD`（周一日期）

**月度：**
- 当前月：当月1日 00:00:00 到当月最后一日 23:59:59
- 标签格式：`2026年7月`
- dateKey：`YYYY-MM`

**状态管理：**
```typescript
const [periodType, setPeriodType] = useState<"week" | "month">("week");
const [periodOffset, setPeriodOffset] = useState(0); // 0=当前周期，-1=上一周期
```

### 3.2 执行概况

**统计指标：**

| 指标 | 计算逻辑 | 说明 |
|------|----------|------|
| 任务完成 | 周期内 status="done" 的任务数 | 本周期完成的任务数 |
| 完成率 | completedCount / totalInPeriod × 100% | 完成任务占总任务比例 |
| 过期任务 | 所有有 dueDate 且已过期且未完成的任务数 | 全局过期任务 |
| 日均完成 | completedCount / periodDays | 周期内日均完成任务数 |

**数据来源：**
- 任务数据：`db.tasks.toArray()`
- 判断周期内任务：`startTime >= range.start && startTime <= range.end`

### 3.3 优先级分布

**四象限分类：**

| 优先级key | 标签 | 颜色 | 含义 |
|-----------|------|------|------|
| urgent-important | 重要紧急 | 红色 | 高优先级，立即处理 |
| not-urgent-important | 重要不紧急 | 橙色 | 中高优先级，规划处理 |
| urgent-not-important | 紧急不重要 | 黄色 | 中优先级，委托处理 |
| not-urgent-not-important | 不紧急不重要 | 灰色 | 低优先级，延后处理 |

**可视化：**
- 使用进度条展示各优先级占比
- Framer Motion 动画效果

### 3.4 目标达成

#### 3.4.1 短期事件

**统计指标：**
- **完成率**：短期事件中已完成比例
- **过期率**：短期事件中过期比例
- **截止日期达标率**：有截止日期的短期事件中按期完成比例

**短期事件定义：**
- `type === "shortterm"` 或 `classification === "short-term"`

#### 3.4.2 每日习惯

**统计指标：**
- **完成率**：习惯打卡次数 / 预期打卡次数 × 100%
- **连续打卡**：从今天往前连续打卡天数
- **中断次数**：周期内未打卡任何习惯的天数

**习惯打卡计算：**
```typescript
// 周期内习惯日志
const periodHabitLogs = habitLogs.filter((l) => {
  if (!habitIds.has(l.taskId)) return false;
  const dayTs = new Date(l.date + "T00:00:00").getTime();
  return dayTs >= range.start && dayTs <= range.end;
});
```

### 3.5 项目完成

**统计逻辑：**
- 按项目分组统计周期内任务
- 计算每个项目的完成任务数和总任务数
- 生成进度条显示完成率

**数据来源：**
- 任务数据：`db.tasks.toArray()`
- 项目数据：`db.projectV2s.toArray()`

### 3.6 回顾记录编辑器

**三大模块：**

1. **亮点（Highlights）**：本周期做得好的事情
2. **问题（Problems）**：本周期遇到的问题和挑战
3. **改进点（Improvements）**：针对问题提出的改进措施

**交互功能：**
- 添加新项：点击"添加"按钮
- 编辑项：点击项文本进入编辑模式，Enter确认，Escape取消
- 删除项：鼠标悬停显示删除按钮

**数据结构：**
```typescript
const [highlights, setHighlights] = useState<string[]>([]);
const [problems, setProblems] = useState<string[]>([]);
const [improvements, setImprovements] = useState<string[]>([]);
```

### 3.7 闭环行动

**功能说明：**
- 将改进点自动转化为待办任务
- 任务标题：`[改进] + 改进点内容`
- 任务类型：`shortterm`（短期事件）
- 任务状态：`active`（待执行）
- 任务优先级：`not-urgent-important`（重要不紧急）
- 任务标签：`["改进", "review"]`

**触发条件：**
- 至少有一个非空的改进点

### 3.8 AI周报生成

**功能说明：**
- 基于周期数据生成智能分析报告
- 使用流式响应，实时展示生成进度
- 支持重新生成
- 支持错误重试（最多3次）

**API接口：**
- 路径：`POST /api/weekly-report`
- 请求体：`{ period, stats }`
- 响应：流式 Markdown 内容

**报告状态：**
```typescript
type ReportState = "idle" | "loading" | "streaming" | "done" | "error";
```

**使用的统计数据：**
```typescript
interface WeeklyReportStats {
  totalMinutes: number;           // 总专注分钟数
  totalSessions: number;          // 总专注次数
  completedSessions: number;      // 完成的专注次数
  averageSessionMinutes: number;  // 平均每次专注时长
  completionRate: number;         // 专注完成率
  bestDay: { date: string; minutes: number } | null; // 最佳专注日
  dailyBreakdown: { date: string; minutes: number; sessions: number }[]; // 每日明细
  hourlyPeak: { hour: number; minutes: number } | null; // 峰值时段
}
```

## 四、数据模型

### 4.1 回顾记录

```typescript
export interface ReviewRecord {
  id?: number;
  type: 'daily' | 'weekly' | 'monthly';     // 回顾类型
  dateKey: string;                          // 周期标识（week-YYYY-MM-DD 或 YYYY-MM）
  summary?: string;                         // 总结（可选）
  stats?: Record<string, number>;           // 统计数据
  highlights?: string[];                    // 亮点列表
  problems?: string[];                      // 问题列表
  improvements?: string[];                  // 改进点列表
  periodType?: 'week' | 'month';            // 周期类型
  periodStart?: number;                     // 周期开始时间戳
  periodEnd?: number;                       // 周期结束时间戳
  createdAt: number;
  updatedAt?: number;
}
```

### 4.2 统计数据结构

```typescript
// 保存到回顾记录中的统计数据
stats: {
  tasksDone: number;        // 完成任务数
  tasksPending: number;     // 待处理任务数
  tasksOverdue: number;     // 过期任务数
  habitStreaks: number;     // 连续打卡天数
  focusMinutes: number;     // 专注分钟数（预留）
  financeIncome: number;    // 收入（预留）
  financeExpense: number;   // 支出（预留）
}
```

### 4.3 优先级配置

```typescript
export const PRIORITY_CONFIG = [
  { key: "urgent-important", label: "重要紧急", bg: "bg-red-100", color: "#EF4444" },
  { key: "not-urgent-important", label: "重要不紧急", bg: "bg-amber-100", color: "#F59E0B" },
  { key: "urgent-not-important", label: "紧急不重要", bg: "bg-yellow-100", color: "#EAB308" },
  { key: "not-urgent-not-important", label: "不紧急不重要", bg: "bg-gray-100", color: "#6B7280" },
];
```

## 五、数据库操作

### 5.1 回顾记录 CRUD

```typescript
// 获取所有回顾记录
export async function getReviewRecords(): Promise<ReviewRecord[]>

// 创建回顾记录
export async function createReviewRecord(
  record: Omit<ReviewRecord, "id" | "createdAt">
): Promise<number>

// 按周期查询回顾记录
export async function getReviewRecordByPeriod(
  periodType: string,
  periodStart: number,
  periodEnd: number
): Promise<ReviewRecord | undefined>

// 按dateKey查询回顾记录
export async function getReviewRecordByKey(key: string): Promise<ReviewRecord | undefined>

// 创建或更新回顾记录
export async function createOrUpdateReviewRecord(
  record: Omit<ReviewRecord, "id" | "createdAt">
): Promise<number>

// 按时间范围查询回顾记录
export async function getReviewRecordsByRange(
  start: number,
  end: number
): Promise<ReviewRecord[]>
```

### 5.2 数据库表结构

**表名：** `reviewRecords`

**索引：** `++id, type, dateKey, periodType, periodStart, periodEnd, createdAt`

### 5.3 关联数据查询

回顾页面需要查询的关联数据：

```typescript
// 页面加载时并行查询
const [tasks, projs, hLogs] = await Promise.all([
  db.tasks.toArray(),           // 所有任务
  db.projectV2s.toArray(),      // 所有项目
  db.habit_logs.toArray(),      // 所有习惯日志
]);
```

## 六、AI周报生成

### 6.1 API 接口

**文件：** [src/app/api/weekly-report/route.ts](file:///d:/hankkk/lifeflow/src/app/api/weekly-report/route.ts)

**请求格式：**
```typescript
interface RequestBody {
  period: {
    start: string;
    end: string;
    type: "week" | "month";
  };
  stats: WeeklyReportStats;
}
```

**响应格式：**
- 流式响应（Streaming Response）
- Content-Type: `text/plain`
- 内容格式：Markdown

### 6.2 周报组件

**文件：** [WeeklyReport.tsx](file:///d:/hankkk/lifeflow/src/components/review/WeeklyReport.tsx)

**核心功能：**
- 调用 API 生成周报
- 流式渲染 Markdown 内容
- 加载状态动画
- 错误处理和重试机制

**状态管理：**
```typescript
const [reportState, setReportState] = useState<ReportState>("idle");
const [content, setContent] = useState("");
const [loadingTextIdx, setLoadingTextIdx] = useState(0);
const [retryCount, setRetryCount] = useState(0);
const [errorMessage, setErrorMessage] = useState("");
```

**流式处理：**
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let result = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  result += decoder.decode(value, { stream: true });
  setContent(result);
}
```

## 七、代码结构

```
src/
├── app/
│   ├── review/
│   │   ├── page.tsx            # 回顾页面主组件
│   │   └── layout.tsx          # 布局组件（force-dynamic）
│   └── api/
│       └── weekly-report/
│           └── route.ts        # AI周报API
├── components/
│   └── review/
│       └── WeeklyReport.tsx    # AI周报组件
├── lib/
│   ├── db.ts                   # 数据库操作函数
│   └── types.ts                # 类型定义
└── components/
    └── ui/
        └── Toast.tsx           # 应用内提示组件
```

### 7.1 页面主组件

**文件：** [page.tsx](file:///d:/hankkk/lifeflow/src/app/review/page.tsx)

**核心状态：**
```typescript
// 周期状态
const [periodType, setPeriodType] = useState<"week" | "month">("week");
const [periodOffset, setPeriodOffset] = useState(0);

// 数据状态
const [loading, setLoading] = useState(true);
const [allTasks, setAllTasks] = useState<Task[]>([]);
const [projects, setProjects] = useState<ProjectV2[]>([]);
const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);

// 回顾记录编辑器状态
const [highlights, setHighlights] = useState<string[]>([]);
const [problems, setProblems] = useState<string[]>([]);
const [improvements, setImprovements] = useState<string[]>([]);
const [saving, setSaving] = useState(false);
const [existingRecord, setExistingRecord] = useState<ReviewRecord | null>(null);
const [editingIndex, setEditingIndex] = useState<{ section: "h" | "p" | "i"; index: number } | null>(null);
const [editValue, setEditValue] = useState("");
```

**核心函数：**
```typescript
loadData()                  // 加载所有数据
getPeriodRange()            // 计算周期范围
handleSave()                // 保存回顾记录
handleGenerateTasks()       // 生成待办任务
handleAddItem()             // 添加编辑项
handleDeleteItem()          // 删除编辑项
startEdit()                 // 开始编辑
commitEdit()                // 提交编辑
```

**子组件：**
- `PeriodSwitcher`：周期切换器
- `OverviewCard`：统计卡片
- `PriorityBar`：优先级进度条
- `ProjectProgressBar`：项目进度条
- `renderEditableList`：可编辑列表渲染函数

## 八、工作流程

### 8.1 用户使用流程

```
进入回顾页面
      ↓
加载数据（任务、项目、习惯日志）
      ↓
加载该周期的回顾记录（如果存在）
      ↓
查看执行概况统计
      ↓
查看优先级分布
      ↓
查看目标达成（短期事件、每日习惯）
      ↓
查看项目完成进度
      ↓
编辑回顾记录（亮点、问题、改进点）
      ↓
保存回顾
      ↓
┌───────┴───────┐
│               │
生成周报     生成待办
│               │
调用AI生成   将改进点转为任务
```

### 8.2 数据加载流程

```
页面加载
      ↓
Promise.all 并行查询
      ↓
┌─────────┬─────────┬─────────┐
│         │         │         │
tasks   projects  habitLogs
│         │         │         │
      ↓
筛选周期内任务（按startTime）
      ↓
计算执行概况（完成数、完成率、过期数、日均）
      ↓
计算优先级分布
      ↓
计算目标达成（短期事件、每日习惯）
      ↓
计算项目完成统计
      ↓
加载该周期的回顾记录
      ↓
更新界面显示
```

### 8.3 保存回顾流程

```
用户点击保存按钮
      ↓
收集当前编辑数据（亮点、问题、改进点）
      ↓
计算当前统计数据
      ↓
调用 createOrUpdateReviewRecord()
      ↓
检查是否存在该周期的记录
      ↓
┌───────┴───────┐
│               │
存在          不存在
│               │
更新记录      创建新记录
      ↓
显示成功Toast
      ↓
重新加载数据
```

### 8.4 闭环行动流程

```
用户点击"生成本期待办"按钮
      ↓
检查改进点是否为空
      ↓
┌───────┴───────┐
│               │
为空         非空
│               │
显示警告     遍历改进点
              ↓
            创建任务：
            - 标题：[改进] + 内容
            - 类型：shortterm
            - 状态：active
            - 优先级：not-urgent-important
            - 标签：["改进", "review"]
              ↓
            显示成功Toast
```

## 九、与其他模块的关联

### 9.1 任务系统

- 回顾页面的数据主要来自任务系统
- 任务完成率、优先级分布、短期事件分析都依赖任务数据
- 闭环行动生成的任务会添加到任务系统中

### 9.2 项目系统

- 项目完成进度依赖项目数据和任务数据的关联
- 通过 `task.projectId` 关联到 `projectV2s`

### 9.3 习惯系统

- 每日习惯统计依赖习惯日志数据
- 通过 `habitLogs.taskId` 关联到习惯任务

### 9.4 健康评分系统

回顾数据可用于健康评分的计算（预留）。

## 十、技术特点

### 10.1 周期计算

- 周度以周一为起始日（符合国际标准）
- 月度自动处理跨年边界
- 支持偏移量计算任意周期

### 10.2 动画效果

使用 Framer Motion 实现：
- 周期切换指示器滑动动画
- 优先级进度条填充动画
- 项目进度条填充动画
- 编辑列表展开/收起动画

### 10.3 流式响应

AI周报使用流式响应：
- 实时显示生成进度
- 减少等待时间
- 支持超时处理（30秒）

### 10.4 错误处理

- 数据库操作使用 try-catch 静默失败
- AI周报支持最多3次重试
- 超时和网络错误友好提示

### 10.5 动态渲染

页面使用 `force-dynamic` 确保每次请求都重新渲染。

## 十一、扩展建议

### 11.1 功能扩展

1. **日度回顾**：添加日度复盘功能
2. **季度/年度回顾**：支持更长周期的复盘
3. **回顾模板**：提供预设的回顾模板
4. **对比分析**：支持不同周期之间的数据对比
5. **数据导出**：支持导出回顾报告（PDF/Markdown）
6. **团队回顾**：支持团队协作的复盘功能
7. **图表可视化**：添加更多统计图表（柱状图、饼图等）

### 11.2 UI 优化

1. 添加回顾日历视图
2. 优化移动端体验
3. 添加深色模式支持
4. 添加键盘快捷键支持
5. 优化数据加载性能

### 11.3 AI 能力增强

1. 支持自定义报告模板
2. 添加自然语言查询
3. 生成行动建议（不仅仅是分析）
4. 支持多语言报告

## 十二、注意事项

### 12.1 数据依赖

- 回顾页面依赖任务、项目、习惯日志等多个数据源
- 如果没有数据，页面显示默认统计（0）
- 建议先使用其他功能产生数据后再使用回顾功能

### 12.2 周期计算

- 周度周期以周一为开始，周日为结束
- 月度周期包含当月所有天数
- 跨月周（如6月30日-7月6日）会显示为 `6/30 - 7/6`

### 12.3 性能考虑

- 当前实现一次性加载所有任务数据
- 对于大量任务（>1000），可能影响加载速度
- 建议考虑分页或虚拟滚动优化

### 12.4 AI 周报

- 需要后端 API 支持
- 流式响应需要 HTTPS 环境
- 超时时间为30秒，建议优化网络连接

### 12.5 数据一致性

- 统计数据基于当前加载的任务计算
- 如果任务数据在查看期间被修改，需要刷新页面才能看到最新数据
- 建议添加自动刷新机制

## 十三、使用示例

### 13.1 创建回顾记录

```typescript
// 创建或更新周度回顾记录
await createOrUpdateReviewRecord({
  type: "weekly",
  dateKey: "week-2026-07-06",
  stats: {
    tasksDone: 12,
    tasksPending: 3,
    tasksOverdue: 2,
    habitStreaks: 7,
    focusMinutes: 0,
    financeIncome: 0,
    financeExpense: 0,
  },
  highlights: ["完成了3个核心功能", "团队协作效率提升"],
  problems: ["进度落后2天", "需求变更频繁"],
  improvements: ["优化时间管理", "建立需求变更流程"],
  periodType: "week",
  periodStart: 1720214400000, // 周一时间戳
  periodEnd: 1720732799000,   // 周日时间戳
});
```

### 13.2 查询回顾记录

```typescript
// 按周期查询
const record = await getReviewRecordByPeriod("week", startTimestamp, endTimestamp);

// 按dateKey查询
const record = await getReviewRecordByKey("week-2026-07-06");
```

### 13.3 生成待办任务

```typescript
// 将改进点转为任务
for (const item of improvements) {
  await createTask({
    title: `[改进] ${item}`,
    type: "shortterm",
    status: "active",
    priority: "not-urgent-important",
    tags: ["改进", "review"],
  });
}
```
