"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, CheckCircle2, CalendarDays, Moon, Activity,
  Droplets, Pill, Dumbbell, PieChartIcon, Wallet, Sparkles,
  BarChart3, BedDouble,
} from "lucide-react";
import { daylogDB, type Item } from "@/lib/db/daylog.db";
import { efficiencyDB, type Project } from "@/lib/db/efficiency.db";
import { healthDB, type WaterLog, type SleepLog, type MedicineLog } from "@/lib/db/health.db";
import { accountingDB, type Transaction, type Category } from "@/lib/db/accounting.db";

// ─── helpers ──────────────────────────────────────────────────

function getDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function toDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${m}月${day}日 ${weekdays[d.getDay()]}`;
}

function formatTimeHM(time: string): string {
  if (!time) return "--:--";
  const [h, m] = time.split(":");
  return `${h}:${m}`;
}

function weekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdays[d.getDay()];
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const pastDays = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
}

// ─── colors ───────────────────────────────────────────────────

const PIE_COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

const CATEGORY_COLOR_MAP: Record<string, string> = {
  "餐饮": "#FF3B30", "交通": "#007AFF", "购物": "#FF9500",
  "住房": "#1E293B", "娱乐": "#5856D6", "医疗": "#DC2626",
  "教育": "#2563EB", "社交": "#F43F5E", "通讯": "#0EA5E9",
  "服饰美容": "#AF52DE", "运动健身": "#34C759", "其他": "#8E8E93",
};

// ─── Props ────────────────────────────────────────────────────

interface ReviewWeeklyProps {
  startDate: string;
  endDate: string;
}

// ─── Component ────────────────────────────────────────────────

export default function ReviewWeekly({ startDate, endDate }: ReviewWeeklyProps) {
  const dates = getDates(startDate, endDate);

  const [items, setItems] = useState<Item[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [medicineLogs, setMedicineLogs] = useState<MedicineLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [
          allItems,
          allWaterLogs,
          allSleepLogs,
          allTransactions,
          allMeds,
          allProjects,
          allCategories,
        ] = await Promise.all([
          daylogDB.items.where("date").between(startDate, endDate, true, true).toArray(),
          healthDB.waterLogs.where("date").between(startDate, endDate, true, true).toArray(),
          healthDB.sleepLogs.where("date").between(startDate, endDate, true, true).toArray(),
          accountingDB.transactions.where("date").between(startDate, endDate, true, true).toArray(),
          healthDB.medicineLogs.where("date").between(startDate, endDate, true, true).toArray(),
          efficiencyDB.projects.toArray(),
          accountingDB.categories.toArray(),
        ]);
        setItems(allItems.filter((i) => i.isCompleted !== false));
        setWaterLogs(allWaterLogs);
        setSleepLogs(allSleepLogs);
        setTransactions(allTransactions);
        setMedicineLogs(allMeds);
        setProjects(allProjects);
        setCategories(allCategories);
      } catch (e) {
        console.error("ReviewWeekly load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  const totalItems = items.length;
  const allDayItems = dates.map((d) => items.filter((it) => it.date === d).length);
  const totalPossibleDays = dates.length;
  const completionRate = totalItems > 0
    ? Math.round((items.filter((i) => i.isCompleted).length / Math.max(totalItems, 1)) * 100)
    : 0;
  const calibratedRate = allDayItems.length > 0
    ? Math.round(allDayItems.filter((c) => c > 0).length / totalPossibleDays * 100)
    : 0;

  // ── completion trend ────────────────────────────────────────
  const completionTrend = dates.map((d) => {
    const dayItems = items.filter((it) => it.date === d);
    const done = dayItems.filter((i) => i.isCompleted).length;
    return {
      day: weekdayLabel(d),
      date: d,
      rate: dayItems.length > 0 ? Math.round((done / dayItems.length) * 100) : null,
    };
  });

  // ── sleep trend ─────────────────────────────────────────────
  const sleepTrend = dates.map((d) => {
    const log = sleepLogs.find((s) => s.date === d);
    return {
      day: weekdayLabel(d),
      date: d,
      bedTime: log ? log.actualTime : null,
      wakeTime: null as string | null,
    };
  });

  const hasSleepData = sleepLogs.length > 0;

  // ── high-frequency items ────────────────────────────────────
  const itemFreq = new Map<string, { title: string; dates: Map<string, number> }>();
  for (const it of items) {
    if (!itemFreq.has(it.title)) {
      itemFreq.set(it.title, { title: it.title, dates: new Map() });
    }
    const entry = itemFreq.get(it.title)!;
    const mins = it.plannedStart && it.plannedEnd
      ? ((parseInt(it.plannedEnd.split(":")[0]) * 60 + parseInt(it.plannedEnd.split(":")[1])) -
         (parseInt(it.plannedStart.split(":")[0]) * 60 + parseInt(it.plannedStart.split(":")[1])))
      : 0;
    entry.dates.set(it.date, (entry.dates.get(it.date) || 0) + Math.max(0, mins));
  }
  const highFreqItems = Array.from(itemFreq.values())
    .filter((v) => v.dates.size >= 4)
    .map((v) => ({
      title: v.title,
      bars: dates.map((d) => ({ day: weekdayLabel(d), date: d, minutes: v.dates.get(d) || 0 })),
    }));

  // ── expense analysis ────────────────────────────────────────
  const expensesByDay = dates.map((d) => {
    const total = transactions
      .filter((tx) => tx.date === d && tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { day: weekdayLabel(d), date: d, amount: total };
  });

  const expenseByCat = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (tx.categoryId) {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const name = cat?.name || "其他";
      expenseByCat.set(name, (expenseByCat.get(name) || 0) + tx.amount);
    } else {
      expenseByCat.set("其他", (expenseByCat.get("其他") || 0) + tx.amount);
    }
  }
  const expensePieData = Array.from(expenseByCat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const hasExpenseData = transactions.filter((tx) => tx.type === "expense").length > 0;

  // ── water / exercise / medication ───────────────────────────
  const waterTrend = dates.map((d) => {
    const total = waterLogs.filter((w) => w.date === d).reduce((s, w) => s + w.amount, 0);
    return { day: weekdayLabel(d), date: d, amount: total };
  });

  const exerciseDays = dates.map((d) => {
    const count = items.filter((it) => it.date === d && it.sourceType === "fitness").length;
    return count;
  });

  const medicationTrend = dates.map((d) => {
    const taken = medicineLogs.filter((m) => m.date === d && m.taken).length;
    const total = medicineLogs.filter((m) => m.date === d).length;
    return { day: weekdayLabel(d), date: d, taken, total };
  });

  // ── project pie ─────────────────────────────────────────────
  const projectTime = new Map<string, number>();
  for (const it of items) {
    const pid = it.projectId || "none";
    const p = projects.find((pr) => pr.id === pid);
    const name = p?.name || "无项目";
    const mins = it.plannedStart && it.plannedEnd
      ? Math.max(0, (parseInt(it.plannedEnd.split(":")[0]) * 60 + parseInt(it.plannedEnd.split(":")[1])) -
          (parseInt(it.plannedStart.split(":")[0]) * 60 + parseInt(it.plannedStart.split(":")[1])))
      : 0;
    projectTime.set(name, (projectTime.get(name) || 0) + mins);
  }
  const projectPieData = Array.from(projectTime.entries())
    .map(([name, value]) => ({ name, value: value / 60 }))
    .sort((a, b) => b.value - a.value);

  // ── total expense / income ──────────────────────────────────
  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="space-y-4">
      {/* ── Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="完成率"
          value={`${completionRate}%`}
          color="text-[var(--state-success)]"
          bg="bg-green-50 dark:bg-green-950/30"
        />
        <StatCard
          icon={CalendarDays}
          label="事项总数"
          value={`${totalItems}`}
          color="text-[var(--lifeflow-primary)]"
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          icon={TrendingUp}
          label="校准率"
          value={`${calibratedRate}%`}
          color="text-[var(--state-warning)]"
          bg="bg-orange-50 dark:bg-orange-950/30"
        />
      </div>

      {/* ── 7-Day Completion Trend ───────────────────────────── */}
      <SectionCard icon={TrendingUp} title="7日完成率趋势">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={completionTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12, border: "1px solid var(--border)",
                background: "var(--card-bg)", fontSize: 13,
              }}
              formatter={(_value: any) => [_value != null ? `${Number(_value)}%` : "无数据", "完成率"]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              fill="url(#completionGradient)"
            />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* ── Sleep Trend ──────────────────────────────────────── */}
      <SectionCard icon={Moon} title="睡眠趋势">
        {hasSleepData ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sleepTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} domain={[20, 26]} hide />
              <Tooltip
                contentStyle={{
                  borderRadius: 12, border: "1px solid var(--border)",
                  background: "var(--card-bg)", fontSize: 13,
                }}
                formatter={(_value: any, name: any) => {
                  if (!_value) return ["无数据", name === "bedTime" ? "入睡时间" : "起床时间"];
                  const s = String(_value);
                  const h = parseInt(s.split(":")[0]);
                  const m = parseInt(s.split(":")[1]);
                  const label = h >= 24
                    ? `${h - 24}:${String(m).padStart(2, "0")}(次日)`
                    : `${h}:${String(m).padStart(2, "0")}`;
                  return [label, name === "bedTime" ? "入睡时间" : "起床时间"];
                }}
              />
              <Line
                type="monotone"
                dataKey="bedTime"
                stroke="#6366F1"
                strokeWidth={2}
                dot={{ r: 3, fill: "#6366F1" }}
                name="入睡时间"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyHint icon={BedDouble} text="暂无睡眠数据" />
        )}
      </SectionCard>

      {/* ── High-Frequency Items ─────────────────────────────── */}
      {highFreqItems.length > 0 && (
        <SectionCard icon={Activity} title="高频事项（出现 >= 4天）">
          <div className="space-y-4">
            {highFreqItems.map((hfi) => (
              <div key={hfi.title}>
                <p className="text-sm font-medium text-[var(--foreground)] mb-2">{hfi.title}</p>
                <ResponsiveContainer width="100%" height={60}>
                  <BarChart data={hfi.bars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]} fill="#2563EB" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Expense Analysis ─────────────────────────────────── */}
      <SectionCard icon={Wallet} title="支出分析">
        {hasExpenseData ? (
          <div className="space-y-4">
            {/* daily bar */}
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={expensesByDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12, border: "1px solid var(--border)",
                    background: "var(--card-bg)", fontSize: 13,
                  }}
                  formatter={(_value: any) => [`¥${Number(_value).toFixed(2)}`, "支出"]}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#FF3B30" />
              </BarChart>
            </ResponsiveContainer>

            {/* category pie */}
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%" cy="50%"
                    innerRadius={35} outerRadius={70}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {expensePieData.map((_, idx) => (
                      <Cell key={idx} fill={CATEGORY_COLOR_MAP[expensePieData[idx].name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12, border: "1px solid var(--border)",
                      background: "var(--card-bg)", fontSize: 13,
                    }}
                    formatter={(_value: any) => [`¥${Number(_value).toFixed(2)}`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {expensePieData.slice(0, 6).map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: CATEGORY_COLOR_MAP[cat.name] || PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="text-[var(--foreground)]">{cat.name}</span>
                    </div>
                    <span className="text-[var(--muted-foreground)]">¥{cat.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 text-xs">
              <span className="text-[var(--muted-foreground)]">
                总收入 <span className="text-[var(--state-success)] font-semibold">¥{totalIncome.toFixed(2)}</span>
              </span>
              <span className="text-[var(--muted-foreground)]">
                总支出 <span className="text-[var(--color-expense)] font-semibold">¥{totalExpense.toFixed(2)}</span>
              </span>
            </div>
          </div>
        ) : (
          <EmptyHint icon={Wallet} text="暂无支出数据" />
        )}
      </SectionCard>

      {/* ── Water / Exercise / Medication Trend ──────────────── */}
      <SectionCard icon={Droplets} title="饮水 / 运动 / 用药趋势">
        <div className="grid grid-cols-3 gap-3">
          {/* Water */}
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1">
              <Droplets className="w-3 h-3" /> 饮水(ml)
            </p>
            <div className="space-y-1">
              {waterTrend.map((w) => (
                <div key={w.date} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">{w.day}</span>
                  <span className="font-medium text-[var(--foreground)]">{w.amount}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Exercise */}
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1">
              <Dumbbell className="w-3 h-3" /> 运动
            </p>
            <div className="space-y-1">
              {dates.map((d, i) => (
                <div key={d} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">{weekdayLabel(d)}</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {exerciseDays[i] > 0 ? `${exerciseDays[i]}次` : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Medication */}
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1">
              <Pill className="w-3 h-3" /> 用药
            </p>
            <div className="space-y-1">
              {medicationTrend.map((m) => (
                <div key={m.date} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">{m.day}</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {m.total > 0 ? `${m.taken}/${m.total}` : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Project Time Pie ─────────────────────────────────── */}
      {projectPieData.length > 0 && (
        <SectionCard icon={PieChartIcon} title="项目时间分布">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={projectPieData}
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={85}
                dataKey="value"
                paddingAngle={2}
              >
                {projectPieData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12, border: "1px solid var(--border)",
                  background: "var(--card-bg)", fontSize: 13,
                }}
                formatter={(_value: any) => [`${Number(_value).toFixed(1)}h`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {projectPieData.slice(0, 6).map((p, idx) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                />
                <span className="text-[var(--foreground)]">{p.name}</span>
                <span className="text-[var(--muted-foreground)]">{p.value.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Range Info ────────────────────────────────────────── */}
      <div className="text-center text-xs text-[var(--muted-foreground)] pb-4">
        {toDateStr(startDate)} - {toDateStr(endDate)}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-xl font-bold text-[var(--foreground)]">{value}</div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}

function SectionCard({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card-bg)] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[var(--lifeflow-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
      <Icon className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
