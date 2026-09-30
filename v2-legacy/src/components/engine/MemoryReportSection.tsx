"use client";

import { useEffect, useState } from "react";
import { GoalEngine } from "@/services/goal-engine";
import { MemoryReport } from "@/components/MemoryReport";
import type { DailyAtom } from "@/types/goal";
import type { Goal } from "@/lib/types";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function weekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  return fmt(d);
}

export function MemoryReportSection() {
  const [atoms, setAtoms] = useState<DailyAtom[] | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const start91 = fmt(new Date(now.getTime() - 91 * 86400000));
        const [a, g] = await Promise.all([
          GoalEngine.getAtomsByDateRange(start91, fmt(now)),
          GoalEngine.getAllGoals(),
        ]);
        setAtoms(a); setGoals(g);
      } catch { setAtoms([]); setGoals([]); }
    })();
  }, []);

  if (!atoms || atoms.length === 0) return null;

  const buckets = new Map<string, { total: number; completed: number }>();
  for (const a of atoms) {
    const ws = weekMonday(a.scheduledDate);
    const b = buckets.get(ws) || { total: 0, completed: 0 };
    b.total++;
    if (a.isCompleted) b.completed++;
    buckets.set(ws, b);
  }

  const quarterData: Array<{ weekStart: string; totalAtoms: number; completedAtoms: number; completionRate: number }> = [];
  for (const [ws, b] of buckets) {
    if (b.total > 0) {
      quarterData.push({ weekStart: ws, totalAtoms: b.total, completedAtoms: b.completed, completionRate: Math.round((b.completed / b.total) * 100) });
    }
  }
  quarterData.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return <MemoryReport quarterData={quarterData} atoms={atoms} goals={goals ?? []} />;
}
