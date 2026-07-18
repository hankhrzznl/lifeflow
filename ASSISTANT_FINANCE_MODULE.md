# LifeFlow 助手 - 记账模块技术文档

## 一、功能概述

记账模块是 LifeFlow 助手页面下的一个财务管理功能，帮助用户记录个人收支情况。该功能支持多账户管理、分类记账、月度统计和余额计算。

**核心功能点：**
- 多账户管理（创建、切换、删除）
- 收支记录（收入/支出分类、金额、日期、备注）
- 分类选择（12种支出分类、6种收入分类）
- 月度汇总统计（收入、支出、结余）
- 按日期分组的记录列表
- 记录删除功能
- 浮动按钮快速记账

## 二、页面结构

### 2.1 入口位置

记账功能位于助手页面（`/assistant`）下的子路由 `/assistant/finance`。

### 2.2 UI 布局

页面采用卡片式设计，与助手页面下的喝水提醒、早睡分析等模块保持一致的视觉风格。

```
┌─────────────────────────────────────────┐
│  返回按钮 | 标题：记账                  │
│  副标题：多账户 · 收支记录              │
├─────────────────────────────────────────┤
│  [账户1] [账户2] [+]                    │  ← 账户切换栏
├─────────────────────────────────────────┤
│  < ◀  2026年7月  ▶ >                    │  ← 月份切换
├─────────────────────────────────────────┤
│  ┌──────┬──────┬──────┐                │
│  │ 收入 │ 支出 │ 结余 │                │  ← 汇总卡片
│  │+0.00 │-0.00 │ 0.00 │                │
│  └──────┴──────┴──────┘                │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ 7月12日 周二 [今天]             │    │  ← 日期分组
│  │ +100.00  -50.00                 │    │
│  ├─────────────────────────────────┤    │
│  │ 🍽️ 餐饮       -30.00  [删除]   │    │  ← 记录项
│  │ 🚗 交通       -20.00  [删除]   │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  [-] [+]                               │  ← 浮动按钮(右下角)
└─────────────────────────────────────────┘
```

## 三、核心功能详解

### 3.1 账户管理

**功能说明：**
- 创建新账户（名称、初始余额）
- 切换不同账户查看收支
- 删除账户（需确认，删除后记录一并删除）

**交互逻辑：**
- 账户切换栏横向排列，支持滚动
- 当前选中账户高亮显示（绿色背景）
- 多账户时显示删除按钮（红色 ×）
- 无账户时显示引导创建界面

### 3.2 收支记录

**功能说明：**
- 记录收入或支出
- 设置金额、分类、日期、备注
- 支持今日快捷日期

**表单字段：**
| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| 类型 | 单选 | 是 | 支出 |
| 金额 | 数字 | 是 | - |
| 分类 | 单选 | 是 | 餐饮(支出)/薪资(收入) |
| 日期 | 日期选择 | 是 | 今天 |
| 备注 | 文本 | 否 | - |

### 3.3 分类选择

**支出分类（12种）：**
| key | 标签 | 图标 | 颜色 |
|-----|------|------|------|
| food | 餐饮 | 🍽️ | #FF6B6B |
| transport | 交通 | 🚗 | #4ECDC4 |
| shopping | 购物 | 🛍️ | #FFD93D |
| entertainment | 娱乐 | 🎮 | #A78BFA |
| housing | 住房 | 🏠 | #60A5FA |
| medical | 医疗 | 💊 | #FB7185 |
| education | 学习 | 📚 | #818CF8 |
| communication | 通讯 | 📱 | #34D399 |
| daily | 日用 | 🧴 | #FBBF24 |
| social | 社交 | 🎉 | #F472B6 |
| pet | 宠物 | 🐾 | #C084FC |
| other | 其他 | 📋 | #9CA3AF |

**收入分类（6种）：**
| key | 标签 | 图标 | 颜色 |
|-----|------|------|------|
| salary | 薪资 | 💰 | #10B981 |
| parttime | 兼职 | 💼 | #6366F1 |
| investment | 投资 | 📈 | #F59E0B |
| gift | 礼金 | 🎁 | #EC4899 |
| refund | 退款 | ↩️ | #14B8A6 |
| other_income | 其他 | 📋 | #9CA3AF |

### 3.4 月度汇总

**计算逻辑：**
- **收入**：当月所有收入类型记录的金额总和
- **支出**：当月所有支出类型记录的金额总和
- **结余**：账户初始余额 + 收入 - 支出

**显示格式：**
- 收入：绿色 `+0.00`
- 支出：红色 `-0.00`
- 结余：蓝色或红色（根据正负）

### 3.5 记录列表

**功能说明：**
- 按日期分组显示记录
- 显示每日收支小计
- 鼠标悬停显示删除按钮
- 支持月份切换查看历史数据

### 3.6 浮动按钮

**位置：** 右下角固定定位（bottom-40）

**按钮功能：**
- **红色按钮（-）**：记支出
- **绿色按钮（+）**：记收入

**交互：** 点击弹出记账表单 Sheet

## 四、数据模型

### 4.1 财务记录

```typescript
interface FinRecord {
  id?: number;
  type: 'income' | 'expense';   // 类型：收入或支出
  amount: number;               // 金额
  category: string;             // 分类key
  date: string;                 // 日期 "YYYY-MM-DD"
  note?: string;                // 备注
  accountId: number;            // 所属账户ID
  createdAt: number;            // 创建时间戳
}
```

### 4.2 账户信息

```typescript
interface FinAccount {
  id?: number;
  name: string;                 // 账户名称
  initialBalance: number;       // 初始余额
  createdAt: number;            // 创建时间戳
}
```

### 4.3 分类配置

```typescript
export const FIN_CATEGORIES = {
  expense: [
    { key: 'food', label: '餐饮', icon: '🍽️', color: '#FF6B6B', bg: '#FFF0F0' },
    // ... 其他11种支出分类
  ],
  income: [
    { key: 'salary', label: '薪资', icon: '💰', color: '#10B981', bg: '#ECFDF5' },
    // ... 其他5种收入分类
  ],
};
```

## 五、数据库操作

### 5.1 财务记录 CRUD

```typescript
// 添加记录
export async function addFinRecord(
  record: Omit<FinRecord, "id" | "createdAt">
): Promise<number>

// 按月份查询记录
export async function getFinRecordsByMonth(
  year: number, month: number, accountId?: number
): Promise<FinRecord[]>

// 删除记录
export async function deleteFinRecord(id: number): Promise<void>
```

### 5.2 账户管理 CRUD

```typescript
// 获取所有账户
export async function getFinAccounts(): Promise<FinAccount[]>

// 创建账户
export async function createFinAccount(
  name: string, initialBalance: number
): Promise<number>

// 删除账户
export async function deleteFinAccount(id: number): Promise<void>
```

### 5.3 数据库表结构

**表名：** `finRecords`

**索引：** `++id, type, amount, category, date, accountId, createdAt`

**表名：** `finAccounts`

**索引：** `++id, name, initialBalance, createdAt`

**版本历史：**
- v18: 新增 `finRecords` 和 `finAccounts` 表

### 5.4 月度统计

```typescript
// 获取月度财务统计
export async function getMonthlyFinanceStats(
  year?: number, month?: number
): Promise<{ income: number; expense: number; balance: number }>
```

## 六、代码结构

```
src/
├── app/
│   └── assistant/
│       └── finance/
│           └── page.tsx      # 记账页面组件
├── lib/
│   ├── db.ts                  # 数据库操作函数
│   └── types.ts               # 类型定义（FinRecord、FinAccount、FIN_CATEGORIES）
└── components/
    └── ui/
        └── Toast.tsx          # 应用内提示组件
```

### 6.1 页面组件核心逻辑

**文件：** [page.tsx](file:///d:/hankkk/lifeflow/src/app/assistant/finance/page.tsx)

```typescript
// 核心状态
const [records, setRecords] = useState<FinRecord[]>([]);      // 记账记录列表
const [accounts, setAccounts] = useState<FinAccount[]>([]);   // 账户列表
const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null); // 当前账户
const [currentYear, setCurrentYear] = useState(new Date().getFullYear()); // 当前年份
const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 当前月份

// 表单状态
const [formType, setFormType] = useState<"expense" | "income">("expense");
const [formAmount, setFormAmount] = useState("");
const [formCategory, setFormCategory] = useState("food");
const [formDate, setFormDate] = useState(getTodayStr());
const [formNote, setFormNote] = useState("");

// Sheet状态
const [showForm, setShowForm] = useState(false);              // 记账表单显示
const [showAccountSheet, setShowAccountSheet] = useState(false); // 账户表单显示

// 核心函数
loadAccounts()           // 加载账户列表
loadRecords()            // 加载记账记录
handlePrevMonth()        // 上月切换
handleNextMonth()        // 下月切换
handleAdd()              // 添加记账记录
handleDelete()           // 删除记账记录
handleCreateAccount()    // 创建账户
handleDeleteAccount()    // 删除账户
openForm()               // 打开记账表单
resetForm()              // 重置表单
```

### 6.2 数据库操作核心函数

**文件：** [db.ts](file:///d:/hankkk/lifeflow/src/lib/db.ts)

```typescript
// 添加记账记录
export async function addFinRecord(
  record: Omit<FinRecord, "id" | "createdAt">
): Promise<number> {
  return db.finRecords.add({ ...record, createdAt: Date.now() });
}

// 按月份查询记录
export async function getFinRecordsByMonth(
  year: number, month: number, accountId?: number
): Promise<FinRecord[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  let query = db.finRecords.where("date").between(startDate, endDate, true, false);
  
  if (accountId !== undefined) {
    query = query.filter(record => record.accountId === accountId);
  }
  
  return query.toArray();
}

// 创建账户
export async function createFinAccount(
  name: string, initialBalance: number
): Promise<number> {
  return db.finAccounts.add({ 
    name, 
    initialBalance,
    createdAt: Date.now() 
  });
}
```

## 七、工作流程

### 7.1 用户使用流程

```
进入记账页面
      ↓
检查是否有账户
      ↓
┌───────┴───────┐
│               │
无账户        有账户
│               │
创建账户      选择账户
      ↓
查看月度汇总（收入、支出、结余）
      ↓
查看按日期分组的记录列表
      ↓
┌─────┴─────┐
│           │
记支出     记收入
│           │
      ↓
弹出记账表单
      ↓
选择分类、输入金额、日期、备注
      ↓
保存记录
      ↓
更新汇总和列表
```

### 7.2 数据流向

**创建账户：**
```
用户输入账户信息 → handleCreateAccount() → createFinAccount() → 数据库存储 → 更新账户列表
```

**添加记账记录：**
```
用户填写表单 → handleAdd() → addFinRecord() → 数据库存储 → 更新记录列表 → 更新汇总统计
```

**查看历史数据：**
```
切换月份 → handlePrevMonth/handleNextMonth() → 更新 currentYear/currentMonth → 触发 loadRecords() → 更新记录列表和汇总
```

### 7.3 汇总计算流程

```
加载记录列表
      ↓
过滤收入记录 → 求和 → totalIncome
过滤支出记录 → 求和 → totalExpense
      ↓
获取账户初始余额 → initialBalance
      ↓
计算结余 = initialBalance + totalIncome - totalExpense
      ↓
更新汇总卡片显示
```

## 八、与其他模块的关联

### 8.1 月度统计

记账模块的数据参与月度统计计算：

```typescript
// 月度财务统计（db.ts 第1113-1130行）
export async function getMonthlyFinanceStats(year?: number, month?: number): Promise<{
  income: number;
  expense: number;
  balance: number;
}> {
  // 查询指定月份的记录
  // 计算收入、支出、结余
}
```

### 8.2 插件版本

项目中存在两个记账功能版本：

1. **助手版本**：[src/app/assistant/finance/page.tsx](file:///d:/hankkk/lifeflow/src/app/assistant/finance/page.tsx)
   - 简约设计，卡片式布局
   - 与助手页面其他模块风格一致
   - 功能：多账户、收支记录、月度汇总

2. **插件版本**：[src/app/plugins/finance/page.tsx](file:///d:/hankkk/lifeflow/src/app/plugins/finance/page.tsx)
   - 功能更完整（预算、报表等）
   - 界面和交互方式不同
   - 使用相同的数据库表（finRecords、finAccounts）

**数据共享：** 两个版本共享同一个数据库表，数据完全同步。

## 九、技术特点

### 9.1 响应式设计

- 使用 Tailwind CSS 实现响应式布局
- 移动端：单列布局，浮动按钮在右下角
- 桌面端：最大宽度 5xl，居中显示

### 9.2 动画效果

使用 Framer Motion 实现表单 Sheet 的滑入动画：

```typescript
<motion.div 
  initial={{ y: "100%" }} 
  animate={{ y: 0 }} 
  exit={{ y: "100%" }}
  transition={{ type: "spring", damping: 25, stiffness: 300 }}
>
  {/* 表单内容 */}
</motion.div>
```

### 9.3 数据分组展示

记录按日期分组，使用对象映射实现：

```typescript
const grouped: Record<string, FinRecord[]> = {};
for (const r of records) {
  if (!grouped[r.date]) grouped[r.date] = [];
  grouped[r.date].push(r);
}
const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
```

### 9.4 账户切换机制

- 首次加载自动选择第一个账户
- 删除账户后自动切换到其他账户或无账户状态
- 无账户时显示引导界面

## 十、扩展建议

### 10.1 功能扩展

1. **预算管理**：设置月度预算，显示预算使用进度
2. **统计报表**：添加周/月/年统计图表（柱状图、饼图）
3. **分类统计**：按分类汇总支出占比
4. **转账功能**：支持账户间转账
5. **数据导出**：支持导出Excel/CSV格式
6. **账单提醒**：设置账单到期提醒
7. **标签功能**：为记录添加自定义标签

### 10.2 UI 优化

1. 添加账户余额进度条
2. 支持自定义分类颜色
3. 添加搜索过滤功能
4. 优化日期选择器交互
5. 添加记账记录编辑功能

### 10.3 数据可视化

1. 月度收支对比图表
2. 支出分类占比饼图
3. 收支趋势折线图
4. 账户余额变化图

## 十一、注意事项

### 11.1 账户删除风险

- 删除账户会同时删除其所有记账记录
- 当前实现使用 `confirm()` 对话框确认删除
- 建议增加回收站功能，支持恢复误删数据

### 11.2 金额精度

- 使用 `parseFloat()` 解析金额
- 显示使用 `toFixed(2)` 保留两位小数
- 建议添加金额格式校验（最大位数、小数位数限制）

### 11.3 日期范围

- 月度查询使用 `date` 字段的 `between` 查询
- 日期格式：`YYYY-MM-DD`
- 注意跨年月份切换的边界处理

### 11.4 性能优化

- 当前每次操作后重新加载全部记录
- 建议使用分页或虚拟列表优化大量记录的加载
- 考虑使用缓存机制减少重复查询

### 11.5 数据一致性

- 结余计算依赖账户初始余额和所有记录
- 删除记录后结余自动更新
- 建议添加余额校验功能，确保数据一致性

## 十二、使用示例

### 12.1 创建账户

```typescript
// 创建一个名为"储蓄卡"的账户，初始余额为10000
const accountId = await createFinAccount("储蓄卡", 10000);
```

### 12.2 添加支出记录

```typescript
// 记录一笔餐饮支出，金额50元
await addFinRecord({
  type: "expense",
  amount: 50,
  category: "food",
  date: "2026-07-12",
  note: "午餐",
  accountId: 1,
});
```

### 12.3 添加收入记录

```typescript
// 记录一笔薪资收入，金额10000元
await addFinRecord({
  type: "income",
  amount: 10000,
  category: "salary",
  date: "2026-07-01",
  note: "7月工资",
  accountId: 1,
});
```

### 12.4 查询月度记录

```typescript
// 查询2026年7月的所有记录
const records = await getFinRecordsByMonth(2026, 7, 1);
```
