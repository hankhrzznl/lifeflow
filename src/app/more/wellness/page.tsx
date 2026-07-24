"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Flower2, Activity, Heart, X } from "lucide-react";
import {
  addWellnessLog,
  deleteWellnessLog,
  getWellnessLogsByDateRange,
} from "@/lib/db/life.db";
import type { WellnessLog } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// Helpers
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const GONGFA_PRESETS = [
  { name: "八段锦", duration: 15 },
  { name: "太极拳", duration: 20 },
  { name: "五禽戏", duration: 15 },
  { name: "易筋经", duration: 20 },
  { name: "站桩", duration: 10 },
];

const TYPE_LABEL: Record<WellnessLog["type"], string> = {
  gongfa: "功法",
  tigang: "提肛",
};

const DAYS_TO_LOAD = 14;

// ============================================================
// Component
// ============================================================

export default function WellnessPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /* bottom sheet for adding gongfa */
  const [showGongfa, setShowGongfa] = useState(false);
  const [gongfaName, setGongfaName] = useState("");
  const [gongfaDuration, setGongfaDuration] = useState(15);

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
      const data = await getWellnessLogsByDateRange(startStr, end);
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

  /* ─── Add gongfa ─── */

  const handleOpenGongfa = useCallback((preset?: { name: string; duration: number }) => {
    if (preset) {
      setGongfaName(preset.name);
      setGongfaDuration(preset.duration);
    } else {
      setGongfaName("");
      setGongfaDuration(15);
    }
    setShowGongfa(true);
  }, []);

  const handleAddGongfa = useCallback(async () => {
    const name = gongfaName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await addWellnessLog({
        name,
        type: "gongfa",
        duration: gongfaDuration,
        date: todayStr(),
      });
      showToast({ type: "success", message: "已记录" });
      setShowGongfa(false);
      setGongfaName("");
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [gongfaName, gongfaDuration, loadLogs]);

  /* ─── Add tigang ─── */

  const handleAddTigang = useCallback(async () => {
    setIsSaving(true);
    try {
      await addWellnessLog({
        name: "提肛",
        type: "tigang",
        date: todayStr(),
      });
      showToast({ type: "success", message: "已记录" });
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setIsSaving(false);
    }
  }, [loadLogs]);

  /* ─── Delete ─── */

  const handleDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    try {
      await deleteWellnessLog(deleteTarget);
      showToast({ type: "success", message: "已删除" });
      setDeleteTarget(null);
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "删除失败" });
    }
  }, [deleteTarget, loadLogs]);

  /* ─── Group by date ─── */

  const groupedLogs = useMemo(() => {
    const map = new Map<string, WellnessLog[]>();
    for (const log of logs) {
      const arr = map.get(log.date) || [];
      arr.push(log);
      map.set(log.date, arr);
    }
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return entries.map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt - a.createdAt),
    }));
  }, [logs]);

  /* ─── Format date ─── */

  function formatDate(dateStr: string): string {
    const today = todayStr();
    if (dateStr === today) return "今天";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ys = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (dateStr === ys) return "昨天";
    const [y, m, d] = dateStr.split("-");
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
          <div className="h-36 rounded-[20px] animate-pulse" style={{ background: "var(--lifeflow-muted)" }} />
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
          养生
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
            <Flower2 className="h-5 w-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              今日养生
            </h2>
          </div>

          {/* 功法 Section */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>功法练习</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {GONGFA_PRESETS.map((preset) => (
                <motion.button
                  key={preset.name}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleOpenGongfa(preset)}
                  className="px-3.5 py-2 rounded-[14px] text-[13px] font-medium"
                  style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
                >
                  {preset.name} {preset.duration}分钟
                </motion.button>
              ))}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => handleOpenGongfa()}
                className="px-3.5 py-2 rounded-[14px] text-[13px] font-medium"
                style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
              >
                自定义
              </motion.button>
            </div>
          </div>

          {/* Divider */}
          <div className="my-3" style={{ height: "1px", background: "var(--lifeflow-border)" }} />

          {/* 提肛 Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>提肛练习</span>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleAddTigang}
              disabled={isSaving}
              className="px-5 py-2 rounded-full text-[14px] font-semibold disabled:opacity-50"
              style={{ background: "var(--lifeflow-primary)", color: "#fff" }}
            >
              完成一次
            </motion.button>
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
            <Flower2 className="h-10 w-10 mb-3" style={{ color: "var(--color-text-disabled)" }} />
            <p className="text-[15px] font-medium" style={{ color: "var(--color-text-secondary)" }}>还没有养生记录。完成一次练习就出现了。</p>
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
                      style={{
                        background: item.type === "gongfa" ? "var(--lifeflow-brand-50)" : "#FEF3C7",
                        color: item.type === "gongfa" ? "var(--lifeflow-primary)" : "#D97706",
                      }}
                    >
                      {TYPE_LABEL[item.type]}
                    </span>
                    <span className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {item.name}
                    </span>
                    {item.duration !== undefined && (
                      <span className="shrink-0 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                        {item.duration}分钟
                      </span>
                    )}
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

      {/* ─── Add Gongfa Bottom Sheet ─── */}
      <AnimatePresence>
        {showGongfa && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowGongfa(false)}
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
                记录功法
              </h3>
              <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)" }}>
                输入功法名称和练习时长
              </p>

              <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                功法名称
              </label>
              <input
                type="text"
                value={gongfaName}
                onChange={(e) => setGongfaName(e.target.value)}
                placeholder="例如：八段锦"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddGongfa();
                }}
                className="w-full h-11 px-4 rounded-[12px] text-[16px] outline-none mb-4 transition-colors"
                style={{
                  border: "1px solid var(--lifeflow-border)",
                  color: "var(--color-text-primary)",
                  background: "var(--lifeflow-input)",
                }}
              />

              <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                练习时长（分钟）
              </label>
              <div className="flex gap-2 mb-5">
                {[5, 10, 15, 20, 30].map((d) => (
                  <motion.button
                    key={d}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setGongfaDuration(d)}
                    className="h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
                    style={{
                      background: gongfaDuration === d ? "var(--lifeflow-brand-50)" : "var(--lifeflow-muted)",
                      color: gongfaDuration === d ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                    }}
                  >
                    {d}分钟
                  </motion.button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddGongfa}
                disabled={isSaving || !gongfaName.trim()}
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
                确定删除这条养生记录？
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
