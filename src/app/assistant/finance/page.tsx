"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Plus, ChevronRight, X, Trash2, Wallet,
  ArrowRightLeft, Download, Edit3, Target,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addFinRecord, getFinRecordsByMonth, deleteFinRecord, updateFinRecord,
  getFinAccounts, createFinAccount, deleteFinAccount,
  getGoalsByProject,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import { FIN_CATEGORIES } from "@/lib/types";
import type { FinRecord, FinAccount } from "@/lib/types";
import { notifyGoalProgressUpdate } from "@/lib/linkage";
import type { Goal } from "@/lib/types";
import { getMonthBudget, setMonthBudget } from "@/lib/financeStats";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): { day: string; weekday: string } {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return { day: `${d.getMonth() + 1}月${d.getDate()}日`, weekday: weekdays[d.getDay()] };
}

function exportCSV(records: FinRecord[], year: number, month: number) {
  const headers = ["类型", "金额", "分类", "日期", "备注", "标签"];
  const rows = records.map((r) => [
    r.type === "income" ? "收入" : "支出",
    r.amount.toFixed(2),
    FIN_CATEGORIES[r.type].find((c) => c.key === r.category)?.label || r.category,
    r.date,
    r.note || "",
    r.tag || "",
  ]);
  const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${v}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `记账_${year}年${month}月.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinancePage() {
  const [records, setRecords] = useState<FinRecord[]>([]);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [showForm, setShowForm] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [showBudgetSheet, setShowBudgetSheet] = useState(false);
  const [editRecordId, setEditRecordId] = useState<number | null>(null);

  // 表单
  const [formType, setFormType] = useState<"expense" | "income">("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("food");
  const [formDate, setFormDate] = useState(getTodayStr());
  const [formNote, setFormNote] = useState("");
  const [formTag, setFormTag] = useState("");

  // 转账
  const [transferFromId, setTransferFromId] = useState<number | null>(null);
  const [transferToId, setTransferToId] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");

  // 预算
  const [budgetAmount, setBudgetAmount] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const router = useRouter();

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

  const loadBudget = useCallback(async () => {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const b = await getMonthBudget(monthKey);
    setBudgetAmount(b);
  }, [currentYear, currentMonth]);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadRecords(); loadBudget(); }, [loadRecords, loadBudget]);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const allProjects = await (await import("@/lib/db")).getAllProjectsV2();
        const allGoals: Goal[] = [];
        for (const p of allProjects) {
          const g = await getGoalsByProject(p.id!);
          allGoals.push(...g.filter(g => g.type === "finance" && (g.status === "active" || g.status === "paused")));
        }
        setGoals(allGoals);
      } catch {}
    };
    loadGoals();
  }, []);

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

  const resetForm = () => {
    setFormType("expense"); setFormAmount(""); setFormCategory("food");
    setFormDate(getTodayStr()); setFormNote(""); setFormTag("");
    setEditRecordId(null);
  };

  const openForm = (type: "expense" | "income") => {
    resetForm();
    setFormType(type);
    setFormCategory(type === "expense" ? "food" : "salary");
    setShowForm(true);
  };

  const openEditForm = (record: FinRecord) => {
    setFormType(record.type);
    setFormAmount(String(record.amount));
    setFormCategory(record.category);
    setFormDate(record.date);
    setFormNote(record.note || "");
    setFormTag(record.tag || "");
    setEditRecordId(record.id ?? null);
    setShowForm(true);
  };

  const handleAdd = async () => {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0 || !selectedAccountId) return;

    if (editRecordId !== null) {
      await updateFinRecord(editRecordId, {
        type: formType,
        amount,
        category: formCategory,
        date: formDate,
        note: formNote || undefined,
        tag: formTag || undefined,
        goalId: selectedGoalId ?? undefined,
      });
      showToast({ message: "已修改", type: "success" });
      if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
    } else {
      await addFinRecord({
        type: formType, amount, category: formCategory,
        date: formDate, note: formNote || undefined,
        tag: formTag || undefined, accountId: selectedAccountId,
        goalId: selectedGoalId ?? undefined,
      });
      showToast({ message: "已记录", type: "success" });
      if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
    }
    setShowForm(false);
    resetForm();
    loadRecords();
  };

  const handleDelete = async (id: number) => {
    await deleteFinRecord(id);
    if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
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

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0 || transferFromId === null || transferToId === null) return;
    if (transferFromId === transferToId) {
      showToast({ message: "转出和转入账户不能相同", type: "error" });
      return;
    }
    const today = getTodayStr();
    // 转出账户：记一笔支出
    await addFinRecord({
      type: "expense", amount, category: "other",
      date: today, note: transferNote ? `转账至: ${transferNote}` : "转账",
      tag: "转账", accountId: transferFromId,
    });
    // 转入账户：记一笔收入
    await addFinRecord({
      type: "income", amount, category: "other_income",
      date: today, note: transferNote ? `转账自: ${transferNote}` : "转账",
      tag: "转账", accountId: transferToId,
    });
    showToast({ message: "转账成功", type: "success" });
    setShowTransferSheet(false);
    setTransferAmount("");
    setTransferNote("");
    loadRecords();
  };

  const handleSaveBudget = async () => {
    const amount = parseFloat(budgetInput);
    if (!amount || amount <= 0) return;
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    await setMonthBudget(monthKey, amount);
    setBudgetAmount(amount);
    setBudgetInput("");
    setShowBudgetSheet(false);
    showToast({ message: "预算已设置", type: "success" });
  };

  const handleExportCSV = () => {
    exportCSV(records, currentYear, currentMonth);
    showToast({ message: "CSV 已导出", type: "success" });
  };

  const categories = FIN_CATEGORIES[formType];

  const budgetProgress = budgetAmount != null ? Math.min(totalExpense / budgetAmount * 100, 100) : 0;
  const budgetColor = budgetProgress >= 90 ? "bg-red-500" : budgetProgress >= 70 ? "bg-amber-500" : "bg-green-500";

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
          {accounts.length >= 2 && (
            <button
              onClick={() => {
                setTransferFromId(selectedAccountId);
                setTransferToId(accounts.find((a) => a.id !== selectedAccountId)?.id ?? null);
                setTransferAmount("");
                setTransferNote("");
                setShowTransferSheet(true);
              }}
              className="ml-auto w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-blue-500"
              title="转账"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600"
            title="导出CSV"
          >
            <Download className="w-4 h-4" />
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

            {/* 关联财务目标 */}
            {goals.length > 0 && (
              <div className="mx-4 mb-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">关联财务目标</span>
                  <select
                    value={selectedGoalId ?? ""}
                    onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : null)}
                    className="text-xs bg-white dark:bg-gray-800 rounded-lg px-2 py-1 border-0"
                  >
                    <option value="">不关联</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.progress}%)</option>
                    ))}
                  </select>
                </div>
                {selectedGoalId && (() => {
                  const g = goals.find(g => g.id === selectedGoalId);
                  if (!g) return null;
                  return (
                    <button onClick={() => router.push(`/projects/${g.projectId}/goals/${g.id}`)} className="w-full text-left">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{g.name}</span>
                        <span className="font-medium">{g.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${g.progress >= 100 ? "bg-emerald-500" : g.progress >= 50 ? "bg-blue-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(g.progress, 100)}%` }}
                        />
                      </div>
                      {g.deadline && (
                        <p className="text-xs text-gray-400 mt-1">截止: {new Date(g.deadline).toLocaleDateString("zh-CN")}</p>
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
            {goals.length === 0 && (
              <div className="mx-4 mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">暂无财务目标，在项目中创建财务类目标以追踪支出预算</p>
              </div>
            )}

            {/* 预算进度条 */}
            <div className="mb-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">月度预算</span>
                </div>
                <button
                  onClick={() => {
                    setBudgetInput(budgetAmount != null ? String(budgetAmount) : "");
                    setShowBudgetSheet(true);
                  }}
                  className="text-xs text-green-500 hover:text-green-600 font-medium"
                >
                  {budgetAmount != null ? "修改预算" : "设置预算"}
                </button>
              </div>
              {budgetAmount != null ? (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-red-500 font-medium">支出 ¥{totalExpense.toFixed(2)}</span>
                    <span className="text-gray-400">
                      预算 ¥{budgetAmount.toFixed(2)}
                      {budgetProgress >= 90 && (
                        <span className="text-red-500 ml-1">⚠️</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budgetColor}`}
                      style={{ width: `${budgetProgress}%` }}
                    />
                  </div>
                  {budgetProgress >= 90 && (
                    <p className="text-[11px] text-red-500 mt-1">预算即将耗尽，注意控制支出！</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1">点击「设置预算」为本月设置支出上限</p>
              )}
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
                          <div
                            key={r.id}
                            onClick={() => openEditForm(r)}
                            className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: cat?.bg || "#f3f4f6" }}>
                              {cat?.icon || "📋"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{cat?.label || r.category}</p>
                                {r.tag && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                    {r.tag}
                                  </span>
                                )}
                              </div>
                              {r.note && <p className="text-xs text-gray-400 truncate">{r.note}</p>}
                            </div>
                            <span className={`text-sm font-bold ${isExpense ? "text-red-500" : "text-green-500"}`}>
                              {isExpense ? "-" : "+"}{r.amount.toFixed(2)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); r.id && handleDelete(r.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                            <Edit3
                              className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 查看更多统计 */}
            <div className="mt-6 text-center">
              <Link
                href="/stats#finance"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm text-gray-500 hover:text-green-600 hover:border-green-300 dark:hover:text-green-400 dark:hover:border-green-800 transition-colors"
              >
                查看完整财务统计
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}

        {/* 浮动添加按钮 */}
        {selectedAccountId !== null && !showForm && !showAccountSheet && !showTransferSheet && !showBudgetSheet && (
          <div className="fixed bottom-40 right-5 md:right-8 z-40 flex flex-col gap-2">
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

      {/* 记账表单 Sheet（新增 + 编辑） */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40" onClick={() => { setShowForm(false); resetForm(); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85vh] overflow-y-auto pb-24"
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
                  <button onClick={() => { setShowForm(false); resetForm(); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
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

                <input
                  placeholder="标签（可选）如：餐饮、聚餐"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-2"
                />

                <input placeholder="备注（可选）" value={formNote} onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-4" />

                <button onClick={handleAdd}
                  className={`w-full py-3 rounded-xl text-white font-medium ${
                    formType === "expense" ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                  }`}>
                  {editRecordId !== null ? "保存修改" : `记录${formType === "expense" ? "支出" : "收入"}`}
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
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl p-5 pb-24"
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

      {/* 转账 Sheet */}
      <AnimatePresence>
        {showTransferSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowTransferSheet(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl p-5 pb-24"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">账户转账</h3>
                <button onClick={() => setShowTransferSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <label className="block text-xs text-gray-500 mb-1.5">转出账户</label>
              <div className="flex gap-2 mb-3">
                {accounts.map((a) => (
                  <button key={a.id}
                    onClick={() => setTransferFromId(a.id!)}
                    className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                      transferFromId === a.id
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >{a.name}</button>
                ))}
              </div>

              <label className="block text-xs text-gray-500 mb-1.5">转入账户</label>
              <div className="flex gap-2 mb-3">
                {accounts.map((a) => (
                  <button key={a.id}
                    onClick={() => setTransferToId(a.id!)}
                    className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                      transferToId === a.id
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >{a.name}</button>
                ))}
              </div>

              <input
                type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="转账金额" className="w-full text-center text-3xl font-bold py-4 bg-transparent outline-none text-gray-900 dark:text-white mb-3"
              />
              <input
                placeholder="转账备注（可选）"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm mb-4"
              />

              <button onClick={handleTransfer}
                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium">
                确认转账
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 预算设置 Sheet */}
      <AnimatePresence>
        {showBudgetSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowBudgetSheet(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl p-5 pb-24"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {budgetAmount != null ? "修改预算" : "设置月度预算"}
                </h3>
                <button onClick={() => setShowBudgetSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              {budgetAmount != null && (
                <p className="text-xs text-gray-400 mb-3">当前预算：¥{budgetAmount.toFixed(2)} | 本月已支出：¥{totalExpense.toFixed(2)}</p>
              )}
              <input
                type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="预算金额" className="w-full text-center text-3xl font-bold py-4 bg-transparent outline-none text-gray-900 dark:text-white mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setShowBudgetSheet(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">取消</button>
                <button onClick={handleSaveBudget}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium">保存预算</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
