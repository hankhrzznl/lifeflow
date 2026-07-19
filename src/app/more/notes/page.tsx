"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, Trash2, StickyNote } from "lucide-react";
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
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => router.push("/more")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight flex-1">备忘录</h1>
      </div>

      {showAdd ? (
        <div className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="标题" autoFocus
            className="w-full text-[17px] font-semibold outline-none mb-2" />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="内容..." rows={4}
            className="w-full text-[15px] outline-none resize-none mb-3" />
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setNewTitle(""); setNewContent(""); }}
              className="flex-1 h-10 rounded-lg text-[15px]" style={{ background: "#F2F2F7", color: "#8E8E93" }}>取消</button>
            <button onClick={handleAdd} disabled={!newTitle.trim() || !newContent.trim()}
              className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
              style={{ background: "#6366F1", opacity: newTitle.trim() && newContent.trim() ? 1 : 0.5 }}>保存</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl mb-4 text-[15px] font-medium"
          style={{ background: "#6366F110", color: "#6366F1", border: "1px dashed #6366F140" }}>
          <Plus className="w-4 h-4" />新建备忘录
        </button>
      )}

      {loading ? null : notes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[34px] mb-3">📝</p>
          <p className="text-[17px] font-semibold mb-1">还没有备忘录</p>
          <p className="text-[15px]" style={{ color: "#8E8E93" }}>记录你的灵感和想法</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              {editingId === n.id ? (
                <>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-[17px] font-semibold outline-none mb-2" />
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-[15px] outline-none resize-none mb-2" rows={3} />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)}
                      className="h-9 px-4 rounded-lg text-[13px]" style={{ background: "#F2F2F7", color: "#8E8E93" }}>取消</button>
                    <button onClick={() => handleUpdate(n.id)}
                      className="h-9 px-4 rounded-lg text-[13px] font-medium text-white" style={{ background: "#6366F1" }}>保存</button>
                  </div>
                </>
              ) : (
                <div className="relative">
                  <button onClick={() => handleDelete(n.id)} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" style={{ color: "#C7C7CC" }} />
                  </button>
                  <button type="button" onClick={() => startEdit(n)} className="text-left w-full pr-6">
                    <div className="text-[17px] font-semibold truncate">{n.title}</div>
                    <div className="text-[15px] mt-1 line-clamp-3" style={{ color: "#4A4A4A" }}>{n.content}</div>
                    <div className="text-[12px] mt-2" style={{ color: "#C7C7CC" }}>{n.date}</div>
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
