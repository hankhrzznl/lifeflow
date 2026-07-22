"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Plus, Minus, X } from "lucide-react";
import { healthDB } from "@/lib/db/health.db";
import type { StretchLog } from "@/lib/db/health.db";
import { showToast } from "@/components/ui/Toast";

const POSTURE_ISSUES = ["驼背", "圆肩", "骨盆前倾", "头部前倾", "脊柱侧弯"] as const;

const QUICK_STRETCHES = [
  { name: "猫式拉伸", desc: "脊柱灵活性" },
  { name: "下犬式", desc: "全身拉伸" },
  { name: "眼镜蛇式", desc: "改善驼背" },
  { name: "蝴蝶拉伸", desc: "髋部打开" },
  { name: "肩部拉伸", desc: "改善圆肩" },
  { name: "颈部放松", desc: "缓解头部前倾" },
];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDateInWeek(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const dow = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return d.getTime() >= mon.getTime() && d.getTime() <= sun.getTime();
}

function fmtDate(d: string) {
  const date = new Date(d + "T00:00:00");
  const ws = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()} 周${ws[date.getDay()]}`;
}

export default function PosturePage() {
  const router = useRouter();
  const [logs, setLogs] = useState<StretchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [exName, setExName] = useState("");
  const [sets, setSets] = useState(1);
  const [reps, setReps] = useState(15);
  const [issue, setIssue] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadLogs = useCallback(async () => {
    const all = await healthDB.stretchLogs.orderBy("date").reverse().limit(50).toArray();
    setLogs(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const weekStats = useMemo(() => {
    const week = logs.filter(l => isDateInWeek(l.date));
    const days = new Set(week.map(l => l.date)).size;
    const totalSets = week.reduce((s, l) => s + l.sets, 0);
    return { days, count: week.length, totalSets };
  }, [logs]);

  const recentByDate = useMemo(() => {
    const map = new Map<string, StretchLog[]>();
    for (const l of logs) {
      const list = map.get(l.date) || [];
      list.push(l);
      map.set(l.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 10);
  }, [logs]);

  const handleSubmit = async () => {
    if (!exName.trim()) return;
    setSubmitting(true);
    try {
      await healthDB.stretchLogs.add({
        exerciseName: exName.trim(),
        sets, reps,
        postureIssue: issue || undefined,
        note: note || undefined,
        date: localToday(),
        createdAt: Date.now(),
      } as any);
      setExName(""); setSets(1); setReps(15); setIssue(""); setNote("");
      setShowForm(false);
      showToast({ type: "success", message: "拉伸已记录" });
      await loadLogs();
    } catch {
      showToast({ type: "error", message: "记录失败" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await healthDB.stretchLogs.delete(id);
    showToast({ type: "success", message: "已删除" });
    await loadLogs();
  };

  const quickFill = (name: string, relatedIssue?: string) => {
    setExName(name);
    setIssue(relatedIssue || "");
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--lifeflow-background)" }}>
        <header className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 rounded-lg" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }} />
        </header>
        <div className="px-4 pt-1 pb-10 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-24 rounded-[20px]" style={{ background: "var(--lifeflow-muted)" }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: "var(--lifeflow-background)" }}>
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => router.push("/more")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)" }}>
          <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-[-0.018em]" style={{ color: "var(--color-text-primary)" }}>体态拉伸</h1>
      </header>

      <div className="px-4 pt-4 pb-10 space-y-4">
        {/* Today Stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5" style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}>
          <p className="text-center mb-4 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>本周拉伸 · {weekStats.count} 次</p>
          <div className="flex items-center justify-center" style={{ gap: 24 }}>
            <div className="flex flex-col items-center flex-1">
              <span className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>{weekStats.days}</span>
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>天数</span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
            <div className="flex flex-col items-center flex-1">
              <span className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>{weekStats.totalSets}</span>
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>总组数</span>
            </div>
            <div style={{ width: 1, height: 32, background: "var(--lifeflow-border)", flexShrink: 0 }} />
            <div className="flex flex-col items-center flex-1">
              <span className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>{weekStats.count}</span>
              <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>次数</span>
            </div>
          </div>
        </motion.div>

        {/* Record Button */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <button onClick={() => setShowForm(true)} className="w-full py-3.5 rounded-full text-white text-base font-semibold active:opacity-90" style={{ background: "var(--lifeflow-primary)" }}>
            记录拉伸
          </button>
        </motion.div>

        {/* Quick Stretch Cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="mb-3 px-1 text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>推荐动作</h2>
          <div className="flex flex-col gap-3">
            {QUICK_STRETCHES.map(s => (
              <div key={s.name} className="p-4 flex items-center justify-between" style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}>
                <div>
                  <p className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{s.name}</p>
                  <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{s.desc}</p>
                </div>
                <button onClick={() => quickFill(s.name)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium active:opacity-70" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                  <Plus className="w-3.5 h-3.5 inline mr-1" />记录
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Logs */}
        {recentByDate.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-5" style={{ background: "var(--color-surface-card)", borderRadius: "20px", boxShadow: "var(--shadow-card)" }}>
            <h2 className="text-[17px] font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>最近记录</h2>
            {recentByDate.map(([date, items]) => (
              <div key={date} className="mb-3 last:mb-0">
                <span className="text-[13px] block mb-1.5" style={{ color: "var(--color-text-secondary)" }}>{fmtDate(date)}</span>
                <div className="space-y-2">
                  {items.map(l => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "var(--lifeflow-muted)" }}>
                      <div>
                        <span className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{l.exerciseName}</span>
                        <span className="text-[12px] ml-2" style={{ color: "var(--color-text-secondary)" }}>{l.sets}组×{l.reps}次</span>
                        {l.postureIssue && <span className="text-[12px] ml-2" style={{ color: "var(--lifeflow-primary)" }}>改善{l.postureIssue}</span>}
                        {l.note && <span className="text-[12px] ml-2 opacity-60" style={{ color: "var(--color-text-secondary)" }}>{l.note}</span>}
                      </div>
                      <button onClick={() => l.id !== undefined && handleDelete(l.id)} className="active:opacity-60">
                        <X className="w-3.5 h-3.5" style={{ color: "var(--color-text-disabled)" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Record Form Sheet */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] px-5 pt-5 pb-8" style={{ background: "var(--color-surface-card)", maxHeight: "85vh", overflowY: "auto", paddingBottom: "calc(var(--bottom-nav-height, 83px) + 20px)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>记录拉伸</h2>
                <button onClick={() => setShowForm(false)} className="text-[15px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>取消</button>
              </div>

              <div className="mb-5">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>动作名称</label>
                <input type="text" value={exName} onChange={e => setExName(e.target.value)} placeholder="输入拉伸动作名" className="w-full h-11 px-4 rounded-xl text-[15px] outline-none" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }} autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>组数</label>
                  <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                    <button onClick={() => setSets(Math.max(1, sets - 1))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                    <span className="flex-1 text-center text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{sets}</span>
                    <button onClick={() => setSets(Math.min(20, sets + 1))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Plus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>次数</label>
                  <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--lifeflow-muted)" }}>
                    <button onClick={() => setReps(Math.max(1, reps - 5))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                    <span className="flex-1 text-center text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{reps}</span>
                    <button onClick={() => setReps(Math.min(100, reps + 5))} className="w-9 h-9 flex items-center justify-center active:opacity-60"><Plus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} /></button>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>关联体态问题</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setIssue("")} className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: !issue ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: !issue ? "#fff" : "var(--color-text-secondary)" }}>无</button>
                  {POSTURE_ISSUES.map(p => (
                    <button key={p} onClick={() => setIssue(issue === p ? "" : p)} className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors" style={{ background: issue === p ? "var(--lifeflow-primary)" : "var(--lifeflow-muted)", color: issue === p ? "#fff" : "var(--color-text-secondary)" }}>{p}</button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>备注（可选）</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="如：肩部感觉好多了" className="w-full h-11 px-4 rounded-xl text-[15px] outline-none" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }} />
              </div>

              <button onClick={handleSubmit} disabled={submitting || !exName.trim()} className="w-full py-3.5 rounded-full text-white text-base font-semibold active:opacity-90 disabled:opacity-50" style={{ background: "var(--lifeflow-primary)" }}>
                {submitting ? "记录中..." : "保存记录"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
