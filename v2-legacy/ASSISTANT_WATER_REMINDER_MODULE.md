# LifeFlow 助手 - 喝水提醒模块文档

## 一、功能概述

喝水提醒模块是 LifeFlow 助手页面下的一个健康管理功能，旨在帮助用户养成规律饮水的习惯。该功能提供定时推送通知和一键记录饮水的便捷操作。

**核心功能点：**
- 定时提醒开关控制
- 可配置的提醒间隔（30/60/90/120分钟）
- 倒计时显示下次提醒时间
- 快捷喝水按钮（基于预设水杯容量）
- 浏览器推送通知
- 应用内 Toast 提醒
- 饮水记录持久化存储

## 二、页面结构

### 2.1 入口位置

喝水提醒功能位于助手页面（`/assistant`）下的子路由 `/assistant/water`。

### 2.2 UI 布局

页面采用卡片式设计，与助手页面下的早睡分析、健身功能等模块保持一致的视觉风格。

```
┌─────────────────────────────────────────┐
│  返回按钮 | 标题：喝水提醒              │
│  副标题：定时推送 · 一键喝水            │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐ │
│  │ 定时提醒卡片                      │ │
│  │  ┌────────────┬───────────────┐  │ │
│  │  │ 💧 定时提醒 │ 已开启/已关闭 │  │ │
│  │  │ 下次提醒: XX分XX秒后        │  │ │
│  │  └────────────┴───────────────┘  │ │
│  │  ┌─────────────────────────────┐  │ │
│  │  │ 提醒间隔：30min 60min 90min │  │ │
│  │  │         120min              │  │ │
│  │  └─────────────────────────────┘  │ │
│  └───────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐ │
│  │ 快捷喝水卡片                      │ │
│  │  ┌─────────────────────────────┐  │ │
│  │  │ +200ml  +300ml  +500ml      │  │ │
│  │  └─────────────────────────────┘  │ │
│  │  提示：与主页人物框共享水杯预设值   │  │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 三、核心功能详解

### 3.1 定时提醒开关

**功能说明：**
- 点击"已开启/已关闭"按钮切换提醒状态
- 开启时自动请求浏览器通知权限
- 开启时立即计算下次提醒时间

**状态管理：**
- 使用 `useState` 管理本地状态
- 使用 `localStorage` 持久化开关状态（key: `water_reminder_enabled`）

### 3.2 提醒间隔设置

**可选间隔：** 30分钟、60分钟、90分钟、120分钟

**交互逻辑：**
- 默认选中 90 分钟
- 点击不同间隔按钮切换
- 切换后立即重置倒计时
- 间隔值持久化到 `localStorage`（key: `water_reminder_interval`）

### 3.3 倒计时显示

**功能说明：**
- 实时显示距离下次提醒的时间
- 格式：`XX分XX秒后`
- 每秒更新一次

**实现机制：**
- 使用 `useEffect` 监听 `enabled` 和 `nextReminder` 状态
- 通过 `setInterval` 每秒计算剩余时间
- 组件卸载时清除定时器

### 3.4 提醒触发机制

**双渠道提醒：**

1. **浏览器推送通知**（仅在页面隐藏时）：
   - 标题：`💧 该喝水了`
   - 内容：`已经XX分钟没喝水了，记得补充水分`
   - 图标：`/favicon.ico`

2. **应用内 Toast 提醒**（始终触发）：
   - 消息：`💧 该喝水了！已经XX分钟了`
   - 类型：info

**触发流程：**
```
1. 计算下次提醒时间戳
2. 设置 setTimeout 在指定时间触发
3. 触发时显示通知和 Toast
4. 自动计算下一次提醒时间并循环
```

### 3.5 快捷喝水按钮

**功能说明：**
- 点击预设容量按钮快速记录饮水
- 支持的容量：200ml、300ml、500ml（可通过用户设置自定义）
- 点击后显示成功 Toast

**数据流向：**
```
用户点击按钮 → handleDrink(ml) → addWaterIntake(ml) → 数据库存储 → 显示成功提示
```

## 四、数据模型

### 4.1 每日饮水记录

```typescript
interface DailyWaterRecord {
  id?: number;
  date: string;             // "YYYY-MM-DD"
  entries: WaterEntry[];    // 每次饮水记录
  totalMl: number;          // 今日总饮水量(ml)
  createdAt: number;        // 创建时间戳
}

interface WaterEntry {
  ml: number;               // 饮用量(ml)
  timestamp: number;        // 饮用时间戳
}
```

### 4.2 用户设置

```typescript
interface UserSettings {
  id?: number;
  sleepTarget: number;      // 每日睡眠目标(小时)，默认 8
  napTarget: number;        // 午睡目标(小时)，默认 0.5
  weight: number;           // 体重(kg)，默认 60
  cupSizes: number[];       // 水杯预设值(ml)，默认 [200, 300, 500]
  avatarDataUrl?: string;   // 头像 Base64
  createdAt: number;
}
```

### 4.3 localStorage 存储

| Key | 类型 | 说明 |
|-----|------|------|
| `water_reminder_enabled` | string | 提醒开关状态："true" 或 "false" |
| `water_reminder_interval` | string | 提醒间隔(分钟)："30"、"60"、"90"、"120" |
| `water_reminder_next` | string | 下次提醒时间戳 |

## 五、数据库操作

### 5.1 饮水记录 CRUD

```typescript
// 获取今日饮水记录
async function getTodayWaterRecord(): Promise<DailyWaterRecord | null>

// 添加饮水量
async function addWaterIntake(ml: number): Promise<DailyWaterRecord>

// 撤销上次饮水记录
async function undoLastWaterIntake(): Promise<DailyWaterRecord>
```

### 5.2 用户设置操作

```typescript
// 获取用户设置（包含水杯预设值）
async function getUserSettings(): Promise<UserSettings>

// 保存用户设置
async function saveUserSettings(settings: Partial<UserSettings>): Promise<void>
```

### 5.3 数据库表结构

**表名：** `dailyWaterRecords`

**索引：** `++id, date`

**版本历史：**
- v24: 新增 `dailyWaterRecords` 表

## 六、通知服务

### 6.1 浏览器通知权限

```typescript
// 请求通知权限
async function requestNotificationPermission(): Promise<NotificationPermission>

// 检查是否有通知权限
async function hasNotificationPermission(): Promise<boolean>

// 显示通知
async function showNotification(title: string, options?: NotificationOptions): Promise<void>
```

### 6.2 权限处理流程

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

## 七、代码结构

```
src/
├── app/
│   └── assistant/
│       └── water/
│           └── page.tsx      # 喝水提醒页面组件
├── lib/
│   ├── db.ts                  # 数据库操作函数
│   ├── types.ts               # 类型定义
│   └── reminderService.ts     # 通知服务
└── components/
    └── ui/
        └── Toast.tsx          # 应用内提示组件
```

### 7.1 页面组件核心逻辑

**文件：** [page.tsx](file:///d:/hankkk/lifeflow/src/app/assistant/water/page.tsx)

```typescript
// 核心状态
const [enabled, setEnabled] = useState(false);      // 提醒开关
const [intervalMin, setIntervalMin] = useState(90); // 提醒间隔(分钟)
const [cupSizes, setCupSizes] = useState([200, 300, 500]); // 水杯预设
const [countdown, setCountdown] = useState(0);      // 倒计时(毫秒)
const [nextReminder, setNextReminder] = useState(0); // 下次提醒时间戳

// 核心函数
toggleReminder()        // 切换提醒开关
handleIntervalChange()  // 切换提醒间隔
handleDrink()           // 记录喝水
fireReminder()          // 触发提醒
toMinSec()              // 毫秒转分秒格式
```

### 7.2 数据库操作核心函数

**文件：** [db.ts](file:///d:/hankkk/lifeflow/src/lib/db.ts)

```typescript
// 获取今日记录
export async function getTodayWaterRecord(): Promise<DailyWaterRecord | null> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await db.dailyWaterRecords.where("date").equals(today).first();
  return result ?? null;
}

// 添加饮水量（创建或更新今日记录）
export async function addWaterIntake(ml: number): Promise<DailyWaterRecord> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.dailyWaterRecords.where("date").equals(today).first();
  if (existing) {
    // 更新现有记录
    await db.dailyWaterRecords.update(existing.id!, {
      entries: [...existing.entries, { ml, timestamp: Date.now() }],
      totalMl: existing.totalMl + ml,
    });
    return (await db.dailyWaterRecords.get(existing.id!))!;
  }
  // 创建新记录
  const id = await db.dailyWaterRecords.add({
    date: today,
    entries: [{ ml, timestamp: Date.now() }],
    totalMl: ml,
    createdAt: Date.now(),
  });
  return (await db.dailyWaterRecords.get(id))!;
}
```

## 八、工作流程

### 8.1 用户使用流程

```
进入喝水提醒页面
      ↓
查看当前提醒状态和倒计时
      ↓
┌─────┴─────┐
│           │
开启提醒   设置间隔
│           │
      ↓
等待提醒触发
      ↓
收到通知/Toast
      ↓
点击快捷喝水按钮记录饮水量
      ↓
查看更新后的饮水记录
```

### 8.2 提醒触发流程

```
用户开启提醒
      ↓
计算下次提醒时间 = 当前时间 + 间隔分钟 × 60000
      ↓
设置 setTimeout 在指定时间触发
      ↓
时间到达
      ↓
┌─────────┴─────────┐
│                   │
浏览器通知        Toast提醒
(页面隐藏时)      (始终显示)
      ↓
计算下一次提醒时间
      ↓
循环等待...
```

### 8.3 饮水记录流程

```
用户点击喝水按钮(ml)
      ↓
调用 addWaterIntake(ml)
      ↓
检查今日记录是否存在
      ↓
┌───────┴───────┐
│               │
存在          不存在
│               │
更新记录      创建新记录
(追加entry)   (初始化entry)
      ↓
返回更新后的记录
      ↓
显示成功Toast
```

## 九、与其他模块的关联

### 9.1 用户设置共享

喝水提醒模块与主页人物框共享水杯预设值：
- 预设值存储在 `UserSettings.cupSizes` 中
- 默认值：`[200, 300, 500]`
- 通过 `getUserSettings()` 获取最新设置

### 9.2 健康评分系统

饮水量数据参与健康评分计算：

```typescript
// 健康评分计算逻辑（db.ts 第552-587行）
if (metrics.water_intake !== undefined) {
  const waterScore = Math.min((metrics.water_intake / 2000) * 25, 25);
  score += waterScore;
  weight += 25;
}
```

**评分规则：**
- 满分 25 分（占总健康评分的 25%）
- 目标：2000ml/天
- 超过 2000ml 按 2000ml 计算

## 十、技术特点

### 10.1 状态持久化策略

- **提醒开关/间隔**：使用 `localStorage`，便于快速读取和简单数据存储
- **饮水记录**：使用 IndexedDB（Dexie.js），支持复杂查询和大容量存储
- **下次提醒时间**：使用 `localStorage`，确保页面刷新后能恢复定时器

### 10.2 定时器恢复机制

```typescript
// 页面加载时恢复定时器
const savedNext = localStorage.getItem("water_reminder_next");
if (savedNext && saved === "true") {
  setNextReminder(Number(savedNext));
}
```

### 10.3 双提醒渠道

- **浏览器推送通知**：使用标准 Notification API，即使页面不在前台也能收到提醒
- **应用内 Toast**：使用自定义组件，确保用户在应用内时不会错过提醒

## 十一、扩展建议

### 11.1 功能扩展

1. **饮水目标设置**：添加每日饮水目标（如 2000ml）并显示进度
2. **历史记录查看**：添加周/月饮水量统计图表
3. **智能提醒**：根据用户习惯调整提醒频率
4. **饮水提醒音效**：添加可选的提醒音效
5. **多设备同步**：支持不同设备间的饮水记录同步

### 11.2 UI 优化

1. 添加饮水进度条
2. 显示今日已饮水次数
3. 添加自定义水杯容量输入
4. 添加饮水记录列表（今日明细）

## 十二、注意事项

### 12.1 浏览器兼容性

- **Notification API**：需要 HTTPS 环境或 localhost 才能使用
- **IndexedDB**：现代浏览器均支持

### 12.2 权限管理

- 用户首次开启提醒时会请求通知权限
- 如果用户拒绝权限，仅显示应用内 Toast 提醒
- 建议在设置页面添加权限状态说明

### 12.3 数据清理

- 饮水记录按日期存储，不会自动清理
- 可考虑添加定期清理历史记录的功能（如保留最近 30 天）

### 12.4 定时器精度

- 使用 `setTimeout` 实现定时提醒，精度受浏览器后台限制
- 页面在后台时，定时器可能被推迟执行
- 建议使用 Service Worker 提升后台提醒可靠性
