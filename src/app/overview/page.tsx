"use client";

import { useEffect, useState, useCallback, Component, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Heart,
  Trees,
  Target,
  Calendar,
  Timer,
  BookOpen,
  X,
  ChevronRight,
  ArrowRight,
  Play,
  ListChecks,
  Focus,
} from "lucide-react";
import { db } from "@/lib/db";
import type { Task } from "@/lib/types";

import TodayTimeline from "@/components/TodayTimeline";

// ==================== 工具函数 ====================

function daysBetween(a: Date, b: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / oneDay);
}

// ==================== 中心入口卡片 ====================

const CENTERS = [
  {
    id: "learning",
    title: "学习中心",
    subtitle: "毕业 · 考公",
    icon: GraduationCap,
    from: "from-indigo-400",
    via: "via-violet-400",
    to: "to-purple-500",
    href: "/learning",
  },
  {
    id: "health",
    title: "健康中心",
    subtitle: "睡眠 · 体态 · 运动",
    icon: Heart,
    from: "from-emerald-400",
    via: "via-teal-400",
    to: "to-cyan-500",
    href: "/health",
  },
  {
    id: "growth",
    title: "长期主义",
    subtitle: "规划 · 习惯 · 成长",
    icon: Trees,
    from: "from-rose-400",
    via: "via-pink-400",
    to: "to-fuchsia-500",
    href: "/growth",
  },
];

function CenterCard({
  center,
}: {
  center: (typeof CENTERS)[0];
}) {
  const router = useRouter();

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => router.push(center.href)}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${center.from} ${center.via} ${center.to} p-4 text-left text-white shadow-lg shadow-slate-200/60 flex flex-col w-[400px] h-[220px]`}
    >
      {/* 微弱右上光晕 */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full pointer-events-none" />

      <div className="relative z-10 flex flex-col flex-1">
        {/* 图标 */}
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
          <center.icon className="w-5 h-5 text-white" strokeWidth={1.6} />
        </div>

        {/* 标题 + 副标题 */}
        <div className="flex-1">
          <h3 className="text-sm font-bold leading-tight">{center.title}</h3>
          <p className="text-white/65 text-[10px] leading-tight mt-1">{center.subtitle}</p>
        </div>

        {/* 箭头 */}
        <ArrowRight className="w-4 h-4 text-white/50 group-hover:translate-x-0.5 transition-transform self-end" />
      </div>
    </motion.button>
  );
}

// ==================== 焦点卡片 ====================

function FocusCard({
  focus,
  onClearFocus,
}: {
  focus: Task;
  onClearFocus: () => void;
}) {
  const router = useRouter();

  // 计算进度（基于时间）
  const now = new Date();
  let progress = 0;
  let countdown = 0;
  let countdownLabel = "";

  if (focus.startTime && focus.dueDate) {
    const totalDays = daysBetween(new Date(focus.startTime), new Date(focus.dueDate));
    const elapsed = daysBetween(new Date(focus.startTime), now);
    progress = totalDays > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100))) : 0;
  }

  if (focus.dueDate) {
    countdown = daysBetween(now, new Date(focus.dueDate));
    if (countdown > 0) {
      countdownLabel = `还有 ${countdown} 天`;
    } else if (countdown === 0) {
      countdownLabel = "今天截止";
    } else {
      countdownLabel = `已过期 ${Math.abs(countdown)} 天`;
    }
  }

  // 进度环 SVG 参数
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-lg shadow-indigo-500/20">
      {/* 右上角装饰光晕 */}
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

      {/* 顶部栏 */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-white/80" strokeWidth={1.5} />
          <span className="text-xs font-medium text-white/80 uppercase tracking-wider">
            当前焦点
          </span>
        </div>
        <button
          onClick={onClearFocus}
          className="text-xs text-white/70 hover:text-white transition-colors"
        >
          取消焦点
        </button>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5 p-5 md:p-6">
        {/* 左侧：标题 + 倒计时 + 今日目标 */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            {focus.title}
          </h2>

          {/* 倒计时 */}
          {focus.dueDate && (
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-white/70" strokeWidth={1.5} />
              <span className="text-sm text-white/80">{countdownLabel}</span>
            </div>
          )}

          {/* 今日目标 */}
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-white/70" strokeWidth={1.5} />
            <span className="text-sm text-white/80">
              {focus.note || "继续推进当前目标"}
            </span>
          </div>
        </div>

        {/* 右侧：进度环 */}
        {(focus.startTime && focus.dueDate) ? (
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-white/20"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-white"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{progress}%</span>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center justify-center w-[72px] h-[72px] rounded-full bg-white/15">
            <Focus className="w-6 h-6 text-white/70" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div className="relative z-10 flex border-t border-white/15 divide-x divide-white/15">
        <button
          onClick={() => router.push("/focus")}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Timer className="w-4 h-4" strokeWidth={1.5} />
          <span>记录专注</span>
        </button>
        <button
          onClick={() => router.push(`/planner?goalId=${focus.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ListChecks className="w-4 h-4" strokeWidth={1.5} />
          <span>查看计划</span>
        </button>
        <button
          onClick={() => router.push("/learning")}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <BookOpen className="w-4 h-4" strokeWidth={1.5} />
          <span>开始学习</span>
        </button>
      </div>
    </div>
  );
}

// ==================== 无焦点空状态 ====================

function EmptyFocusCard({ onSetFocus }: { onSetFocus: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 p-8 md:p-10 flex flex-col items-center text-center shadow-lg shadow-indigo-500/20">
      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
        <Target className="w-7 h-7 text-white" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">尚未设置焦点</h3>
      <p className="text-sm text-white/70 mb-5">
        选择一个目标作为当前焦点，追踪进度与倒计时
      </p>
      <button
        onClick={onSetFocus}
        className="px-5 py-2.5 rounded-xl bg-white text-indigo-600 text-sm font-medium hover:bg-white/90 transition-colors"
      >
        选择焦点目标
      </button>
    </div>
  );
}

// ==================== 焦点选择 Modal ====================

function FocusPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (task: Task) => void;
}) {
  const [goals, setGoals] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const all = await db.tasks
        .where("status")
        .equals("active")
        .filter(
          (t) =>
            t.type === "longterm" ||
            t.type === "shortterm" ||
            t.classification === "long-term" ||
            t.classification === "short-term"
        )
        .toArray();
      setGoals(all);
      setLoading(false);
    };
    load();
  }, [open]);

  const handleSelect = async (task: Task) => {
    // 清除之前的焦点
    const all = await db.tasks.toArray();
    const prevFocus = all.filter((t) => t.isFocus === true);
    for (const t of prevFocus) {
      await db.tasks.update(t.id!, { isFocus: false });
    }
    // 设置新焦点
    await db.tasks.update(task.id!, { isFocus: true });
    onSelect(task);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white max-h-[70vh] flex flex-col rounded-t-2xl pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                选择焦点目标
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  加载中...
                </div>
              ) : goals.length === 0 ? (
                <div className="py-12 text-center">
                  <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-gray-500 mb-3">
                    暂无活跃的长期/短期目标
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      window.location.href = "/planner";
                    }}
                    className="text-sm text-blue-500 hover:text-blue-600"
                  >
                    去规划页创建目标
                  </button>
                </div>
              ) : (
                goals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => handleSelect(goal)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {goal.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {goal.dueDate
                          ? `截止 ${new Date(goal.dueDate).toLocaleDateString("zh-CN")}`
                          : "无截止日期"}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==================== 时间线错误边界 ====================

class TimelineErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || "未知错误" };
  }

  componentDidCatch(error: Error) {
    console.error("[TimelineErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl bg-white border border-red-200 p-6 text-center">
          <p className="text-sm text-red-500 mb-1">时间线加载异常</p>
          <p className="text-xs text-gray-400">{this.state.errorMsg}</p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: "" })}
            className="mt-3 text-xs text-blue-500 underline"
          >
            点击重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==================== 主页面 ====================

export default function OverviewPage() {
  const [focus, setFocus] = useState<Task | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadFocus = useCallback(async () => {
    try {
      const all = await db.tasks.toArray();
      const focused = all.filter((t) => t.isFocus === true && t.status !== "archived");
      setFocus(focused[0] || null);
    } catch (err) {
      console.error("Failed to load focus:", err);
    } finally {
      setLoadingFocus(false);
    }
  }, []);

  useEffect(() => {
    loadFocus();
  }, [loadFocus]);

  const handleClearFocus = async () => {
    if (focus?.id) {
      await db.tasks.update(focus.id, { isFocus: false });
      setFocus(null);
    }
  };

  const handleSelectFocus = (task: Task) => {
    setFocus(task);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-5 pt-6 pb-24 md:px-8 md:pt-10">
        {/* 头部 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">总览</h1>
          <p className="text-sm text-gray-500 mt-1">
            聚焦目标 · 今日时间线 · 快速进入各中心
          </p>
        </div>

        {/* 焦点卡片 */}
        <div className="mb-8">
          {loadingFocus ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : focus ? (
            <FocusCard focus={focus} onClearFocus={handleClearFocus} />
          ) : (
            <EmptyFocusCard onSetFocus={() => setPickerOpen(true)} />
          )}
        </div>

        {/* 今日时间线 */}
        <div className="mb-8">
          <TimelineErrorBoundary>
            {mounted ? (
              <TodayTimeline />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-400 mt-2">加载中...</span>
              </div>
            )}
          </TimelineErrorBoundary>
        </div>

        {/* 中心入口 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            中心入口
          </h2>
          {/* 桌面端 */}
          <div className="hidden md:flex gap-4">
            {CENTERS.map((center, i) => (
              <motion.div
                key={center.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <CenterCard
                  center={center}
                />
              </motion.div>
            ))}
          </div>
          {/* 移动端：纵向堆叠 */}
          <div className="flex flex-col gap-3 md:hidden">
            {CENTERS.map((center) => (
              <CenterCard
                key={center.id}
                center={center}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 焦点选择器 */}
      <FocusPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectFocus}
      />
    </div>
  );
}
