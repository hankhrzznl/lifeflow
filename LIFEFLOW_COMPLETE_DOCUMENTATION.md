# LifeFlow 完整网站文档

## 一、项目概览

LifeFlow 是一款基于 Next.js 16 + React 19 构建的个人生产力与健康管理 Web 应用。它提供了任务管理、项目规划、健康追踪、财务记账等全方位的个人管理功能，支持 PWA 离线使用。

### 核心价值主张

> **捕捉 · 规划 · 专注 · 回顾**

LifeFlow 帮助用户建立完整的个人管理闭环：从想法捕捉到任务规划，再到专注执行和周期性回顾，形成持续改进的个人成长体系。

---

## 二、技术栈

### 前端框架
| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.2.6 | 全栈框架，App Router |
| React | 19.2.4 | UI 组件库 |
| TypeScript | 5.x | 类型安全 |

### 样式与动画
| 技术 | 版本 | 用途 |
|------|------|------|
| Tailwind CSS | 4.3.2 | 原子化 CSS |
| Framer Motion | 12.38.0 | 动画效果 |

### 数据库与状态管理
| 技术 | 版本 | 用途 |
|------|------|------|
| Dexie.js | 4.4.2 | IndexedDB 封装，本地数据持久化 |

### 数据可视化
| 技术 | 版本 | 用途 |
|------|------|------|
| Recharts | 3.8.1 | 图表组件 |

### 图标与工具
| 技术 | 版本 | 用途 |
|------|------|------|
| Lucide React | 1.14.0 | 图标库 |
| react-markdown | 10.1.0 | Markdown 渲染 |
| @dnd-kit | ^6.x | 拖拽功能 |

### PWA 支持
- Service Worker
- Web App Manifest
- 离线检测与存储监控

---

## 三、目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API 路由
│   │   └── weekly-report/route.ts
│   ├── assistant/          # 助手模块
│   │   ├── finance/page.tsx    # 记账
│   │   ├── fitness/page.tsx    # 健身
│   │   ├── sleep/page.tsx      # 早睡分析
│   │   ├── water/page.tsx      # 喝水提醒
│   │   └── page.tsx            # 助手首页
│   ├── capture/page.tsx    # 捕捉页面
│   ├── planner/            # 规划页面
│   │   ├── TodayTab.tsx
│   │   └── page.tsx
│   ├── projects/           # 项目管理
│   │   ├── [projectId]/boards/[boardId]/sections/[sectionId]/page.tsx
│   │   ├── [projectId]/goals/[goalId]/page.tsx
│   │   ├── unclassified/page.tsx
│   │   └── page.tsx
│   ├── review/             # 回顾页面
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── stats/              # 统计页面
│   │   ├── components/
│   │   │   ├── FinanceStats.tsx
│   │   │   ├── FitnessStats.tsx
│   │   │   ├── SleepStats.tsx
│   │   │   └── WaterStats.tsx
│   │   └── page.tsx
│   ├── today/page.tsx      # 主页
│   ├── layout.tsx          # 根布局
│   ├── globals.css         # 全局样式
│   └── ...
├── components/             # 通用组件
│   ├── agent/              # AI 助手
│   ├── layout/             # 布局组件
│   │   ├── CaptureInbox.tsx
│   │   ├── OverviewHeader.tsx
│   │   └── QuickCaptureBar.tsx
│   ├── navigation/         # 导航组件
│   │   ├── BottomTabBar.tsx
│   │   └── DesktopSidebarV2.tsx
│   ├── pwa/                # PWA 组件
│   │   ├── OfflineDetector.tsx
│   │   ├── SWProvider.tsx
│   │   ├── SWUpdateBanner.tsx
│   │   └── StorageMonitor.tsx
│   ├── ui/                 # UI 组件
│   │   ├── BottomSheet.tsx
│   │   ├── Dialog.tsx
│   │   ├── FAB.tsx
│   │   └── Toast.tsx
│   └── ...
├── lib/                    # 工具函数与数据层
│   ├── db.ts               # 数据库核心（Dexie）
│   ├── types.ts            # TypeScript 类型定义
│   ├── agent-core.ts       # AI 助手核心逻辑
│   ├── agent-db.ts         # AI 助手数据库
│   ├── agent-state.ts      # AI 助手状态管理
│   ├── financeStats.ts     # 财务统计
│   ├── fitnessStats.ts     # 健身统计
│   ├── sleepStats.ts       # 睡眠统计
│   ├── waterStats.ts       # 饮水统计
│   └── ...
└── middleware.ts           # 中间件
```

---

## 四、数据库设计

### 4.1 数据库 Schema（Dexie.js v25）

LifeFlow 使用 Dexie.js 管理 IndexedDB，经历了 25 次版本迭代。

```typescript
export class LifeFlowDB extends Dexie {
  // 核心任务系统
  tasks!: Table<Task, number>;
  habit_logs!: Table<HabitLog, number>;
  
  // 项目层级
  projectV2s!: Table<ProjectV2, number>;
  boards!: Table<Board, number>;
  sections!: Table<Section, number>;
  
  // 财务系统
  finRecords!: Table<FinRecord, number>;
  finAccounts!: Table<FinAccount, number>;
  finBudgets!: Table<FinBudget, number>;
  
  // 健康系统
  muscleGroups!: Table<MuscleGroup, number>;
  subMuscles!: Table<SubMuscle, number>;
  muscleRecords!: Table<MuscleRecord, number>;
  sleepRecords!: Table<SleepRecord, number>;
  dailyWaterRecords!: Table<DailyWaterRecord, number>;
  
  // 回顾系统
  reviewRecords!: Table<ReviewRecord, number>;
  
  // 其他
  agentMemory!: Table<AgentMemory, number>;
  agentChats!: Table<AgentChatSession, string>;
  reminders!: Table<Reminder, number>;
  userSettings!: Table<UserSettings, number>;
  // ... 共 30+ 张表
}
```

### 4.2 核心数据模型

#### Task（任务）
```typescript
export interface Task {
  id?: number;
  title: string;
  type: 'longterm' | 'shortterm' | 'daily' | 'habit';
  status: 'active' | 'done' | 'archived';
  projectId?: string;
  sectionId?: number;
  boardId?: number;
  dueDate?: number;
  priority?: 'urgent-important' | 'not-urgent-important' | 
             'urgent-not-important' | 'not-urgent-not-important';
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}
```

#### ProjectV2（项目）
```typescript
export interface ProjectV2 {
  id?: number;
  name: string;
  color?: string;
  createdAt: number;
}
```

#### MuscleRecord（健身记录）
```typescript
export interface MuscleRecord {
  id?: number;
  subMuscleId: number;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  rpe: number;
  date: string;
  isPersonalBest?: boolean;
  createdAt: number;
}
```

#### DailyWaterRecord（饮水记录）
```typescript
export interface DailyWaterRecord {
  id?: number;
  date: string;
  entries: { ml: number; timestamp: number }[];
  totalMl: number;
  createdAt: number;
}
```

### 4.3 数据层级关系

```
Project（项目）
  └── Board（目标）
        └── Section（阶段）
              └── Task（任务）
```

---

## 五、路由结构

### 底部导航（BottomTabBar）

| 路由 | 名称 | 图标 | 功能 |
|------|------|------|------|
| `/` | 主页 | CalendarDays | 今日任务、时间线、捕捉 |
| `/planner` | 规划 | Layers | 项目列表、待安排任务 |
| `/review` | 回顾 | BarChart3 | 周/月度复盘、统计 |
| `/assistant` | 助手 | Bot | 早睡、喝水、记账、健身 |
| `/stats` | 统计 | TrendingUp | 健康/财务数据可视化 |

### 助手子路由

| 路由 | 功能 |
|------|------|
| `/assistant/sleep` | 早睡分析 |
| `/assistant/water` | 喝水提醒 |
| `/assistant/finance` | 记账管理 |
| `/assistant/fitness` | 健身记录 |

### 项目管理子路由

| 路由 | 功能 |
|------|------|
| `/projects` | 项目列表 |
| `/projects/unclassified` | 未分类任务 |
| `/projects/[id]/boards/[boardId]/sections/[sectionId]` | 阶段详情 |
| `/projects/[id]/goals/[goalId]` | 目标详情 |

---

## 六、核心功能模块

### 6.1 主页（TodayPage）

**路径**: `src/app/today/page.tsx`

主页是用户的每日入口，包含三个核心区域：

```tsx
export default function TodayPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <OverviewHeader />           {/* 概览头部 */}
      <QuickCaptureBar />          {/* 快速捕捉栏 */}
      <CaptureInbox />             {/* 捕捉收件箱 */}
      <TodayTab />                 {/* 今日任务列表 */}
      <TodayTimeline />            {/* 时间线 */}
    </div>
  );
}
```

**功能特点**:
- 快速捕捉：一键输入想法，支持连续输入
- 今日任务：按优先级展示待办事项
- 时间线：展示当日日程安排

### 6.2 快速捕捉（QuickCaptureBar）

**路径**: `src/components/layout/QuickCaptureBar.tsx`

```tsx
const handleSend = async () => {
  if (!inputValue.trim()) return;
  await createTask({
    title: inputValue.trim(),
    type: "daily",
    status: "active",
    tags: [...selectedTags],
    projectId: selectedProjectId ?? undefined,
  });
  showToast({ message: "想法已捕捉", type: "success" });
  setInputValue("");
  inputRef.current?.focus(); // 支持连续输入
};
```

**功能特点**:
- 实时项目选择下拉
- `#` 触发标签建议
- 连续输入支持

### 6.3 规划页面（PlannerPage）

**路径**: `src/app/planner/page.tsx`

规划页面采用双 Tab 设计：

| Tab | 功能 |
|-----|------|
| 安排 | 项目列表，可展开查看目标和任务 |
| 今日 | 今日任务详情 |

**项目卡片展开逻辑**:
```tsx
function ExpandedProjectCard({ project }) {
  // 加载项目下的短期事件和日常习惯
  const shorttermGoals = goals.filter(g => g.type === "shortterm");
  const dailyGoals = goals.filter(g => g.type === "daily");
  
  // 计算完成进度
  const stProgress = shorttermGoals.length > 0 
    ? Math.round((stDone / shorttermGoals.length) * 100) : 0;
  
  return (
    // 展示进度条和目标列表
  );
}
```

### 6.4 助手模块（Assistant）

**路径**: `src/app/assistant/page.tsx`

助手模块集成四个生活辅助工具：

| 工具 | 描述 | 颜色主题 |
|------|------|----------|
| 早睡分析 | 设定入睡目标 + 定时提醒 + 趋势图表 | 靛蓝紫 |
| 喝水提醒 | 定时推送提醒 · 一键喝水 | 蓝青 |
| 记账 | 多账户 · 预算 · 报表 · 月度统计 | 翡翠绿 |
| 健身 | 力量训练记录 · 趋势图表 · 肌群管理 | 橙红 |

#### 6.4.1 喝水提醒（WaterPage）

**路径**: `src/app/assistant/water/page.tsx`

**核心功能**:
- 自定义每日饮水目标（默认 2000ml）
- 定时提醒（30/60/90/120 分钟间隔）
- 夜间免打扰（可自定义时段）
- 快捷喝水按钮（共享水杯预设值）
- 饮水明细记录与撤销

**提醒触发逻辑**:
```tsx
const fireReminder = () => {
  // 免打扰检查
  if (dndEnabled && isInDndPeriod(dndStart, dndEnd)) {
    scheduleNext();
    return;
  }
  // 浏览器通知
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("💧 该喝水了", { body: `已经${intervalMin}分钟没喝水了` });
  }
  // 应用内 toast
  showToast({ message: `💧 该喝水了！`, type: "info" });
  scheduleNext();
};
```

#### 6.4.2 早睡分析（SleepPage）

**路径**: `src/app/assistant/sleep/page.tsx`

**核心功能**:
- 入睡目标设定
- 提前提醒（5-60 分钟可调）
- 今日达标进度可视化
- 连续早睡天数统计（徽章系统）
- 7天入睡趋势折线图
- 手动校准入睡时间

**数据来源**:
- 从日程系统自动提取睡眠时间段
- 支持手动校准覆盖

**连续天数计算**:
```tsx
const consecutiveDays = (() => {
  let count = 0;
  for (let i = 0; i < 365; i++) {
    const checkDate = shiftDate(today, -(i + 1));
    const entry = logs.find(l => l.date === checkDate);
    if (!entry) break;
    if (entry.sleepTime > targetMinutes) break;
    count++;
  }
  return count;
})();
```

#### 6.4.3 健身模块（FitnessPage）

**路径**: `src/app/assistant/fitness/page.tsx`

**肌群层级系统**:
```
大肌群（6个）
  └── 小肌肉（每个3-4个）
        └── 预设动作（多个）
              └── 训练记录
```

**默认大肌群**:
| 肌群 | 子部位 |
|------|--------|
| 胸部 | 上胸、中胸、下胸、内侧胸 |
| 背部 | 背阔肌、斜方肌、菱形肌 |
| 腿部 | 股四头肌、腘绳肌、小腿肌群 |
| 肩部 | 前束、中束、后束 |
| 手臂 | 肱二头肌、肱三头肌、前臂 |
| 核心 | 腹直肌、腹斜肌、下背部 |

**训练记录结构**:
```typescript
export interface MuscleRecord {
  subMuscleId: number;      // 关联小肌肉
  exerciseName: string;     // 动作名称
  sets: number;             // 组数
  reps: number;             // 次数
  weight: number;           // 重量(kg)
  rpe: number;              // RPE 1-10
  restTime: number;         // 休息(秒)
  date: string;
}
```

### 6.5 回顾页面（ReviewPage）

**路径**: `src/app/review/page.tsx`

**核心功能**:
- 周/月度切换
- 执行概况统计（完成率、过期任务、日均完成）
- 优先级分布可视化
- 目标达成分析（短期事件、每日习惯）
- 项目完成进度
- 亮点/问题/改进点编辑
- 闭环行动：改进点转待办任务

**统计指标**:
```tsx
// 执行概况
const completedCount = periodTasks.filter(t => t.status === "done").length;
const completionRate = totalInPeriod > 0 
  ? Math.round((completedCount / totalInPeriod) * 100) : 0;
const overdueCount = allTasks.filter(
  t => t.dueDate && t.dueDate < now && t.status === "active"
).length;

// 习惯连续打卡
const consecutiveDays = getConsecutiveDays();
```

**闭环行动**:
```tsx
const handleGenerateTasks = async () => {
  for (const item of improvements) {
    await createTask({
      title: `[改进] ${item.trim()}`,
      type: "shortterm",
      status: "active",
      priority: "not-urgent-important",
      tags: ["改进", "review"],
    });
  }
};
```

### 6.6 统计页面（StatsPage）

**路径**: `src/app/stats/page.tsx`

统计页面聚合四个维度的数据可视化：

| 统计模块 | 组件 |
|----------|------|
| 饮水统计 | WaterStats |
| 财务统计 | FinanceStats |
| 健身统计 | FitnessStats |
| 睡眠统计 | SleepStats |

支持周度/月度切换和时间导航。

---

## 七、UI/UX 设计

### 7.1 设计系统

**主题色**:
- 主色调：靛蓝紫 (`#6366F1`)
- 成功色：翡翠绿 (`#10B981`)
- 警告色：琥珀橙 (`#F59E0B`)
- 错误色：玫瑰红 (`#EF4444`)

**卡片风格**:
```tsx
// 标准卡片
<div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
```

**动画效果**:
- Framer Motion 入场动画
- 进度条过渡动画
- Tab 切换滑动指示器

### 7.2 响应式布局

```tsx
// 移动端单列，桌面端多列
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
```

### 7.3 深色模式

通过 Tailwind 的 `dark:` 前缀实现自动深色模式适配：
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

---

## 八、数据迁移与升级

### 8.1 版本迁移历史

| 版本 | 变更 |
|------|------|
| v1 | 初始表：capture, events, focusLogs, projects |
| v3 | 新增 tasks 表，迁移 capture 和 events |
| v10 | 新增 projectV2s 表 |
| v11 | 新增 boards、sections 表 |
| v15 | 新增肌肉训练相关表 |
| v18 | 新增财务相关表 |
| v23 | 删除 deprecated 的 submodules 表 |
| v24 | 新增 userSettings、dailyWaterRecords 表 |
| v25 | 新增 finBudgets 表 |

### 8.2 迁移示例（v3）

```typescript
this.version(3).stores({
  tasks: "++id, type, status, parentTaskId, startTime, projectId, createdAt",
}).upgrade(async (tx) => {
  // 迁移 capture 到 tasks
  const captures = await tx.table("capture").toArray();
  for (const c of captures) {
    await tx.table("tasks").add({
      title: c.content,
      type: "daily",
      status: c.status === "trash" ? "archived" : "active",
      tags: c.tags || [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
  }
});
```

---

## 九、PWA 功能

### 9.1 离线检测

**组件**: `src/components/pwa/OfflineDetector.tsx`

检测网络状态，离线时显示提示。

### 9.2 存储监控

**组件**: `src/components/pwa/StorageMonitor.tsx`

监控 IndexedDB 存储空间使用情况。

### 9.3 版本更新

**组件**: `src/components/pwa/SWUpdateBanner.tsx`

Service Worker 更新通知，支持一键刷新。

---

## 十、运行与部署

### 10.1 开发命令

```bash
npm run dev        # 启动开发服务器
npm run build      # 构建生产版本
npm run start      # 预览生产构建
npm run lint       # 代码检查
```

### 10.2 部署配置

**Vercel 配置**:
- 构建命令：`vite build`（或 `next build`）
- 输出目录：`dist/`

**PWA 配置**:
- Manifest: `/manifest.json`
- Service Worker: `/sw.js`

---

## 十一、核心业务流程

### 11.1 捕捉 → 规划 → 执行流程

```
1. 用户在主页捕捉栏输入想法
   ↓
2. 想法保存为 daily 类型任务（status: active）
   ↓
3. 在规划页"安排"Tab 中显示为待安排任务
   ↓
4. 用户将任务分配到项目/目标/阶段
   ↓
5. 在主页"今日任务"中展示
   ↓
6. 用户完成任务，状态变为 done
   ↓
7. 回顾页统计完成率和趋势
```

### 11.2 健身训练流程

```
1. 选择大肌群 → 选择小肌肉
   ↓
2. 选择预设动作或自定义动作
   ↓
3. 记录训练数据（组数、次数、重量、RPE）
   ↓
4. 自动检测是否个人最佳
   ↓
5. 查看肌肉训练趋势图表
```

### 11.3 早睡分析流程

```
1. 设定入睡目标时间（如 23:30）
   ↓
2. 开启提前提醒（如提前 15 分钟）
   ↓
3. 系统从日程自动提取入睡时间
   ↓
4. 用户可手动校准不准确的数据
   ↓
5. 查看今日达标状态和连续早睡天数
   ↓
6. 查看 7 天/30 天趋势图表
```

---

## 十二、关键工具函数

### 12.1 数据库操作

```typescript
// 创建任务
export async function createTask(task: Omit<Task, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  return db.tasks.add({ ...task, createdAt: now, updatedAt: now });
}

// 事务执行（带重试）
export async function executeTransaction<T>(
  stores: (Table | string)[],
  operation: () => Promise<T>,
  options: { maxRetries?: number } = {}
) {
  // 自动重试机制
}
```

### 12.2 日期工具

```typescript
function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}
```

---

## 十三、扩展能力

### 13.1 插件系统

```typescript
export interface PluginMetadata {
  id?: number;
  name: string;
  version: string;
  status: 'installed' | 'active' | 'disabled' | 'error';
  isBuiltIn?: boolean;
  showInNavbar?: boolean;
}
```

### 13.2 数据导入导出

```typescript
export async function exportAllData(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const table of tables) {
    data[table] = await (db as any)[table].toArray();
  }
  return JSON.stringify(data, null, 2);
}
```

---

## 十四、总结

LifeFlow 是一个功能完整、架构清晰的个人管理 Web 应用。其核心优势包括：

1. **完整的管理闭环**：捕捉 → 规划 → 执行 → 回顾
2. **多维度健康管理**：睡眠、饮水、健身、财务
3. **离线优先**：基于 IndexedDB 的本地数据持久化
4. **渐进式增强**：PWA 支持，可安装为桌面应用
5. **类型安全**：完整的 TypeScript 类型定义
6. **响应式设计**：支持移动端和桌面端

项目采用模块化架构，各功能模块独立开发，便于后续扩展和维护。