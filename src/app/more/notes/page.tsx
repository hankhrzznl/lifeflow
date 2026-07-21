"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, StickyNote } from "lucide-react";
import { getNotes, addNote, updateNote, deleteNote } from "@/lib/db/life.db";
import type { Note } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NotesPage() {
  const router = useRouter();
  const today = todayStr();

  const [notes, setNotes] = useState<Note[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await getNotes();
    setNotes(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    await addNote({ title: newTitle.trim(), content: newContent.trim(), date: today });
    showToast({ type: "success", message: "已保存" });
    setNewTitle(""); setNewContent(""); setShowAdd(false);
    refresh();
  }, [newTitle, newContent, today, refresh]);

  const handleUpdate = useCallback(async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    await updateNote(id, { title: editTitle.trim(), content: editContent.trim() });
    showToast({ type: "success", message: "已更新" });
    setEditingId(null);
    refresh();
  }, [editTitle, editContent, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteNote(id);
    refresh();
  }, [refresh]);

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  return (
    <div className="flex flex-col min-h-dvh pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: "var(--color-surface-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          备忘录
        </h1>
        <div className="w-8" />
      </div>

      {loading ? null : notes.length === 0 && !showAdd ? (
        <div className="flex-1 flex items-center justify-center px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-sm flex-col items-center rounded-[20px] px-6 py-10 text-center"
            style={{
              background: "var(--color-surface-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "var(--lifeflow-brand-50)" }}
            >
              <StickyNote className="h-8 w-8" style={{ color: "var(--lifeflow-primary)" }} />
            </div>
            <p className="text-[17px]" style={{ color: "var(--color-text-secondary)" }}>
              暂无笔记
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-6 inline-flex items-center justify-center rounded-full px-8 py-3 text-[16px] font-semibold transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: "var(--lifeflow-primary)", color: "var(--lifeflow-primary-foreground)" }}
            >
              写笔记
            </button>
          </motion.div>
        </div>
      ) : (
        <div className="px-4 pt-5">
          {/* Add form or button */}
          {showAdd ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-standard p-4 mb-4"
            >
              <input
                type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="标题" autoFocus
                className="w-full text-[16px] font-semibold outline-none bg-transparent"
                style={{ color: "var(--color-text-primary)" }}
              />
              <textarea
                value={newContent} onChange={(e) => setNewContent(e.target.value)}
                placeholder="内容..." rows={4}
                className="w-full text-[15px] outline-none resize-none mt-2 bg-transparent"
                style={{ color: "var(--color-text-primary)" }}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowAdd(false); setNewTitle(""); setNewContent(""); }}
                  className="flex-1 h-10 rounded-lg text-[15px]"
                  style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
                >
                  取消
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                  style={{
                    background: "var(--lifeflow-primary)",
                    opacity: newTitle.trim() && newContent.trim() ? 1 : 0.5,
                  }}
                >
                  保存
                </button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[20px] mb-4 text-[15px] font-medium"
              style={{
                background: "var(--lifeflow-brand-50)",
                color: "var(--lifeflow-primary)",
                border: "1px dashed var(--lifeflow-brand-200)",
              }}
            >
              <Plus className="w-4 h-4" />
              新建备忘录
            </button>
          )}

          {/* Notes list */}
          <div className="flex flex-col gap-3">
            {notes.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-standard p-4"
              >
                {editingId === n.id ? (
                  <>
                    <input
                      type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-[16px] font-semibold outline-none bg-transparent"
                      style={{ color: "var(--color-text-primary)" }}
                    />
                    <textarea
                      value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full text-[15px] outline-none resize-none mt-2 bg-transparent" rows={3}
                      style={{ color: "var(--color-text-primary)" }}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-9 px-4 rounded-lg text-[13px]"
                        style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleUpdate(n.id)}
                        className="h-9 px-4 rounded-lg text-[13px] font-medium text-white"
                        style={{ background: "var(--lifeflow-primary)" }}
                      >
                        保存
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                    <button type="button" onClick={() => startEdit(n)} className="text-left w-full pr-6">
                      <div className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                        {n.title}
                      </div>
                      <div className="text-[15px] mt-1 line-clamp-3" style={{ color: "var(--color-text-secondary)" }}>
                        {n.content}
                      </div>
                      <div className="text-[12px] mt-2" style={{ color: "var(--color-text-disabled)" }}>{n.date}</div>
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
