"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCountdowns, addCountdown, deleteCountdown } from "@/lib/db/life.db";
import type { Countdown } from "@/lib/db/life.db";
import { showToast } from "@/components/ui/Toast";

const ICONS = ["🎂", "🧧", "🚀", "🎄", "💍", "🏖", "🎓", "🌟"];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(d1: string, d2: string): number {
  return Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000);
}

export default function CountdownPage() {
  const router = useRouter();
  const today = todayStr();

  const countdowns = useLiveQuery(() => getCountdowns(), [], [] as Countdown[]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newIcon, setNewIcon] = useState(ICONS[0]);
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || !newDate || adding) return;
    setAdding(true);
    await addCountdown({ name: newName.trim(), date: newDate, icon: newIcon, type: "once" });
    showToast({ type: "success", message: "已添加" });
    setNewName(""); setNewDate(""); setShowAdd(false);
    setAdding(false);
  }, [newName, newDate, newIcon, adding]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCountdown(id);
  }, []);

  const sorted = useMemo(() => {
    return [...(countdowns ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  }, [countdowns]);

  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => router.push("/more")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-[34px] font-bold tracking-[-0.02em] leading-tight flex-1">倒数日</h1>
      </div>
      <p className="text-[15px] mb-4" style={{ color: "#8E8E93" }}>重要日子 · 倒计时提醒</p>

      {showAdd ? (
        <div className="rounded-xl bg-white p-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex gap-2 mb-3">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="事件名称" autoFocus
              className="flex-1 text-[17px] outline-none" />
            <div className="flex gap-1">
              {ICONS.map((icon) => (
                <button key={icon} onClick={() => setNewIcon(icon)}
                  className={`w-8 h-8 rounded-full text-lg ${newIcon === icon ? "bg-[#6366F1]20 ring-2 ring-[#6366F1]" : ""}`}>{icon}</button>
              ))}
            </div>
          </div>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            className="w-full h-10 rounded-lg px-3 text-[15px] outline-none mb-3" style={{ background: "#F2F2F7" }} />
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setNewName(""); setNewDate(""); }}
              className="flex-1 h-10 rounded-lg text-[15px]" style={{ background: "#F2F2F7", color: "#8E8E93" }}>取消</button>
            <button onClick={handleAdd} disabled={!newName.trim() || !newDate}
              className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
              style={{ background: "#6366F1", opacity: newName.trim() && newDate ? 1 : 0.5 }}>添加</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl mb-4 text-[15px] font-medium"
          style={{ background: "#6366F110", color: "#6366F1", border: "1px dashed #6366F140" }}>
          <Plus className="w-4 h-4" />添加倒数日
        </button>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map((c, i) => {
          const days = daysBetween(today, c.date);
          const isPast = days < 0;
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex items-center gap-4">
              <div className="text-3xl">{c.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-semibold truncate">{c.name}</div>
                <div className="text-[13px]" style={{ color: "#8E8E93" }}>{c.date}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[24px] font-bold" style={{ color: isPast ? "#8E8E93" : "#6366F1" }}>
                  {isPast ? `${Math.abs(days)}天前` : days === 0 ? "今天" : `${days}天`}
                </div>
                <div className="text-[12px]" style={{ color: "#8E8E93" }}>{isPast ? "" : "后"}</div>
              </div>
              <button onClick={() => handleDelete(c.id)} className="w-5 h-5">
                <Trash2 className="w-4 h-4" style={{ color: "#C7C7CC" }} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {(countdowns ?? []).length === 0 && (
        <div className="text-center py-12">
          <p className="text-[34px] mb-3">📅</p>
          <p className="text-[17px] font-semibold mb-1">还没有倒数日</p>
          <p className="text-[15px]" style={{ color: "#8E8E93" }}>添加重要的日子开始倒计时</p>
        </div>
      )}
    </div>
  );
}
