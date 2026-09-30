"use client";

import { useEffect, useState } from "react";
import { GoalEngine } from "@/services/goal-engine";
import { Check } from "lucide-react";

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function calcStreak(days: boolean[]): number {
  let s = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i]) s++; else break; }
  return s;
}

export function WidgetToday() {
  const [atoms, setAtoms] = useState<Array<{ id: string; title: string; isCompleted: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    GoalEngine.getTodayAtoms().then((data) => { setAtoms(data); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" /></div>;

  const completed = atoms.filter((a) => a.isCompleted).length;

  return (
    <div className="rounded-fabric p-3" style={{ backgroundColor: "var(--surface-fabric)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>今日任务</h3>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{completed}/{atoms.length}</span>
      </div>
      {atoms.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>今天没有任务</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {atoms.map((atom) => (
            <div key={atom.id} className="flex items-center gap-2 py-1">
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${atom.isCompleted ? "bg-[var(--success)] border-[var(--success)]" : "border-[var(--border)]"}`}>
                {atom.isCompleted && <Check className="w-2.5 h-2.5 text-[var(--text-inverse)]" strokeWidth={3} />}
              </span>
              <span className="text-xs truncate" style={{
                color: atom.isCompleted ? "var(--text-tertiary)" : "var(--text-primary)",
                textDecoration: atom.isCompleted ? "line-through" : "none",
              }}>{atom.title}</span>
            </div>
          ))}
        </div>
      )}
      <a href="/today" className="block mt-2 text-center text-xs hover:underline py-1" style={{ color: "var(--brand-primary)" }}>打开LifeFlow →</a>
    </div>
  );
}

export function WidgetGoals() {
  const [goals, setGoals] = useState<Array<{ id: number; name: string; progress: number; type: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/lib/db").then(({ getAllGoals }) => {
      getAllGoals().then((data) => { setGoals(data.filter(g => g.status === "active" && g.id != null).slice(0, 3).map(g => ({ id: g.id!, name: g.name, progress: g.progress, type: g.type }))); setLoading(false); });
    });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" /></div>;

  return (
    <div className="rounded-fabric p-3" style={{ backgroundColor: "var(--surface-fabric)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>目标进度</h3>
      {goals.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>暂无进行中的目标</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs truncate flex-1 mr-2" style={{ color: "var(--text-primary)" }}>{goal.name}</span>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{goal.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--knit-bg)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, backgroundColor: "var(--brand-primary)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <a href="/goals" className="block mt-2 text-center text-xs hover:underline py-1" style={{ color: "var(--brand-primary)" }}>查看全部 →</a>
    </div>
  );
}

export function WidgetHabits() {
  const [habits, setHabits] = useState<Array<{ id: string; title: string; streak: number; done: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = getWeekStart(today);
    GoalEngine.getAtomsByDateRange(weekStart, today).then((atoms) => {
      const taskMap = new Map<string, { title: string; days: boolean[] }>();
      atoms.forEach((atom) => {
        const entry = taskMap.get(atom.weeklyTaskId);
        if (entry) { entry.days.push(atom.isCompleted); }
        else { taskMap.set(atom.weeklyTaskId, { title: atom.title, days: [atom.isCompleted] }); }
      });
      const result = Array.from(taskMap.entries()).map(([id, data]) => ({
        id, title: data.title, streak: calcStreak(data.days), done: data.days[data.days.length - 1] || false,
      }));
      setHabits(result.slice(0, 5));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--brand-primary)] rounded-full animate-spin" /></div>;

  return (
    <div className="rounded-fabric p-3" style={{ backgroundColor: "var(--surface-fabric)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>习惯打卡</h3>
      {habits.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>暂无习惯数据</p>
      ) : (
        <div className="space-y-2">
          {habits.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${h.done ? "bg-[var(--success)] border-[var(--success)]" : "border-[var(--border)]"}`}>
                  {h.done && <Check className="w-2.5 h-2.5 text-[var(--text-inverse)]" strokeWidth={3} />}
                </span>
                <span className="text-xs" style={{ color: h.done ? "var(--text-primary)" : "var(--text-tertiary)" }}>{h.title}</span>
              </div>
              {h.streak > 0 && <span className="text-xs" style={{ color: "var(--brand-primary)" }}>🔥 {h.streak}天</span>}
            </div>
          ))}
        </div>
      )}
      <a href="/today" className="block mt-2 text-center text-xs hover:underline py-1" style={{ color: "var(--brand-primary)" }}>去打卡 →</a>
    </div>
  );
}
