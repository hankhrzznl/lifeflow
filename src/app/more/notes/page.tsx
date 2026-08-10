"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, StickyNote, Pin, Search } from "lucide-react";
import { getNotes, addNote, updateNote, deleteNote } from "@/lib/db/life.db";
import type { Note } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

/** 置顶标记的本地持久化键（仅前端 UI 状态，不写 life.db） */
const PIN_STORAGE_KEY = "lifeflow.notes.pinned";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NotesPage() {
  const router = useRouter();
  const today = todayStr();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned">("all");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const refresh = useCallback(async () => {
    const list = await getNotes();
    setNotes(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      if (raw) setPinnedIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      try {
        localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // 置顶优先，其次按创建时间倒序（getNotes 已按 createdAt 倒序，这里再叠加置顶）
  const displayed = useMemo(() => {
    let list = [...notes];
    if (filter === "pinned") list = list.filter((n) => pinnedIds.includes(n.id));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const ap = pinnedIds.includes(a.id) ? 0 : 1;
      const bp = pinnedIds.includes(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return b.createdAt - a.createdAt;
    });
    return list;
  }, [notes, pinnedIds, filter, query]);

  const pinnedCount = useMemo(
    () => notes.filter((n) => pinnedIds.includes(n.id)).length,
    [notes, pinnedIds]
  );

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingId(null);
    setTitle("");
    setContent("");
  };

  const handleAdd = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    await addNote({ title: title.trim(), content: content.trim(), date: today });
    showToast({ type: "success", message: "已保存" });
    closeSheet();
    refresh();
  }, [title, content, today, refresh]);

  const handleUpdate = useCallback(async () => {
    if (!editingId || !title.trim() || !content.trim()) return;
    await updateNote(editingId, { title: title.trim(), content: content.trim() });
    showToast({ type: "success", message: "已更新" });
    closeSheet();
    refresh();
  }, [editingId, title, content, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteNote(id);
    showToast({ type: "success", message: "已删除" });
    closeSheet();
    refresh();
  }, [refresh]);

  const openNew = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setSheetOpen(true);
  };

  const openEdit = (n: Note) => {
    setEditingId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setSheetOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <div className="min-h-dvh max-w-md mx-auto px-4 pt-[var(--safe-area-top)] pb-[104px]">
      {/* 顶部：返回 + 标题 + 搜索 */}
      <header className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1 py-1">
        <button
          type="button"
          onClick={() => router.push("/more")}
          aria-label="返回"
          className="w-10 h-10 flex items-center justify-center rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 active:scale-90 transition"
        >
          <ArrowLeft className="w-[22px] h-[22px]" />
        </button>
        <h1 className="text-center text-[17px] font-bold text-gray-900 dark:text-white truncate">备忘</h1>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) closeSearch();
          }}
          aria-label="搜索笔记"
          aria-expanded={searchOpen}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition ${
            searchOpen ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <Search className="w-5 h-5" />
        </button>
      </header>

      {/* 搜索展开行 */}
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[10px] px-3 shadow-[var(--shadow-card)] mt-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题或内容…"
                autoFocus
                autoComplete="off"
                aria-label="搜索笔记"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none py-2.5 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="flex-shrink-0 text-[13px] font-semibold text-blue-500 hover:opacity-80"
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 统计行 */}
      <div className="flex items-baseline justify-between gap-2 px-1 mt-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          共 <b className="font-mono font-semibold text-purple-500 dark:text-purple-400">{displayed.length}</b> 条笔记 · 置顶{" "}
          <b className="font-mono font-semibold text-purple-500 dark:text-purple-400">{pinnedCount}</b> 条
        </p>
        <span className="text-[11px] text-gray-400">点击笔记编辑</span>
      </div>

      {/* 筛选 chips */}
      <div className="flex gap-2 mt-2.5 px-0.5">
        {(
          [
            { key: "all", label: "全部" },
            { key: "pinned", label: "置顶" },
          ] as const
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`h-8 px-4 rounded-md text-[13px] font-semibold border transition active:scale-95 ${
              filter === c.key
                ? "bg-purple-500 border-purple-500 text-white"
                : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 shadow-[var(--shadow-card)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? null : notes.length === 0 ? (
        /* 空态（画布风格） */
        <div className="flex flex-col items-center justify-center pt-20 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mb-4">
            <StickyNote className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-[15px] text-gray-500 dark:text-gray-400">还没有笔记。写一条吧。</p>
          <button
            onClick={openNew}
            className="mt-5 h-11 px-8 rounded-full text-[15px] font-semibold text-white bg-[var(--lifeflow-primary)] hover:opacity-90 transition"
          >
            写一条
          </button>
        </div>
      ) : (
        /* 笔记列表（分组卡片，画布行视觉） */
        <>
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[var(--shadow-card)] overflow-hidden mt-3">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <StickyNote className="w-6 h-6 text-gray-400" />
                <p className="text-[13px] text-gray-400">没有匹配的笔记</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayed.map((n, i) => {
                  const pinned = pinnedIds.includes(n.id);
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                          pinned
                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400"
                            : "bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400"
                        }`}
                      >
                        {pinned ? <Pin className="w-[18px] h-[18px]" /> : <StickyNote className="w-[18px] h-[18px]" />}
                      </span>
                      <button type="button" onClick={() => openEdit(n)} className="flex-1 min-w-0 text-left">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{n.title}</span>
                          {pinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                        </span>
                        <span className="block text-[13px] text-gray-400 truncate mt-0.5">{n.content}</span>
                      </button>
                      <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">{n.date}</span>
                      <button
                        type="button"
                        onClick={() => togglePin(n.id)}
                        aria-label={pinned ? "取消置顶" : "置顶"}
                        aria-pressed={pinned}
                        className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                        style={{ color: pinned ? "var(--lifeflow-primary)" : "var(--color-text-disabled)" }}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
          <p className="text-center text-[11px] text-gray-400 mt-4">共 {displayed.length} 条 · 点击笔记编辑</p>
        </>
      )}

      {/* 新建 FAB */}
      <button
        type="button"
        onClick={openNew}
        aria-label="新建笔记"
        className="fixed right-4 bottom-[180px] z-40 w-[52px] h-[52px] rounded-full bg-purple-500 text-white shadow-[var(--shadow-modal)] flex items-center justify-center active:scale-90 transition"
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
                {editingId ? "编辑笔记" : "新建笔记"}
              </h3>
              <p className="text-center text-xs text-gray-400 mt-1">写下此刻的想法，稍后随时回来</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="标题，如 下周复习安排"
                maxLength={30}
                autoFocus
                aria-label="笔记标题"
                className="block w-full mt-3.5 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-[15px] text-gray-900 dark:text-white outline-none focus:border-purple-400 placeholder:text-gray-400"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="正文内容…"
                rows={4}
                aria-label="笔记正文"
                className="block w-full mt-3 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-[15px] text-gray-900 dark:text-white outline-none resize-none focus:border-purple-400 placeholder:text-gray-400 leading-relaxed"
              />
              <div className="flex gap-2.5 mt-4">
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingId)}
                    className="flex items-center justify-center gap-1.5 h-11 rounded-[10px] px-4 text-[15px] font-semibold text-white bg-red-500 hover:opacity-90 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                ) : null}
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
                  disabled={!title.trim() || !content.trim()}
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
