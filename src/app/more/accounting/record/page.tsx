"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Calendar, Pencil, Delete } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { getAllCategories } from "@/lib/db/accounting.db";
import type { Category } from "@/lib/db/accounting.db";
import { CategoryIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌（Apple 简约风）
// ============================================================
const ACCENT = "#5865F2";

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
      className="min-h-screen bg-white flex flex-col"
    >
      {/* ===== 顶部导航栏 ===== */}
      <div className="relative flex items-center justify-between px-4 h-[44px] mt-3 border-b border-[#E5E5E5]">
        <button type="button" onClick={() => router.push("/more/accounting")}
          className="text-[17px] text-[#86868B] active:opacity-50">取消</button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">记一笔</span>
        <span className="w-10" />
      </div>

      {/* ===== 金额显示区 ===== */}
      <div className="text-center py-8">
        <span className={`text-[64px] font-medium tracking-tight ${raw ? "text-[#1D1D1F]" : "text-[#AEAEB2]"}`}>
          ¥{displayAmount}
        </span>
      </div>

      {/* ===== 支出/收入 pill 分段控件 ===== */}
      <div className="flex justify-center pb-6">
        <div className="inline-flex items-center rounded-full bg-[#F5F5F5] p-1 relative">
          {(["expense", "income"] as const).map((t) => {
            const active = type === t;
            return (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={`relative h-9 px-6 rounded-full text-[15px] transition-colors ${
                  active ? "text-[#5865F2] font-semibold" : "text-[#86868B]"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="record-type-pill"
                    className="absolute inset-0 rounded-full bg-[#EEF2FF]"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t === "expense" ? "支出" : "收入"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 数字键盘（3×4） ===== */}
      <div className="px-6">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <button key={k} type="button" onClick={() => pressDigit(k)}
              className="h-[64px] rounded-[16px] text-[28px] font-medium text-[#1D1D1F] active:bg-black/5 flex items-center justify-center">{k}</button>
          ))}
          <button type="button" onClick={() => showToast({ type: "info", message: "直接输入数字即可，末两位是分" })}
            className="h-[64px] rounded-[16px] text-[28px] font-medium text-[#1D1D1F] active:bg-black/5 flex items-center justify-center">.</button>
          <button type="button" onClick={() => pressDigit("0")}
            className="h-[64px] rounded-[16px] text-[28px] font-medium text-[#1D1D1F] active:bg-black/5 flex items-center justify-center">0</button>
          <button type="button" onClick={pressDelete} aria-label="删除"
            className="h-[64px] rounded-[16px] bg-[#F5F5F5] flex items-center justify-center active:opacity-50">
            <Delete className="w-6 h-6 text-[#86868B]" />
          </button>
        </div>
      </div>

      {/* ===== 选择分类 ===== */}
      <div className="px-4 pt-8">
        <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-4">选择分类</h2>
        <div className="grid grid-cols-4" style={{ gap: "12px 9px" }}>
          {visibleCategories.map((c) => {
            const selected = selectedCategory?.id === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setSelectedCategory(c)}
                className="flex flex-col items-center active:opacity-60">
                <motion.div
                  animate={selected ? { scale: 1.08 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className={selected ? "ring-2 ring-[#5865F2] ring-offset-2 rounded-full" : ""}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size={44} iconSize={22} />
                </motion.div>
                <span className="text-[13px] mt-2"
                  style={{ color: selected ? ACCENT : "#86868B", fontWeight: selected ? 600 : 400 }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 弹性占位，底栏始终在底部 */}
      <div className="flex-1" />

      {/* ===== 底部操作栏 ===== */}
      <div className="sticky bottom-0 bg-white border-t border-[#E5E5E5] px-4 py-3 flex items-center gap-3">
        {/* 日期 chip */}
        <div className="h-10 px-4 rounded-full bg-[#F5F5F5] flex items-center gap-1.5 relative">
          <Calendar className="w-4 h-4 text-[#86868B]" />
          <span className="text-[14px] text-[#1D1D1F]">{dateLabel}</span>
          <input type="date" value={date} max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        </div>

        {/* 备注 chip + 内联输入 */}
        <div className="relative">
          <button type="button" onClick={() => { setShowNoteInput(true); setTimeout(() => noteRef.current?.focus(), 50); }}
            className="h-10 px-4 rounded-full bg-[#F5F5F5] flex items-center gap-1.5">
            <Pencil className="w-4 h-4 text-[#86868B]" />
            <span className={`text-[14px] ${note ? "text-[#1D1D1F] truncate max-w-[120px]" : "text-[#86868B]"}`}>
              {note || "添加备注"}
            </span>
          </button>
          <AnimatePresence>
            {showNoteInput && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-full left-0 mb-2 w-[200px]"
              >
                <input
                  ref={noteRef} type="text" value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => setShowNoteInput(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") setShowNoteInput(false); }}
                  placeholder="添加备注"
                  className="h-11 px-4 rounded-[12px] bg-[#F5F5F5] text-[15px] text-[#1D1D1F] placeholder-[#86868B] outline-none w-full"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 保存按钮 */}
        <motion.button
          type="button" whileTap={{ scale: 0.95 }}
          onClick={handleSave} disabled={!canSave || saving}
          className="ml-auto h-12 px-8 rounded-full text-[16px] font-semibold text-white disabled:opacity-60"
          style={{ background: canSave ? ACCENT : "#C7D2FE" }}
        >
          {saving ? "保存中…" : "保存"}
        </motion.button>
      </div>
    </motion.div>
  );
}
