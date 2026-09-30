"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Calendar, CheckCircle2, Circle, Clock, Target, MousePointerClick } from "lucide-react";
import { motion } from "framer-motion";
import { reviewerBrain } from "@/lib/brains/reviewer";
import type { ReviewModuleSummary, DateRange } from "@/lib/brains/reviewer";
import { daylogDB } from "@/lib/db/daylog.db";
import type { Item } from "@/lib/db/daylog.db";

function getWeekRange(): DateRange {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  const sun = new Date(now);
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
  };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[d.getDay()];
}

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(month)}月${parseInt(day)}日`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export default function ScheduleReviewPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReviewModuleSummary | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => getWeekRange(), []);

  useEffect(() => {
    async function load() {
      try {
        const [s, rawItems] = await Promise.all([
          reviewerBrain.reviewSchedule(dateRange),
          daylogDB.items
            .where("date")
            .between(dateRange.start, dateRange.end, true, true)
            .toArray(),
        ]);
        setSummary(s);
        setItems(rawItems);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateRange]);

  // Group items by date, sorted by date ascending
  const groupedItems = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of items) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    // Sort each group by plannedStart
    for (const date of Object.keys(map)) {
      map[date].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
    }
    // Sort dates ascending
    return Object.keys(map)
      .sort()
      .map((date) => ({ date, items: map[date] }));
  }, [items]);

  const sourceTypeLabel: Record<string, string> = {
    routine: "作息",
    course: "课程",
    manual: "手动",
    habit: "习惯",
    task: "任务",
  };

  const sourceTypeColor: Record<string, string> = {
    routine: "#8B5CF6",
    course: "#3B82F6",
    manual: "#6366F1",
    habit: "#10B981",
    task: "#FF9500",
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-6 pb-[100px]">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/more/review")}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: "var(--lifeflow-muted)" }}
          aria-label="返回"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--lifeflow-foreground)" }} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6" style={{ color: "#FF9500" }} />
          <h1 className="text-[17px] font-semibold" style={{ color: "var(--lifeflow-foreground)" }}>
            日程复盘
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-[20px] animate-pulse"
              style={{ background: "var(--lifeflow-muted)" }}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          {summary && Object.keys(summary.stats).length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-3 mb-6"
            >
              {/* Total items */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#FF950015" }}>
                    <Target className="w-4 h-4" style={{ color: "#FF9500" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>总事项</span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {summary.stats["总事项数"] ?? "--"}
                </p>
              </motion.div>

              {/* Completion rate */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#10B98115" }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: "#10B981" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>完成率</span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {summary.stats["完成率"] ?? "--"}
                </p>
              </motion.div>

              {/* Completed */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#3B82F615" }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: "#3B82F6" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>已完成</span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {summary.stats["已完成"] ?? "--"}
                </p>
              </motion.div>

              {/* Calibrated */}
              <motion.div
                variants={cardVariants}
                className="rounded-[20px] p-4"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#8B5CF615" }}>
                    <MousePointerClick className="w-4 h-4" style={{ color: "#8B5CF6" }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>已校准</span>
                </div>
                <p className="text-[28px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {summary.stats["已校准"] ?? "--"}
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* Daily Grouped List */}
          {groupedItems.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-4"
            >
              <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-disabled)" }}>
                每日事项
              </h2>
              {groupedItems.map((group) => (
                <motion.div key={group.date} variants={itemVariants}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#FF9500" }} />
                    <span className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {formatDateLabel(group.date)}
                    </span>
                    <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                      {formatWeekday(group.date)}
                    </span>
                    <span className="text-[12px] ml-auto" style={{ color: "var(--color-text-secondary)" }}>
                      {group.items.filter((i) => i.isCompleted).length}/{group.items.length} 完成
                    </span>
                  </div>

                  {/* Items */}
                  <div
                    className="rounded-[16px] p-1.5 flex flex-col gap-0.5"
                    style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                  >
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-colors"
                        style={{
                          background: item.isCompleted ? "transparent" : "var(--lifeflow-muted)",
                          opacity: item.isCompleted ? 0.6 : 1,
                        }}
                      >
                        {/* Status icon */}
                        {item.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#10B981" }} />
                        ) : (
                          <Circle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[13px] font-medium truncate"
                              style={{
                                color: item.isCompleted ? "var(--color-text-secondary)" : "var(--color-text-primary)",
                                textDecoration: item.isCompleted ? "line-through" : "none",
                              }}
                            >
                              {item.title}
                            </span>
                            {/* Source type badge */}
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{
                                background: `${(sourceTypeColor[item.sourceType] || "#6366F1")}18`,
                                color: sourceTypeColor[item.sourceType] || "#6366F1",
                              }}
                            >
                              {sourceTypeLabel[item.sourceType] || item.sourceType}
                            </span>
                            {/* Corrected badge */}
                            {item.isCorrected && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                                style={{ background: "#8B5CF618", color: "#8B5CF6" }}
                              >
                                已校准
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
                            <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                              {item.plannedStart} - {item.plannedEnd}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : !loading ? (
            <div
              className="rounded-[20px] p-8 text-center"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "#FF950015" }}
              >
                <Calendar className="w-8 h-8" style={{ color: "#FF9500" }} />
              </div>
              <p className="text-[15px] font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                暂无日程数据
              </p>
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                本周还没有日程记录。添加课程、作息或手动事项后，这里会显示复盘。
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
