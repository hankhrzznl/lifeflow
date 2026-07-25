"use client";

import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Clock,
  Droplets,
  Wallet,
  Pill,
  Moon,
  AlertCircle,
} from "lucide-react";
import { daylogDB, updateItem, type Item } from "@/lib/db/daylog.db";
import { efficiencyDB } from "@/lib/db/efficiency.db";
import { accountingDB } from "@/lib/db/accounting.db";
import { healthDB } from "@/lib/db/health.db";

// ==================== 工具函数 ====================

/** 计算两个 HH:mm 时间之间的分钟差 */
function timeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** 将分钟数格式化为可读字符串 */
function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/** 获取给定日期 YYYY-MM-DD 的前一天 */
function yesterdayStr(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 获取 item 的有效开始/结束时间 */
function getEffectiveTime(item: Item): { start: string; end: string } {
  return item.isCorrected
    ? { start: item.actualStart, end: item.actualEnd }
    : { start: item.plannedStart, end: item.plannedEnd };
}

// ==================== 饼图颜色调色板 ====================

const PIE_COLORS = [
  "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#0EA5E9", "#14B8A6", "#F97316", "#84CC16",
  "#06B6D4", "#A855F7", "#3B82F6", "#E11D48", "#65A30D",
];

// ==================== 智能匹配（方案C） ====================

interface MatchPair {
  today: Item;
  yesterday: Item;
  matchType: "title" | "sourceType";
}

function smartMatch(todayItems: Item[], yesterdayItems: Item[]) {
  const matched: MatchPair[] = [];
  const todayRemaining = [...todayItems];
  const yesterdayRemaining = [...yesterdayItems];

  // 第一轮：精确标题匹配
  const todayMatchedIdx1 = new Set<number>();
  const yesterdayMatchedIdx1 = new Set<number>();

  for (let ti = 0; ti < todayRemaining.length; ti++) {
    for (let yi = 0; yi < yesterdayRemaining.length; yi++) {
      if (yesterdayMatchedIdx1.has(yi)) continue;
      if (todayRemaining[ti].title === yesterdayRemaining[yi].title) {
        matched.push({
          today: todayRemaining[ti],
          yesterday: yesterdayRemaining[yi],
          matchType: "title",
        });
        todayMatchedIdx1.add(ti);
        yesterdayMatchedIdx1.add(yi);
        break;
      }
    }
  }

  const todayUnmatched1 = todayRemaining.filter((_, i) => !todayMatchedIdx1.has(i));
  const yesterdayUnmatched1 = yesterdayRemaining.filter((_, i) => !yesterdayMatchedIdx1.has(i));

  // 第二轮：sourceType + 时间窗口匹配（1小时以内）
  const timeWindowMinutes = 60;
  const todayMatchedIdx2 = new Set<number>();
  const yesterdayMatchedIdx2 = new Set<number>();

  for (let ti = 0; ti < todayUnmatched1.length; ti++) {
    const tItem = todayUnmatched1[ti];
    const tTime = getEffectiveTime(tItem);
    const tStartMin = timeDiff("00:00", tTime.start);

    for (let yi = 0; yi < yesterdayUnmatched1.length; yi++) {
      if (yesterdayMatchedIdx2.has(yi)) continue;
      const yItem = yesterdayUnmatched1[yi];
      if (tItem.sourceType !== yItem.sourceType) continue;
      const yTime = getEffectiveTime(yItem);
      const yStartMin = timeDiff("00:00", yTime.start);
      if (Math.abs(tStartMin - yStartMin) <= timeWindowMinutes) {
        matched.push({
          today: tItem,
          yesterday: yItem,
          matchType: "sourceType",
        });
        todayMatchedIdx2.add(ti);
        yesterdayMatchedIdx2.add(yi);
        break;
      }
    }
  }

  const todayOnly = todayUnmatched1.filter((_, i) => !todayMatchedIdx2.has(i));
  const yesterdayOnly = yesterdayUnmatched1.filter((_, i) => !yesterdayMatchedIdx2.has(i));

  return { matched, todayOnly, yesterdayOnly };
}

// ==================== 主组件 ====================

export default function ReviewDaily({ date: propDate }: { date?: string }) {
  const date = propDate || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const yesterdayDate = yesterdayStr(date);

  // ─── 数据加载 ──────────────────────────────────────────────

  const todayItems = useLiveQuery(() => daylogDB.items.where("date").equals(date).toArray(), [date], []) as Item[];
  const yesterdayItems = useLiveQuery(() => daylogDB.items.where("date").equals(yesterdayDate).toArray(), [yesterdayDate], []) as Item[];
  const projects = useLiveQuery(() => efficiencyDB.projects.toArray(), [], []);
  const todayTransactions = useLiveQuery(() => accountingDB.transactions.where("date").equals(date).toArray(), [date], []);
  const todayWaterLogs = useLiveQuery(() => healthDB.waterLogs.where("date").equals(date).toArray(), [date], []);
  const todayMedicineLogs = useLiveQuery(() => healthDB.medicineLogs.where("date").equals(date).toArray(), [date], []);
  const medicines = useLiveQuery(() => healthDB.medicines.toArray(), [], []);
  const todaySleepLog = useLiveQuery(() => healthDB.sleepLogs.where("date").equals(date).first(), [date]);

  // ─── 项目映射 ──────────────────────────────────────────────

  const projectMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const p of projects ?? []) {
      map.set(p.id, { name: p.name, color: p.color });
    }
    return map;
  }, [projects]);

  // ─── 展开/折叠状态 ────────────────────────────────────────

  type ExpandedNotes = Record<string, { expanded: boolean; saving: boolean }>;
  const [expandedNotes, setExpandedNotes] = useState<ExpandedNotes>({});

  const toggleNoteExpand = useCallback((itemId: string) => {
    setExpandedNotes((prev) => {
      if (prev[itemId]?.expanded) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { expanded: true, saving: false } };
    });
  }, []);

  const handleSaveNote = useCallback(async (itemId: string, note: string) => {
    setExpandedNotes((prev) => {
      if (!prev[itemId]) return prev;
      return { ...prev, [itemId]: { ...prev[itemId], saving: true } };
    });
    try {
      await updateItem(itemId, { note });
    } catch {
      // silently fail
    }
    setExpandedNotes((prev) => {
      if (!prev[itemId]) return prev;
      return { ...prev, [itemId]: { ...prev[itemId], saving: false } };
    });
  }, []);

  // ─── 智能匹配 ──────────────────────────────────────────────

  const { matched, todayOnly, yesterdayOnly } = useMemo(
    () => smartMatch(todayItems ?? [], yesterdayItems ?? []),
    [todayItems, yesterdayItems],
  );

  // ─── 统计 ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = (todayItems ?? []).length;
    const completed = (todayItems ?? []).filter((i) => i.isCompleted).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const yesterdayTotal = (yesterdayItems ?? []).length;
    const diff = total - yesterdayTotal;
    return { total, completed, rate, yesterdayTotal, diff };
  }, [todayItems, yesterdayItems]);

  // ─── 饼图数据 ──────────────────────────────────────────────

  const pieData = useMemo(() => {
    const grouped = new Map<string, { name: string; minutes: number; color: string }>();
    for (const item of todayItems ?? []) {
      const pid = item.projectId || "__none__";
      if (!grouped.has(pid)) {
        const proj = projectMap.get(pid);
        grouped.set(pid, {
          name: proj?.name ?? "无项目",
          minutes: 0,
          color: proj?.color ?? "#94A3B8",
        });
      }
      const t = getEffectiveTime(item);
      grouped.get(pid)!.minutes += Math.max(0, timeDiff(t.start, t.end));
    }
    return Array.from(grouped.values())
      .filter((d) => d.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [todayItems, projectMap]);

  const totalHours = useMemo(() => {
    const totalMin = pieData.reduce((sum, d) => sum + d.minutes, 0);
    return totalMin / 60;
  }, [pieData]);

  // ─── 模块快速统计 ──────────────────────────────────────────

  const moduleStats = useMemo(() => {
    const waterMl = (todayWaterLogs ?? []).reduce((sum, l) => sum + (l.amount ?? 0), 0);
    const waterCount = (todayWaterLogs ?? []).length;
    const expenseTotal = (todayTransactions ?? [])
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const activeMedicines = (medicines ?? []).filter((m) => m.active);
    const takenCount = (todayMedicineLogs ?? []).filter((l) => l.taken).length;
    const medicineTotal = activeMedicines.length * 3; // 每个药每天3次
    const sleepActualTime = todaySleepLog?.actualTime ?? null;
    return { waterMl, waterCount, expenseTotal, takenCount, medicineTotal, sleepActualTime };
  }, [todayWaterLogs, todayTransactions, todayMedicineLogs, medicines, todaySleepLog]);

  // ─── 空态 ──────────────────────────────────────────────────

  if ((todayItems ?? []).length === 0) {
    return (
      <div className="px-4 py-16 flex flex-col items-center text-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--color-surface-card)" }}
        >
          <AlertCircle className="w-10 h-10" style={{ color: "var(--color-text-disabled)" }} strokeWidth={1.5} />
        </div>
        <p
          className="text-[17px] font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          今天还没有记录事项
        </p>
        <p className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>
          前往日程页面添加今天要做的事情，明天回来看看复盘吧
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-10">
      {/* ===== Top Stats Card ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-[20px] px-5 py-5 flex items-center justify-between"
        style={{
          backgroundColor: "var(--color-surface-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
            今日完成率
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-extrabold leading-none" style={{ color: "var(--color-text-primary)" }}>
              {stats.rate}%
            </span>
            <span className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
              {stats.completed}/{stats.total}项
            </span>
          </div>
          {stats.diff !== 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              {stats.diff > 0 ? (
                <TrendingUp className="w-4 h-4" style={{ color: "#34C759" }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: "#FF3B30" }} />
              )}
              <span
                className="text-[13px] font-medium"
                style={{ color: stats.diff > 0 ? "#34C759" : "#FF3B30" }}
              >
                比昨天{stats.diff > 0 ? "多" : "少"}{Math.abs(stats.diff)}件
              </span>
            </div>
          )}
        </div>
        {/* 圆形进度指示 */}
        <div className="relative w-[72px] h-[72px] flex items-center justify-center">
          <svg width={72} height={72} className="transform -rotate-90">
            <circle
              cx={36} cy={36} r={30}
              fill="none"
              stroke="var(--lifeflow-background)"
              strokeWidth={5}
            />
            <circle
              cx={36} cy={36} r={30}
              fill="none"
              stroke="var(--lifeflow-primary)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 30}
              strokeDashoffset={2 * Math.PI * 30 * (1 - stats.rate / 100)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <span className="absolute text-[15px] font-bold" style={{ color: "var(--lifeflow-primary)" }}>
            {stats.rate}%
          </span>
        </div>
      </motion.div>

      {/* ===== 事项对比区域 ===== */}
      <section>
        <h3
          className="text-[18px] font-bold mb-3"
          style={{ color: "var(--color-text-primary)" }}
        >
          事项对比
        </h3>

        <div className="flex flex-col gap-3">
          {/* 匹配项对比卡片 */}
          {matched.map((pair, i) => (
            <ComparisonCard
              key={pair.today.id}
              pair={pair}
              index={i}
              projectName={projectMap.get(pair.today.projectId || "")?.name}
              expanded={expandedNotes[pair.today.id]?.expanded ?? false}
              saving={expandedNotes[pair.today.id]?.saving ?? false}
              onToggleExpand={() => toggleNoteExpand(pair.today.id)}
              onSaveNote={(note) => handleSaveNote(pair.today.id, note)}
            />
          ))}

          {/* 今天新增 */}
          {todayOnly.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
              className="rounded-[20px] px-4 py-3"
              style={{
                backgroundColor: "var(--color-surface-card)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color || "#6366F1" }}
                  />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                      {item.title}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                      {getEffectiveTime(item).start} - {getEffectiveTime(item).end}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(52, 199, 89, 0.12)",
                    color: "#34C759",
                  }}
                >
                  今天新增
                </span>
              </div>
            </motion.div>
          ))}

          {/* 今天未做 */}
          {yesterdayOnly.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
              className="rounded-[20px] px-4 py-3"
              style={{
                backgroundColor: "var(--color-surface-card)",
                boxShadow: "var(--shadow-card)",
                opacity: 0.55,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "var(--color-text-disabled)" }}
                />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium truncate" style={{ color: "var(--color-text-disabled)" }}>
                    {item.title}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
                    {getEffectiveTime(item).start} - {getEffectiveTime(item).end}
                  </p>
                </div>
                <span
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full ml-auto flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(142, 142, 147, 0.12)",
                    color: "var(--color-text-disabled)",
                  }}
                >
                  今天未做
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== 项目时间饼图 ===== */}
      {pieData.length > 0 && (
        <section>
          <h3
            className="text-[18px] font-bold mb-3"
            style={{ color: "var(--color-text-primary)" }}
          >
            时间分布
          </h3>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-[20px] px-4 py-5"
            style={{
              backgroundColor: "var(--color-surface-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center gap-4">
              {/* 饼图 */}
              <div style={{ width: 140, height: 140 }} className="relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData.map((d, i) => ({
                        name: d.name,
                        value: d.minutes,
                        color: d.color || PIE_COLORS[i % PIE_COLORS.length],
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((d, i) => (
                        <Cell
                          key={d.name}
                          fill={d.color || PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(_value: any) => [formatDuration(Number(_value)), "时长"]}
                      contentStyle={{
                        backgroundColor: "var(--color-surface-card)",
                        border: "1px solid var(--lifeflow-border)",
                        borderRadius: 12,
                        fontSize: 13,
                        boxShadow: "var(--shadow-card)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* 中心文字 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[20px] font-extrabold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                    {totalHours.toFixed(1)}h
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                    总计
                  </span>
                </div>
              </div>

              {/* 图例 */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                {pieData.map((d, i) => {
                  const color = d.color || PIE_COLORS[i % PIE_COLORS.length];
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[13px] truncate" style={{ color: "var(--color-text-primary)" }}>
                        {d.name}
                      </span>
                      <span className="text-[12px] ml-auto flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
                        {formatDuration(d.minutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </section>
      )}

      {/* ===== 模块快速统计 ===== */}
      <section>
        <h3
          className="text-[18px] font-bold mb-3"
          style={{ color: "var(--color-text-primary)" }}
        >
          模块概览
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 饮水 */}
          <ModuleStatCard
            icon={Droplets}
            iconColor="#0EA5E9"
            label="饮水"
            value={moduleStats.waterMl > 0 ? `${moduleStats.waterMl}ml` : "--"}
            sub={`${moduleStats.waterCount}次记录`}
          />
          {/* 支出 */}
          <ModuleStatCard
            icon={Wallet}
            iconColor="#14B8A6"
            label="支出"
            value={moduleStats.expenseTotal > 0 ? `¥${moduleStats.expenseTotal.toFixed(2)}` : "--"}
            sub="今日消费"
          />
          {/* 用药 */}
          <ModuleStatCard
            icon={Pill}
            iconColor="#DC2626"
            label="用药"
            value={
              moduleStats.medicineTotal > 0
                ? `${moduleStats.takenCount}/${moduleStats.medicineTotal}`
                : "--"
            }
            sub={moduleStats.medicineTotal > 0 ? "已服/应服" : "无需用药"}
          />
          {/* 睡眠 */}
          <ModuleStatCard
            icon={Moon}
            iconColor="#1E293B"
            label="睡眠"
            value={moduleStats.sleepActualTime ?? "--"}
            sub={moduleStats.sleepActualTime ? "实际就寝" : "暂无记录"}
          />
        </div>
      </section>
    </div>
  );
}

// ==================== 对比卡片子组件 ====================

function ComparisonCard({
  pair,
  index,
  projectName,
  expanded,
  saving,
  onToggleExpand,
  onSaveNote,
}: {
  pair: { today: Item; yesterday: Item; matchType: "title" | "sourceType" };
  index: number;
  projectName?: string;
  expanded: boolean;
  saving: boolean;
  onToggleExpand: () => void;
  onSaveNote: (note: string) => void;
}) {
  const todayTime = getEffectiveTime(pair.today);
  const yesterdayTime = getEffectiveTime(pair.yesterday);

  const todayDuration = timeDiff(todayTime.start, todayTime.end);
  const yesterdayDuration = timeDiff(yesterdayTime.start, yesterdayTime.end);
  const durationDelta = todayDuration - yesterdayDuration; // 负数=快了

  const todayStartMin = timeDiff("00:00", todayTime.start);
  const yesterdayStartMin = timeDiff("00:00", yesterdayTime.start);
  const startDelta = todayStartMin - yesterdayStartMin; // 负数=提前了

  const [noteText, setNoteText] = useState(pair.today.note ?? "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35 }}
      className="rounded-[20px] overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="px-4 py-3">
        {/* 标题行 */}
        <div className="flex items-center gap-2.5 mb-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: pair.today.color || "#6366F1" }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
              {pair.today.title}
            </p>
            {projectName && (
              <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                {projectName}
                {pair.matchType === "sourceType" && (
                  <span className="ml-1 text-[11px]" style={{ color: "var(--color-text-disabled)" }}>(类型匹配)</span>
                )}
              </p>
            )}
          </div>
          {/* 折叠按钮 */}
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-black/5 transition-colors"
            aria-label={expanded ? "收起" : "展开"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
            )}
          </button>
        </div>

        {/* 时间对比行 */}
        <div className="flex flex-col gap-1.5 ml-4">
          {/* 昨天 */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] w-10 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }}>
              昨天
            </span>
            <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
              {yesterdayTime.start} - {yesterdayTime.end}
            </span>
            <span className="text-[12px]" style={{ color: "var(--color-text-disabled)" }}>
              ({formatDuration(yesterdayDuration)})
            </span>
          </div>

          {/* 今天 */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] w-10 flex-shrink-0 font-medium" style={{ color: "var(--color-text-primary)" }}>
              今天
            </span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {todayTime.start} - {todayTime.end}
            </span>
            <span className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              ({formatDuration(todayDuration)})
            </span>
          </div>

          {/* 变化指标 */}
          <div className="flex items-center gap-3 mt-1">
            {/* 耗时变化 */}
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" style={{ color: "var(--color-text-secondary)" }} />
              <span
                className="text-[12px] font-semibold"
                style={{
                  color: durationDelta < 0 ? "#34C759" : durationDelta > 0 ? "#FF3B30" : "var(--color-text-secondary)",
                }}
              >
                {durationDelta === 0
                  ? "时间相同"
                  : durationDelta < 0
                    ? `快了${formatDuration(Math.abs(durationDelta))}`
                    : `慢了${formatDuration(durationDelta)}`}
              </span>
            </div>
            {/* 开始时间偏移 */}
            {startDelta !== 0 && (
              <div className="flex items-center gap-1">
                <TrendingUp
                  className="w-3.5 h-3.5"
                  style={{
                    color: startDelta < 0 ? "#34C759" : "#FF3B30",
                    transform: startDelta < 0 ? "rotate(-45deg)" : "rotate(45deg)",
                  }}
                />
                <span
                  className="text-[12px] font-semibold"
                  style={{
                    color: startDelta < 0 ? "#34C759" : "#FF3B30",
                  }}
                >
                  {startDelta < 0
                    ? `提前了${Math.abs(startDelta)}分钟`
                    : `推后了${startDelta}分钟`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 展开备注区域 */}
      {expanded && (
        <div
          className="px-4 pb-3 border-t"
          style={{ borderColor: "var(--lifeflow-background)" }}
        >
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="添加复盘备注..."
            rows={3}
            className="w-full mt-3 px-3 py-2.5 rounded-xl text-[14px] resize-none outline-none transition-colors"
            style={{
              backgroundColor: "var(--lifeflow-background)",
              color: "var(--color-text-primary)",
              border: "1px solid transparent",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--lifeflow-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "transparent";
              onSaveNote(noteText);
            }}
          />
          {saving && (
            <span className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
              保存中...
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ==================== 模块统计卡片子组件 ====================

function ModuleStatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[20px] px-4 py-3.5"
      style={{
        backgroundColor: "var(--color-surface-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}14` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <span className="text-[13px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </span>
      </div>
      <p className="text-[20px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </p>
      <p className="text-[11px] mt-1" style={{ color: "var(--color-text-disabled)" }}>
        {sub}
      </p>
    </motion.div>
  );
}
