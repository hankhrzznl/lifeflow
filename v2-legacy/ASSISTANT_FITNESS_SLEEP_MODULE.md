# LifeFlow 助手 - 健身与早睡分析模块技术文档

---

## 第一部分：健身功能

### 一、功能概述

健身模块是 LifeFlow 助手页面下的一个力量训练管理功能，帮助用户记录和追踪力量训练进度。该功能支持肌肉群管理、训练记录、周统计和趋势分析。

**核心功能点：**
- 肌肉群管理（大肌群、小肌肉层级结构）
- 训练记录（动作、组数、次数、重量、RPE、休息时间）
- 预设动作库（系统预设 + 自定义动作）
- 本周训练总结（训练次数、覆盖肌群、个人最佳、总训练量）
- 肌肉成长趋势图（按动作追踪重量变化）
- 最近训练记录列表
- 子肌肉筛选查看

### 二、页面结构

#### 2.1 入口位置

健身功能位于助手页面（`/assistant`）下的子路由 `/assistant/fitness`。

#### 2.2 UI 布局

页面采用卡片式设计，与助手页面下的喝水提醒、早睡分析等模块保持一致的视觉风格。

```
┌─────────────────────────────────────────┐
│  返回按钮 | 标题：健身                  │
│  副标题：力量训练记录 · 趋势追踪         │
├─────────────────────────────────────────┤
│  [+ 添加训练记录]                        │  ← 顶部操作按钮
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 本周训练总结                       │  │  ← 统计卡片
│  │ 训练次数 | 覆盖肌群 | 个人最佳 |  │  │
│  │ 总训练量                          │  │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 肌肉群管理                         │  │  ← 肌肉群卡片列表
│  │ ┌───────────────────────────────┐ │  │
│  │ │ 胸部  💪 4个小肌肉 [管理][▶] │ │  │
│  │ │   ┌─────┬─────┬─────┬─────┐ │ │  │
│  │ │   │上胸 │中胸 │下胸 │内侧胸│ │ │  │
│  │ │   └─────┴─────┴─────┴─────┘ │ │  │
│  │ └───────────────────────────────┘ │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 肌肉成长趋势                       │  │  ← 趋势图表
│  │ [折线图：日期 vs 重量]             │  │  │
│  │ [动作选择按钮]                     │  │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 最近训练                          │  │  ← 训练记录列表
│  │ 2026-07-12                        │  │
│  │ 卧推 3×10 40kg RPE7 😊           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 三、核心功能详解

#### 3.1 肌肉群管理

**层级结构：**
- **大肌群（MuscleGroup）**：如胸部、背部、腿部等
- **小肌肉（SubMuscle）**：隶属于大肌群的细分部位，如胸部包含上胸、中胸、下胸、内侧胸

**管理功能：**
- 展开/折叠大肌群查看小肌肉
- 点击管理按钮编辑小肌肉（添加、修改、删除）
- 点击小肌肉筛选训练记录

#### 3.2 添加训练记录

**两步表单流程：**

**第一步：选择部位和动作**
```
选择大肌群 → 选择小肌肉 → 选择预设动作或输入自定义动作
```

**第二步：填写训练详情**
| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| 组数 | 数字 | 是 | 3 |
| 每组次数 | 数字 | 是 | 10 |
| 重量(kg) | 数字 | 是 | - |
| RPE | 滑块(1-10) | 是 | 7 |
| 组间休息时间 | 单选 | 是 | 60秒 |
| 训练感受 | 单选 | 是 | 适中 |
| 备注 | 文本 | 否 | - |

**RPE（Rate of Perceived Exertion）等级：**
| 等级 | 描述 |
|------|------|
| 1 | 非常轻松 |
| 3 | 轻松 |
| 5 | 中等 |
| 7 | 较难 |
| 9 | 很难 |
| 10 | 力竭 |

**休息时间预设：** 30s、60s、90s、120s、180s

**训练感受选项：**
- 😊 轻松（easy）
- 😐 适中（medium）
- 😫 吃力（hard）

#### 3.3 预设动作库

**功能说明：**
- 系统预设常用动作（按小肌肉分类）
- 支持自定义添加新动作（需填写器材名称）
- 自定义动作自动保存到预设库

#### 3.4 本周训练总结

**统计指标：**
- **训练次数**：本周训练记录总数
- **覆盖肌群**：本周训练涉及的大肌群数量
- **个人最佳**：本周达到个人最佳的次数
- **总训练量**：本周所有训练的重量×组数×次数总和

#### 3.5 肌肉成长趋势图

**功能说明：**
- 按动作追踪重量变化趋势
- 显示最近10次训练的最大重量
- 支持选择不同动作查看详情
- 使用 Recharts 折线图展示

#### 3.6 最近训练记录

**功能说明：**
- 按日期分组显示
- 显示每条记录的动作、组数、次数、重量、RPE、训练感受
- 个人最佳记录标注奖杯图标

### 四、数据模型

#### 4.1 大肌群

```typescript
interface MuscleGroup {
  id?: number;
  name: string;                          // 大肌群名称
  icon: string;                          // 图标
  color: string;                          // 颜色
  description?: string;                   // 描述
  order: number;                          // 排序
  createdAt: number;
  updatedAt: number;
}
```

#### 4.2 小肌肉

```typescript
interface SubMuscle {
  id?: number;
  muscleGroupId: number;                  // 所属大肌群ID
  name: string;                           // 小肌肉名称
  description?: string;                   // 描述
  order: number;                          // 排序
  createdAt: number;
  updatedAt: number;
}
```

#### 4.3 预设动作

```typescript
interface PresetExercise {
  id?: number;
  name: string;                           // 动作名称
  subMuscleId: number;                     // 所属小肌肉ID
  equipment?: string;                      // 需要的器械
  description?: string;                    // 动作描述
  instructions?: string;                   // 动作说明
  isCustom: boolean;                       // 是否自定义动作
  createdAt: number;
}
```

#### 4.4 训练记录

```typescript
interface MuscleRecord {
  id?: number;
  subMuscleId: number;                     // 小肌肉ID
  exerciseName: string;                    // 动作名称
  sets: number;                            // 组数
  reps: number;                            // 每组次数
  weight: number;                           // 重量(kg)
  rpe: number;                              // RPE 1-10
  restTime: number;                         // 组间休息(秒)
  feeling: 'easy' | 'medium' | 'hard';     // 训练感受
  date: string;                             // 训练日期
  timestamp: number;
  notes?: string;                          // 备注
  isPersonalBest?: boolean;                 // 是否个人最佳
  createdAt: number;
}
```

### 五、数据库操作

#### 5.1 肌肉群操作

```typescript
// 获取所有大肌群
export async function getAllMuscleGroups(): Promise<MuscleGroup[]>

// 更新大肌群
export async function updateMuscleGroup(id: number, updates: Partial<MuscleGroup>): Promise<void>

// 删除大肌群
export async function deleteMuscleGroup(id: number): Promise<void>

// 添加大肌群
export async function addMuscleGroup(group: Omit<MuscleGroup, "id" | "createdAt" | "updatedAt">): Promise<number>
```

#### 5.2 小肌肉操作

```typescript
// 获取所有小肌肉
export async function getAllSubMuscles(): Promise<SubMuscle[]>

// 按大肌群获取小肌肉
export async function getSubMusclesByGroup(muscleGroupId: number): Promise<SubMuscle[]>

// 添加小肌肉
export async function addSubMuscle(subMuscle: Omit<SubMuscle, "id" | "createdAt" | "updatedAt">): Promise<number>

// 更新小肌肉
export async function updateSubMuscle(id: number, updates: Partial<SubMuscle>): Promise<void>

// 删除小肌肉
export async function deleteSubMuscle(id: number): Promise<void>
```

#### 5.3 训练记录操作

```typescript
// 添加训练记录
export async function addMuscleRecord(
  record: Omit<MuscleRecord, "id" | "createdAt">
): Promise<number>

// 删除训练记录
export async function deleteMuscleRecord(id: number): Promise<void>

// 获取最近训练记录
export async function getRecentMuscleRecords(limit: number): Promise<MuscleRecord[]>

// 按动作获取训练记录
export async function getMuscleRecordsByExercise(exerciseName: string): Promise<MuscleRecord[]>

// 计算本周训练进度
export async function calculateWeeklyProgress(): Promise<{
  totalWorkouts: number;
  muscleGroupsCovered: number;
  personalBests: number;
  totalVolume: number;
}>

// 获取个人最佳
export async function getPersonalBest(subMuscleId: number, exerciseName: string): Promise<MuscleRecord | null>
```

#### 5.4 预设动作操作

```typescript
// 按小肌肉获取预设动作
export async function getPresetExercisesBySubMuscle(subMuscleId: number): Promise<PresetExercise[]>

// 添加预设动作
export async function addPresetExercise(
  exercise: Omit<PresetExercise, "id" | "createdAt">
): Promise<number>

// 初始化肌肉数据（首次使用时）
export async function initializeMuscleData(): Promise<void>
```

### 六、代码结构

```
src/
├── app/
│   ├── assistant/
│   │   └── fitness/
│   │       └── page.tsx      # 健身页面入口
│   └── health/
│       └── components/
│           └── MusclePage.tsx # 健身核心组件
├── lib/
│   ├── db.ts                  # 数据库操作函数
│   └── types.ts               # 类型定义
└── components/
    └── ui/
        └── Toast.tsx          # 应用内提示组件
```

#### 6.1 页面入口

**文件：** [page.tsx](file:///d:/hankkk/lifeflow/src/app/assistant/fitness/page.tsx)

```typescript
export default function FitnessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white ...">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24">
        {/* 返回按钮 + 标题 */}
        {/* MusclePage 核心组件 */}
      </div>
    </div>
  );
}
```

#### 6.2 核心组件

**文件：** [MusclePage.tsx](file:///d:/hankkk/lifeflow/src/app/health/components/MusclePage.tsx)

**核心状态：**
```typescript
const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);      // 大肌群列表
const [subMuscles, setSubMuscles] = useState<SubMuscle[]>([]);            // 小肌肉列表
const [presetExercises, setPresetExercises] = useState<PresetExercise[]>([]); // 预设动作
const [recentRecords, setRecentRecords] = useState<MuscleRecord[]>([]);   // 最近训练记录
const [weeklyStats, setWeeklyStats] = useState<...>(...);                 // 本周统计
const [showAddModal, setShowAddModal] = useState(false);                  // 添加记录弹窗
const [selectedSubMuscleId, setSelectedSubMuscleId] = useState<number | null>(null); // 选中的小肌肉
```

**核心函数：**
```typescript
loadData()                        // 加载所有数据
handleSelectGroup()               // 选择大肌群加载预设动作
handleSelectSubMuscle()           // 选择小肌肉筛选记录
```

**子组件：**
- `Card`：通用卡片组件
- `TrendIndicator`：趋势指示器
- `MuscleGroupCard`：肌肉群卡片（包含小肌肉列表）
- `SubMuscleManagerModal`：小肌肉管理弹窗
- `EditMuscleModal`：编辑肌肉群/小肌肉弹窗
- `AddRecordModal`：添加训练记录弹窗
- `WeeklyProgressCard`：本周训练总结卡片
- `RecentRecordsCard`：最近训练记录卡片
- `MuscleProgressChart`：肌肉成长趋势图表

### 七、工作流程

#### 7.1 用户使用流程

```
进入健身页面
      ↓
加载肌肉数据（初始化如果是首次使用）
      ↓
查看本周训练总结
      ↓
查看肌肉群列表
      ↓
┌─────┴─────┐
│           │
展开肌肉群 添加训练记录
│           │
查看小肌肉 → 选择大肌群 → 选择小肌肉 → 选择动作 → 填写详情 → 保存
      ↓
筛选训练记录（按小肌肉）
      ↓
查看肌肉成长趋势
```

#### 7.2 添加训练记录流程

```
点击"添加训练记录"按钮
      ↓
第一步：选择大肌群
      ↓
选择小肌肉
      ↓
选择预设动作或输入自定义动作
      ↓
下一步
      ↓
第二步：填写训练详情
      ↓
提交保存
      ↓
判断是否新动作 → 如果是且有器材 → 保存为预设动作
      ↓
添加训练记录到数据库
      ↓
重新加载数据更新界面
```

#### 7.3 数据流向

```
用户操作 → 组件状态更新 → 数据库操作 → 更新组件状态 → 界面刷新
```

### 八、技术特点

#### 8.1 动画效果

使用 Framer Motion 实现：
- 小肌肉列表展开/折叠动画
- 弹窗缩放动画
- 按钮点击缩放效果

#### 8.2 数据可视化

使用 Recharts 实现：
- 肌肉成长趋势折线图
- 支持多动作对比显示

#### 8.3 数据去重

加载数据时自动去重：
- 按名称去重大肌群
- 按大肌群ID+名称去重小肌肉

#### 8.4 个人最佳检测

添加训练记录时自动检测是否达到个人最佳：
- 与历史记录对比
- 更新 `isPersonalBest` 字段

### 九、扩展建议

#### 9.1 功能扩展

1. **训练计划**：创建和管理训练计划
2. **训练日志**：添加训练日的整体记录和感受
3. **进度分析**：更详细的数据分析（训练强度、频率、容量）
4. **社交分享**：分享训练成果到社交平台
5. **训练建议**：基于历史数据提供训练建议
6. **热身/拉伸指导**：添加热身和拉伸动作库
7. **体测数据**：记录体重、体脂率等身体数据

#### 9.2 UI 优化

1. 添加训练日历视图
2. 优化趋势图交互（支持缩放、拖拽）
3. 添加训练记录编辑功能
4. 支持深色/浅色主题切换

---

## 第二部分：早睡分析功能

### 一、功能概述

早睡分析模块是 LifeFlow 助手页面下的一个睡眠管理功能，帮助用户养成规律的作息习惯。该功能基于日程数据自动分析入睡时间，并提供可视化的睡眠趋势。

**核心功能点：**
- 入睡目标时间设置
- 定时提醒（提前15分钟）
- 浏览器推送通知
- 30天平均入睡时间统计
- 周入睡时间趋势图
- 月度入睡时间热力图

### 二、页面结构

#### 2.1 入口位置

早睡分析功能位于助手页面（`/assistant`）下的子路由 `/assistant/sleep`。

#### 2.2 UI 布局

页面采用卡片式设计，与助手页面下的其他模块保持一致的视觉风格。

```
┌─────────────────────────────────────────┐
│  返回按钮 | 标题：早睡分析              │
│  副标题：基于日程校准的入睡时间          │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 入睡目标                          │  │  ← 设置卡片
│  │ 🌙 入睡目标   [提醒已开/已关]     │  │
│  │ 23:30                             │  │
│  │ 提前15分钟提醒                     │  │
│  │ 提醒时间: 23:15                    │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 30天平均入睡时间                  │  │  ← 统计卡片
│  │ 23:45                             │  │
│  │ 30天数据                          │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 入睡时间趋势（最近7天）            │  │  ← 趋势图表
│  │ [折线图：日期 vs 入睡时间]         │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ 月度热力图                        │  │  ← 热力图
│  │ [7×5网格，颜色深浅表示早睡程度]    │  │
│  │ ← 较早        较晚 →              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 三、核心功能详解

#### 3.1 入睡目标设置

**功能说明：**
- 设置目标入睡时间（默认23:30）
- 时间选择器精确到分钟
- 设置持久化到 localStorage（key: `sleep_target`）

#### 3.2 定时提醒

**功能说明：**
- 提前15分钟提醒入睡
- 浏览器推送通知（需要通知权限）
- 状态持久化到 localStorage（key: `sleep_reminder_enabled`）

**权限处理：**
```
用户开启提醒 → 检查 Notification API 是否可用
                ↓
           请求通知权限
                ↓
      ┌─────────┴─────────┐
      │                   │
   授权成功             授权失败
      │                   │
   正常推送           仅应用内提醒
```

**提醒调度：**
- 使用 `setTimeout` 实现定时
- 定时器ID持久化到 localStorage（key: `sleep_reminder_timeout`）
- 提醒触发后自动重新调度明天的提醒

#### 3.3 30天平均入睡时间

**计算逻辑：**
- 获取过去30天的日程数据
- 筛选标题包含"睡"的事件
- 提取晚上睡觉事件（18:00-06:00）
- 计算平均入睡时间

**数据来源：**
- 从日程系统（`getDaySchedule`）获取每日事件
- 识别标题包含"睡"的事件作为入睡记录

#### 3.4 周趋势图

**功能说明：**
- 显示最近7天的入睡时间趋势
- 使用 Recharts 折线图
- Y轴范围：21:00 - 02:00
- 支持 Tooltip 显示详细时间

#### 3.5 月度热力图

**功能说明：**
- 显示过去30天的入睡时间分布
- 7×5网格布局（每周一行）
- 颜色深浅表示早睡程度：
  - 绿色（接近21:00）：较早入睡
  - 红色（接近02:00）：较晚入睡

**颜色计算：**
```typescript
// 基于入睡时间的分钟数计算颜色
const minutes = sleepTime; // 0-1440
const hue = Math.max(0, Math.min(120, 120 - ((minutes - 21 * 60) / (6 * 60)) * 120));
// hue: 120 = 绿色(早), 0 = 红色(晚)
```

### 四、数据模型

#### 4.1 睡眠日志（本地状态）

```typescript
interface SleepLog {
  date: string;
  sleepTime: number; // 午夜后的分钟数（如23:30 = 1410）
  label: string;     // 显示标签（如7/12）
}
```

#### 4.2 localStorage 存储

| Key | 类型 | 说明 |
|-----|------|------|
| `sleep_target` | string | 目标入睡时间："23:30" |
| `sleep_reminder_enabled` | string | 提醒开关："true" 或 "false" |
| `sleep_reminder_timeout` | string | 定时器ID |

### 五、数据获取

#### 5.1 日程数据

```typescript
// 获取每日日程
export async function getDaySchedule(date: string): Promise<DaySchedule | null>
```

**数据提取逻辑：**
```typescript
// 从日程事件中提取睡眠记录
for (const ev of ds.events) {
  if (!ev.title?.includes("睡")) continue;  // 筛选睡眠相关事件
  const start = ev.actualStartTime || ev.startTime;
  if (!start) continue;
  const [sh, sm] = start.split(":").map(Number);
  const startMin = sh * 60 + sm;
  // 判断是否为晚上睡觉（>18:00 或 <6:00）
  if (startMin >= 18 * 60 || startMin < 6 * 60) {
    sleepMinutes = startMin;
    isNight = true;
  }
}
```

### 六、代码结构

```
src/
├── app/
│   └── assistant/
│       └── sleep/
│           └── page.tsx      # 早睡分析页面组件
├── lib/
│   ├── db.ts                  # 数据库操作函数（getDaySchedule）
│   └── types.ts               # 类型定义
└── components/
    └── ui/
        └── Toast.tsx          # 应用内提示组件
```

#### 6.1 页面组件核心逻辑

**文件：** [page.tsx](file:///d:/hankkk/lifeflow/src/app/assistant/sleep/page.tsx)

**核心状态：**
```typescript
const [targetTime, setTargetTime] = useState("23:30");      // 目标入睡时间
const [reminderEnabled, setReminderEnabled] = useState(false); // 提醒开关
const [logs, setLogs] = useState<SleepLog[]>([]);            // 睡眠日志
const [loading, setLoading] = useState(true);                // 加载状态
```

**核心函数：**
```typescript
saveTarget(val)             // 保存目标时间
toggleReminder()           // 切换提醒开关
scheduleReminder(time)     // 调度提醒定时器
load()                     // 加载睡眠数据（useEffect）
formatTime(minutes)        // 分钟转时间格式
shiftDate(date, days)      // 日期偏移
getLocalDate()             // 获取本地日期字符串
```

### 七、工作流程

#### 7.1 用户使用流程

```
进入早睡分析页面
      ↓
加载本地设置（目标时间、提醒状态）
      ↓
加载过去30天的睡眠数据
      ↓
查看平均入睡时间
      ↓
查看周趋势图
      ↓
查看月度热力图
      ↓
┌───────┴───────┐
│               │
调整目标时间  开启/关闭提醒
│               │
保存到localStorage
```

#### 7.2 数据加载流程

```
页面加载
      ↓
循环获取过去30天的日程数据
      ↓
筛选睡眠相关事件（标题含"睡"）
      ↓
判断是否为晚上睡觉（>18:00 或 <6:00）
      ↓
提取入睡时间（午夜后的分钟数）
      ↓
计算30天平均值
      ↓
生成周趋势数据（最近7天）
      ↓
生成月度热力图数据（30天网格）
      ↓
更新界面显示
```

#### 7.3 提醒调度流程

```
用户开启提醒
      ↓
计算提醒时间 = 目标时间 - 15分钟
      ↓
计算距离现在的延迟
      ↓
设置 setTimeout
      ↓
时间到达
      ↓
显示浏览器通知（如果有权限）
      ↓
重新调度明天的提醒
```

### 八、技术特点

#### 8.1 数据来源

- 基于日程系统自动提取睡眠数据
- 无需用户手动记录入睡时间
- 依赖日程中标题包含"睡"的事件

#### 8.2 定时器持久化

- 定时器ID保存到 localStorage
- 页面刷新后自动恢复定时器
- 避免重复设置定时器

#### 8.3 可视化

- 使用 Recharts 折线图展示趋势
- 使用 HSL 颜色动态计算热力图颜色
- Tooltip 显示详细时间信息

### 九、扩展建议

#### 9.1 功能扩展

1. **手动校准**：支持手动调整入睡时间
2. **睡眠质量评估**：添加睡眠质量评分
3. **睡眠目标统计**：统计达标率、连续达标天数
4. **睡眠建议**：基于入睡时间提供改善建议
5. **多设备同步**：支持不同设备间的睡眠数据同步
6. **睡眠模式**：进入睡眠模式后自动静音设备

#### 9.2 UI 优化

1. 添加睡眠达标率进度条
2. 添加连续早睡记录徽章
3. 优化热力图交互（点击查看详情）
4. 添加历史数据导出功能

### 十、注意事项

#### 10.1 数据依赖

- 睡眠数据依赖日程系统中的睡眠事件
- 需要用户在日程中创建标题包含"睡"的事件
- 如果没有日程数据，页面显示"暂无数据"

#### 10.2 浏览器兼容性

- **Notification API**：需要 HTTPS 环境或 localhost
- 定时器在页面后台时可能被推迟执行

#### 10.3 时间计算

- 入睡时间以午夜后的分钟数存储
- 支持跨午夜的时间（如01:00 = 60分钟）

#### 10.4 数据清理

- 睡眠数据实时从日程系统获取
- 不存储独立的睡眠日志
- 依赖日程数据的准确性和完整性

---

## 第三部分：两个模块的共同特点

### 一、UI 风格统一

- 卡片式布局
- 圆角设计（rounded-2xl）
- 渐变背景（from-slate-50 to-white）
- 响应式设计（max-w-5xl）

### 二、技术栈一致

- React + TypeScript
- Tailwind CSS 样式
- Framer Motion 动画
- Recharts 数据可视化
- localStorage 状态持久化

### 三、与其他模块的关联

- **健康评分系统**：健身和睡眠数据都参与健康评分计算
- **用户设置**：共享用户基础设置（体重等）
- **日程系统**：早睡分析依赖日程数据

### 四、扩展建议

1. **健康仪表盘**：整合健身、睡眠、喝水等数据到统一的健康仪表盘
2. **健康目标**：设置综合健康目标并追踪进度
3. **数据导出**：支持导出所有健康数据
4. **数据可视化**：添加更多统计图表和分析功能
