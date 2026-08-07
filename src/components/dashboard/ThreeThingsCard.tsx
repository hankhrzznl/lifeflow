"use client";

// ============================================================
// T21-4 今日三件事卡片（首页）
// 每日自动生成「今天最重要的三件事」+ 手动可调 + 完成联动备考进度
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, Check, Pencil, Sparkles } from "lucide-react";
import { useThreeThings } from "@/lib/three-things";

const ACCENT = "#F59E0B";

const AUTO_LABEL: Record<string, string> = { province: "省考", cet4: "四级" };
const AUTO_COLOR: Record<string, string> = { province: "#6366F1", cet4: "#10B981" };

export default function ThreeThingsCard() {
  const { store, doneCount, allDone, toggle, updateText } = useThreeThings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setDraft(text);
  };
  const commitEdit = (id: string) => {
    updateText(id, draft);
    setEditingId(null);
  };

  const items = store?.items ?? [];

  return (
    <div className="px-4 mb-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03, duration: 0.3, ease: "easeOut" }}
        className="rounded-[20px] p-4"
        style={{
          background: "var(--color-surface-card)",
          boxShadow: "var(--shadow-card)",
          borderLeft: allDone ? "3px solid #34C759" : `3px solid ${ACCENT}`,
        }}
      >
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FFFBEB" }}>
            <Target className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>今日三件事</span>
          <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums"
            style={{
              color: allDone ? "#34C759" : ACCENT,
              background: allDone ? "rgba(52,199,89,0.12)" : "rgba(245,158,11,0.12)",
            }}>
            {allDone ? "已完成 🎉" : `${doneCount}/${items.length} 已完成`}
          </span>
        </div>

        {/* 三件事列表 */}
        <div className="flex flex-col">
          {items.map((item, i) => {
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2.5"
                style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border)" : "none", opacity: item.done ? 0.55 : 1 }}
              >
                {/* 勾选圆 */}
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-label={item.done ? "标记未完成" : "标记完成"}
                  className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                  style={{
                    borderColor: item.done ? "#34C759" : item.auto ? AUTO_COLOR[item.auto] : ACCENT,
                    backgroundColor: item.done ? "#34C759" : "transparent",
                  }}
                >
                  {item.done && <Check className="w-[13px] h-[13px] text-white" strokeWidth={2.5} />}
                </button>

                {/* 文案 / 编辑态 */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(item.id); }}
                        onBlur={() => commitEdit(item.id)}
                        autoFocus
                        placeholder="输入最重要的一件事…"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[14px] outline-none"
                        style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit(item.id)}
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 active:opacity-60"
                        style={{ background: "#FFFBEB" }}
                      >
                        <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.auto && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ color: AUTO_COLOR[item.auto], background: `${AUTO_COLOR[item.auto]}1F` }}>
                          {AUTO_LABEL[item.auto]}
                        </span>
                      )}
                      <span
                        className="block text-[14px] font-medium truncate"
                        style={{
                          color: item.text ? "var(--color-text-primary)" : "var(--color-text-disabled)",
                          textDecoration: item.done ? "line-through" : "none",
                        }}
                      >
                        {item.text || (i === items.length - 1 ? "点击 ✎ 添加最重要的一件事…" : "点击 ✎ 添加…")}
                      </span>
                    </div>
                  )}
                </div>

                {/* 编辑按钮 */}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(item.id, item.text)}
                    aria-label="编辑"
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:opacity-60"
                    style={{ background: "var(--lifeflow-muted)" }}
                  >
                    <Pencil className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部说明 */}
        <div className="mt-2 pt-2.5 flex items-center gap-2" style={{ borderTop: "1px solid var(--lifeflow-border)" }}>
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-disabled)" }}>
            自动来自备考计划 · 打勾联动学习进度 · 点 ✎ 可改成自己的事
          </p>
        </div>
      </motion.div>
    </div>
  );
}
