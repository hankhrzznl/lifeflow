"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Gift, Check } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getWishes, addWish, deleteWish, toggleWishCompletion } from "@/lib/db/life.db";
import type { Wish } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

const WISH_COLORS = ["#FF2D55", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE"];

export default function WishesPage() {
  const router = useRouter();

  const wishes = useLiveQuery(() => getWishes(), [], [] as Wish[]);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(WISH_COLORS[0]);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;
    const currentWishes = wishes || [];
    const maxOrder = currentWishes.length > 0
      ? Math.max(...currentWishes.map(w => w.sortOrder))
      : -1;
    await addWish({
      name: newName.trim(),
      desc: newDesc.trim() || undefined,
      color: newColor,
      sortOrder: maxOrder + 1,
      completed: false,
    });
    showToast({ type: "success", message: "心愿已添加" });
    setNewName("");
    setNewDesc("");
    setNewColor(WISH_COLORS[0]);
    setShowForm(false);
  }, [newName, newDesc, newColor, wishes]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteWish(id);
  }, []);

  const handleToggle = useCallback(async (id: string) => {
    await toggleWishCompletion(id);
  }, []);

  const incomplete = (wishes || []).filter(w => !w.completed);
  const completed = (wishes || []).filter(w => w.completed);

  return (
    <div className="pb-[120px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button" onClick={() => router.back()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>心愿清单</h1>
        <button
          type="button" onClick={() => setShowForm(!showForm)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <Plus className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
      </div>

      <div className="px-4">
        {/* 添加表单 */}
        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div
                className="p-4 rounded-[20px] mb-4 flex flex-col gap-3"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="心愿名称"
                  className="block w-full h-11 px-3 rounded-xl border-none outline-none text-[15px] bg-[var(--color-surface-secondary)] placeholder-[#86868B]"
                  style={{ color: "var(--color-text-primary)", caretColor: "#5865F2" }}
                />
                <input
                  type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="描述（可选）"
                  className="block w-full h-11 px-3 rounded-xl border-none outline-none text-[15px] bg-[var(--color-surface-secondary)] placeholder-[#86868B]"
                  style={{ color: "var(--color-text-primary)", caretColor: "#5865F2" }}
                />
                {/* 颜色选择器 */}
                <div className="flex items-center gap-2">
                  <span className="text-[13px] shrink-0" style={{ color: "var(--color-text-disabled)" }}>颜色</span>
                  <div className="flex gap-2">
                    {WISH_COLORS.map(c => (
                      <button
                        key={c} type="button"
                        onClick={() => setNewColor(c)}
                        className="w-7 h-7 rounded-full transition-transform"
                        style={{
                          background: c,
                          transform: newColor === c ? "scale(1.2)" : "scale(1)",
                          boxShadow: newColor === c ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${c}` : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button" onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="h-10 rounded-xl text-[15px] font-semibold transition-opacity"
                  style={{
                    background: "var(--color-accent, #5865F2)",
                    color: "#FFFFFF",
                    opacity: newName.trim() ? 1 : 0.4,
                  }}
                >添加</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 未完成 */}
        {incomplete.length > 0 && (
          <div className="mb-5">
            <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>未完成</p>
            <div className="flex flex-col gap-2">
              {incomplete.map((wish, i) => (
                <motion.button
                  key={wish.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleToggle(wish.id)}
                  className="p-3.5 rounded-[20px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform w-full"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: wish.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{wish.name}</div>
                    {wish.desc && (
                      <div className="text-[12px] truncate mt-0.5" style={{ color: "var(--color-text-disabled)" }}>{wish.desc}</div>
                    )}
                  </div>
                  <button
                    type="button" onClick={(e) => { e.stopPropagation(); handleDelete(wish.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "transparent" }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                  </button>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* 已完成 */}
        {completed.length > 0 && (
          <div className="mb-5">
            <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>已完成</p>
            <div className="flex flex-col gap-2">
              {completed.map((wish, i) => (
                <motion.button
                  key={wish.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleToggle(wish.id)}
                  className="p-3.5 rounded-[20px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform w-full"
                  style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: wish.color, opacity: 0.5 }}>
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate line-through" style={{ color: "var(--color-text-disabled)", opacity: 0.6 }}>{wish.name}</div>
                    {wish.desc && (
                      <div className="text-[12px] truncate mt-0.5 line-through" style={{ color: "var(--color-text-disabled)", opacity: 0.4 }}>{wish.desc}</div>
                    )}
                  </div>
                  <button
                    type="button" onClick={(e) => { e.stopPropagation(); handleDelete(wish.id); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "transparent" }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                  </button>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {(!wishes || wishes.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Gift className="w-12 h-12" style={{ color: "var(--color-text-disabled)", opacity: 0.5 }} />
            <p className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>还没有心愿，添加一个吧</p>
          </div>
        )}
      </div>
    </div>
  );
}
