"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Pencil } from "lucide-react";
import { addLedger } from "@/lib/db/accounting.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-accounting/pages/add-ledger.html
// ============================================================

const BRAND = "#34C759";
const SHADOW_CARD = "0 4px 16px rgba(0,0,0,0.08)";

// ─── 封面渐变 ────────────────────────────────────────────────

const LEDGER_COVERS = [
  "linear-gradient(180deg, #FF9500 0%, #AF52DE 100%)",
  "linear-gradient(180deg, #FF6B8A 0%, #FFB8C6 100%)",
  "linear-gradient(180deg, #5AC8FA 0%, #34C759 100%)",
  "linear-gradient(180deg, #007AFF 0%, #5AC8FA 100%)",
  "linear-gradient(180deg, #AF52DE 0%, #FF6B8A 100%)",
];

// ─── 预览卡背景（20% 透明度版本）─────────────────────────────

function previewBg(idx: number): string {
  const c = LEDGER_COVERS[idx] ?? LEDGER_COVERS[0];
  // 将 hex → rgba(..., 0.2) 形式的低透明度渐变
  // 简化：直接用所选 cover 以 20% opacity 上层 + 白底
  // 用 linear-gradient 叠加：先画固底白，再叠加低透明度渐变
  // 最简单方法：解析 hex 为 rgba
  return c
    .replace("#FF9500", "rgba(255,149,0,0.2)")
    .replace("#AF52DE", "rgba(175,82,222,0.2)")
    .replace("#FF6B8A", "rgba(255,107,138,0.2)")
    .replace("#FFB8C6", "rgba(255,184,198,0.2)")
    .replace("#5AC8FA", "rgba(90,200,250,0.2)")
    .replace("#34C759", "rgba(52,199,89,0.2)")
    .replace("#007AFF", "rgba(0,122,255,0.2)");
}

function defaultPreviewBg(): string {
  return "linear-gradient(to bottom, rgba(52,199,89,0.2), rgba(0,122,255,0.2))";
}

// ============================================================
// 页面
// ============================================================

export default function NewLedgerPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [coverIndex, setCoverIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0;

  const handleConfirm = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await addLedger({ name: name.trim(), type: "personal", currency: "CNY", coverIndex });
      showToast({ type: "success", message: "已创建" });
      router.replace("/accounting/ledgers");
    } catch {
      showToast({ type: "error", message: "创建失败" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF" }}>
      <div className="mx-auto" style={{ maxWidth: 430 }}>
        {/* ===== 导航条 44px ===== */}
        <div className="h-11 flex items-center relative px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute left-4 inline-flex items-center justify-center w-8 h-8"
            aria-label="关闭"
          >
            <X className="w-5 h-5" style={{ color: "#000000" }} />
          </button>
          <div className="flex-1 text-center text-[17px] font-semibold" style={{ color: "#000000" }}>
            新增账本
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit || submitting}
            className="absolute inline-flex items-center justify-center w-8 h-8"
            style={{ right: 16 }}
            aria-label="确认"
          >
            <Check
              className="w-5 h-5"
              style={{ color: canSubmit ? BRAND : "#C7C7CC" }}
            />
          </button>
        </div>

        {/* ===== 封面预览卡 330×420 ===== */}
        <div className="mx-auto mt-[27px] relative overflow-hidden" style={{ width: 330, height: 420, borderRadius: 24, boxShadow: SHADOW_CARD }}>
          {/* 背景渐变 */}
          <div className="absolute inset-0" style={{ background: coverIndex === 0 && name === "" ? defaultPreviewBg() : previewBg(coverIndex) }} />
          {/* 输入区 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入账本的名称"
              className="bg-transparent text-center text-[20px] text-black outline-none w-full px-6 placeholder:text-[rgba(0,0,0,0.3)]"
              maxLength={20}
            />
          </div>
        </div>

        {/* ===== 单选项「独立账本」 ===== */}
        <div className="flex items-center justify-center mt-[25px] gap-3">
          <div
            className="relative inline-flex items-center justify-center w-5 h-5 rounded-full"
            style={{ border: "2px solid #000000" }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
          </div>
          <span className="text-base font-normal" style={{ color: "#000000" }}>
            独立账本
          </span>
        </div>

        {/* ===== 「选择账本封面」区头 ===== */}
        <div className="flex items-center justify-between px-4 mt-10">
          <span className="text-base font-semibold" style={{ color: "#000000" }}>
            选择账本封面
          </span>
          <button
            type="button"
            onClick={() => showToast({ type: "info", message: "功能开发中" })}
            className="inline-flex items-center justify-center w-6 h-6"
            aria-label="编辑"
          >
            <Pencil className="w-6 h-6" style={{ color: "#000000" }} />
          </button>
        </div>

        {/* ===== 横向封面选择器 ===== */}
        <div
          className="mt-[35px] h-[180px] overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          <div className="flex gap-3 px-4 h-full items-start" style={{ minWidth: "max-content" }}>
            {LEDGER_COVERS.map((gradient, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCoverIndex(i)}
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: 100,
                  height: 140,
                  borderRadius: 12,
                  background: gradient,
                }}
              >
                {coverIndex === i && (
                  <div
                    className="absolute bottom-2 left-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: BRAND }}
                  >
                    <Check className="w-[14px] h-[14px]" style={{ color: "#FFFFFF" }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ===== 底部安全区 ===== */}
        <div className="h-[34px]" />
      </div>
    </div>
  );
}
