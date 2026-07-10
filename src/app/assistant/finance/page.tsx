"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, ChevronRight, X, Trash2, Wallet,
} from "lucide-react";
import Link from "next/link";
import {
  addFinRecord, getFinRecordsByMonth, deleteFinRecord,
  getFinAccounts, createFinAccount, deleteFinAccount,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import { FIN_CATEGORIES } from "@/lib/types";
import type { FinRecord, FinAccount } from "@/lib/types";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): { day: string; weekday: string } {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return { day: `${d.getMonth() + 1}月${d.getDate()}日`, weekday: weekdays[d.getDay()] };
}

export default function FinancePage() {
  const [records, setRecords] = useState<FinRecord[]>([]);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [showForm, setShowForm] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);

  // 表单
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("food");
  const [formDate, setFormDate] = useState(getTodayStr());
  const [formNote, setFormNote] = useState("");

  const loadAccounts = useCallback(async () => {
    const list = await getFinAccounts();
    setAccounts(list);
    if (list.length > 0 && !selectedAccountId) {
      setSelectedAccountId(list[0].id!);
    } else if (list.length === 0) {
      setSelectedAccountId(null);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    if (selectedAccountId === null) { setRecords([]); return; }
    const list = await getFinRecordsByMonth(currentYear, currentMonth, selectedAccountId);
    setRecords(list);
  }, [currentYear, currentMonth, selectedAccountId]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12); }
    else setCurrentMonth((m) => m - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1); }
    else setCurrentMonth((m) => m + 1);
  };

  // 汇总
  const totalIncome = records.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const balance = (selectedAccount?.initialBalance ?? 0) + totalIncome - totalExpense;

  // 按日期分组
  const grouped: Record<string, FinRecord[]> = {};
  for (const r of records) {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleAdd = async () => {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0 || !selectedAccountId) return;
    await addFinRecord({
      type: formType, amount, category: formCategory,
      date: formDate, note: formNote || undefined, accountId: selectedAccountId,
    });
    showToast({ message: "已记录", type: "success" });
    setShowForm(false);
    resetForm();
    loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteFinRecord(id);
    showToast({ message: "已删除", type: "info" });
    loadRecords();
  };

  const handleCreateAccount = async () => {
    const name = (document.getElementById("accName") as HTMLInputElement)?.value?.trim();
    const balanceStr = (document.getElementById("accBalance") as HTMLInputElement)?.value?.trim();
    if (!name) return;
    const initialBalance = parseFloat(balanceStr) || 0;
    await createFinAccount(name, initialBalance);
    showToast({ message: "账户已创建", type: "success" });
    setShowAccountSheet(false);
    loadAccounts();
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("删除此账户将同时删除其所有记账记录，确定？")) return;
    await deleteFinAccount(id);
    showToast({ message: "账户已删除", type: "info" });
    if (selectedAccountId === id) setSelectedAccountId(null);
    loadAccounts();
  };

  const resetForm = () => {
    setFormType("expense"); setFormAmount(""); setFormCategory("food");
    setFormDate(getTodayStr()); setFormNote("");
  };

  const openForm = (type: "expense" | "income") => {
    setFormType(type); setFormAmount(""); setFormCategory(type === "expense" ? "food" : "salary");
    setFormDate(getTodayStr()); setFormNote(""); setShowForm(true);
  };

  const categories = FIN_CATEGORIES[formType];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-32 md:px-8 md:pt-10">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">记账</h1>
            <p className="text-xs text-gray-400">多账户 · 收支记录</p>
          </div>
        </div>

        {/* 账户切换栏 */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {accounts.map((acc) => (
            <div key={acc.id} className="relative flex-shrink-0">
              <button
                onClick={() => setSelectedAccountId(acc.id!)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedAccountId === acc.id
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {acc.name}
              </button>
              {accounts.length > 1 && (
                <button
                  onClick={() => handleDeleteAccount(acc.id!)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white rounded-full flex items-center justify-center text-[10px]"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setShowAccountSheet(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {selectedAccountId === null ? (
          <div className="text-center py-16">
            <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 mb-1">请先创建账户</p>
            <button onClick={() => setShowAccountSheet(true)}
              className="text-sm text-green-500 hover:text-green-600 font-medium">
              创建账户
            </button>
          </div>
        ) : (
          <>
            {/* 月份切换 */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {currentYear}年{currentMonth}月
              </span>
              <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* 汇总卡片 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">收入</p>
                <p className="text-lg font-bold text-green-500">+{totalIncome.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">支出</p>
                <p className="text-lg font-bold text-red-500">-{totalExpense.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">结余</p>
                <p className={`text-lg font-bold ${balance >= 0 ? "text-blue-500" : "text-red-500"}`}>
                  {balance.toFixed(2)}
                </p>
              </div>
            </div>

            {/* 记录列表 */}
            {sortedDates.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm text-gray-400">本月暂无记录</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedDates.map((date) => {
                  const dayRecords = grouped[date];
                  const dayIncome = dayRecords.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
                  const dayExpense = dayRecords.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
                  const { day, weekday } = formatDayHeader(date);
                  const isToday = date === getTodayStr();
                  return (
                    <div key={date} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{day}</span>
                          <span className="text-xs text-gray-400">{weekday}</span>
                          {isToday && <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">今天</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {dayIncome > 0 && <span className="text-green-500">+{dayIncome.toFixed(2)}</span>}
                          {dayExpense > 0 && <span className="text-red-500">-{dayExpense.toFixed(2)}</span>}
                        </div>
                      </div>
                      {dayRecords.map((r) => {
                        const cat = FIN_CATEGORIES[r.type].find((c) => c.key === r.category);
                        const isExpense = r.type === "expense";
                        return (
                          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0 group">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: cat?.bg || "#f3f4f6" }}>
                              {cat?.icon || "📋"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{cat?.label || r.category}</p>
                              {r.note && <p className="text-xs text-gray-400 truncate">{r.note}</p>}
                            </div>
                            <span className={`text-sm font-bold ${isExpense ? "text-red-500" : "text-green-500"}`}>
                              {isExpense ? "-" : "+"}{r.amount.toFixed(2)}
                            </span>
                            <button
                              onClick={() => r.id && handleDelete(r.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 浮动添加按钮 */}
        {selectedAccountId !== null && !showForm && !showAccountSheet && (
          <div className="fixed bottom-20 right-5 md:right-8 z-40 flex flex-col gap-2">
            <button
              onClick={() => openForm("expense")}
              className="w-12 h-12 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors flex items-center justify-center"
              title="记支出"
            >
              <span className="text-lg font-bold">-</span>
            </button>
            <button
              onClick={() => openForm("income")}
              className="w-12 h-12 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition-colors flex items-center justify-center"
              title="记收入"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* 记账表单 Sheet */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowForm(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormType("expense")}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        formType === "expense" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}
                    >支出</button>
                    <button
                      onClick={() => setFormType("income")}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        formType === "income" ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}
                    >收入</button>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <input
                  type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00" className="w-full text-center text-3xl font-bold py-4 bg-transparent outline-none text-gray-900 dark:text-white"
                  autoFocus
                />

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {categories.map((cat) => (
                    <button key={cat.key}
                      onClick={() => setFormCategory(cat.key)}
                      className={`p-2 rounded-xl text-xs transition-colors ${
                        formCategory === cat.key
                          ? "ring-2 ring-offset-1 ring-blue-400"
                          : ""
                      }`}
                      style={{ backgroundColor: cat.bg }}
                    >
                      <span className="text-lg block mb-0.5">{cat.icon}</span>
                      <span className="text-gray-700 dark:text-gray-300">{cat.label}</span>
                    </button>
                  ))}
                </div>

                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-2" />
                <input placeholder="备注（可选）" value={formNote} onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-4" />

                <button onClick={handleAdd}
                  className={`w-full py-3 rounded-xl text-white font-medium ${
                    formType === "expense" ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                  }`}>
                  记录{formType === "expense" ? "支出" : "收入"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 新建账户 Sheet */}
      <AnimatePresence>
        {showAccountSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowAccountSheet(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl p-5"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">新建账户</h3>
              <input id="accName" placeholder="账户名称" defaultValue=""
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-2" />
              <input id="accBalance" type="number" placeholder="初始余额" defaultValue="0"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setShowAccountSheet(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">取消</button>
                <button onClick={handleCreateAccount}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium">创建</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
