"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, ChevronLeft, ChevronRight, Trash2,
  TrendingUp, TrendingDown, Wallet,
} from "lucide-react";
import Link from "next/link";
import { getPluginMeta, initBuiltInPlugins, addFinRecord, getFinRecordsByMonth, deleteFinRecord } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import { FIN_CATEGORIES } from "@/lib/types";
import type { FinRecord } from "@/lib/types";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): { day: string; weekday: string } {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    day: `${d.getMonth() + 1}月${d.getDate()}日`,
    weekday: weekdays[d.getDay()],
  };
}

export default function FinancePluginPage() {
  const [active, setActive] = useState(false);
  const [records, setRecords] = useState<FinRecord[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [showForm, setShowForm] = useState(false);

  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("food");
  const [formDate, setFormDate] = useState(getTodayStr());
  const [formNote, setFormNote] = useState("");

  useEffect(() => {
    getPluginMeta("finance").then((p) => setActive(p?.status === "active"));
  }, []);

  const loadRecords = useCallback(async () => {
    await initBuiltInPlugins();
    const data = await getFinRecordsByMonth(currentYear, currentMonth);
    setRecords(data);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    if (active) loadRecords();
  }, [active, loadRecords]);

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const totalIncome = records
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);

  const totalExpense = records
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);

  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await addFinRecord({
        type: formType,
        amount,
        category: formCategory,
        date: formDate,
        note: formNote || undefined,
      });
      setFormAmount("");
      setFormNote("");
      setFormDate(getTodayStr());
      setShowForm(false);
      showToast({ message: "已记录", type: "success" });
      await loadRecords();
    } catch {
      showToast({ message: "记录失败", type: "error" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteFinRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast({ message: "已删除", type: "info" });
    } catch {
      showToast({ message: "删除失败", type: "error" });
    }
  };

  const categoryList = formType === "expense" ? FIN_CATEGORIES.expense : FIN_CATEGORIES.income;

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Wallet className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">财务管理插件未启用</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">请在插件管理中启用此插件</p>
        <Link href="/plugins" className="text-indigo-600 text-sm font-medium">前往插件管理</Link>
      </div>
    );
  }

  const todayStr = getTodayStr();

  const grouped = records.reduce<{ date: string; items: FinRecord[]; income: number; expense: number }[]>((acc, r) => {
    const last = acc[acc.length - 1];
    if (last && last.date === r.date) {
      last.items.push(r);
      if (r.type === "income") last.income += r.amount;
      else last.expense += r.amount;
    } else {
      acc.push({
        date: r.date,
        items: [r],
        income: r.type === "income" ? r.amount : 0,
        expense: r.type === "expense" ? r.amount : 0,
      });
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/plugins" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">财务管理</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {currentYear}年{currentMonth}月
        </span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">收入</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalIncome.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">支出</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalExpense.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wallet className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">本月暂无记录</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击右下角 + 开始记账</p>
          </div>
        ) : (
          grouped.map(({ date, items, income, expense }) => {
            const { day, weekday } = formatDayHeader(date);
            const isToday = date === todayStr;
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{day}</span>
                    <span className="text-xs text-gray-400">{weekday}</span>
                    {isToday && (
                      <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">今天</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {income > 0 && <span className="text-emerald-500">收 {income.toFixed(2)}</span>}
                    {expense > 0 && <span className="text-red-400">支 {expense.toFixed(2)}</span>}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {items.map((record) => {
                    const cats = record.type === "expense" ? FIN_CATEGORIES.expense : FIN_CATEGORIES.income;
                    const cat = cats.find((c) => c.key === record.category);
                    return (
                      <div key={record.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0 group">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                          style={{ backgroundColor: cat?.bg || "#F3F4F6" }}
                        >
                          {cat?.icon || "📋"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {cat?.label || record.category}
                          </p>
                          {record.note && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{record.note}</p>
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${record.type === "income" ? "text-emerald-500" : "text-red-500"}`}>
                          {record.type === "income" ? "+" : "-"}{record.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => record.id != null && handleDelete(record.id)}
                          className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={() => {
          setFormType("expense");
          setFormAmount("");
          setFormCategory("food");
          setFormDate(todayStr);
          setFormNote("");
          setShowForm(true);
        }}
        className="fixed bottom-24 right-4 z-30 bg-blue-500 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors active:scale-95"
        aria-label="添加记录"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">记一笔</h3>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setFormType("expense"); setFormCategory("food"); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${formType === "expense" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}
                >
                  支出
                </button>
                <button
                  onClick={() => { setFormType("income"); setFormCategory("salary"); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${formType === "income" ? "bg-emerald-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}
                >
                  收入
                </button>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">金额</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xl font-bold text-gray-900 dark:text-gray-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">分类</label>
                <div className="grid grid-cols-4 gap-2">
                  {categoryList.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setFormCategory(cat.key)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                        formCategory === cat.key
                          ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500"
                          : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">日期</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">备注</label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="添加备注..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formAmount || parseFloat(formAmount) <= 0}
                  className={`flex-1 py-3 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40 ${formType === "expense" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                >
                  记录
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
