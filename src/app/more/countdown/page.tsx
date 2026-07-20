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
    <div className="pb-[100px]">
      {/* Header */}
      <div className="flex items-center px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={() => router.push("/more")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav flex-1 text-center" style={{ color: "var(--color-text-primary)" }}>
          倒数日
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-5">
        {/* Add form or button */}
        {showAdd ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-standard p-4 mb-4"
          >
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="事件名称" autoFocus
              className="w-full text-[16px] outline-none bg-transparent"
              style={{ color: "var(--color-text-primary)" }}
            />
            <div className="flex gap-1 mt-3">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className="w-8 h-8 rounded-full text-lg"
                  style={{
                    background: newIcon === icon ? "var(--lifeflow-brand-50)" : "transparent",
                    outline: newIcon === icon ? "2px solid var(--lifeflow-primary)" : "none",
                    outlineOffset: 2,
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full h-10 rounded-lg px-3 text-[15px] outline-none mt-3"
              style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--lifeflow-border)" }}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowAdd(false); setNewName(""); setNewDate(""); }}
                className="flex-1 h-10 rounded-lg text-[15px]"
                style={{ background: "var(--color-surface-secondary)", color: "var(--color-text-secondary)" }}
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newDate}
                className="flex-1 h-10 rounded-lg text-[15px] font-semibold text-white"
                style={{ background: "var(--lifeflow-primary)", opacity: newName.trim() && newDate ? 1 : 0.5 }}
              >
                添加
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
              border: "1px dashed var(--lifeflow-primary)",
              borderColor: "var(--lifeflow-brand-200)",
            }}
          >
            <Plus className="w-4 h-4" />
            添加倒数日
          </button>
        )}

        {/* List */}
        <div className="flex flex-col gap-3">
          {sorted.map((c, i) => {
            const days = daysBetween(today, c.date);
            const isPast = days < 0;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-standard p-4 flex items-center gap-4"
              >
                <div className="text-3xl">{c.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                    {c.name}
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{c.date}</div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="text-[24px] font-bold"
                    style={{ color: isPast ? "var(--color-text-disabled)" : "var(--lifeflow-primary)" }}
                  >
                    {isPast ? `${Math.abs(days)}天前` : days === 0 ? "今天" : `${days}天`}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    {isPast ? "" : "后"}
                  </div>
                </div>
                <button onClick={() => handleDelete(c.id)} className="w-5 h-5">
                  <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {(countdowns ?? []).length === 0 && !showAdd && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-standard p-10 flex flex-col items-center mt-2"
          >
            <p className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              暂无重要日子
            </p>
            <p className="text-[14px] mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
              添加重要的日子开始倒计时
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-5 h-10 px-6 rounded-full text-[15px] font-semibold text-white"
              style={{ background: "var(--lifeflow-primary)" }}
            >
              添加倒数日
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
