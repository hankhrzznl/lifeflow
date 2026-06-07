"use client";

import { useEffect, useState, useCallback } from "react";
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
import { db, getSubmodulesByParent, initializeSubmodules } from "@/lib/db";
import type { Task, Submodule } from "@/lib/types";

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
    accent: "border-l-gray-900 dark:border-l-gray-100",
    accentBg: "bg-gray-100 dark:bg-gray-800",
    href: "/learning",
  },
  {
    id: "health",
    title: "健康中心",
    subtitle: "睡眠 · 体态 · 运动",
    icon: Heart,
    accent: "border-l-gray-700 dark:border-l-gray-300",
    accentBg: "bg-gray-100 dark:bg-gray-800",
    href: "/health",
  },
  {
    id: "growth",
    title: "长期主义",
    subtitle: "规划 · 习惯 · 成长",
    icon: Trees,
    accent: "border-l-gray-500 dark:border-l-gray-400",
    accentBg: "bg-gray-100 dark:bg-gray-800",
    href: "/growth",
  },
];

function CenterCard({
  center,
  submodules,
  loading,
}: {
  center: (typeof CENTERS)[0];
  submodules: Submodule[];
  loading: boolean;
}) {
  const router = useRouter();

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(center.href)}
      className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden text-left hover:shadow-md transition-shadow min-h-[180px]"
    >
      {/* 左侧彩色装饰条 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 border-l-2 ${center.accent}`} />

      <div className="flex-1 p-5 md:p-6 flex flex-col">
        {/* 图标 */}
        <div
          className={`w-10 h-10 md:w-11 md:h-11 rounded-xl ${center.accentBg} flex items-center justify-center mb-4`}
        >
          <center.icon
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            strokeWidth={1.6}
          />
        </div>

        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-1">
          {center.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {center.subtitle}
        </p>

        {/* 子模块标签 */}
        {!loading && submodules.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {submodules.slice(0, 4).map((sm) => (
              <span
                key={sm.id}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                {sm.name}
              </span>
            ))}
            {submodules.length > 4 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500">
                +{submodules.length - 4}
              </span>
            )}
          </div>
        )}

        {/* 进入 */}
        <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
          <span>进入</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </div>
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
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            当前焦点
          </span>
        </div>
        <button
          onClick={onClearFocus}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          取消焦点
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-5 p-5 md:p-6">
        {/* 左侧：标题 + 倒计时 + 今日目标 */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {focus.title}
          </h2>

          {/* 倒计时 */}
          {focus.dueDate && (
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {countdownLabel}
              </span>
            </div>
          )}

          {/* 今日目标 */}
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
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
                className="text-gray-100 dark:text-gray-800"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-gray-900 dark:text-gray-100"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {progress}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center justify-center w-[72px] h-[72px] rounded-full bg-gray-100 dark:bg-gray-800">
            <Focus className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div className="flex border-t border-gray-100 dark:border-gray-800 divide-x divide-gray-100 dark:divide-gray-800">
        <button
          onClick={() => router.push("/focus")}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Timer className="w-4 h-4" strokeWidth={1.5} />
          <span>记录专注</span>
        </button>
        <button
          onClick={() => router.push(`/planner?goalId=${focus.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <ListChecks className="w-4 h-4" strokeWidth={1.5} />
          <span>查看计划</span>
        </button>
        <button
          onClick={() => router.push("/learning")}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 p-8 md:p-10 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Target className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        尚未设置焦点
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        选择一个目标作为当前焦点，追踪进度与倒计时
      </p>
      <button
        onClick={onSetFocus}
        className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
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
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] flex flex-col pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                选择焦点目标
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
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
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
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
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {goal.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
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

// ==================== 主页面 ====================

export default function OverviewPage() {
  const [focus, setFocus] = useState<Task | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 子模块数据
  const [learningSubs, setLearningSubs] = useState<Submodule[]>([]);
  const [healthSubs, setHealthSubs] = useState<Submodule[]>([]);
  const [growthSubs, setGrowthSubs] = useState<Submodule[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const loadFocus = useCallback(async () => {
    try {
      // Dexie 不支持 boolean 索引, 用 filter
      const all = await db.tasks.toArray();
      const focused = all.filter((t) => t.isFocus === true && t.status !== "archived");
      setFocus(focused[0] || null);
    } catch (err) {
      console.error("Failed to load focus:", err);
    } finally {
      setLoadingFocus(false);
    }
  }, []);

  const loadSubs = useCallback(async () => {
    try {
      await initializeSubmodules();
      const [l, h, g] = await Promise.all([
        getSubmodulesByParent("learning"),
        getSubmodulesByParent("health"),
        getSubmodulesByParent("growth"),
      ]);
      setLearningSubs(l);
      setHealthSubs(h);
      setGrowthSubs(g);
    } catch (err) {
      console.error("Failed to load submodules:", err);
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFocus();
    loadSubs();
  }, [loadFocus, loadSubs]);

  const handleClearFocus = async () => {
    if (focus?.id) {
      await db.tasks.update(focus.id, { isFocus: false });
      setFocus(null);
    }
  };

  const handleSelectFocus = (task: Task) => {
    setFocus(task);
  };

  const subMap: Record<string, Submodule[]> = {
    learning: learningSubs,
    health: healthSubs,
    growth: growthSubs,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-5 pt-6 pb-24 md:px-8 md:pt-10">
        {/* 头部 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            总览
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            聚焦当前目标，快速进入各中心
          </p>
        </div>

        {/* 焦点卡片 */}
        <div className="mb-8">
          {loadingFocus ? (
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : focus ? (
            <FocusCard focus={focus} onClearFocus={handleClearFocus} />
          ) : (
            <EmptyFocusCard onSetFocus={() => setPickerOpen(true)} />
          )}
        </div>

        {/* 中心入口 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            中心入口
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {CENTERS.map((center, i) => (
              <motion.div
                key={center.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <CenterCard
                  center={center}
                  submodules={subMap[center.id]}
                  loading={subsLoading}
                />
              </motion.div>
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
