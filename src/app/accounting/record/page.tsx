"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Pencil, Delete, Check } from "lucide-react";
import { useAccountingStore } from "@/lib/store/accountingStore";
import type { Category } from "@/lib/db/accounting.db";
import { CategoryIcon } from "@/components/accounting/CategoryIcon";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/record-expense.html
// X关闭+总账本 / 支出收入Tab / 分类网格 / 账户与保存再记胶囊 /
// 备注+金额条 / 4×4自定义键盘(今天 + − ✓)
// ============================================================

const BRAND = "#34C759";
const MUTED = "#8E8E93";
const DISABLED = "#C7C7CC";
const BORDER = "#E5E5EA";
const CURRENCY = "#FFCC00";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** raw 分数字符串 → 显示 "1.23" */
function formatRaw(raw: string): string {
  if (!raw) return "0";
  const padded = raw.length >= 3 ? raw : raw.padStart(3, "0");
  const yuan = padded.slice(0, -2) || "0";
  const fen = padded.slice(-2);
  return `${yuan}.${fen}`;
}

function formatFen(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RecordPage() {
  const router = useRouter();
  const {
    accounts, categories, defaultLedgerId,
    loadData, addTransaction,
  } = useAccountingStore();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [raw, setRaw] = useState("");
  const [acc, setAcc] = useState<number | null>(null); // 累计值（分）
  const [op, setOp] = useState<"+" | "-" | null>(null);
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [loadData]);

  // 默认账户
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const visibleCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === type),
    [categories, type],
  );

  // 切换类型时清空分类
  useEffect(() => { setSelectedCategory(null); }, [type]);

  // ─── 金额计算 ───
  const currentFen = raw ? parseInt(raw, 10) : 0;
  const evalPending = (a: number, b: number, o: "+" | "-") => (o === "+" ? a + b : Math.max(0, a - b));
  const totalFen = acc === null ? currentFen : evalPending(acc, currentFen, op ?? "+");

  const displayAmount = raw
    ? formatRaw(raw)
    : acc !== null
      ? formatFen(acc)
      : "0";

  // ─── 键盘 ───
  const pressDigit = (d: string) => {
    if (raw.replace(/^0+/, "").length >= 8) return;
    if (raw === "" && d === "0" && acc === null) return;
    setRaw((r) => (r + d).slice(0, 10));
  };
  const pressDot = () => {
    // 分位输入模式下小数点无需处理（直接输入分），保留设计键位，提示即可
    showToast({ type: "info", message: "直接输入数字即可，末两位是分" });
  };
  const pressDelete = () => {
    if (raw) setRaw((r) => r.slice(0, -1));
    else if (acc !== null) { setAcc(null); setOp(null); }
  };
  const pressOp = (o: "+" | "-") => {
    const cur = raw ? parseInt(raw, 10) : 0;
    setAcc((prev) => (prev === null ? cur : evalPending(prev, cur, op ?? "+")));
    setOp(o);
    setRaw("");
  };

  // ─── 保存 ───
  const canSave = totalFen > 0 && selectedCategory !== null && !saving;

  const doSave = async (closeAfter: boolean) => {
    if (!canSave) {
      if (!selectedCategory) showToast({ type: "warning", message: "请选择分类" });
      else if (totalFen <= 0) showToast({ type: "warning", message: "请输入金额" });
      return;
    }
    if (!defaultLedgerId) {
      showToast({ type: "error", message: "账本未就绪" });
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        ledgerId: defaultLedgerId,
        accountId: accountId ?? undefined,
        categoryId: selectedCategory!.id,
        type,
        amount: totalFen,
        date,
        note: note.trim() || undefined,
      });
      showToast({ type: "success", message: "已保存" });
      if (closeAfter) {
        router.push("/accounting");
      } else {
        setRaw(""); setAcc(null); setOp(null); setNote("");
        setSelectedCategory(null);
      }
    } catch {
      showToast({ type: "error", message: "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const dateLabel = date === todayStr() ? "今天" : `${Number(date.split("-")[1])}/${Number(date.split("-")[2])}`;

  return (
    <div className="min-h-screen bg-white">
      {/* ===== 导航（设计稿: X + 总账本胶囊） ===== */}
      <div className="flex items-center justify-between px-4 h-[44px] mt-3">
        <button
          type="button"
          onClick={() => router.push("/accounting")}
          aria-label="关闭"
          className="w-8 h-8 flex items-center justify-center active:opacity-50"
        >
          <X className="w-6 h-6 text-black" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/accounting/ledgers")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border bg-white active:opacity-50"
          style={{ borderColor: BORDER }}
        >
          <BookOpen className="w-5 h-5 text-black" strokeWidth={1.5} />
          <span className="text-[15px] text-black">总账本</span>
        </button>
      </div>

      {/* ===== 支出/收入 Tab（设计稿: 18px + 绿色下划线） ===== */}
      <div className="flex justify-center gap-10 pt-6 pb-3">
        {(["expense", "income"] as const).map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className="relative flex flex-col items-center pb-1"
              style={{
                fontSize: "18px",
                fontWeight: active ? 700 : 400,
                color: active ? "#000" : MUTED,
              }}
            >
              {t === "expense" ? "支出" : "收入"}
              {active && (
                <motion.span
                  layoutId="record-type-underline"
                  className="absolute bottom-0"
                  style={{ width: "28px", height: "3px", borderRadius: "1.5px", background: BRAND }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ===== 分类网格（设计稿: 4列 / 48px圆图标 + 13px标签） ===== */}
      <div className="px-4 pt-3.5">
        <div className="grid grid-cols-4" style={{ gap: "12px 9px" }}>
          {visibleCategories.map((c) => {
            const selected = selectedCategory?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className="flex flex-col items-center active:opacity-60"
              >
                <motion.div
                  animate={selected ? { scale: 1.08 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size={48} iconSize={24} />
                </motion.div>
                <span
                  className="text-[13px] mt-2"
                  style={{ color: selected ? BRAND : MUTED, fontWeight: selected ? 600 : 400 }}
                >
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 账户 / 保存再记（设计稿: 100×40 胶囊） ===== */}
      <div className="flex justify-between px-4 pt-8 relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountPickerOpen((p) => !p)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border bg-white active:opacity-50"
            style={{ width: "100px", height: "40px", borderColor: BORDER, fontSize: "15px", color: "#000" }}
          >
            {selectedAccount ? selectedAccount.name : "选择账户"}
          </button>
          <AnimatePresence>
            {accountPickerOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAccountPickerOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-[46px] z-40 w-[140px] bg-white rounded-[16px] overflow-hidden origin-top-left"
                  style={{ boxShadow: SHADOW_CARD }}
                >
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setAccountId(a.id); setAccountPickerOpen(false); }}
                      className="w-full flex items-center justify-between px-4 h-[44px] text-left active:bg-black/5"
                    >
                      <span className="text-[15px] text-black">{a.name}</span>
                      {a.id === accountId && <Check className="w-4 h-4" style={{ color: BRAND }} />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => doSave(false)}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full border bg-white active:opacity-50"
          style={{ width: "100px", height: "40px", borderColor: BORDER, fontSize: "15px", color: "#000" }}
        >
          保存再记
        </button>
      </div>

      {/* ===== 备注 + 金额条（设计稿: 56px 卡片） ===== */}
      <div
        className="mx-4 flex items-center justify-between bg-white rounded-[16px] mt-3 px-4"
        style={{ height: "56px", boxShadow: SHADOW_CARD }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Pencil className="w-6 h-6 shrink-0" style={{ color: MUTED }} strokeWidth={1.5} />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="填写备注"
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-[16px] text-black placeholder:text-[#C7C7CC]"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[28px] font-bold" style={{ color: CURRENCY }}>¥</span>
          <span className="text-[28px] font-bold text-black">{displayAmount}</span>
        </div>
      </div>

      {/* ===== 自定义键盘（设计稿: 4×4 / 62px键） ===== */}
      <div className="px-4 pt-3 pb-10">
        <div className="grid grid-cols-4" style={{ gap: "7px" }}>
          {["1", "2", "3"].map((k) => <NumKey key={k} label={k} onPress={() => pressDigit(k)} />)}
          {/* 今天（日期） */}
          <div className="relative">
            <button
              type="button"
              className="w-full flex items-center justify-center rounded-xl text-white"
              style={{ height: "62px", background: BRAND, fontSize: "18px", fontWeight: 600 }}
            >
              {dateLabel}
            </button>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="选择日期"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          {["4", "5", "6"].map((k) => <NumKey key={k} label={k} onPress={() => pressDigit(k)} />)}
          <NumKey label="+" onPress={() => pressOp("+")} />

          {["7", "8", "9"].map((k) => <NumKey key={k} label={k} onPress={() => pressDigit(k)} />)}
          <NumKey label="−" onPress={() => pressOp("-")} />

          <NumKey label="." onPress={pressDot} />
          <NumKey label="0" onPress={() => pressDigit("0")} />
          <button
            type="button"
            onClick={pressDelete}
            aria-label="删除"
            className="flex items-center justify-center rounded-xl bg-white active:opacity-50"
            style={{ height: "62px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
          >
            <Delete className="w-6 h-6 text-black" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => doSave(true)}
            aria-label="确认"
            className="flex items-center justify-center rounded-xl active:opacity-70"
            style={{ height: "62px", background: canSave ? BRAND : "#A3E3B3" }}
          >
            <Check className="w-7 h-7 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 数字键盘键（设计稿: 62px / 白底 / 24px） */
function NumKey({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex items-center justify-center rounded-xl bg-white active:bg-black/5"
      style={{
        height: "62px",
        fontSize: "24px",
        color: "#000",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {label}
    </button>
  );
}
