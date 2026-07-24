"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Zap, Check, Bell, Flame,
  Calendar, Droplets, Moon, Dumbbell, Pill,
  Timer, CalendarRange, StickyNote, BarChart3, Settings, FolderKanban,
  Plus, X, Clock,
} from "lucide-react";
import { getUpcomingItems, addManualItem, updateItem } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";
import { getPendingReminders } from "@/lib/db";
import type { Reminder } from "@/lib/types";
import { useAgent } from "@/components/agent/AgentProvider";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 工具函数
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateChinese(date: Date): string {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? m : ""}` : `${m}min`;
}

function itemDuration(item: Item): number {
  const [sh, sm] = item.plannedStart.split(":").map(Number);
  const [eh, em] = item.plannedEnd.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

// ============================================================
// AI 快捷指令
// ============================================================

const QUICK_PROMPTS = [
  { label: "今日提醒", icon: Bell },
  { label: "安排日程", icon: Calendar },
  { label: "本周复盘", icon: Flame },
];

// 提醒图标映射
const REMINDER_ICONS: Record<string, React.ComponentType<any>> = {
  water: Droplets,
  sleep: Moon,
  fitness: Dumbbell,
  medication: Pill,
};

/* ────────── Quick Access Button ────────── */

function QuickBtn({ href, icon: Icon }: { href: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <Link
      href={href}
      className="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60"
      style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
    </Link>
  );
}

// ─── 预设颜色 ───
const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6", "#FF2D55", "#00C7BE"];

// ============================================================
// 首页
// ============================================================

export default function HomePage() {
  const today = todayStr();
  const now = new Date();
  const { sendAndNavigate } = useAgent();

  // ── 当前时间（每分钟更新） ──
  const [nowTime, setNowTime] = useState(nowTimeStr);
  useEffect(() => {
    const update = () => setNowTime(nowTimeStr());
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // ── 数据源：当前时间往后的 6 个事项 ──
  const upcomingItems = useLiveQuery(
    () => (today && nowTime ? getUpcomingItems(today, nowTime, 6) : Promise.resolve([])),
    [today, nowTime],
    [] as Item[],
  );

  // ── 提醒 ──
  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([]);
  useEffect(() => {
    getPendingReminders().then((r) => setPendingReminders(r.slice(0, 3))).catch(() => {});
  }, []);

  // ── 核心事项（第一条未完成） ──
  const coreItem = useMemo(() => {
    return (upcomingItems ?? []).find((item) => !item.isCompleted) ?? null;
  }, [upcomingItems]);

  // ── 今日事项计数 ──
  const todayTotal = (upcomingItems ?? []).length;
  const completedCount = (upcomingItems ?? []).filter((i) => i.isCompleted).length;

  // ── 排序 ──
  const sortedItems = useMemo(() => {
    return [...(upcomingItems ?? [])].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.plannedStart.localeCompare(b.plannedStart);
    });
  }, [upcomingItems]);

  // ── 勾选切换 ──
  const handleToggle = useCallback(async (item: Item) => {
    await updateItem(item.id, { isCompleted: !item.isCompleted });
  }, []);

  // ── 创建弹窗 ──
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    plannedStart: "",
    plannedEnd: "",
    note: "",
    color: PRESET_COLORS[0],
  });

  const resetForm = () => {
    const now = new Date();
    const start = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const later = new Date(now.getTime() + 30 * 60000);
    const end = `${String(later.getHours()).padStart(2, "0")}:${String(later.getMinutes()).padStart(2, "0")}`;
    setCreateForm({ title: "", plannedStart: start, plannedEnd: end, note: "", color: PRESET_COLORS[0] });
  };

  const handleCreate = useCallback(async () => {
    const title = createForm.title.trim();
    if (!title) { showToast({ type: "error", message: "请输入事项名称" }); return; }
    if (!createForm.plannedStart || !createForm.plannedEnd) { showToast({ type: "error", message: "请选择时间" }); return; }

    await addManualItem({
      date: today,
      plannedStart: createForm.plannedStart,
      plannedEnd: createForm.plannedEnd,
      title,
      note: createForm.note || undefined,
      color: createForm.color,
    });

    showToast({ type: "success", message: "事项已创建" });
    setShowCreate(false);
    resetForm();
  }, [createForm, today]);

  // ────────── Render ──────────

  return (
    <div className="min-h-screen pb-[90px] relative">
      {/* ===== Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="px-4 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between"
      >
        <p className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {greeting()} · {formatDateChinese(now)}
        </p>
        <div className="flex items-center gap-0.5">
          <QuickBtn href="/more/focus" icon={Timer} />
          <QuickBtn href="/more/countdown" icon={CalendarRange} />
          <QuickBtn href="/more/notes" icon={StickyNote} />
          <QuickBtn href="/more/review" icon={BarChart3} />
          <QuickBtn href="/settings" icon={Settings} />
          <Link
            href="/more/projects"
            className="h-7 flex items-center gap-1.5 px-2.5 rounded-lg active:opacity-60 ml-1"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}
          >
            <FolderKanban className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>项目管理</span>
          </Link>
        </div>
      </motion.div>

      {/* ===== 核心事项高亮卡 ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: "easeOut" }}
          className="p-5"
          style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--lifeflow-brand-50)" }}>
              <Zap className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: "var(--lifeflow-primary)" }}>下一个事项</span>
          </div>

          {coreItem ? (
            <>
              <p className="text-[20px] font-bold mb-1.5" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
                {coreItem.title}
              </p>
              <div className="flex items-center gap-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {coreItem.plannedStart}
                  {itemDuration(coreItem) > 0 && ` · ${formatDuration(itemDuration(coreItem))}`}
                </span>
                <span
                  className="px-2 py-0.5 rounded-md text-[11px]"
                  style={{ background: `${coreItem.color}20`, color: coreItem.color }}
                >
                  {coreItem.color === "#FF9500" ? "作息" : coreItem.color === "#007AFF" ? "课程" : "事项"}
                </span>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleToggle(coreItem)}
                  className="flex-1 py-2.5 rounded-full text-white text-[14px] font-semibold active:opacity-90"
                  style={{ background: coreItem.isCompleted ? "var(--color-text-disabled)" : "var(--lifeflow-primary)" }}
                >
                  {coreItem.isCompleted ? "已勾选" : "完成"}
                </button>
                <Link
                  href="/efficiency/schedule"
                  className="py-2.5 px-4 rounded-full text-[14px] font-medium active:opacity-70"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                >
                  日程
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                今天接下来暂无安排
              </p>
              <p className="text-[13px] mb-4" style={{ color: "var(--color-text-secondary)" }}>
                新建一个事项，或去日程页查看完整时间轴
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { resetForm(); setShowCreate(true); }}
                  className="flex-1 py-2.5 rounded-full text-center text-[14px] font-semibold text-white active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  新建事项
                </button>
                <Link
                  href="/efficiency/schedule"
                  className="py-2.5 px-4 rounded-full text-[14px] font-medium active:opacity-70"
                  style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                >
                  日程
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ===== AI 快捷指令 ===== */}
      <div className="px-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35, ease: "easeOut" }}
        >
          <div className="flex gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => { sendAndNavigate(p.label); }}
                className="flex-1 py-2.5 px-2 rounded-full text-[12px] font-medium flex items-center justify-center gap-1.5 active:opacity-70 transition-opacity"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", color: "var(--color-text-primary)" }}
              >
                <p.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
                {p.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ===== 今日提醒条 ===== */}
      {pendingReminders.length > 0 && (
        <div className="px-4 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11, duration: 0.35, ease: "easeOut" }}
          >
            <Link
              href="/reminders"
              className="flex items-center gap-2 px-4 py-3 rounded-[20px] active:opacity-70"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <Bell className="w-4 h-4 flex-shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                {pendingReminders.map((r, i) => {
                  const Icon = REMINDER_ICONS[r.moduleType || ""];
                  return (
                    <span key={i} className="flex items-center gap-1 text-[12px] whitespace-nowrap" style={{ color: "var(--color-text-secondary)" }}>
                      {Icon && <Icon className="w-3 h-3" />}
                      {r.message || r.type}
                      {i < pendingReminders.length - 1 && (
                        <span style={{ color: "var(--color-text-disabled)" }}>·</span>
                      )}
                    </span>
                  );
                })}
              </div>
              <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: "var(--lifeflow-primary)" }}>
                {pendingReminders.length} 条
              </span>
            </Link>
          </motion.div>
        </div>
      )}

      {/* ===== 今日事项（当前时间往后） ===== */}
      <div className="px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35, ease: "easeOut" }}
          className="flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.018em" }}>
              今日待办
            </h2>
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
              {completedCount}/{todayTotal}
            </span>
          </div>
          <Link href="/efficiency/schedule" className="text-[13px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
            完整时间轴
          </Link>
        </motion.div>

        <div className="flex flex-col gap-3">
          {sortedItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.35 }}
              className="rounded-[20px] p-4 text-center"
              style={{ backgroundColor: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
                今天接下来的事项将显示在这里
              </p>
              <button
                onClick={() => { resetForm(); setShowCreate(true); }}
                className="mt-3 text-[13px] font-medium"
                style={{ color: "var(--lifeflow-primary)" }}
              >
                新建事项
              </button>
            </motion.div>
          )}
          {sortedItems.map((item, i) => {
            const isDone = item.isCompleted;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.04, duration: 0.3, ease: "easeOut" }}
                className="rounded-[20px] p-4 flex items-center gap-3"
                style={{
                  backgroundColor: "var(--color-surface-card)",
                  boxShadow: "var(--shadow-card)",
                  opacity: isDone ? 0.6 : 1,
                  borderLeft: `3px solid ${item.color}`,
                }}
              >
                <button
                  onClick={() => handleToggle(item)}
                  className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                  style={{
                    borderColor: isDone ? "var(--color-text-disabled)" : item.color,
                    backgroundColor: isDone ? item.color : "transparent",
                  }}
                >
                  {isDone && <Check className="w-[14px] h-[14px] text-white" strokeWidth={2} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[15px] font-medium truncate"
                    style={{
                      color: isDone ? "var(--color-text-disabled)" : "var(--color-text-primary)",
                      textDecoration: isDone ? "line-through" : "none",
                    }}
                  >
                    {item.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3 h-3" style={{ color: "var(--color-text-disabled)" }} />
                    <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                      {item.plannedStart}
                      {itemDuration(item) > 0 && ` - ${item.plannedEnd}`}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ===== 浮动创建按钮 ===== */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
        onClick={() => { resetForm(); setShowCreate(true); }}
        className="absolute w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform z-40"
        style={{
          background: "var(--lifeflow-primary)",
          bottom: 24,
          right: 24,
        }}
        aria-label="新建事项"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </motion.button>

      {/* ===== 创建事项弹窗 ===== */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[20px] max-w-[430px] mx-auto"
              style={{
                backgroundColor: "var(--color-surface-card)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>

              <div className="px-5 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                    新建事项
                  </h3>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                  </button>
                </div>

                {/* 标题 */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    事项名称
                  </label>
                  <input
                    type="text"
                    placeholder="例如：写周报"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                    style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    autoFocus
                  />
                </div>

                {/* 时间 */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                      开始
                    </label>
                    <input
                      type="time"
                      value={createForm.plannedStart}
                      onChange={(e) => setCreateForm((f) => ({ ...f, plannedStart: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                      结束
                    </label>
                    <input
                      type="time"
                      value={createForm.plannedEnd}
                      onChange={(e) => setCreateForm((f) => ({ ...f, plannedEnd: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                      style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>

                {/* 颜色 */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>
                    颜色
                  </label>
                  <div className="flex gap-3">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCreateForm((f) => ({ ...f, color: c }))}
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
                        style={{ backgroundColor: c }}
                      >
                        {createForm.color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 备注 */}
                <div className="mb-6">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    备注（可选）
                  </label>
                  <input
                    type="text"
                    placeholder="添加备注..."
                    value={createForm.note}
                    onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                    style={{ backgroundColor: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                  />
                </div>

                <button
                  onClick={handleCreate}
                  className="w-full py-3.5 rounded-full text-white text-[16px] font-semibold active:opacity-90"
                  style={{ background: "var(--lifeflow-primary)" }}
                >
                  新建事项
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
