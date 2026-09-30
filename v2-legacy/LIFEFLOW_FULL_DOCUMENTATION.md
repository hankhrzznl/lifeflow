# LifeFlow 完整技术文档

## 一、项目概览

LifeFlow 是一款基于 Next.js 的个人生产力与健康管理 Web 应用，采用 PWA 架构，数据完全本地存储，支持离线使用。

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 16.2.6 |
| UI 库 | React | 19.2.4 |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.3.2 |
| 数据库 | Dexie.js | 4.4.2 |
| 动画 | Framer Motion | 12.x |
| 图表 | Recharts | 3.x |
| 图标 | Lucide React | 1.x |

### 部署

- **构建命令**: `next build`
- **输出目录**: `.next/`
- **生产环境**: Vercel
- **域名**: `https://www.my-lifeos.com/`

---

## 二、目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 后端 API 路由
│   │   └── weekly-report/  # AI 周报生成
│   ├── assistant/          # 助手模块（4个子功能）
│   │   ├── finance/        # 记账
│   │   ├── fitness/        # 健身
│   │   ├── sleep/          # 早睡分析
│   │   └── water/          # 喝水提醒
│   ├── planner/            # 规划页（2个Tab）
│   │   ├── TodayTab.tsx    # 今日任务列表
│   │   └── page.tsx        # 安排Tab + 项目列表
│   ├── projects/           # 项目详情（3级层级）
│   │   ├── [projectId]/    # 项目详情页
│   │   │   ├── goals/      # 目标详情页
│   │   │   └── boards/     # 大模块/阶段/任务
│   │   └── unclassified/  # 未分类入口
│   ├── review/             # 回顾页（PDCA）
│   ├── stats/              # 数据统计页
│   │   └── components/     # 4个统计板块组件
│   ├── today/              # 主页
│   ├── settings/           # 设置页
│   ├── layout.tsx          # 全局布局
│   └── globals.css         # 全局样式
├── components/             # 共享组件
│   ├── layout/             # 布局组件
│   │   ├── QuickCaptureBar.tsx  # 快速捕捉栏
│   │   ├── CaptureInbox.tsx     # 收件箱
│   │   └── OverviewHeader.tsx   # 主页头部
│   ├── navigation/         # 导航组件
│   │   ├── BottomTabBar.tsx     # 底部导航栏
│   │   └── DesktopSidebarV2.tsx # 桌面侧边栏
│   ├── agent/              # AI 助手组件
│   ├── pwa/                # PWA 相关组件
│   ├── review/             # 回顾组件
│   ├── schedule/           # 日程组件
│   └── ui/                 # UI 基础组件
├── lib/                    # 工具库
│   ├── db.ts               # 数据库操作（核心）
│   ├── types.ts            # TypeScript 类型定义
│   ├── agent-core.ts       # AI 助手核心逻辑
│   ├── reminderService.ts  # 提醒服务
│   ├── financeStats.ts     # 财务统计计算
│   ├── fitnessStats.ts     # 健身统计计算
│   ├── sleepStats.ts       # 睡眠统计计算
│   └── waterStats.ts       # 饮水统计计算
└── middleware.ts           # Next.js 中间件
```

---

## 三、数据库设计

### 3.1 核心数据表

Dexie.js 数据库版本已升级到 **v25**，包含以下核心表：

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `tasks` | 任务存储（统一模型） | type, status, projectId, sectionId, boardId, startTime, dueDate |
| `projectV2s` | 项目 | name, color |
| `boards` | 大模块 | name, projectId |
| `sections` | 阶段 | name, boardId |
| `finRecords` | 财务记录 | type, amount, category, date, accountId |
| `finAccounts` | 账户 | name, initialBalance |
| `muscleRecords` | 训练记录 | subMuscleId, exerciseName, sets, reps, weight |
| `muscleGroups` | 大肌群 | name, icon, color |
| `subMuscles` | 小肌肉 | muscleGroupId, name |
| `dailyWaterRecords` | 每日饮水 | date, entries[], totalMl |
| `sleepRecords` | 睡眠记录 | sleepDuration, sleepTime, wakeTime |
| `healthRecords` | 健康指标 | metricType, value, date |
| `reviewRecords` | 回顾记录 | type, dateKey, highlights, problems, improvements |
| `reminders` | 提醒 | taskId, type, triggerTime |
| `habit_logs` | 习惯打卡 | taskId, date, count |

### 3.2 任务模型（统一）

```typescript
interface Task {
  id?: number;
  title: string;
  type: 'longterm' | 'shortterm' | 'daily' | 'habit';
  status: 'active' | 'done' | 'archived';
  projectId?: string;
  boardId?: number;        // 所属大模块
  sectionId?: number;      // 所属阶段
  parentTaskId?: number;   // 父任务（目标）
  startTime?: number;
  endTime?: number;
  dueDate?: number;
  priority?: Priority;
  tags?: string[];
  note?: string;
  successCriteria?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.3 项目层级架构

```
Project → Board → Section → Task
         大模块   阶段     任务
```

目标（Goal）作为特殊的 Task 存在（type=shortterm 或 type=daily），通过 projectId 关联到项目。

---

## 四、路由结构

### 4.1 底部导航栏（5个核心入口）

| 路由 | 名称 | 图标 | 说明 |
|------|------|------|------|
| `/` | 主页 | CalendarDays | 捕捉栏 + 今日任务 + 时间线 |
| `/planner` | 规划 | Layers | 安排Tab + 今日Tab |
| `/review` | 回顾 | BarChart3 | PDCA周期回顾 |
| `/assistant` | 助手 | Bot | 4个生活辅助工具入口 |
| `/stats` | 统计 | TrendingUp | 全局数据统计 |

### 4.2 其他路由

| 路由 | 说明 |
|------|------|
| `/settings` | 设置页（右上角入口） |
| `/goals` | 目标页（独立入口） |
| `/projects/[projectId]` | 项目详情页 |
| `/projects/[projectId]/goals/[goalId]` | 目标详情页 |
| `/projects/[projectId]/boards/[boardId]/sections/[sectionId]` | 阶段详情页 |
| `/projects/unclassified` | 未分类任务 |
| `/assistant/water` | 喝水提醒 |
| `/assistant/sleep` | 早睡分析 |
| `/assistant/finance` | 记账 |
| `/assistant/fitness` | 健身 |
| `/pending` | 待安排页（保留） |
| `/reminders` | 提醒管理 |
| `/trash` | 回收站 |

---

## 五、核心功能模块

### 5.1 主页 (`/`)

**组件组成：**

1. **OverviewHeader** - 顶部标题栏，包含设置入口（齿轮图标）
2. **QuickCaptureBar** - 快速捕捉栏
   - 支持项目选择下拉框
   - 输入后回车发送，自动展开收件箱
   - 显示待处理数量
3. **CaptureInbox** - 收件箱
   - 显示所有待处理任务（status=active）
   - 每条任务有快速操作：今日/明天/本周/完整安排/删除
   - 底部链接跳转规划页
4. **TodayTab** - 今日任务列表
   - 显示今天有时间安排的任务
   - 支持完成/取消完成
5. **TodayTimeline** - 今日日程时间线
   - 按时间顺序展示今日事件

**数据流向：**
```
用户输入 → QuickCaptureBar → createTask() → tasks表 → CaptureInbox显示
```

### 5.2 规划页 (`/planner`)

**2个Tab：**

**Tab 1 - 安排**
- 项目列表（可展开）
  - 未分类入口
  - 项目卡片（显示待安排数量徽章）
  - 点击展开显示目标列表（短期事件/日常习惯）
  - 目标进度条（百分比）
  - 点击目标 → 跳转目标详情页
- 新建项目按钮（底部虚线按钮）
- 新建项目弹窗（BottomSheet）

**Tab 2 - 今日**
- 复用 TodayTab 组件
- 显示今日任务

**URL参数支持：**
- `?tab=pending` - 切换到安排Tab
- `?tab=today` - 切换到今日Tab

### 5.3 项目详情页 (`/projects/[projectId]`)

**概览Tab内容：**
- 子模块（Board）列表，可展开
- 展开后显示阶段（Section）列表
- 点击阶段 → 阶段详情页
- 阶段内显示任务列表

### 5.4 目标详情页 (`/projects/[projectId]/goals/[goalId]`)

**结构：**
- 顶部：目标信息（标题、类型、备注、截止日期、成功标准）
- 区块1：已安排任务列表（绿色圆点）
- 区块2：待安排任务列表（琥珀色背景）
  - 点击 → 弹出"处理中"Sheet
  - 处理中选项：短期事件 / 日常习惯

### 5.5 回顾页 (`/review`)

**PDCA循环回顾：**

1. **周期切换器** - 周度/月度切换，前后导航
2. **执行概况** - 4个统计卡片
   - 任务完成数
   - 完成率
   - 过期任务数
   - 日均完成数
3. **优先级分布** - 四象限分布（重要紧急等）
4. **目标达成** - 两个子卡片
   - 短期事件：完成率、过期率、截止日期达标率
   - 每日习惯：完成率、连续打卡天数、中断次数
5. **项目完成** - 项目进度条列表
6. **回顾记录编辑器** - 三个可编辑列表
   - 亮点
   - 问题
   - 改进点
7. **闭环行动** - 将改进点转为待办任务

### 5.6 统计页 (`/stats`)

**全局周期切换器** - 周度/月度，影响所有板块

**4个垂直排列的统计板块：**

1. **WaterStats** - 饮水统计
   - 日均饮水量
   - 达标天数
   - 饮水趋势图
2. **FinanceStats** - 财务统计
   - 收入/支出/结余
   - 分类占比
   - 月度趋势
3. **FitnessStats** - 健身统计
   - 训练次数
   - 负荷量
   - 肌群分布
4. **SleepStats** - 睡眠统计
   - 平均入睡时间
   - 平均睡眠时长
   - 早睡达标率

### 5.7 助手模块 (`/assistant`)

**4个功能入口卡片：**

| 功能 | 路由 | 核心特性 |
|------|------|----------|
| 喝水提醒 | `/assistant/water` | 定时提醒、一键喝水、目标设置、夜间免打扰 |
| 早睡分析 | `/assistant/sleep` | 入睡目标、定时提醒、30天平均入睡时间、周趋势图、月度热力图 |
| 记账 | `/assistant/finance` | 多账户、收支分类、月度汇总、记录编辑、CSV导出 |
| 健身 | `/assistant/fitness` | 肌群管理、训练记录、预设动作库、本周总结、趋势图 |

---

## 六、AI 助手

### 6.1 核心组件

- **AgentChat** - 聊天界面
- **AgentInput** - 输入框
- **AgentMessage** - 消息组件
- **AgentProvider** - 状态管理
- **TypingIndicator** - 打字指示器

### 6.2 后端 API

- `POST /api/weekly-report` - AI周报生成
  - 流式响应
  - 基于回顾数据生成智能分析

### 6.3 数据存储

- `agentMemory` - 每日摘要
- `agentChats` - 聊天会话

---

## 七、PWA 功能

### 7.1 组件

- **SWProvider** - Service Worker 提供者
- **SWUpdateBanner** - 更新提示横幅
- **StorageMonitor** - 存储监控
- **OfflineDetector** - 离线检测

### 7.2 Manifest

```json
{
  "name": "LifeFlow",
  "description": "捕捉 · 规划 · 专注 · 回顾",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366F1"
}
```

---

## 八、状态管理

### 8.1 本地状态

主要使用 React Hooks (`useState`, `useEffect`, `useCallback`) 管理组件状态。

### 8.2 全局状态

- **ToastContainer** - 全局通知
- **FAB** - 悬浮按钮（快速创建）

---

## 九、关键设计模式

### 9.1 数据层

- **统一任务模型** - 所有任务使用 `Task` 接口
- **Dexie.js** - IndexedDB 封装，支持版本迁移
- **事务操作** - `executeTransaction()` 和 `writeWithRetry()` 确保数据一致性

### 9.2 组件设计

- **无状态组件** - 大部分组件为函数式组件
- **组合模式** - 页面由多个小组件组合而成
- **动画过渡** - Framer Motion 实现平滑过渡效果

### 9.3 错误处理

- **GlobalErrorBoundary** - 全局错误边界
- **数据库初始化** - `initializeDatabase()` 处理版本冲突和存储限制

---

## 十、数据迁移

数据库经历了 **25个版本** 的升级，关键迁移：

| 版本 | 变更 |
|------|------|
| v3 | 引入 tasks 表，迁移 capture 和 events |
| v10 | 引入 projectV2s |
| v11 | 引入 boards 和 sections |
| v18 | 引入 finRecords 和 finAccounts |
| v15 | 引入肌肉管理表 |
| v24 | 引入 userSettings 和 dailyWaterRecords |
| v23 | 删除废弃的 submodules 表 |

---

## 十一、安全性

### 11.1 数据保护

- 所有数据本地存储（IndexedDB）
- 无后端服务器，数据不传输到第三方
- 支持数据导出/导入

### 11.2 XSS防护

- TypeScript 类型检查
- 输入内容进行适当转义

---

## 十二、性能优化

### 12.1 代码分割

- Next.js App Router 自动代码分割
- 页面级懒加载

### 12.2 数据库优化

- 索引优化（Dexie.js 自动创建）
- 事务批量操作
- 重试机制（`writeWithRetry`）

### 12.3 渲染优化

- Framer Motion 动画优化
- Tailwind CSS 4 零JS配置
- 响应式设计

---

## 十三、未来扩展方向

1. **目标-阶段-任务关联** - 在 Board 和 Section 之间增加 Goal 层级
2. **智能推荐** - 基于历史数据的智能规划建议
3. **多设备同步** - 云端同步功能
4. **团队协作** - 项目共享和协作功能
5. **更多健康指标** - 血压、心率等更多健康数据追踪