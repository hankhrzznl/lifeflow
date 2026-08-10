"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Timer, Sparkles, Moon, Droplets, CalendarCheck, Target, TrendingUp, Flame } from "lucide-react";
import { getRecentFocusSessions, getRecentMeditationSessions } from "@/lib/db/life.db";
import { getSleepLogs, getWaterMlBetween, getWaterGoal } from "@/lib/db/health.db";
import { getHabits } from "@/lib/db/life.db";
import { getIdealDayPlans } from "@/lib/ideal-day-templates";
import { getAllGoalsV2 } from "@/lib/db/goal-v2.db";
import { daylogDB } from "@/lib/db/daylog.db";

// T23.1：周报汇总 · 数据洞察（近 7 天聚合）

const BAR_KEYFRAMES = `
  @keyframes lf-bar-grow { from { transform: scaleY(0.06); } to { transform: scaleY(1); } }
  .lf-bar-anim { transform-origin: bottom; animation: lf-bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) { .lf-bar-anim { animation: none; } }
`;

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 周区间展示：如 8月4日 - 8月10日 */
function weekRangeText(): string {
  const start = dayKey(6);
  const end = dayKey(0);
  return `${Number(start.slice(5, 7))}月${Number(start.slice(8, 10))}日 - ${Number(end.slice(5, 7))}月${Number(end.slice(8, 10))}日`;
}

/** 洞察文案 → 语义色图标（仅展示映射，不改变 insights 生成逻辑） */
function insightMeta(text: string): { icon: ComponentType<{ className?: string }>; color: string; light: string } {
  if (text.includes("专注")) return { icon: Timer, color: "#8B5CF6", light: "rgba(139,92,246,0.14)" };
  if (text.includes("冥想")) return { icon: Sparkles, color: "#06B6D4", light: "rgba(6,182,212,0.14)" };
  if (text.includes("入睡")) return { icon: Moon, color: "#5856D6", light: "rgba(88,86,214,0.14)" };
  if (text.includes("饮水")) return { icon: Droplets, color: "#3B82F6", light: "rgba(59,130,246,0.14)" };
  if (text.includes("理想日")) return { icon: CalendarCheck, color: "#6366F1", light: "rgba(99,102,241,0.14)" };
  if (text.includes("习惯")) return { icon: Flame, color: "#F97316", light: "rgba(249,115,22,0.14)" };
  return { icon: TrendingUp, color: "#8B5CF6", light: "rgba(139,92,246,0.14)" };
}

interface WeekStat {
  focusMin: number; focusCount: number;
  medMin: number; medCount: number;
  sleepOnTime: number; sleepDays: number;
  waterAvg: number; waterDays: number; waterGoalMl: number;
  idealTotal: number; idealDone: number;
  itemTotal: number; itemDone: number;
}

export default function WeeklyReportPage() {
  const router = useRouter();
  const [stat, setStat] = useState<WeekStat | null>(null);
  const [dailyFocus, setDailyFocus] = useState<{ date: string; min: number }[]>([]);
  const [goalList, setGoalList] = useState<{ id: string; title: string; progress: number }[]>([]);
  const [streakBest, setStreakBest] = useState(0);

  useEffect(() => {
    (async () => {
      const start = dayKey(6);
      const end = dayKey(0);

      const [focusS, medS, sleepLogs, waterRows, waterGoal, habits, goals, idealPlans, items] = await Promise.all([
        getRecentFocusSessions(7),
        getRecentMeditationSessions(7),
        getSleepLogs(7),
        getWaterMlBetween(start, end),
        getWaterGoal(),
        getHabits(),
        getAllGoalsV2(),
        Promise.all(Array.from({ length: 7 }, (_, i) => getIdealDayPlans(dayKey(i)))),
        daylogDB.items.where("date").between(start, end, true, true).toArray(),
      ]);

      // 近 7 天日期序列（今天在前）
      const days = Array.from({ length: 7 }, (_, i) => dayKey(i));
      const daily = days.map((d) => ({
        date: d,
        min: focusS.filter((s) => s.date === d && s.type === "focus" && s.completed).reduce((a, s) => a + s.duration, 0),
      }));

      const medMin = medS.filter((s) => s.completed).reduce((a, s) => a + s.duration, 0);
      const waterMap = new Map(waterRows.map((r) => [r.date, r.amount]));
      const waterValues = days.map((d) => waterMap.get(d) ?? 0).filter((v) => v > 0);
      const sleepOnTime = sleepLogs.filter((s) => s.isOnTime).length;
      const weekStreak = habits.reduce((max, h) => {
        let streak = 0;
        for (const d of days) if (h.days?.[d]) streak++; else break;
        return Math.max(max, streak);
      }, 0);

      setStat({
        focusMin: focusS.filter((s) => s.type === "focus" && s.completed).reduce((a, s) => a + s.duration, 0),
        focusCount: focusS.filter((s) => s.type === "focus" && s.completed).length,
        medMin, medCount: medS.filter((s) => s.completed).length,
        sleepOnTime, sleepDays: sleepLogs.length,
        waterAvg: waterValues.length ? Math.round(waterValues.reduce((a, b) => a + b, 0) / waterValues.length) : 0,
        waterDays: waterValues.length, waterGoalMl: waterGoal?.dailyTarget ?? 2000,
        idealTotal: idealPlans.flat().filter((p) => p.feature === "study").length,
        idealDone: idealPlans.flat().filter((p) => p.feature === "study" && p.isCompleted).length,
        itemTotal: items.length,
        itemDone: items.filter((i) => i.isCompleted).length,
      });
      setDailyFocus(daily);
      setGoalList(goals.map((g) => ({ id: g.id, title: g.title, progress: g.progress })));
      setStreakBest(weekStreak);
    })();
  }, []);

  const insights = useMemo(() => {
    if (!stat) return [] as string[];
    const out: string[] = [];
    const focusAvg = stat.focusMin / 7;
    if (stat.focusMin >= 210) out.push(`专注 ${stat.focusMin} 分钟（日均 ${Math.round(focusAvg)} 分钟），深度工作状态很好`);
    else if (stat.focusMin > 0) out.push(`本周专注 ${stat.focusMin} 分钟，建议每天保证 1 个完整专注时段`);
    else out.push("本周还没有专注记录，从 25 分钟番茄钟开始");
    if (stat.medMin >= 30) out.push(`冥想 ${stat.medMin} 分钟 × ${stat.medCount} 次，身心恢复做得到位`);
    const sleepRate = stat.sleepDays ? Math.round((stat.sleepOnTime / stat.sleepDays) * 100) : 0;
    if (stat.sleepDays) out.push(sleepRate >= 60 ? `按时入睡 ${stat.sleepOnTime}/${stat.sleepDays} 天（${sleepRate}%），作息稳定` : `按时入睡仅 ${stat.sleepOnTime}/${stat.sleepDays} 天，试试睡前仪式与渐进早睡`);
    const idealRate = stat.idealTotal ? Math.round((stat.idealDone / stat.idealTotal) * 100) : 0;
    if (stat.idealTotal) out.push(idealRate >= 80 ? `理想日学习完成 ${idealRate}%，计划执行率高` : idealRate >= 50 ? `理想日学习完成 ${idealRate}%，还有提升空间` : `理想日学习完成 ${idealRate}%，建议先规划 2 个学习时段`);
    if (stat.waterDays) out.push(`饮水 ${stat.waterDays}/7 天有记录，日均 ${stat.waterAvg}ml${stat.waterAvg >= stat.waterGoalMl ? "，达标" : `，目标 ${stat.waterGoalMl}ml`}`);
    if (streakBest > 0) out.push(`习惯连续打卡最长 ${streakBest} 天，坚持就是力量`);
    return out.slice(0, 5);
  }, [stat, streakBest]);

  const maxFocus = Math.max(...dailyFocus.map((d) => d.min), 1);

  return (
    <div className="mx-auto px-4 pt-4 pb-[100px]" style={{ maxWidth: 430 }}>
      <style>{BAR_KEYFRAMES}</style>

      <header className="sticky top-0 z-20 w-full pb-3 mb-4" style={{ background: "var(--lifeflow-background)", paddingTop: "16px" }}>
        <div className="flex items-center">
          <button onClick={() => router.push("/more")} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--lifeflow-card)", border: "1px solid var(--lifeflow-border)" }} aria-label="返回">
            <ChevronLeft className="h-5 w-5" style={{ color: "var(--color-text-primary)" }} />
          </button>
          <h1 className="min-w-0 flex-1 text-center truncate" style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text-primary)" }}>周报汇总</h1>
          <div className="w-9 shrink-0"></div>
        </div>
      </header>

      {/* 周区间（画布周报汇总：图标 chip + 区间文案，居中） */}
      <div className="mb-4 flex items-center justify-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-[10px]" style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}>
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        <p className="text-[12px] tabular-nums font-medium" style={{ color: "var(--color-text-tertiary)" }}>
          {weekRangeText()} · 近 7 天
        </p>
      </div>

      {!stat ? (
        <div className="rounded-[20px] py-10 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>统计中…</p>
        </div>
      ) : (
        <>
          {/* 模块统计卡网格（画布风格：语义色图标 chip + 大数字 + 单位） */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Timer, color: "#8B5CF6", label: "专注时长", value: `${stat.focusMin}`, unit: "分钟", sub: `${stat.focusCount} 次` },
              { icon: Sparkles, color: "#06B6D4", label: "冥想", value: `${stat.medMin}`, unit: "分钟", sub: `${stat.medCount} 次` },
              { icon: Moon, color: "#5856D6", label: "按时入睡", value: stat.sleepDays ? `${stat.sleepOnTime}/${stat.sleepDays}` : "—", unit: stat.sleepDays ? "天" : "", sub: stat.sleepDays ? `${Math.round((stat.sleepOnTime / stat.sleepDays) * 100)}%` : "暂无记录" },
              { icon: Droplets, color: "#34C759", label: "日均饮水", value: stat.waterDays ? `${stat.waterAvg}` : "—", unit: stat.waterDays ? "ml" : "", sub: stat.waterDays ? `${stat.waterDays}/7 天` : "暂无记录" },
              { icon: CalendarCheck, color: "#6366F1", label: "理想日学习", value: stat.idealTotal ? `${Math.round((stat.idealDone / stat.idealTotal) * 100)}` : "—", unit: stat.idealTotal ? "%" : "", sub: stat.idealTotal ? `${stat.idealDone}/${stat.idealTotal}` : "未安排" },
              { icon: Target, color: "#FF9500", label: "日程完成", value: stat.itemTotal ? `${Math.round((stat.itemDone / stat.itemTotal) * 100)}` : "—", unit: stat.itemTotal ? "%" : "", sub: stat.itemTotal ? `${stat.itemDone}/${stat.itemTotal}` : "无事项" },
            ].map((c) => (
              <div key={c.label} className="rounded-[16px] p-3.5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${c.color}24`, color: c.color }}>
                    <c.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[11.5px] font-medium" style={{ color: "var(--color-text-secondary)" }}>{c.label}</span>
                </div>
                <p className="text-[20px] font-semibold leading-tight tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                  {c.value}
                  {c.unit && <span className="text-[12px] font-normal" style={{ color: "var(--color-text-tertiary)" }}> {c.unit}</span>}
                </p>
                <p className="mt-1 text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* 每日专注趋势条（画布风格：渐变柱 + 顶部数值 + 底部日期） */}
          <div className="rounded-[16px] p-4 mt-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>每日专注时长</p>
              <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>近 7 天</span>
            </div>
            <div className="flex items-end justify-between gap-1.5" style={{ height: 108 }}>
              {dailyFocus.map((d, i) => (
                <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] leading-none tabular-nums" style={{ color: d.min > 0 ? "#8B5CF6" : "var(--color-text-disabled)" }}>
                    {d.min > 0 ? `${d.min}m` : ""}
                  </span>
                  <div
                    className="lf-bar-anim w-full"
                    style={{
                      height: `${Math.max(6, (d.min / maxFocus) * 78)}px`,
                      borderRadius: "6px 6px 0 0",
                      background: d.min > 0 ? "linear-gradient(180deg,#8B5CF6,rgba(139,92,246,0.25))" : "var(--lifeflow-muted)",
                      animationDelay: `${0.05 + i * 0.05}s`,
                    }}
                  />
                  <span className="text-[10px] leading-none tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                    {i === 0 ? "今天" : `${d.date.slice(8)}日`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 数据洞察卡（画布自动洞察：语义色图标 + 洞察文案列表） */}
          {insights.length > 0 && (
            <div className="rounded-[16px] p-4 mt-3" style={{ background: "var(--color-surface-card)", border: "1px solid var(--lifeflow-border)", boxShadow: "var(--shadow-card)" }}>
              <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px]" style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}>
                  <TrendingUp className="h-3 w-3" />
                </span>
                自动洞察
              </p>
              <ul className="space-y-2">
                {insights.map((t, i) => {
                  const meta = insightMeta(t);
                  return (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]" style={{ background: meta.light, color: meta.color }}>
                        <meta.icon className="h-3 w-3" />
                      </span>
                      <span>{t}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 目标进度 */}
          {goalList.length > 0 && (
            <div className="rounded-[16px] p-4 mt-3" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
              <p className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>目标进度</p>
              <div className="space-y-3.5">
                {goalList.map((g) => (
                  <button key={g.id} type="button" onClick={() => router.push(`/efficiency-v2/goals/${g.id}`)} className="block w-full rounded-[6px] text-left active:opacity-70">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium" style={{ color: "var(--color-text-primary)" }}>{g.title}</span>
                      <span className="text-[12px] font-semibold tabular-nums leading-none" style={{ color: "var(--color-text-primary)" }}>{g.progress}%</span>
                    </div>
                    <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "var(--lifeflow-knit-bg)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, g.progress)}%`, background: "linear-gradient(90deg,#6366F1,#8B5CF6)" }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
