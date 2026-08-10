"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Gift, Check, Star, Sparkles } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getWishes, addWish, updateWish, deleteWish, toggleWishCompletion } from "@/lib/db/life.db";
import type { Wish } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

const WISH_COLORS = ["#FF2D55", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE"];

type SegKey = "active" | "done" | "all";

export default function WishesPage() {
  const router = useRouter();

  const wishes = useLiveQuery(() => getWishes(), [], [] as Wish[]);

  const [seg, setSeg] = useState<SegKey>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(WISH_COLORS[0]);
  const [status, setStatus] = useState<"active" | "done">("active");
  const [saving, setSaving] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    const currentWishes = wishes || [];
    const maxOrder =
      currentWishes.length > 0 ? Math.max(...currentWishes.map((w) => w.sortOrder)) : -1;
    await addWish({
      name: newName.trim(),
      desc: newDesc.trim() || undefined,
      color: newColor,
      sortOrder: maxOrder + 1,
      completed: status === "done",
    });
    showToast({ type: "success", message: "心愿已添加" });
    closeSheet();
    setSaving(false);
  }, [newName, newDesc, newColor, status, wishes, saving]);

  const handleUpdate = useCallback(async () => {
    if (!editingId || !newName.trim() || saving) return;
    setSaving(true);
    await updateWish(editingId, {
      name: newName.trim(),
      desc: newDesc.trim() || undefined,
      color: newColor,
      completed: status === "done",
    });
    showToast({ type: "success", message: "已更新" });
    closeSheet();
    setSaving(false);
  }, [editingId, newName, newDesc, newColor, status, saving]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteWish(id);
    showToast({ type: "success", message: "已删除" });
  }, []);

  const handleToggle = useCallback(async (id: string) => {
    await toggleWishCompletion(id);
  }, []);

  const openNew = () => {
    setEditingId(null);
    setNewName("");
    setNewDesc("");
    setNewColor(WISH_COLORS[0]);
    setStatus("active");
    setSheetOpen(true);
  };

  const openEdit = (w: Wish) => {
    setEditingId(w.id);
    setNewName(w.name);
    setNewDesc(w.desc || "");
    setNewColor(w.color);
    setStatus(w.completed ? "done" : "active");
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingId(null);
    setNewName("");
    setNewDesc("");
    setSaving(false);
  };

  const list = useMemo(() => wishes ?? [], [wishes]);
  const activeCount = useMemo(() => list.filter((w) => !w.completed).length, [list]);
  const doneCount = useMemo(() => list.filter((w) => w.completed).length, [list]);
  const shown = useMemo(() => {
    if (seg === "all") return list;
    return list.filter((w) => (seg === "active" ? !w.completed : w.completed));
  }, [list, seg]);

  return (
    <div className="min-h-dvh max-w-md mx-auto px-4 pt-[var(--safe-area-top)] pb-[104px]">
      {/* 顶部：返回 + 标题 */}
      <header className="flex items-center gap-2 px-1 py-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="返回"
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm text-gray-900 dark:text-white hover:opacity-85 active:scale-90 transition"
        >
          <ChevronLeft className="w-[22px] h-[22px]" />
        </button>
        <h1 className="flex-1 min-w-0 text-center text-[17px] font-bold text-gray-900 dark:text-white truncate">
          愿望清单
        </h1>
        <span className="w-10 shrink-0" aria-hidden="true" />
      </header>

      {/* 统计头行 */}
      <section className="flex items-stretch bg-white dark:bg-gray-900 rounded-2xl shadow-[var(--shadow-card)] px-2 py-3 mt-1" aria-label="愿望统计">
        <div className="flex-1 flex flex-col items-center gap-1.5 py-1 rounded-[10px]">
          <span className="font-mono text-[20px] font-bold text-gray-900 dark:text-white leading-none">{activeCount}</span>
          <span className="text-[11px] text-gray-400 leading-none">进行中</span>
        </div>
        <div className="w-px bg-gray-100 dark:bg-gray-800 my-1.5" aria-hidden="true" />
        <div className="flex-1 flex flex-col items-center gap-1.5 py-1 rounded-[10px]">
          <span className="font-mono text-[20px] font-bold text-green-500 leading-none">{doneCount}</span>
          <span className="text-[11px] text-gray-400 leading-none">已完成</span>
        </div>
      </section>

      {/* 分类 segmented */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-[10px] mt-2.5">
        {(
          [
            { key: "active", label: "进行中" },
            { key: "done", label: "已完成" },
            { key: "all", label: "全部" },
          ] as const
        ).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSeg(s.key)}
            aria-pressed={seg === s.key}
            className={`flex-1 h-8 rounded-md text-[13px] font-semibold transition active:scale-95 ${
              seg === s.key
                ? "bg-white dark:bg-gray-900 text-[var(--lifeflow-primary)] shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 愿望卡列表 */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Gift className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-[14px] text-gray-400">还没有心愿，添加一个吧</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2.5 mt-3">
            {shown.map((wish, i) => {
              const done = wish.completed;
              return (
                <motion.div
                  key={wish.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  onClick={() => handleToggle(wish.id)}
                  role="button"
                  aria-pressed={done}
                  aria-label={done ? `愿望「${wish.name}」，点击取消完成` : `愿望「${wish.name}」，点击标记完成`}
                  className="flex items-start gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-transparent shadow-[var(--shadow-card)] px-3.5 py-3.5 cursor-pointer hover:border-gray-100 dark:hover:border-gray-800 active:scale-[0.995] transition"
                >
                  <span
                    className="w-11 h-11 shrink-0 rounded-[12px] flex items-center justify-center"
                    style={{ background: `${wish.color}1A`, color: wish.color }}
                    aria-hidden="true"
                  >
                    {done ? <Sparkles className="w-[22px] h-[22px]" /> : <Star className="w-[22px] h-[22px]" />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="flex-1 min-w-0 text-[15px] font-semibold text-gray-900 dark:text-white truncate">
                        {wish.name}
                      </h3>
                      {done ? (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                          <Check className="w-2.5 h-2.5" />
                          已完成
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                          进行中
                        </span>
                      )}
                    </div>

                    {/* 完成进度（进行中 0% / 已完成 100%） */}
                    <div className="mt-2.5">
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${done ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: done ? "100%" : "0%" }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className={`text-[12px] truncate ${done ? "text-gray-500 dark:text-gray-400" : "text-gray-400"}`}>
                          {wish.desc || (done ? "已达成目标" : "正在努力实现")}
                        </span>
                        <span className={`font-mono text-[11px] font-semibold shrink-0 ${done ? "text-green-500" : "text-gray-400"}`}>
                          {done ? "达成" : "0%"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(wish);
                      }}
                      aria-label={`编辑：${wish.name}`}
                      className="h-7 px-2.5 rounded-md text-[12px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-900/30 hover:opacity-85 active:scale-95 transition"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(wish.id);
                      }}
                      aria-label={`删除：${wish.name}`}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 active:scale-90 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {shown.length === 0 && (
            <p className="text-center text-[13px] text-gray-400 mt-8">这个分类下还没有愿望</p>
          )}
        </>
      )}

      {/* 新建 FAB */}
      <button
        type="button"
        onClick={openNew}
        aria-label="新建愿望"
        className="fixed right-4 bottom-[180px] z-40 w-14 h-14 rounded-full bg-[var(--lifeflow-primary)] text-white shadow-[var(--shadow-modal)] flex items-center justify-center active:scale-90 transition"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* 新建/编辑 BottomSheet */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={closeSheet}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl px-5 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))]"
            >
              <div className="w-9 h-1 mx-auto rounded-full bg-gray-200 dark:bg-gray-700 mb-4" />
              <h3 className="text-center text-[17px] font-bold text-gray-900 dark:text-white">
                {editingId ? "编辑愿望" : "新建愿望"}
              </h3>
              <p className="text-center text-xs text-gray-400 mt-1">写下想实现的事，为它攒一笔专款</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="愿望名称，如 环青海湖骑行"
                autoFocus
                aria-label="愿望名称"
                className="block w-full mt-3.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-[15px] text-gray-900 dark:text-white outline-none focus:border-blue-400 placeholder:text-gray-400"
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="描述（可选）"
                rows={2}
                aria-label="描述"
                className="block w-full mt-3 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-[15px] text-gray-900 dark:text-white outline-none resize-none focus:border-blue-400 placeholder:text-gray-400 leading-relaxed"
              />
              {/* 颜色选择 */}
              <div className="flex items-center gap-2 mt-3.5">
                <span className="text-[13px] shrink-0 text-gray-400">颜色</span>
                <div className="flex gap-2">
                  {WISH_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      aria-label={`选择颜色 ${c}`}
                      aria-pressed={newColor === c}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: newColor === c ? "scale(1.15)" : "scale(1)",
                        boxShadow: newColor === c ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* 状态选择 */}
              <div className="flex gap-2 mt-3.5" role="group" aria-label="愿望状态">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  aria-pressed={status === "active"}
                  className={`flex-1 h-10 rounded-[10px] border text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    status === "active"
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  进行中
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("done")}
                  aria-pressed={status === "done"}
                  className={`flex-1 h-10 rounded-[10px] border text-[13px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    status === "done"
                      ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  已完成
                </button>
              </div>
              <div className="flex gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={closeSheet}
                  className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:opacity-85 transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={editingId ? handleUpdate : handleAdd}
                  disabled={!newName.trim() || saving}
                  className="flex-1 h-11 rounded-[10px] text-[15px] font-semibold text-white bg-[var(--lifeflow-primary)] transition hover:opacity-90 disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
