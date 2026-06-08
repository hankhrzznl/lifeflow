"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, CheckCheck, ListTodo, Flame, Wallet,
  TrendingUp, Inbox, ClipboardList, Target,
  ArrowLeft, Moon, Dumbbell, Sparkles,
  GraduationCap, BookOpen, Sprout, Repeat,
  LayoutGrid, Clock,
} from "lucide-react";
import {
  initBuiltInPlugins,
  getMonthlyTaskStats, getMonthlyHabitStats, getMonthlyFinanceStats,
  getWeeklyTaskStats, getActiveSchedulableTasks,
  createReviewRecord, getReviewRecordByKey,
  getAllSubmodules, initializeSubmodules,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { ReviewRecord, Task, Submodule } from "@/lib/types";
import { db } from "@/lib/db";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ==================== 类型 ====================

type ReviewTab = "daily" | "weekly" | "monthly";
type TimeRange = 7 | 30 | 90;
type ViewMode = "grid" | "all";

// ==================== 工具函数 ====================

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return `${start.getFullYear()}-W${String(Math.ceil((start.getDate() - 1 + start.getDay()) / 7) + 1).padStart(2, "0")}`;
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getIconComponent(iconName: string) {
  const map: Record<string, React.ComponentType<any>> = {
    GraduationCap, BookOpen, Moon, Sparkles, Dumbbell,
    Target, Sprout, Repeat, LayoutGrid,
  };
  return map[iconName] || LayoutGrid;
}

// ==================== 子模块图标网格 ====================

function SubmoduleGrid({
  submodules,
  onTapAll,
  onTapSubmodule,
}: {
  submodules: Submodule[];
  onTapAll: () => void;
  onTapSubmodule: (sub: Submodule) => void;
}) {
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">回顾</h1>
      <p className="text-sm text-gray-500 mb-6">选择模块查看回顾与趋势</p>

      <div className="grid grid-cols-3 gap-4">
        {/* 全部入口 */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onTapAll}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 via-violet-400 to-purple-500 flex items-center justify-center">
            <LayoutGrid className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-xs font-medium text-gray-700">全部</span>
        </motion.button>

        {/* 子模块 */}
        {submodules.map((sub, i) => {
          const IconComp = getIconComponent(sub.icon);
          return (
            <motion.button
              key={sub.id}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              onClick={() => onTapSubmodule(sub)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${sub.from} ${sub.via} ${sub.to} flex items-center justify-center`}>
                <IconComp className="w-6 h-6 text-white" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-gray-700">{sub.name}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 全部回顾视图（重写） ====================

function AllReviewView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<ReviewTab>("daily");
  const [loading, setLoading] = useState(true);

  const [taskStats, setTaskStats] = useState({ completed: 0, active: 0, new: 0 });
  const [habitStats, setHabitStats] = useState({ completed: 0, total: 0, streak: 0 });
  const [financeStats, setFinanceStats] = useState({ income: 0, expense: 0, balance: 0 });
  const [weeklyDone, setWeeklyDone] = useState(0);
  const [weeklyPending, setWeeklyPending] = useState(0);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState("");
  const [savedRecord, setSavedRecord] = useState<ReviewRecord | null>(null);
  const [prevMonthRecord, setPrevMonthRecord] = useState<ReviewRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await initBuiltInPlugins();

      const [monthTasks, monthHabits, monthFinance, weekTasks, pending] =
        await Promise.all([
          getMonthlyTaskStats(currentYear, currentMonth),
          getMonthlyHabitStats(currentYear, currentMonth),
          getMonthlyFinanceStats(currentYear, currentMonth),
          getWeeklyTaskStats(),
          getActiveSchedulableTasks(),
        ]);

      setTaskStats(monthTasks);
      setHabitStats(monthHabits);
      setFinanceStats(monthFinance);
      setWeeklyDone(weekTasks.completed);
      setWeeklyPending(weekTasks.active);
      setPendingTasks(pending.slice(0, 10));

      const todayKey = getTodayStr();
      const existingDaily = await getReviewRecordByKey(todayKey);
      if (existingDaily) {
        setSavedRecord(existingDaily);
        setSummary(existingDaily.summary || "");
      }

      if (tab === "monthly") {
        const prevKey = `${currentMonth === 1 ? currentYear - 1 : currentYear}-${String(currentMonth === 1 ? 12 : currentMonth - 1).padStart(2, "0")}`;
        const prev = await getReviewRecordByKey(prevKey);
        setPrevMonthRecord(prev || null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [currentYear, currentMonth, tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveRecord = async () => {
    setSaving(true);
    try {
      const key = tab === "daily" ? getTodayStr() : tab === "weekly" ? getWeekKey(now) : getMonthKey(now);
      await createReviewRecord({
        type: tab === "weekly" ? "weekly" : tab === "monthly" ? "monthly" : "daily",
        dateKey: key,
        summary: summary || undefined,
        stats: {
          tasksDone: tab === "daily" ? weeklyDone : taskStats.completed,
          tasksPending: tab === "daily" ? weeklyPending : taskStats.active,
          tasksOverdue: 0,
          habitStreaks: habitStats.completed,
          focusMinutes: 0,
          financeIncome: financeStats.income,
          financeExpense: financeStats.expense,
        },
      });
      showToast({ message: "回顾已保存", type: "success" });
      const r = await getReviewRecordByKey(key);
      if (r) setSavedRecord(r);
    } catch {
      showToast({ message: "保存失败", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const tabLabels: { key: ReviewTab; label: string }[] = [
    { key: "daily", label: "日回顾" },
    { key: "weekly", label: "周回顾" },
    { key: "monthly", label: "月复盘" },
  ];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      {/* 头部 + 返回 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">全部回顾</h1>
          <p className="text-xs text-gray-500">日 · 周 · 月 综合复盘</p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {tabLabels.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSummary(""); setSavedRecord(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 日回顾 */}
          {tab === "daily" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<CheckCheck className="w-4 h-4" />} iconColor="text-emerald-500" label="本周完成" value={weeklyDone} />
                <StatCard icon={<ListTodo className="w-4 h-4" />} iconColor="text-amber-500" label="待办" value={weeklyPending} />
                <StatCard icon={<Flame className="w-4 h-4" />} iconColor="text-orange-500" label="习惯打卡" value={habitStats.completed} />
                <StatCard icon={<Wallet className="w-4 h-4" />} iconColor="text-blue-500" label="今日支出" value={financeStats.expense.toFixed(0)} valueColor="text-red-500" />
              </div>

              {pendingTasks.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-gray-700">明天待办预览</h3>
                  </div>
                  <div className="space-y-1">
                    {pendingTasks.slice(0, 5).map((t) => (
                      <div key={t.id} className="text-xs text-gray-500 truncate pl-1 border-l-2 border-gray-200"> {t.title}</div>
                    ))}
                  </div>
                </div>
              )}

              <ReflectionBox
                summary={summary}
                onChange={setSummary}
                onSave={handleSaveRecord}
                saving={saving}
                label="今日反思"
                placeholder="今天完成了什么？有什么需要改进？"
                savedRecord={savedRecord}
              />
            </>
          )}

          {/* 周回顾 */}
          {tab === "weekly" && (
            <>
              <StepCard
                icon={<Inbox className="w-4 h-4" />}
                iconBg="bg-amber-100"
                iconColor="text-amber-600"
                title="Step 1 · 收件箱清理"
                subtitle={`本周待安排任务：${taskStats.active} 个`}
                action={{ label: "前往安排事项", href: "/pending" }}
              />

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCheck className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-700">Step 2 · 本周概览</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="完成任务" value={weeklyDone} />
                  <MiniStat label="待办任务" value={weeklyPending} />
                  <MiniStat label="习惯打卡" value={habitStats.completed} />
                  <MiniStat
                    label="本月收支"
                    value={(financeStats.income - financeStats.expense).toFixed(0)}
                    valueColor={financeStats.income - financeStats.expense >= 0 ? "text-emerald-500" : "text-red-500"}
                  />
                </div>
              </div>

              <StepCard
                icon={<ClipboardList className="w-4 h-4" />}
                iconBg="bg-indigo-100"
                iconColor="text-indigo-600"
                title="Step 3 · 下周计划"
                subtitle={pendingTasks.length > 0 ? undefined : "暂无待安排任务"}
                action={{ label: "前往安排下周任务", href: "/pending" }}
              >
                {pendingTasks.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {pendingTasks.slice(0, 8).map((t) => (
                      <div key={t.id} className="text-xs text-gray-500 truncate pl-1 border-l-2 border-gray-200"> {t.title}</div>
                    ))}
                  </div>
                )}
              </StepCard>

              <ReflectionBox
                summary={summary}
                onChange={setSummary}
                onSave={handleSaveRecord}
                saving={saving}
                label="周反思笔记"
                placeholder="这周完成了什么？有哪些收获和改进？"
                savedRecord={savedRecord}
              />
            </>
          )}

          {/* 月复盘 */}
          {tab === "monthly" && (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-700">{currentYear}年{currentMonth}月 复盘</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400">完成任务</p>
                    <p className="text-lg font-bold text-gray-900">{taskStats.completed}</p>
                    {prevMonthRecord && prevMonthRecord.stats.tasksDone > 0 && (
                      <p className={`text-[10px] mt-0.5 ${taskStats.completed > prevMonthRecord.stats.tasksDone ? "text-emerald-500" : "text-red-500"}`}>
                        {taskStats.completed > prevMonthRecord.stats.tasksDone ? "↑" : "↓"} 上月 {prevMonthRecord.stats.tasksDone}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400">新增任务</p>
                    <p className={`text-lg font-bold ${taskStats.new > 0 ? "text-blue-500" : "text-gray-900"}`}>{taskStats.new}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400">习惯打卡</p>
                    <p className="text-lg font-bold text-gray-900">{habitStats.completed}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-400">习惯数量</p>
                    <p className="text-lg font-bold text-gray-900">{habitStats.total}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <p className="text-xs text-emerald-600">收入</p>
                    <p className="text-lg font-bold text-emerald-600">{financeStats.income.toFixed(0)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl">
                    <p className="text-xs text-red-500">支出</p>
                    <p className="text-lg font-bold text-red-500">{financeStats.expense.toFixed(0)}</p>
                  </div>
                </div>
              </div>

              <ReflectionBox
                summary={summary}
                onChange={setSummary}
                onSave={handleSaveRecord}
                saving={saving}
                label="月度反思"
                placeholder="这个月完成了什么？收入支出如何？有哪些收获和改进？"
                savedRecord={savedRecord}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 子组件 ====================

function StatCard({
  icon, iconColor, label, value, valueColor,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={iconColor}>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueColor || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function MiniStat({
  label, value, valueColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${valueColor || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function StepCard({
  icon, iconBg, iconColor, title, subtitle, action, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  action: { label: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {children}
      <a
        href={action.href}
        className="inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-1"
      >
        {action.label} →
      </a>
    </div>
  );
}

function ReflectionBox({
  summary, onChange, onSave, saving, label, placeholder, savedRecord,
}: {
  summary: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  label: string;
  placeholder: string;
  savedRecord: ReviewRecord | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      <textarea
        value={summary}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <button
        onClick={onSave}
        disabled={saving}
        className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {saving ? "保存中..." : savedRecord ? "更新回顾" : "保存回顾"}
      </button>
      {savedRecord && (
        <p className="text-[10px] text-gray-400 mt-1 text-center">
          上次保存: {new Date(savedRecord.createdAt || 0).toLocaleString("zh-CN")}
        </p>
      )}
    </div>
  );
}

// ==================== 子模块详情视图 ====================

function SubmoduleDetailView({
  submodule,
  onBack,
}: {
  submodule: Submodule;
  onBack: () => void;
}) {
  switch (submodule.name) {
    case "睡眠":
      return <SleepChartView submodule={submodule} onBack={onBack} />;
    case "体态":
      return <BodyMetricChartView submodule={submodule} onBack={onBack} />;
    case "运动":
      return <WorkoutChartView submodule={submodule} onBack={onBack} />;
    default:
      return <PlaceholderView submodule={submodule} onBack={onBack} />;
  }
}

// ==================== 睡眠图表视图 ====================

function SleepChartView({ submodule, onBack }: { submodule: Submodule; onBack: () => void }) {
  const [range, setRange] = useState<TimeRange>(30);
  const [metric, setMetric] = useState<"duration" | "sleepTime">("duration");
  const [chartData, setChartData] = useState<{ date: string; 时长: number; 入睡: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSleepData = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const start = now - range * 24 * 60 * 60 * 1000;
      const records = await db.sleepRecords
        .where("timestamp")
        .between(start, now)
        .toArray();

      records.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const data = records.map((r) => {
        const hours = r.sleepTime
          ? new Date(r.sleepTime).getHours() + ":" + String(new Date(r.sleepTime).getMinutes()).padStart(2, "0")
          : "-";
        return {
          date: formatDate(r.timestamp || 0),
          时长: r.sleepDuration ? Math.round(r.sleepDuration / 60) : 0,
          入睡: hours,
        };
      });
      setChartData(data);
    } catch (err) {
      console.error("Failed to load sleep data:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadSleepData(); }, [loadSleepData]);

  return (
    <ChartViewShell submodule={submodule} onBack={onBack} range={range} onChangeRange={setRange} loading={loading}>
      {/* 指标切换 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
        <button
          onClick={() => setMetric("duration")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            metric === "duration" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          睡眠时长
        </button>
        <button
          onClick={() => setMetric("sleepTime")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            metric === "sleepTime" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          入睡时间
        </button>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">暂无睡眠数据</div>
      ) : metric === "duration" ? (
        <div className="bg-white rounded-xl p-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} unit="h" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                formatter={(v) => [`${v} 小时`, "睡眠时长"]}
              />
              <Line type="monotone" dataKey="时长" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-gray-500">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p>入睡时间趋势</p>
          <div className="mt-3 space-y-1.5">
            {chartData.map((d, i) => (
              <div key={i} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5 max-w-xs mx-auto">
                <span className="text-gray-500">{d.date}</span>
                <span className="text-gray-700 font-mono">{d.入睡}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartViewShell>
  );
}

// ==================== 体态图表视图 ====================

function BodyMetricChartView({ submodule, onBack }: { submodule: Submodule; onBack: () => void }) {
  const [range, setRange] = useState<TimeRange>(30);
  const [chartData, setChartData] = useState<{ date: string; 体重: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const start = now - range * 24 * 60 * 60 * 1000;
      const records = await db.bodyMetricRecords
        .where("timestamp")
        .between(start, now)
        .filter((r) => r.type === "weight")
        .toArray();

      records.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const data = records.map((r) => ({
        date: formatDate(r.timestamp || 0),
        体重: r.value,
      }));
      setChartData(data);
    } catch (err) {
      console.error("Failed to load body metric data:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <ChartViewShell submodule={submodule} onBack={onBack} range={range} onChangeRange={setRange} loading={loading}>
      {chartData.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">暂无体态数据</div>
      ) : (
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">体重变化趋势 (kg)</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                formatter={(v) => [`${v} kg`, "体重"]}
              />
              <Line type="monotone" dataKey="体重" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartViewShell>
  );
}

// ==================== 运动图表视图 ====================

function WorkoutChartView({ submodule, onBack }: { submodule: Submodule; onBack: () => void }) {
  const [range, setRange] = useState<TimeRange>(30);
  const [chartData, setChartData] = useState<{ date: string; 次数: number; 时长: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const start = now - range * 24 * 60 * 60 * 1000;
      const records = await db.workouts
        .where("startTime")
        .between(start, now)
        .toArray();

      // 按日期聚合
      const grouped: Record<string, { count: number; totalDuration: number }> = {};
      for (const r of records) {
        const dateKey = formatDate(r.startTime || 0);
        if (!grouped[dateKey]) grouped[dateKey] = { count: 0, totalDuration: 0 };
        grouped[dateKey].count += 1;
        grouped[dateKey].totalDuration += r.duration || 0;
      }

      const dates = Object.keys(grouped).sort();
      const data = dates.map((d) => ({
        date: d,
        次数: grouped[d].count,
        时长: Math.round(grouped[d].totalDuration / 60),
      }));
      setChartData(data);
    } catch (err) {
      console.error("Failed to load workout data:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <ChartViewShell submodule={submodule} onBack={onBack} range={range} onChangeRange={setRange} loading={loading}>
      {chartData.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">暂无运动数据</div>
      ) : (
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">运动次数 & 总时长趋势</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} unit="min" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }} />
              <Line yAxisId="left" type="monotone" dataKey="次数" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="时长" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartViewShell>
  );
}

// ==================== 占位视图 ====================

function PlaceholderView({ submodule, onBack }: { submodule: Submodule; onBack: () => void }) {
  const IconComp = getIconComponent(submodule.icon);
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${submodule.from} ${submodule.via} ${submodule.to} flex items-center justify-center`}>
          <IconComp className="w-4 h-4 text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{submodule.name}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <BarChart3 className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">暂无趋势数据</p>
        <p className="text-xs text-gray-400">该模块的趋势图表尚未配置，敬请期待</p>
      </div>
    </div>
  );
}

// ==================== 图表视图外壳 ====================

function ChartViewShell({
  submodule, onBack, range, onChangeRange, loading, children,
}: {
  submodule: Submodule;
  onBack: () => void;
  range: TimeRange;
  onChangeRange: (r: TimeRange) => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  const IconComp = getIconComponent(submodule.icon);
  const rangeOptions: { key: TimeRange; label: string }[] = [
    { key: 7, label: "7天" },
    { key: 30, label: "30天" },
    { key: 90, label: "90天" },
  ];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${submodule.from} ${submodule.via} ${submodule.to} flex items-center justify-center`}>
          <IconComp className="w-4 h-4 text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{submodule.name}</h1>
      </div>
      <p className="text-xs text-gray-500 mb-4 ml-11">{submodule.description}</p>

      {/* 时间范围切换 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 ml-11 w-fit">
        {rangeOptions.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChangeRange(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              range === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ==================== 主页面 ====================

export default function ReviewPage() {
  const [view, setView] = useState<ViewMode>("grid");
  const [activeSubmodule, setActiveSubmodule] = useState<Submodule | null>(null);
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        await initializeSubmodules();
        const all = await getAllSubmodules();
        setSubmodules(all.filter((s) => s.enabled));
      } catch (err) {
        console.error("Failed to load submodules:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="skeleton h-8 w-20 mb-2" />
        <div className="skeleton h-4 w-40 mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {view === "grid" ? (
        <motion.div
          key="grid"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <SubmoduleGrid
            submodules={submodules}
            onTapAll={() => setView("all")}
            onTapSubmodule={(sub) => {
              setActiveSubmodule(sub);
              setView("all"); // 切换为非 grid
            }}
          />
        </motion.div>
      ) : activeSubmodule ? (
        <motion.div
          key={activeSubmodule.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          <SubmoduleDetailView
            submodule={activeSubmodule}
            onBack={() => {
              setActiveSubmodule(null);
              setView("grid");
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="all"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          <AllReviewView
            onBack={() => setView("grid")}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
