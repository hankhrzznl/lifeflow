import { create } from 'zustand';
import {
  getDefaultLedger,
  getAllAccounts,
  getAllCategories,
  getTransactionsByDate,
  getTransactionsByMonth,
  addTransaction as addTransactionToDB,
  deleteTransaction as deleteTransactionFromDB,
  accountingDB,
  addCategory,
} from '../db/accounting.db';
import type { Ledger, Account, Transaction, Category } from '../db/accounting.db';

// ─── Helpers ─────────────────────────────────────────────────

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcSums(items: Transaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const t of items) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense };
}

// ─── Store ───────────────────────────────────────────────────

interface AccountingState {
  transactions: Transaction[];
  todayTransactions: Transaction[];
  accounts: Account[];
  ledgers: Ledger[];
  categories: Category[];
  defaultLedgerId: string | null;
  monthIncome: number;
  monthExpense: number;
  todayIncome: number;
  todayExpense: number;
  loading: boolean;

  loadData: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useAccountingStore = create<AccountingState>()((set, get) => ({
  transactions: [],
  todayTransactions: [],
  accounts: [],
  ledgers: [],
  categories: [],
  defaultLedgerId: null,
  monthIncome: 0,
  monthExpense: 0,
  todayIncome: 0,
  todayExpense: 0,
  loading: false,

  loadData: async () => {
    set({ loading: true });
    try {
      // 确保默认数据存在（分类为空时自动播种）
      const existingCats = await getAllCategories();
      if (existingCats.length === 0) {
        const ledgerId = crypto.randomUUID();
        const now = Date.now();
        await accountingDB.ledgers.add({ id: ledgerId, name: "日常账本", type: "personal", currency: "CNY", isDefault: true, createdAt: now });
        const defaultAccounts = [
          { id: crypto.randomUUID(), ledgerId, name: "微信钱包", type: "asset", balance: 0, currency: "CNY", createdAt: now },
          { id: crypto.randomUUID(), ledgerId, name: "支付宝", type: "asset", balance: 0, currency: "CNY", createdAt: now },
          { id: crypto.randomUUID(), ledgerId, name: "银行卡", type: "asset", balance: 0, currency: "CNY", createdAt: now },
          { id: crypto.randomUUID(), ledgerId, name: "现金", type: "asset", balance: 0, currency: "CNY", createdAt: now },
        ];
        for (const a of defaultAccounts) await accountingDB.accounts.add(a);
        const expenseCats = [
          { name: "餐饮", type: "expense", icon: "utensils-crossed", color: "#FF3B30", ledgerId },
          { name: "购物", type: "expense", icon: "shopping-bag", color: "#FF9500", ledgerId },
          { name: "日用", type: "expense", icon: "package", color: "#5856D6", ledgerId },
          { name: "交通", type: "expense", icon: "car", color: "#007AFF", ledgerId },
          { name: "蔬菜", type: "expense", icon: "leaf", color: "#34C759", ledgerId },
          { name: "水果", type: "expense", icon: "apple", color: "#FF3B30", ledgerId },
          { name: "零食", type: "expense", icon: "candy", color: "#FF9500", ledgerId },
          { name: "运动", type: "expense", icon: "dumbbell", color: "#34C759", ledgerId },
          { name: "娱乐", type: "expense", icon: "gamepad-2", color: "#5856D6", ledgerId },
          { name: "通讯", type: "expense", icon: "smartphone", color: "#007AFF", ledgerId },
          { name: "服饰", type: "expense", icon: "shirt", color: "#AF52DE", ledgerId },
          { name: "美容", type: "expense", icon: "sparkles", color: "#FF9500", ledgerId },
        ];
        const incomeCats = [
          { name: "工资", type: "income", icon: "banknote", color: "#34C759", ledgerId },
          { name: "红包", type: "income", icon: "gift", color: "#FF3B30", ledgerId },
          { name: "理财", type: "income", icon: "trending-up", color: "#FF9500", ledgerId },
          { name: "奖金", type: "income", icon: "trophy", color: "#5856D6", ledgerId },
          { name: "租金", type: "income", icon: "home", color: "#007AFF", ledgerId },
          { name: "其他", type: "income", icon: "help-circle", color: "#8E8E93", ledgerId },
        ];
        for (const c of [...expenseCats, ...incomeCats]) await addCategory(c);
      }

      const ledger = await getDefaultLedger();
      const ledgerId = ledger?.id ?? null;

      const [accounts, categories] = await Promise.all([
        getAllAccounts(),
        getAllCategories(),
      ]);

      const todayStr = getTodayStr();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [todayTxs, monthTxs] = await Promise.all([
        getTransactionsByDate(todayStr),
        getTransactionsByMonth(year, month),
      ]);

      const todayStats = calcSums(todayTxs);
      const monthStats = calcSums(monthTxs);

      set({
        ledgers: ledger ? [ledger] : [],
        defaultLedgerId: ledgerId,
        accounts,
        categories,
        transactions: monthTxs,
        todayTransactions: todayTxs,
        todayIncome: todayStats.income,
        todayExpense: todayStats.expense,
        monthIncome: monthStats.income,
        monthExpense: monthStats.expense,
        loading: false,
      });
    } catch (e) {
      console.error("accountingStore.loadData failed:", e);
      set({ loading: false });
    }
  },

  addTransaction: async (tx) => {
    await addTransactionToDB(tx);
    await get().loadData();
  },

  deleteTransaction: async (id) => {
    await deleteTransactionFromDB(id);
    await get().loadData();
  },
}));
