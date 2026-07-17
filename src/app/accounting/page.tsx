"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ChevronLeft, ChevronRight, ShoppingBag, Home, Car, Gift, Package,
  Leaf, Apple, Candy, Dumbbell, Gamepad2, Smartphone, Shirt, Sparkles,
  Banknote, TrendingUp, Trophy, HelpCircle, Check, Delete, X, Settings,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useAccountingStore } from "@/lib/store/accountingStore";
import type { Category, Account } from "@/lib/db/accounting.db";
import BottomSheet from "@/components/common/BottomSheet";
import { showToast } from "@/components/ui/Toast";

// ─── 图标映射 ────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-bag": ShoppingBag,
  "package": Package,
  "car": Car,
  "leaf": Leaf,
  "apple": Apple,
  "candy": Candy,
  "dumbbell": Dumbbell,
  "gamepad-2": Gamepad2,
  "smartphone": Smartphone,
  "shirt": Shirt,
  "sparkles": Sparkles,
  "banknote": Banknote,
  "gift": Gift,
  "trending-up": TrendingUp,
  "trophy": Trophy,
  "home": Home,
  "help-circle": HelpCircle,
};

function getIcon(iconName: string): React.ComponentType<any> {
  return ICON_MAP[iconName] || HelpCircle;
}

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// ─── 辅助函数 ────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayAmount(raw: string): string {
  if (!raw) return "0.00";
  const padded = raw.length >= 3 ? raw : raw.padStart(3, "0");
  const yuan = padded.slice(0, -2) || "0";
  const fen = padded.slice(-2);
  return `${yuan}.${fen}`;
}

// ─── 页面组件 ────────────────────────────────────────────────

export default function AccountingPage() {
  const {
    transactions,
    todayTransactions,
    accounts,
    categories,
    monthIncome,
    monthExpense,
    defaultLedgerId,
    loadData,
    addTransaction,
    loading,
  } = useAccountingStore();

  const [monthOffset, setMonthOffset] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [rawAmount, setRawAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const currentMonth = new Date();
  const displayMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1);

  // ─── 初始化加载 ─────────────────────────────────────────────

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 按类型筛选的分类（从 store） ──────────────────────────

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income"),
    [categories],
  );

  // ─── 根据选中月份过滤 ──────────────────────────────────────

  const monthPrefix = useMemo(() => {
    const y = displayMonth.getFullYear();
    const m = displayMonth.getMonth() + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  }, [displayMonth]);

  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(monthPrefix));
  }, [transactions, monthPrefix]);

  const monthSummary = useMemo(() => {
    if (monthOffset === 0) {
      return { income: monthIncome / 100, expense: monthExpense / 100 };
    }
    let income = 0;
    let expense = 0;
    for (const t of monthTransactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income: income / 100, expense: expense / 100 };
  }, [monthTransactions, monthOffset, monthIncome, monthExpense]);

  const todayStr = getTodayStr();
  const displayTodayTransactions = useMemo(() => {
    if (monthOffset === 0) return todayTransactions;
    return transactions
      .filter((t) => t.date === todayStr)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [todayTransactions, transactions, todayStr, monthOffset]);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);
  const amountInFen = parseInt(rawAmount) || 0;
  const displayAmount = formatDisplayAmount(rawAmount);

  // ─── 可用账户 ───────────────────────────────────────────────

  const availableAccounts = useMemo(() => {
    return accounts.length > 0 ? accounts : [];
  }, [accounts]);

  // ─── 打开/关闭弹窗 ─────────────────────────────────────────

  const openSheet = useCallback(() => {
    setStep(1);
    setTransactionType("expense");
    setSelectedCategory(null);
    setRawAmount("");
    setSelectedDate(getTodayStr());
    setSelectedAccountId(availableAccounts[0]?.id ?? null);
    setNote("");
    setSheetOpen(true);
  }, [availableAccounts]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  // ─── 类型选择 ───────────────────────────────────────────────

  const handleSelectType = (type: "expense" | "income") => {
    setTransactionType(type);
    setSelectedCategory(null);
    setStep(2);
  };

  // ─── 分类选择 ───────────────────────────────────────────────

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setRawAmount("");
    setStep(3);
  };

  // ─── 数字键盘逻辑 ───────────────────────────────────────────

  const handleKeypadInput = (key: string) => {
    if (key === "delete") {
      setRawAmount((prev) => prev.slice(0, -1));
    } else if (key === ".") {
      // 忽略小数点，由 rawAmount 长度自动推断
    } else {
      if (rawAmount.length >= 8) return; // 最大 999999.99
      setRawAmount((prev) => prev + key);
    }
  };

  const handleAmountConfirm = () => {
    if (amountInFen <= 0) return;
    setStep(4);
  };

  // ─── 保存 ───────────────────────────────────────────────────

  const handleSave = async (keepOpen: boolean) => {
    if (!selectedCategory) return;
    if (amountInFen <= 0) return;

    try {
      await addTransaction({
        type: transactionType,
        amount: amountInFen,
        categoryId: selectedCategory.id,
        date: selectedDate,
        note: note || "",
        ledgerId: defaultLedgerId ?? "",
        accountId: selectedAccountId ?? "",
      });
      showToast({ message: "记账成功", type: "success" });
      if (keepOpen) {
        setRawAmount("");
        setNote("");
        setSelectedDate(getTodayStr());
        setStep(2);
        setSelectedCategory(null);
      } else {
        closeSheet();
        await loadData();
      }
    } catch {
      showToast({ message: "保存失败，请重试", type: "error" });
    }
  };

  // ─── 上/下月 ────────────────────────────────────────────────

  const goPrevMonth = () => setMonthOffset((o) => o - 1);
  const goNextMonth = () => setMonthOffset((o) => o + 1);

  // ─── 渲染 ───────────────────────────────────────────────────

  const displayCategories = transactionType === "expense" ? expenseCategories : incomeCategories;

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-28">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">明细</h1>
          <Link href="/accounting/settings">
            <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
              <Settings className="w-5 h-5 text-gray-500" />
            </button>
          </Link>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goPrevMonth}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <span className="text-lg font-bold text-gray-900">
            {displayMonth.getFullYear()}年 {MONTH_NAMES[displayMonth.getMonth()]}
          </span>
          <button
            onClick={goNextMonth}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Income / Expense Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-4 mb-5 flex"
        >
          <div className="flex-1 text-center border-r border-gray-100">
            <div className="text-xs text-gray-500 mb-1">本月收入</div>
            <div className="text-lg font-bold" style={{ color: "#34C759" }}>
              ￥{monthSummary.income.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-xs text-gray-500 mb-1">本月支出</div>
            <div className="text-lg font-bold" style={{ color: "#FF3B30" }}>
              ￥{monthSummary.expense.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </motion.div>

        {/* Today's Transactions */}
        <div className="space-y-3">
          {displayTodayTransactions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <UtensilsCrossed className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">今日还没有记账哦，点击记一笔吧</p>
            </motion.div>
          ) : (
            displayTodayTransactions.map((item, idx) => {
              const isExpense = item.type === "expense";
              const cat = getCategoryById(item.categoryId ?? "");
              const categoryName = cat?.name ?? "其他";
              const catColor = cat?.color ?? "#8E8E93";
              const IconComp = getIcon(cat?.icon ?? "help-circle");
              return (
                <motion.div
                  key={item.id ?? idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${catColor}18` }}
                  >
                    <IconComp className="w-5 h-5" style={{ color: catColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{categoryName}</div>
                    {item.note ? (
                      <div className="text-xs text-gray-400 truncate">{item.note}</div>
                    ) : null}
                  </div>
                  <span
                    className="text-sm font-semibold flex-shrink-0"
                    style={{ color: isExpense ? "#FF3B30" : "#34C759" }}
                  >
                    {isExpense ? "-" : "+"}￥{(item.amount / 100).toFixed(2)}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* FAB Button */}
      <motion.button
        onClick={openSheet}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center text-white z-40"
        style={{ background: "linear-gradient(135deg, #34C759, #5CD47A)" }}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* "记一笔" BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={closeSheet} title="记一笔">
        {step === 1 && (
          <TypeStep
            transactionType={transactionType}
            onSelect={handleSelectType}
          />
        )}
        {step === 2 && (
          <CategoryStep
            categories={displayCategories}
            transactionType={transactionType}
            selectedCategory={selectedCategory}
            onSelect={handleSelectCategory}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <AmountStep
            transactionType={transactionType}
            selectedCategory={selectedCategory}
            rawAmount={rawAmount}
            displayAmount={displayAmount}
            amountInFen={amountInFen}
            onKeypadInput={handleKeypadInput}
            onConfirm={handleAmountConfirm}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <DetailStep
            transactionType={transactionType}
            selectedCategory={selectedCategory}
            displayAmount={displayAmount}
            amountInFen={amountInFen}
            selectedDate={selectedDate}
            selectedAccountId={selectedAccountId}
            note={note}
            availableAccounts={availableAccounts}
            onDateChange={setSelectedDate}
            onAccountChange={setSelectedAccountId}
            onNoteChange={setNote}
            onSave={handleSave}
            onBack={() => setStep(3)}
            loading={loading}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// ─── Step 1: 类型选择 ───────────────────────────────────────

function TypeStep({
  transactionType,
  onSelect,
}: {
  transactionType: "expense" | "income";
  onSelect: (type: "expense" | "income") => void;
}) {
  return (
    <div className="pt-2">
      <div className="flex">
        <button
          onClick={() => onSelect("expense")}
          className="flex-1 pb-3 text-center font-semibold text-base transition-colors relative"
          style={{ color: transactionType === "expense" ? "#FF3B30" : "#8E8E93" }}
        >
          支出
          {transactionType === "expense" && (
            <motion.div
              layoutId="type-underline"
              className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
              style={{ backgroundColor: "#FF3B30" }}
            />
          )}
        </button>
        <button
          onClick={() => onSelect("income")}
          className="flex-1 pb-3 text-center font-semibold text-base transition-colors relative"
          style={{ color: transactionType === "income" ? "#34C759" : "#8E8E93" }}
        >
          收入
          {transactionType === "income" && (
            <motion.div
              layoutId="type-underline"
              className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
              style={{ backgroundColor: "#34C759" }}
            />
          )}
        </button>
      </div>
      <div className="h-px bg-gray-200 -mx-5" />
    </div>
  );
}

// ─── Step 2: 分类选择 ────────────────────────────────────────

function CategoryStep({
  categories,
  transactionType,
  selectedCategory,
  onSelect,
  onBack,
}: {
  categories: Category[];
  transactionType: "expense" | "income";
  selectedCategory: Category | null;
  onSelect: (cat: Category) => void;
  onBack: () => void;
}) {
  return (
    <div>
      {/* 类型标签 */}
      <div className="flex mb-4">
        <button
          onClick={onBack}
          className="flex-1 pb-3 text-center font-semibold text-base transition-colors relative"
          style={{ color: transactionType === "expense" ? "#FF3B30" : "#34C759" }}
        >
          {transactionType === "expense" ? "支出" : "收入"}
          <motion.div
            layoutId="type-underline"
            className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
            style={{ backgroundColor: transactionType === "expense" ? "#FF3B30" : "#34C759" }}
          />
        </button>
      </div>
      <div className="h-px bg-gray-200 -mx-5 mb-4" />

      {/* 分类网格 */}
      <div className="grid grid-cols-3 gap-4">
        {categories.map((cat) => {
          const IconComp = getIcon(cat.icon);
          const isSelected = selectedCategory?.id === cat.id;
          return (
            <motion.button
              key={cat.id}
              onClick={() => onSelect(cat)}
              whileTap={{ scale: 0.92 }}
              animate={isSelected ? { scale: 1.1 } : { scale: 1 }}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-shadow"
                style={{
                  backgroundColor: `${cat.color}18`,
                  boxShadow: isSelected ? `0 0 0 2px ${cat.color}, 0 2px 8px ${cat.color}40` : "none",
                }}
              >
                <IconComp className="w-6 h-6" style={{ color: cat.color }} />
              </div>
              <span className="text-[13px] font-medium text-gray-500">{cat.name}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: 金额输入 ────────────────────────────────────────

function AmountStep({
  transactionType,
  selectedCategory,
  rawAmount,
  displayAmount,
  amountInFen,
  onKeypadInput,
  onConfirm,
  onBack,
}: {
  transactionType: "expense" | "income";
  selectedCategory: Category | null;
  rawAmount: string;
  displayAmount: string;
  amountInFen: number;
  onKeypadInput: (key: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const isExpense = transactionType === "expense";
  const accentColor = isExpense ? "#FF3B30" : "#34C759";
  const CatIcon = selectedCategory ? getIcon(selectedCategory.icon) : HelpCircle;

  return (
    <div className="flex flex-col items-center">
      {/* 已选分类 */}
      {selectedCategory && (
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${selectedCategory.color}18` }}
          >
            <CatIcon className="w-4 h-4" style={{ color: selectedCategory.color }} />
          </div>
          <span className="text-sm font-medium text-gray-600">{selectedCategory.name}</span>
          <button
            onClick={onBack}
            className="ml-1 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      {/* 金额显示 */}
      <div className="my-4 text-center">
        <div className="text-5xl font-extrabold mt-1 tracking-tight" style={{ color: accentColor }}>
          <span className="text-3xl align-top">￥</span>
          {displayAmount}
        </div>
      </div>

      {/* 数字键盘 */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"].map((key) => {
          if (key === ".") {
            return (
              <button
                key={key}
                className="h-12 rounded-xl bg-gray-100 text-gray-400 text-lg font-medium flex items-center justify-center cursor-not-allowed"
                disabled
              >
                .
              </button>
            );
          }
          if (key === "delete") {
            return (
              <motion.button
                key={key}
                onClick={() => onKeypadInput("delete")}
                whileTap={{ scale: 0.9 }}
                className="h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                <Delete className="w-5 h-5 text-gray-500" />
              </motion.button>
            );
          }
          return (
            <motion.button
              key={key}
              onClick={() => onKeypadInput(key)}
              whileTap={{ scale: 0.9 }}
              className="h-12 rounded-xl bg-white shadow-sm text-gray-900 text-lg font-medium flex items-center justify-center hover:bg-gray-50 active:bg-gray-100"
            >
              {key}
            </motion.button>
          );
        })}
      </div>

      {/* 确认按钮 */}
      <motion.button
        onClick={onConfirm}
        whileTap={{ scale: 0.9 }}
        disabled={amountInFen <= 0}
        className="mt-6 w-16 h-16 rounded-full flex items-center justify-center shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: amountInFen > 0 ? accentColor : "#E5E5EA" }}
      >
        <Check className="w-7 h-7 text-white" strokeWidth={3} />
      </motion.button>
    </div>
  );
}

// ─── Step 4: 详情填写 ────────────────────────────────────────

function DetailStep({
  transactionType,
  selectedCategory,
  displayAmount,
  amountInFen,
  selectedDate,
  selectedAccountId,
  note,
  availableAccounts,
  onDateChange,
  onAccountChange,
  onNoteChange,
  onSave,
  onBack,
  loading,
}: {
  transactionType: "expense" | "income";
  selectedCategory: Category | null;
  displayAmount: string;
  amountInFen: number;
  selectedDate: string;
  selectedAccountId: string | null;
  note: string;
  availableAccounts: Account[];
  onDateChange: (d: string) => void;
  onAccountChange: (id: string) => void;
  onNoteChange: (n: string) => void;
  onSave: (keepOpen: boolean) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const isExpense = transactionType === "expense";
  const accentColor = isExpense ? "#FF3B30" : "#34C759";
  const CatIcon = selectedCategory ? getIcon(selectedCategory.icon) : HelpCircle;

  return (
    <div className="flex flex-col gap-5">
      {/* 已选摘要 */}
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
        {selectedCategory && (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${selectedCategory.color}18` }}
          >
            <CatIcon className="w-5 h-5" style={{ color: selectedCategory.color }} />
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {selectedCategory?.name} · {isExpense ? "支出" : "收入"}
          </div>
        </div>
        <span className="text-lg font-bold" style={{ color: accentColor }}>
          ￥{displayAmount}
        </span>
        <button
          onClick={onBack}
          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"
        >
          <X className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      {/* 日期 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">日期</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full h-10 px-3 rounded-xl bg-gray-50 text-sm text-gray-900 border-none outline-none focus:ring-2 focus:ring-[#34C759]/30"
        />
      </div>

      {/* 账户 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">账户</label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {availableAccounts.map((acc) => {
            const isSelected = selectedAccountId === acc.id;
            return (
              <motion.button
                key={acc.id}
                onClick={() => onAccountChange(acc.id)}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: isSelected ? "#34C759" : "#F2F2F7",
                  color: isSelected ? "#FFFFFF" : "#8E8E93",
                }}
              >
                {acc.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1.5 block">备注</label>
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="添加备注"
          className="w-full h-10 px-3 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder-gray-400 border-none outline-none focus:ring-2 focus:ring-[#34C759]/30"
        />
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-3 mt-2">
        <motion.button
          onClick={() => onSave(true)}
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          className="flex-1 h-11 rounded-xl border-2 text-sm font-semibold disabled:opacity-50 transition-colors"
          style={{ borderColor: "#34C759", color: "#34C759" }}
        >
          保存再记一笔
        </motion.button>
        <motion.button
          onClick={() => onSave(false)}
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          className="flex-1 h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ backgroundColor: "#34C759" }}
        >
          保存
        </motion.button>
      </div>
    </div>
  );
}
