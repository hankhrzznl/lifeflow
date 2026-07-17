import { create } from 'zustand';
import {
  getDefaultLedger,
  getAllAccounts,
  getAllCategories,
  getTransactionsByDate,
  getTransactionsByMonth,
  addTransaction as addTransactionToDB,
  deleteTransaction as deleteTransactionFromDB,
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
    } catch {
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
