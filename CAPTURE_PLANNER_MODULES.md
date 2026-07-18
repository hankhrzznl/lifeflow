# LifeFlow 捕捉与规划模块技术文档

## 概述

本文档详细描述 LifeFlow 应用中 **捕捉功能** 和 **规划页面** 的5个核心模块：

1. **捕捉 (Capture)** - 快速记录想法
2. **今日 (Today)** - 今日任务执行
3. **安排 (Pending)** - 三段式任务配置
4. **目标 (Goals)** - 短期事件与日常琐事管理
5. **项目 (Projects)** - 四级层级项目管理

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS 3
- **动画**: Framer Motion
- **图标**: Lucide React
- **数据库**: IndexedDB (通过 `@/lib/db`)

---

## 1. 捕捉功能 (Capture)

### 1.1 文件位置

```
src/components/layout/QuickCaptureBar.tsx
src/components/layout/CaptureInbox.tsx
```

### 1.2 核心功能

| 功能 | 描述 |
|------|------|
| 快速输入 | 类似闪电笔记的输入框，支持回车发送 |
| 标签选择 | 自动关联项目名称，聚焦时展开标签选择器 |
| 发送机制 | 点击发送按钮或回车键发送 |

### 1.3 数据模型

**capture 表字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| content | string | 捕捉内容 |
| status | string | 状态（固定为 "inbox"） |
| tags | string[] | 关联的项目标签 |
| createdAt | number | 创建时间戳 |
| updatedAt | number | 更新时间戳 |

### 1.4 使用流程

```
用户输入想法
    ↓
(可选) 选择项目标签（标签自动追加到输入框）
    ↓
点击发送按钮或按回车键
    ↓
数据存入 db.capture，状态为 inbox
    ↓
显示成功 Toast
```

### 1.5 关键代码逻辑

```typescript
// 发送逻辑
const handleSend = async () => {
  await db.capture.add({
    content: inputValue.trim(),
    status: "inbox",
    tags: [...selectedTags],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

// 标签点击逻辑
const handleTagClick = (tagName: string) => {
  // 切换选中状态
  // 自动追加 #标签名 到输入框
};
```

---

## 2. 今日任务 (Today)

### 2.1 文件位置

```
src/app/planner/TodayTab.tsx
```

### 2.2 核心功能

| 功能 | 描述 |
|------|------|
| 今日任务列表 | 显示今日范围内的活跃任务 |
| 任务卡片 | 包含标题、标签、优先级点、日期 |
| 标记完成 | 点击复选框或完成按钮标记任务完成 |
| 待办计数 | 显示今日待办任务数量徽章 |

### 2.3 数据查询逻辑

```typescript
// 获取今日时间范围
function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

// 查询今日任务
const all = await db.tasks
  .where("startTime")
  .between(start, end)
  .toArray();
const active = all.filter((t) => t.status === "active");
```

### 2.4 优先级颜色映射

| 优先级 | 颜色 |
|--------|------|
| urgent-important | 红色 (#EF4444) |
| not-urgent-important | 琥珀色 (#F59E0B) |
| 其他 | 绿色 (#22C55E) |

---

## 3. 安排事项 (Pending)

### 3.1 文件位置

```
src/app/pending/page.tsx
```

### 3.2 核心功能

**三段式任务安排流程**，包含3个子标签页：

| 子标签 | 功能 |
|--------|------|
| 待安排 | 显示未配置时间段的任务，支持快速类型切换 |
| 处理中 | 三段式配置流程（分类 → 归属 → 安排） |
| 已安排 | 显示已配置好时间段的任务 |

### 3.3 任务类型定义

| 类型 | 标签 | 颜色 |
|------|------|------|
| shortterm | 短期事件 | 蓝色 |
| daily | 日常琐事 | 绿色 |
| habit | 习惯 | 橙色 |
| longterm | 长期目标 | 靛蓝 |

### 3.4 三段式流程详解

#### Step 1: 分类

```
选择类型
    ↓
设置优先级（PRIORITY_CONFIG）
    ↓
设置截止日期（datetime-local）
    ↓
保存并继续
```

**优先级配置**:
- urgent-important: 紧急且重要
- not-urgent-important: 不紧急但重要
- urgent-not-important: 紧急但不重要
- not-urgent-not-important: 不紧急不重要

#### Step 2: 归属

```
选择项目（可选）
    ↓
选择大模块（Board）
    ↓
选择子模块（Section）
    ↓
保存并继续
```

**层级关系**:
```
项目 → 大模块 → 子模块 → 任务
```

#### Step 3: 安排

```
设置时间段数量（小:1-2 / 中:3-5 / 大:6+）
    ↓
设置截止前提醒天数（1-180天）
    ↓
预览安排计划时间线
    ↓
完成安排
```

**时间线预览**:
```
安静期 → 规划启动 → 第1次催更 → ... → 最后通牒 → 截止日期
```

### 3.5 任务状态流转

```
待安排 → 处理中 → 已安排 → 已完成
    ↑              ↓
    └──────────────┘
        可重新编辑
```

---

## 4. 目标管理 (Goals)

### 4.1 文件位置

```
src/app/goals/page.tsx
```

### 4.2 核心功能

**双视图切换**:

| 视图 | 功能 |
|------|------|
| 短期事件 | 管理短期目标，支持多种筛选 |
| 日常琐事 | 管理日常小任务，显示完成进度条 |

### 4.3 筛选功能

**短期事件筛选**:
- 全部
- 进行中
- 已完成
- 已逾期
- 本周
- 本月

**日常琐事筛选**:
- 全部
- 未完成
- 已完成

### 4.4 操作功能

| 操作 | 描述 |
|------|------|
| 创建 | 添加新目标/琐事 |
| 完成 | 标记任务完成/取消完成 |
| 分配今日 | 将任务分配到今日日程 |
| 删除 | 移入回收站 |
| 详情 | 查看任务详细信息 |

### 4.5 排序逻辑

```typescript
// 优先级排序 + 截止日期排序
const priorityOrder = ["urgent-important", "not-urgent-important", "urgent-not-important", "not-urgent-not-important"];
const pa = priorityOrder.indexOf(a.priority || "not-urgent-not-important");
const pb = priorityOrder.indexOf(b.priority || "not-urgent-not-important");
if (pa !== pb) return pa - pb;
return (a.dueDate || Infinity) - (b.dueDate || Infinity);
```

### 4.6 特色功能

- **全部完成庆祝**: 所有短期事件完成时显示 🎉 提示
- **倒计时显示**: 逾期X天 / 今天 / X天后
- **进度条**: 日常琐事视图显示完成百分比

---

## 5. 项目管理 (Projects)

### 5.1 文件位置

```
src/app/projects/page.tsx
src/app/projects/[projectId]/page.tsx
src/app/projects/[projectId]/boards/[boardId]/page.tsx
src/app/projects/[projectId]/boards/[boardId]/sections/[sectionId]/page.tsx
```

### 5.2 核心功能

**四级层级结构**:

```
项目 (Project)
    └── 大模块 (Board)
            └── 阶段 (Stage)
                    └── 子模块 (Section)
                            └── 任务 (Task)
```

### 5.3 各层级功能

| 层级 | 创建 | 编辑 | 删除 | 其他功能 |
|------|------|------|------|----------|
| 项目 | ✓ | ✓ | ✓ | 选择颜色标识 |
| 大模块 | ✓ | ✗ | ✓ | 管理阶段 |
| 阶段 | ✓ | ✓ | ✓ | 设置成就点 |
| 子模块 | ✓ | ✗ | ✓ | 查看任务列表 |
| 任务 | 通过子模块 | ✓ | ✓ | 标记完成 |

### 5.4 阶段管理特色

**阶段成就系统**:
- 每个阶段可设置多个成就点
- 成就点显示在阶段展开视图中
- 支持添加/编辑/删除成就

**批量编辑**:
- 支持批量编辑所有阶段
- 批量添加/删除阶段和成就

**归属管理**:
- 子模块自动归属到对应阶段
- 未归属阶段的子模块单独显示

### 5.5 数据模型

**ProjectV2**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 项目ID |
| name | string | 项目名称 |
| color | string | 项目颜色 |

**Board**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 大模块ID |
| name | string | 大模块名称 |
| projectId | number | 所属项目ID |
| stages | BoardStage[] | 阶段列表 |

**BoardStage**:
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 阶段名称 |
| achievements | string[] | 成就列表 |

**Section**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 子模块ID |
| name | string | 子模块名称 |
| boardId | number | 所属大模块ID |
| stageIndex | number | 阶段索引 |

---

## 完整工作流程

### 数据流向

```
┌─────────────────────────────────────────────────────────────────┐
│                    捕捉 → 安排 → 执行 → 追踪                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [捕捉] QuickCaptureBar                                          │
│      ↓ 存入 db.capture (status: inbox)                           │
│                                                                  │
│  [安排] PendingPage                                              │
│      ↓ 更新任务属性                                              │
│      - type: shortterm/daily/habit/longterm                     │
│      - priority: 优先级                                          │
│      - dueDate: 截止日期                                         │
│      - sectionId: 归属子模块                                     │
│      - requiredSegments: 所需时间段数量                          │
│      - segmentReminderDays: 提醒天数                             │
│                                                                  │
│  [今日] TodayTab                                                 │
│      ↓ 查询今日范围内的 active 任务                               │
│      ↓ 标记完成 → status: done                                   │
│                                                                  │
│  [目标] GoalsPage                                                │
│      ↓ 按类型筛选查看                                            │
│      ↓ 分配到今日 → 设置 startTime/endTime                        │
│                                                                  │
│  [项目] ProjectsPage                                             │
│      ↓ 结构化管理                                                 │
│      项目 → 大模块 → 阶段 → 子模块 → 任务                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 用户体验流程

```
用户产生想法
    ↓
使用捕捉功能快速记录
    ↓
在安排页面进行三段式配置
    ↓
今日页面执行任务
    ↓
目标页面追踪进度
    ↓
项目页面管理大型项目
```

---

## 代码结构

```
src/
├── app/
│   ├── capture/
│   │   └── page.tsx          # 捕捉页面（重定向到首页）
│   ├── planner/
│   │   ├── page.tsx          # 规划主页面（Tab容器）
│   │   └── TodayTab.tsx      # 今日任务组件
│   ├── pending/
│   │   └── page.tsx          # 安排事项页面
│   ├── goals/
│   │   └── page.tsx          # 目标管理页面
│   ├── projects/
│   │   ├── page.tsx          # 项目列表页面
│   │   └── [projectId]/
│   │       ├── page.tsx
│   │       └── boards/
│   │           ├── [boardId]/
│   │           │   ├── page.tsx
│   │           │   └── sections/
│   │           │       └── [sectionId]/
│   │           │           └── page.tsx
│   └── today/
│       └── page.tsx          # 今日首页（包含捕捉和今日任务）
├── components/
│   └── layout/
│       ├── QuickCaptureBar.tsx   # 快速捕捉栏
│       └── CaptureInbox.tsx      # 捕捉收件箱
└── lib/
    └── db.ts                 # 数据库操作封装
```

---

## 关键设计模式

### 1. Tab 切换模式

所有规划模块使用统一的滑动指示器 Tab 切换：

```typescript
const PLANNER_TABS = [
  { key: "today", label: "今日", icon: Clock },
  { key: "pending", label: "安排", icon: CalendarCheck },
  { key: "goals", label: "目标", icon: Flag },
  { key: "projects", label: "项目", icon: LayoutGrid },
];
```

### 2. 动画效果

使用 Framer Motion 实现：
- 滑动指示器动画
- 页面切换淡入淡出
- 任务卡片列表动画
- 弹窗底部滑入

### 3. 状态管理

- **组件状态**: React useState/useEffect
- **数据持久化**: IndexedDB
- **全局提示**: Toast 组件

---

## 数据存储

### 数据库表结构

| 表名 | 用途 |
|------|------|
| tasks | 任务数据 |
| capture | 捕捉记录 |
| projects | 项目数据 |
| boards | 大模块数据 |
| sections | 子模块数据 |
| timeSegments | 时间段记录 |

### 任务表关键字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 任务ID |
| title | string | 任务标题 |
| type | string | 类型 (shortterm/daily/habit/longterm) |
| status | string | 状态 (active/done/archived) |
| priority | string | 优先级 |
| dueDate | number | 截止日期 |
| startTime | number | 开始时间 |
| endTime | number | 结束时间 |
| sectionId | number | 所属子模块 |
| requiredSegments | number | 所需时间段数 |
| segmentReminderDays | number | 提醒天数 |

---

## 扩展性说明

### 新增功能建议

1. **任务重复规则**: 支持每日/每周/每月重复
2. **任务模板**: 保存常用任务模板
3. **任务依赖**: 设置任务间的依赖关系
4. **团队协作**: 支持多用户协作
5. **数据导出**: 支持导出为 CSV/JSON

### 性能优化方向

1. **虚拟滚动**: 大量任务时使用虚拟滚动
2. **缓存策略**: 缓存已加载的数据
3. **懒加载**: 按需加载项目详情
4. **索引优化**: 优化 IndexedDB 查询索引
