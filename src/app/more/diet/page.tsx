"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Utensils, Coffee, Sun, Moon, Apple, X } from "lucide-react";
import {
  addDietLog,
  deleteDietLog,
  getDietLogsByDateRange,
} from "@/lib/db/life.db";
import type { DietLog } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// Helpers
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MEAL_TYPES: { key: DietLog["mealType"]; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
  { key: "breakfast", label: "早餐", icon: Coffee },
  { key: "lunch", label: "午餐", icon: Sun },
  { key: "dinner", label: "晚餐", icon: Moon },
  { key: "snack", label: "加餐", icon: Apple },
];

const MEAL_TYPE_LABEL: Record<DietLog["mealType"], string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

const DAYS_TO_LOAD = 14;

// ============================================================
// Component
// ============================================================

export default function DietPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<DietLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /* bottom sheet for adding */
  const [showAdd, setShowAdd] = useState(false);
  const [activeMealType, setActiveMealType] = useState<DietLog["mealType"] | null>(null);
  const [foodName, setFoodName] = useState("");

  /* delete confirm */
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  /* ─── Load ─── */

  const loadLogs = useCallback(async () => {
    try {
      const today = new Date();
      const end = todayStr();
      const start = new Date(today);
      start.setDate(start.getDate() - DAYS_TO_LOAD + 1);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const data = await getDietLogsByDateRange(startStr, end);
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /* ─── Open add sheet ─── */

  const handleOpenAdd = useCallback((mealType: DietLog["mealType"]) => {
    setActiveMealType(mealType);
    setFoodName("");
    setShowAdd(true);
  }, []);

  /* ─── Add ─── */

  const handleAdd = useCallback(async () => {
    const name = foodName.trim();
    if (!name || !activeMealType) return;
    setIsSaving(true);
    try {
      await addDietLog({
        name,
        mealType: activeMealType,
        date: todayStr(),
      });
      showToast({ type: "success", message: "已记录" });
      setShowAdd(false);
      setFoodName("");
      setActiveMealType(null);
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [foodName, activeMealType, loadLogs]);

  /* ─── Delete ─── */

  const handleDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    try {
      await deleteDietLog(deleteTarget);
      showToast({ type: "success", message: "已删除" });
      setDeleteTarget(null);
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "删除失败" });
    }
  }, [deleteTarget, loadLogs]);

  /* ─── Group by date ─── */

  const groupedLogs = useMemo(() => {
    const map = new Map<string, DietLog[]>();
    for (const log of logs) {
      const arr = map.get(log.date) || [];
      arr.push(log);
      map.set(log.date, arr);
    }
    // sort dates descending
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return entries.map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt - a.createdAt),
    }));
  }, [logs]);

  /* ─── Format date ─── */

  function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    const today = todayStr();
    if (dateStr === today) return "今天";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ys = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (dateStr === ys) return "昨天";
    return `${parseInt(m)}月${parseInt(d)}日`;
  }

  /* ─── Loading ─── */

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="flex items-center h-11 px-4">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }} />
        </header>
        <div className="px-4 pt-4 space-y-4">
          <div className="h-28 rounded-[20px] animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
          <div className="h-40 rounded-[20px] animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
        </div>
      </div>
    );
  }

  /* ────────── Render ────────── */

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <header className="flex items-center h-11 px-4">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>
          饮食
        </h1>
        <div className="w-8" />
      </header>

      {/* Quick Record Card */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <Utensils className="h-5 w-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              今天吃了什么？
            </h2>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {MEAL_TYPES.map(({ key, label, icon: Icon }) => (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => handleOpenAdd(key)}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-[16px]"
                style={{ background: "var(--lifeflow-brand-50)" }}
              >
                <Icon className="h-5 w-5" style={{ color: "var(--lifeflow-primary)" }} />
                <span className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "var(--lifeflow-primary)" }}>
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* History */}
      <div className="px-4 pt-5">
        {groupedLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col items-center justify-center p-10"
            style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
          >
            <Utensils className="h-10 w-10 mb-3" style={{ color: "var(--color-text-disabled)" }} />
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>暂无饮食记录</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-disabled)" }}>点击上方按钮开始记录</p>
          </motion.div>
        ) : (
          groupedLogs.map(({ date, items }, gi) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * gi, duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="mb-4 p-4"
              style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="text-[13px] font-semibold mb-2" style={{ color: "var(--color-text-disabled)" }}>
                {formatDate(date)}
              </h3>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: "1px solid var(--lifeflow-border)" }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="shrink-0 text-[12px] font-medium px-2 py-0.5 rounded-md"
                      style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                    >
                      {MEAL_TYPE_LABEL[item.mealType]}
                    </span>
                    <span className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {item.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item.id ?? null)}
                    className="shrink-0 ml-3"
                    aria-label="删除"
                  >
                    <X className="h-4 w-4" style={{ color: "var(--color-text-disabled)" }} />
                  </button>
                </div>
              ))}
            </motion.div>
          ))
        )}
      </div>

      {/* ─── Add Bottom Sheet ─── */}
      <AnimatePresence>
        {showAdd && activeMealType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowAdd(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] px-5 pt-6 pb-10"
              style={{ maxWidth: 430, margin: "0 auto", background: "var(--color-surface-card)", paddingBottom: "calc(var(--bottom-nav-height, 83px) + 20px)" }}
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--lifeflow-muted)" }} />
              <h3 className="text-[17px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                添加{MEAL_TYPE_LABEL[activeMealType]}
              </h3>
              <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)" }}>
                输入食物名称
              </p>

              <input
                type="text"
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                placeholder="例如：红烧牛肉面"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                className="w-full h-11 px-4 rounded-[12px] text-[16px] outline-none mb-4 transition-colors"
                style={{
                  border: "1px solid var(--lifeflow-border)",
                  color: "var(--color-text-primary)",
                  background: "var(--lifeflow-input)",
                }}
              />

              <button
                type="button"
                onClick={handleAdd}
                disabled={isSaving || !foodName.trim()}
                className="w-full h-11 rounded-full text-[16px] font-medium transition-opacity disabled:opacity-50"
                style={{ background: "var(--lifeflow-primary)", color: "#fff" }}
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirm Modal ─── */}
      <AnimatePresence>
        {deleteTarget !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="p-5 mx-8 w-full max-w-[280px]"
              style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card-elevated)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[15px] font-semibold text-center" style={{ color: "var(--color-text-primary)" }}>
                确定删除这条饮食记录？
              </p>
              <div className="flex gap-3 mt-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-10 rounded-full text-[15px] font-medium"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
                >
                  取消
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  className="flex-1 h-10 rounded-full text-[15px] text-white font-medium"
                  style={{ background: "#FF3B30" }}
                >
                  删除
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
