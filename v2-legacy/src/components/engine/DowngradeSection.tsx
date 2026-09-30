"use client";

import { useEffect, useState } from "react";
import { downgradeEngine, type DowngradeSuggestion } from "@/lib/engine/DowngradeEngine";
import { DowngradeCard } from "@/components/DowngradeCard";
import { getAllGoals, updateGoal } from "@/lib/db";
import { GoalEngine } from "@/services/goal-engine";
import { showToast } from "@/components/ui/Toast";
import type { Goal } from "@/lib/types";

const DISMISS_KEY = "lifeflow_downgrade_dismissed";
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return fmt(d);
}

function adaptGoal(g: Goal) {
  const pMap: Record<string, string> = {
    "urgent-important": "p1",
    "not-urgent-important": "p2",
    "urgent-not-important": "p3",
    "not-urgent-not-important": "p4",
  };
  return {
    id: String(g.id),
    title: g.name,
    description: g.description ?? "",
    category: "custom",
    priority: pMap[g.priority ?? ""] ?? "p2",
    deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : "2099-12-31",
    progress: g.progress ?? 0,
    status: g.status,
    createdAt: new Date(g.createdAt).toISOString(),
    updatedAt: new Date(Date.now()).toISOString(),
  };
}

export function DowngradeSection() {
  const [suggestion, setSuggestion] = useState<DowngradeSuggestion | null>(null);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === fmt(new Date())) return;

    (async () => {
      try {
        const gs = await getAllGoals();
        const active = gs.filter((g) => g.status === "active");
        if (active.length === 0) return;
        setAllGoals(gs);

        const adapted = active.map(adaptGoal);

        const now = new Date();
        const start28 = fmt(new Date(now.getTime() - 28 * 86400000));
        const atoms = await GoalEngine.getAtomsByDateRange(start28, fmt(now));

        const buckets = new Map<string, { total: number; completed: number }>();
        for (const a of atoms) {
          const ws = weekStart(a.scheduledDate);
          const b = buckets.get(ws) || { total: 0, completed: 0 };
          b.total++;
          if (a.isCompleted) b.completed++;
          buckets.set(ws, b);
        }

        const history: Array<{ weekStart: string; completionRate: number }> = [];
        for (const [ws, b] of buckets) {
          if (b.total > 0) {
            history.push({ weekStart: ws, completionRate: Math.round((b.completed / b.total) * 100) });
          }
        }

        const s = downgradeEngine.analyze(adapted as Parameters<typeof downgradeEngine.analyze>[0], [], history);
        if (s.shouldDowngrade) setSuggestion(s);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleConfirm = async (pauseGoalIds: string[]) => {
    let count = 0;
    for (const sid of pauseGoalIds) {
      const numId = Number(sid);
      const goal = allGoals.find((g) => g.id === numId);
      if (goal && goal.status === "active") {
        await updateGoal(numId, { status: "paused" } as Partial<Goal>);
        count++;
      }
    }
    showToast({ message: `已暂停 ${count} 个目标，可在规划页随时恢复`, type: "success" });
    localStorage.setItem(DISMISS_KEY, fmt(new Date()));
    setSuggestion(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, fmt(new Date()));
    setSuggestion(null);
  };

  if (!suggestion) return null;
  return <DowngradeCard suggestion={suggestion} onConfirm={handleConfirm} onDismiss={handleDismiss} />;
}
