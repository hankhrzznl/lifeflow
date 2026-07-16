"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { taskMatcher, type MatchedTask } from "@/lib/engine/TaskMatcher";
import { TimeSegmentService, timeSegmentService, type TimeSegment } from "@/lib/engine/TimeSegmentService";

// ============================================================
// 类型
// ============================================================

interface DayScheduleViewProps {
  date?: Date;
  onAtomClick?: (atomId: string) => void;
  className?: string;
}

// ============================================================
// 组件
// ============================================================

export default function DayScheduleView({ date, onAtomClick, className = "" }: DayScheduleViewProps) {
  const d = date ?? new Date();
  const dateStr = d.toISOString().slice(0, 10);

  const [segments, setSegments] = useState<Map<string, MatchedTask[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const matched = await taskMatcher.matchDailyTasks(dateStr);
      setSegments(matched);
    } catch (err) {
      console.error("[DayScheduleView] 加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // 时段列表
  const segList: TimeSegment[] = [...TimeSegmentService.SEGMENTS];

  if (loading) {
    return (
      <div className={`rounded-fabric overflow-hidden ${className}`}
        style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (<div key={i} className="skeleton h-16 rounded-xl" />))}
        </div>
      </div>
    );
  }

  const totalTasks = Array.from(segments.values()).reduce((s, t) => s + t.length, 0);

  return (
    <div className={`rounded-fabric overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}>
      {/* 时段标题行 */}
      <div className="grid grid-cols-4 border-b" style={{ borderColor: "var(--border-light)" }}>
        {segList.map((seg) => (
          <div key={seg.id} className="px-2 py-3 text-center">
            <span className="text-lg block">{seg.icon}</span>
            <span className="text-sm mt-0.5 block" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
              {seg.name}
            </span>
            <span className="text-[10px] block" style={{ color: "var(--text-tertiary)" }}>
              {seg.start}-{seg.end}时
            </span>
          </div>
        ))}
      </div>

      {/* 4列时段内容 */}
      <div className="grid grid-cols-4 divide-x min-h-[200px]" style={{ borderColor: "var(--border-light)" }}>
        {segList.map((seg) => {
          const tasks = segments.get(seg.id) ?? [];
          const capacity = timeSegmentService.getSegmentCapacity(seg.id);
          const isOverCapacity = capacity > 0 && tasks.length > capacity;

          return (
            <div key={seg.id} className="p-2 relative">
              {/* 容量条 */}
              <div className="flex items-center gap-1 mb-2">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--knit-bg)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: capacity > 0 ? `${Math.min((tasks.length / capacity) * 100, 100)}%` : "0%",
                      backgroundColor: isOverCapacity ? "var(--warning)" : seg.color,
                    }}
                  />
                </div>
                <span className="text-[10px]" style={{ color: isOverCapacity ? "var(--warning)" : "var(--text-tertiary)" }}>
                  {tasks.length}/{capacity}
                </span>
              </div>

              {/* 任务列表 */}
              <div className="space-y-1.5">
                {tasks.map((task, i) => (
                  <motion.div
                    key={task.atomId}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onAtomClick?.(task.atomId)}
                    className="px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
                    style={{
                      backgroundColor: task.isCompleted ? "var(--success-light)" : "var(--surface-desk-light)",
                      color: task.isCompleted ? "var(--text-tertiary)" : "var(--text-primary)",
                      textDecoration: task.isCompleted ? "line-through" : "none",
                    }}
                  >
                    <div className="truncate font-medium">{task.title}</div>
                    <div className="truncate text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {task.goalTitle}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 空状态 */}
              {tasks.length === 0 && (
                <div className="text-center py-6 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  空
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部汇总 */}
      {totalTasks > 0 && (
        <div className="px-4 py-2 border-t text-center text-xs"
          style={{ borderColor: "var(--border-light)", color: "var(--text-tertiary)" }}>
          {totalTasks} 个任务 · {segList.length} 个时段
        </div>
      )}
    </div>
  );
}
