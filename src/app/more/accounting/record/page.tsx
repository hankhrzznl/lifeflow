"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Calendar, Pencil, Delete, ChevronDown, BookOpen } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { getAllCategories } from "@/lib/db/accounting.db";
import type { Category } from "@/lib/db/accounting.db";
import { getIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌（CSS 变量）
// ============================================================

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatRaw(raw: string): string {
  if (!raw) return "0";
  const padded = raw.length >= 3 ? raw : raw.padStart(3, "0");
  const yuan = padded.slice(0, -2) || "0";
  const fen = padded.slice(-2);
  return `${yuan}.${fen}`;
}

// ============================================================
// 主组件
// ============================================================
export default function RecordPage() {
  const router = useRouter();
  const { accounts, defaultLedgerId, loadData, addTransaction } = useAccountingStore();

  // 分类直接用 useLiveQuery 订阅（比 store 更实时可靠）
  const allCategories = useLiveQuery(() => getAllCategories(), [], [] as Category[]);

  // 首次加载：store 的 loadData 负责播种数据，这里只做初始化触发
  useEffect(() => { loadData(); }, [loadData]);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleCategories = useMemo(
    () => (allCategories ?? []).filter((c) => c.type === type),
    [allCategories, type],
  );

  useEffect(() => { setSelectedCategory(null); }, [type]);

  const currentFen = raw ? parseInt(raw, 10) : 0;
  const displayAmount = raw ? formatRaw(raw) : "0";
  const canSave = currentFen > 0 && selectedCategory !== null && !saving;

  // ─── 键盘 ────────────────────────────────────────────────
  const pressDigit = (d: string) => {
    if (raw.replace(/^0+/, "").length >= 8) return;
    if (raw === "" && d === "0") return;
    setRaw((r) => (r + d).slice(0, 10));
  };
  const pressDelete = () => setRaw((r) => r.slice(0, -1));

  // ─── 保存 ────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave) {
      if (!selectedCategory) showToast({ type: "warning", message: "请选择分类" });
      else if (currentFen <= 0) showToast({ type: "warning", message: "请输入金额" });
      return;
    }
    if (!defaultLedgerId) { showToast({ type: "error", message: "账本未就绪" }); return; }
    setSaving(true);
    try {
      await addTransaction({
        ledgerId: defaultLedgerId,
        accountId: accounts[0]?.id ?? undefined,
        categoryId: selectedCategory!.id,
        type, amount: currentFen, date,
        note: note.trim() || undefined,
      });
      showToast({ type: "success", message: "已保存" });
      router.push("/more/accounting");
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally { setSaving(false); }
  }, [canSave, selectedCategory, currentFen, defaultLedgerId, accounts, type, date, note, addTransaction, router]);

  const dateLabel = `${Number(date.split("-")[1])}月${Number(date.split("-")[2])}日`;

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="min-h-screen flex flex-col" style={{ background: "var(--color-surface-card)" }}
    >
      {/* ===== 顶部导航栏 ===== */}
      <div className="relative flex items-center justify-between px-4 h-[44px] mt-3" style={{ borderBottom: "1px solid var(--lifeflow-border)" }}>
        <button type="button" onClick={() => router.push("/more/accounting")}
          className="text-[17px] active:opacity-50" style={{ color: "var(--color-text-secondary)" }}>取消</button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>记一笔</span>
        <span className="w-10" />
      </div>

      {/* ===== 金额显示 + 备注输入 ===== */}
      <div className="flex flex-col items-center pt-8 pb-2">
        <div className="text-5xl font-bold tracking-[-0.025em] leading-none select-none"
          style={{ color: raw ? "var(--color-text-primary)" : "var(--color-text-disabled)" }}>
          ¥{displayAmount}
        </div>
        <div className="flex items-center gap-1.5 mt-4 px-4 py-2.5 rounded-full"
          style={{ background: "var(--lifeflow-muted)" }}>
          <Pencil className="h-3.5 w-3.5" style={{ color: "var(--lifeflow-muted-foreground)" }} />
          <input type="text" placeholder="添加备注..." value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-28"
            style={{ color: "var(--color-text-secondary)" }} maxLength={30} />
        </div>
      </div>

      {/* ===== 分类网格（3 列） ===== */}
      <div className="px-4 pt-6">
        <div className="grid grid-cols-3 gap-y-7 gap-x-2">
          {visibleCategories.map((c) => {
            const selected = selectedCategory?.id === c.id;
            const Icon = getIcon(c.icon);
            return (
              <button key={c.id} type="button" onClick={() => setSelectedCategory(c)}
                className="flex flex-col items-center gap-2.5 focus:outline-none active:opacity-70">
                <div className="w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-200"
                  style={{
                    background: selected
                      ? "var(--lifeflow-brand-200)"
                      : "var(--lifeflow-brand-100)",
                  }}>
                  <Icon className="w-6 h-6" style={{ color: "var(--lifeflow-brand)" }} />
                </div>
                <span className="text-xs font-medium"
                  style={{
                    color: selected ? "var(--lifeflow-primary)" : "var(--color-text-primary)",
                    fontWeight: selected ? 600 : 500,
                  }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 支出/收入 tab 切换 ===== */}
      <div className="flex justify-center pt-8 pb-4">
        <div className="flex p-1 rounded-full" style={{ background: "var(--lifeflow-muted)", width: "fit-content" }}>
          {(["expense", "income"] as const).map((t) => {
            const active = type === t;
            return (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`px-7 py-2 rounded-full text-sm transition-all duration-200 ${
                  active ? "font-semibold" : "font-medium"
                }`}
                style={active
                  ? { background: "var(--lifeflow-brand)", color: "var(--lifeflow-primary-foreground)", boxShadow: "var(--shadow-tab-center)" }
                  : { color: "var(--lifeflow-muted-foreground)" }
                }>
                {t === "expense" ? "支出" : "收入"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 数字键盘（3×4） ===== */}
      <div className="px-6 pt-2">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <button key={k} type="button" onClick={() => pressDigit(k)}
              className="h-[64px] rounded-[16px] text-[28px] font-medium active:bg-black/5 flex items-center justify-center"
              style={{ color: "var(--color-text-primary)" }}>{k}</button>
          ))}
          <button type="button" onClick={() => showToast({ type: "info", message: "直接输入数字即可，末两位是分" })}
            className="h-[64px] rounded-[16px] text-[28px] font-medium active:bg-black/5 flex items-center justify-center"
            style={{ color: "var(--color-text-primary)" }}>.</button>
          <button type="button" onClick={() => pressDigit("0")}
            className="h-[64px] rounded-[16px] text-[28px] font-medium active:bg-black/5 flex items-center justify-center"
            style={{ color: "var(--color-text-primary)" }}>0</button>
          <button type="button" onClick={pressDelete} aria-label="删除"
            className="h-[64px] rounded-[16px] flex items-center justify-center active:opacity-50"
            style={{ background: "var(--lifeflow-border)" }}>
            <Delete className="w-6 h-6" style={{ color: "var(--color-text-secondary)" }} />
          </button>
        </div>
      </div>

      {/* 弹性占位，底栏始终在底部 */}
      <div className="flex-1" />

      {/* ===== 底部操作栏 ===== */}
      <div className="sticky bottom-0 px-4 pb-4 pt-2" style={{ background: "var(--color-surface-card)" }}>
        <motion.button type="button" whileTap={{ scale: 0.95 }}
          onClick={handleSave} disabled={!canSave || saving}
          className="w-full py-3.5 rounded-full text-lg font-semibold tracking-[-0.01em] transition-opacity duration-200 active:opacity-85 disabled:opacity-60"
          style={{
            background: canSave ? "var(--lifeflow-brand)" : "var(--lifeflow-border)",
            color: "var(--lifeflow-primary-foreground)",
            boxShadow: canSave ? "var(--shadow-tab-center)" : "none",
          }}>
          {saving ? "保存中…" : "记一笔"}
        </motion.button>

        {/* 日期 + 账本选择行 */}
        <div className="flex items-center justify-between px-1 mt-3">
          <button type="button" className="flex items-center gap-1.5 text-sm py-1.5"
            style={{ color: "var(--color-text-secondary)" }}>
            <Calendar className="h-4 w-4" />
            <span style={{ color: "var(--color-text-primary)" }}>{dateLabel}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <button type="button" className="flex items-center gap-1.5 text-sm py-1.5"
            style={{ color: "var(--color-text-secondary)" }}>
            <BookOpen className="h-4 w-4" />
            <span style={{ color: "var(--color-text-primary)" }}>默认账本</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
