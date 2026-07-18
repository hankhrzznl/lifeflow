import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────

export interface Ledger {
  id: string;
  name: string;
  type: string;
  currency: string;
  coverIndex?: number;
  note?: string;
  isDefault?: boolean;
  createdAt: number;
}

export interface Account {
  id: string;
  name: string;
  ledgerId: string;
  type: string;
  balance: number;
  currency: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  ledgerId: string;
  accountId?: string;
  categoryId?: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  note?: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  parentId?: string;
  ledgerId: string;
}

// ─── Database ────────────────────────────────────────────────

export class AccountingDB extends Dexie {
  ledgers!: Table<Ledger, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;

  constructor() {
    super('LifeFlowAccounting');
    this.version(1).stores({
      ledgers: '&id, name',
      accounts: '&id, ledgerId, name',
      transactions: '&id, ledgerId, date',
      categories: '&id, type',
    });

    this.version(2).stores({
      ledgers: '&id, name',
      accounts: '&id, ledgerId, name',
      transactions: '&id, ledgerId, date',
      categories: '&id, type',
    }).upgrade(async (tx) => {
      const now = Date.now();

      // Default ledger
      const ledgerId = crypto.randomUUID();
      await tx.table('ledgers').add({
        id: ledgerId, name: '日常账本', type: 'personal', currency: 'CNY', createdAt: now,
      });

      // Default accounts (4)
      const accounts = [
        { id: crypto.randomUUID(), ledgerId, name: '微信钱包', type: 'asset', balance: 0, currency: 'CNY', createdAt: now },
        { id: crypto.randomUUID(), ledgerId, name: '支付宝', type: 'asset', balance: 0, currency: 'CNY', createdAt: now },
        { id: crypto.randomUUID(), ledgerId, name: '银行卡', type: 'asset', balance: 0, currency: 'CNY', createdAt: now },
        { id: crypto.randomUUID(), ledgerId, name: '现金', type: 'asset', balance: 0, currency: 'CNY', createdAt: now },
      ];
      for (const a of accounts) await tx.table('accounts').add(a);

      // Expense categories (12)
      const expenseCategories = [
        { id: crypto.randomUUID(), name: '餐饮', type: 'expense', icon: 'utensils-crossed', color: '#FF3B30', ledgerId },
        { id: crypto.randomUUID(), name: '购物', type: 'expense', icon: 'shopping-bag', color: '#FF9500', ledgerId },
        { id: crypto.randomUUID(), name: '日用', type: 'expense', icon: 'package', color: '#5856D6', ledgerId },
        { id: crypto.randomUUID(), name: '交通', type: 'expense', icon: 'car', color: '#007AFF', ledgerId },
        { id: crypto.randomUUID(), name: '蔬菜', type: 'expense', icon: 'leaf', color: '#34C759', ledgerId },
        { id: crypto.randomUUID(), name: '水果', type: 'expense', icon: 'apple', color: '#FF3B30', ledgerId },
        { id: crypto.randomUUID(), name: '零食', type: 'expense', icon: 'candy', color: '#FF9500', ledgerId },
        { id: crypto.randomUUID(), name: '运动', type: 'expense', icon: 'dumbbell', color: '#34C759', ledgerId },
        { id: crypto.randomUUID(), name: '娱乐', type: 'expense', icon: 'gamepad-2', color: '#5856D6', ledgerId },
        { id: crypto.randomUUID(), name: '通讯', type: 'expense', icon: 'smartphone', color: '#007AFF', ledgerId },
        { id: crypto.randomUUID(), name: '服饰', type: 'expense', icon: 'shirt', color: '#AF52DE', ledgerId },
        { id: crypto.randomUUID(), name: '美容', type: 'expense', icon: 'sparkles', color: '#FF9500', ledgerId },
      ];

      // Income categories (6)
      const incomeCategories = [
        { id: crypto.randomUUID(), name: '工资', type: 'income', icon: 'banknote', color: '#34C759', ledgerId },
        { id: crypto.randomUUID(), name: '红包', type: 'income', icon: 'gift', color: '#FF3B30', ledgerId },
        { id: crypto.randomUUID(), name: '理财', type: 'income', icon: 'trending-up', color: '#FF9500', ledgerId },
        { id: crypto.randomUUID(), name: '奖金', type: 'income', icon: 'trophy', color: '#5856D6', ledgerId },
        { id: crypto.randomUUID(), name: '租金', type: 'income', icon: 'home', color: '#007AFF', ledgerId },
        { id: crypto.randomUUID(), name: '其他', type: 'income', icon: 'help-circle', color: '#8E8E93', ledgerId },
      ];
      for (const c of [...expenseCategories, ...incomeCategories]) await tx.table('categories').add(c);
    });
  }
}

export const accountingDB = new AccountingDB();

export async function initializeAccountingDB(): Promise<{ success: boolean; error?: string }> {
  try {
    await accountingDB.open();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Ledgers CRUD ────────────────────────────────────────────

export async function addLedger(ledger: Omit<Ledger, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await accountingDB.ledgers.add({ ...ledger, id, createdAt: Date.now() });
  return id;
}

export async function updateLedger(id: string, updates: Partial<Ledger>): Promise<void> {
  await accountingDB.ledgers.update(id, updates);
}

export async function deleteLedger(id: string): Promise<void> {
  await accountingDB.ledgers.delete(id);
}

export async function getAllLedgers(): Promise<Ledger[]> {
  return accountingDB.ledgers.toArray();
}

export async function getDefaultLedger(): Promise<Ledger | undefined> {
  const ledgers = await accountingDB.ledgers.toArray();
  if (ledgers.length === 0) return undefined;
  const dl = ledgers.find((l) => l.isDefault);
  if (dl) return dl;
  return ledgers.sort((a, b) => a.createdAt - b.createdAt)[0];
}

// ─── Accounts CRUD ───────────────────────────────────────────

export async function addAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await accountingDB.accounts.add({ ...account, id, createdAt: Date.now() });
  return id;
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  await accountingDB.accounts.update(id, updates);
}

export async function deleteAccount(id: string): Promise<void> {
  await accountingDB.accounts.delete(id);
}

export async function getAllAccounts(): Promise<Account[]> {
  return accountingDB.accounts.toArray();
}

// ─── Transactions CRUD ───────────────────────────────────────

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await accountingDB.transactions.add({ ...transaction, id, createdAt: Date.now() });
  return id;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  await accountingDB.transactions.update(id, updates);
}

export async function deleteTransaction(id: string): Promise<void> {
  await accountingDB.transactions.delete(id);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  return accountingDB.transactions.toArray();
}

export async function getTransactionsByDate(date: string): Promise<Transaction[]> {
  return accountingDB.transactions.where('date').equals(date).toArray();
}

export async function getTransactionsByMonth(year: number, month: number): Promise<Transaction[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return accountingDB.transactions
    .filter((tx) => tx.date.startsWith(prefix))
    .toArray();
}

export async function getTransactionsByYear(year: number): Promise<Transaction[]> {
  const prefix = `${year}-`;
  return accountingDB.transactions
    .filter((tx) => tx.date.startsWith(prefix))
    .toArray();
}

// ─── Categories CRUD ─────────────────────────────────────────

export async function addCategory(category: Omit<Category, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await accountingDB.categories.add({ ...category, id });
  return id;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  await accountingDB.categories.update(id, updates);
}

export async function deleteCategory(id: string): Promise<void> {
  await accountingDB.categories.delete(id);
}

export async function getAllCategories(): Promise<Category[]> {
  return accountingDB.categories.toArray();
}

// ─── 清空所有记账数据并重新播种默认数据 ──────────────────────
export async function clearAllAccountingData(): Promise<void> {
  await accountingDB.transaction(
    "rw",
    [accountingDB.ledgers, accountingDB.accounts, accountingDB.transactions, accountingDB.categories],
    async () => {
      await accountingDB.ledgers.clear();
      await accountingDB.accounts.clear();
      await accountingDB.transactions.clear();
      await accountingDB.categories.clear();

      const now = Date.now();

      // 重新创建默认账本
      const ledgerId = crypto.randomUUID();
      await accountingDB.ledgers.add({
        id: ledgerId, name: "日常账本", type: "personal", currency: "CNY", isDefault: true, createdAt: now,
      });

      // 重新创建默认账户
      const defaultAccounts = [
        { id: crypto.randomUUID(), ledgerId, name: "微信钱包", type: "asset", balance: 0, currency: "CNY", createdAt: now },
        { id: crypto.randomUUID(), ledgerId, name: "支付宝", type: "asset", balance: 0, currency: "CNY", createdAt: now },
        { id: crypto.randomUUID(), ledgerId, name: "银行卡", type: "asset", balance: 0, currency: "CNY", createdAt: now },
        { id: crypto.randomUUID(), ledgerId, name: "现金", type: "asset", balance: 0, currency: "CNY", createdAt: now },
      ];
      for (const a of defaultAccounts) await accountingDB.accounts.add(a);

      // 重新创建默认分类
      const expenseCategories = [
        { id: crypto.randomUUID(), name: "餐饮", type: "expense", icon: "utensils-crossed", color: "#FF3B30", ledgerId },
        { id: crypto.randomUUID(), name: "购物", type: "expense", icon: "shopping-bag", color: "#FF9500", ledgerId },
        { id: crypto.randomUUID(), name: "日用", type: "expense", icon: "package", color: "#5856D6", ledgerId },
        { id: crypto.randomUUID(), name: "交通", type: "expense", icon: "car", color: "#007AFF", ledgerId },
        { id: crypto.randomUUID(), name: "蔬菜", type: "expense", icon: "leaf", color: "#34C759", ledgerId },
        { id: crypto.randomUUID(), name: "水果", type: "expense", icon: "apple", color: "#FF3B30", ledgerId },
        { id: crypto.randomUUID(), name: "零食", type: "expense", icon: "candy", color: "#FF9500", ledgerId },
        { id: crypto.randomUUID(), name: "运动", type: "expense", icon: "dumbbell", color: "#34C759", ledgerId },
        { id: crypto.randomUUID(), name: "娱乐", type: "expense", icon: "gamepad-2", color: "#5856D6", ledgerId },
        { id: crypto.randomUUID(), name: "通讯", type: "expense", icon: "smartphone", color: "#007AFF", ledgerId },
        { id: crypto.randomUUID(), name: "服饰", type: "expense", icon: "shirt", color: "#AF52DE", ledgerId },
        { id: crypto.randomUUID(), name: "美容", type: "expense", icon: "sparkles", color: "#FF9500", ledgerId },
      ];
      const incomeCategories = [
        { id: crypto.randomUUID(), name: "工资", type: "income", icon: "banknote", color: "#34C759", ledgerId },
        { id: crypto.randomUUID(), name: "红包", type: "income", icon: "gift", color: "#FF3B30", ledgerId },
        { id: crypto.randomUUID(), name: "理财", type: "income", icon: "trending-up", color: "#FF9500", ledgerId },
        { id: crypto.randomUUID(), name: "奖金", type: "income", icon: "trophy", color: "#5856D6", ledgerId },
        { id: crypto.randomUUID(), name: "租金", type: "income", icon: "home", color: "#007AFF", ledgerId },
        { id: crypto.randomUUID(), name: "其他", type: "income", icon: "help-circle", color: "#8E8E93", ledgerId },
      ];
      for (const c of [...expenseCategories, ...incomeCategories]) await accountingDB.categories.add(c);
    },
  );
}
