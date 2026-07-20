"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft, Check, Plus, CheckCircle2, TrendingUp,
  Circle, AlertTriangle,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type Goal, type ScheduleTask, type Project, getAllProjects } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌
// ============================================================
const ACCENT = "#6366F1";
const MUTED = "#86868B";
const BORDER = "#EBEBEB";
const STRONG = "#C7C7CC";
const GREEN = "#34C759";
const WARNING = "#FF9500";

// ============================================================
// 工具函数
// ============================================================
function calcProgress(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

// ============================================================
// 主组件
// ============================================================
export default function GoalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  const { goals, loadGoals, updateGoalStatus, toggleScheduleTask } = useEfficiencyStore();

  // 从 live query 获取目标
  const goal = useLiveQuery(() => efficiencyDB.goals.get(goalId), [goalId]);
  const allScheduleTasks = useLiveQuery(() => efficiencyDB.scheduleTasks.toArray(), []);
  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  // 目标颜色：从所属项目继承，无项目则为白色
  const goalColor = useMemo(() => {
    if (!goal) return ACCENT;
    const p = projects.find((p) => p.id === goal.projectId);
    return p?.color || "#FFFFFF";
  }, [goal, projects]);

  // 按 goalId 过滤任务
  const tasks = useMemo(() => {
    if (!allScheduleTasks) return [];
    return allScheduleTasks.filter((t) => t.goalId === goalId);
  }, [allScheduleTasks, goalId]);

  // 分组
  const normalTasks = useMemo(() => tasks.filter((t) => t.progressType !== "progress"), [tasks]);
  const progressTasks = useMemo(() => tasks.filter((t) => t.progressType === "progress"), [tasks]);

  // 完成统计
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.isCompleted).length;
    return { total, done };
  }, [tasks]);

  const allCompleted = taskStats.total > 0 && taskStats.done === taskStats.total;
  const goalProgress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  // 切换任务完成状态
  const handleToggleTask = useCallback(async (taskId: string) => {
    await toggleScheduleTask(taskId);
  }, [toggleScheduleTask]);

  // 完成目标
  const handleCompleteGoal = useCallback(async () => {
    if (!goal || !allCompleted) return;
    await updateGoalStatus(goalId, "completed");
    showToast({ type: "success", message: "目标已标记完成" });
    router.push("/efficiency");
  }, [goal, goalId, allCompleted, updateGoalStatus, router]);

  // 加载
  useEffect(() => { loadGoals(); }, [loadGoals]);

  if (!goal) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
        <div className="flex items-center h-14 px-4">
          <button onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
            <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
          </button>
        </div>
        <div className="flex flex-col items-center pt-20">
          <p className="text-[15px] text-[#86868B]">目标不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ maxWidth: 430, margin: "0 auto" }}>
      {/* ===== 导航栏 ===== */}
      <div className="flex items-center h-14 px-4">
        <button onClick={() => router.push("/efficiency")} className="w-8 h-8 -ml-1 flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-[#1D1D1F]" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">目标详情</span>
      </div>

      {/* ===== 目标卡片 ===== */}
      <div className="mx-4 mt-2 p-5 bg-white rounded-2xl border border-[#EBEBEB]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: goalColor }} />
          <h1 className="text-[20px] font-bold text-[#1D1D1F] truncate flex-1">{goal.title}</h1>
        </div>

        {/* 进度统计 */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[13px] text-[#86868B]">
              {taskStats.total > 0
                ? `${taskStats.done}/${taskStats.total} 项已完成`
                : "暂无任务"}
            </p>
          </div>
          <span className="text-[28px] font-bold text-[#1D1D1F] tabular-nums">{goalProgress}%</span>
        </div>

        {/* 进度条 */}
        <div className="mt-2 h-2 rounded-full bg-[#F5F5F5] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: goalColor }}
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* 剩余信息 */}
        {taskStats.total > 0 && !allCompleted && (
          <p className="mt-2 text-[13px] text-[#86868B]">
            还剩 {taskStats.total - taskStats.done} 项任务未完成
          </p>
        )}
        {allCompleted && taskStats.total > 0 && (
          <p className="mt-2 text-[13px] text-[#34C759]">所有任务已完成</p>
        )}

        {/* 备注 */}
        {goal.note && (
          <p className="mt-2 text-[13px] text-[#86868B]">{goal.note}</p>
        )}
      </div>

      {/* ===== 操作按钮区 ===== */}
      <div className="mx-4 mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => router.push(`/efficiency/goals/${goalId}/tasks/new`)}
          className="flex-1 h-11 rounded-xl bg-[#6366F1] text-white text-[15px] font-semibold flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          添加任务
        </button>
        <button
          type="button"
          onClick={handleCompleteGoal}
          disabled={!allCompleted}
          className="flex-1 h-11 rounded-xl border text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            borderColor: allCompleted ? GREEN : BORDER,
            color: allCompleted ? GREEN : MUTED,
            background: allCompleted ? "rgba(52,199,89,0.06)" : "transparent",
            cursor: allCompleted ? "pointer" : "default",
          }}
        >
          <CheckCircle2 className="w-4 h-4" />
          完成目标
        </button>
      </div>

      {/* ===== 普通任务列表 ===== */}
      {normalTasks.length > 0 && (
        <div className="mx-4 mt-6">
          <h2 className="text-[15px] font-semibold text-[#86868B] mb-2">普通任务</h2>
          <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
            {normalTasks.map((task, i) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task.id)}
                showDivider={i < normalTasks.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 进度条任务列表 ===== */}
      {progressTasks.length > 0 && (
        <div className="mx-4 mt-6">
          <h2 className="text-[15px] font-semibold text-[#86868B] mb-2">进度条任务</h2>
          <div className="flex flex-col gap-2">
            {progressTasks.map((task) => (
              <ProgressTaskCard
                key={task.id}
                task={task}
                onToggle={() => handleToggleTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 空态 ===== */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center pt-16">
          <div className="w-16 h-16 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-3">
            <Plus className="w-8 h-8 text-[#C7C7CC]" />
          </div>
          <p className="text-[15px] text-[#86868B]">还没有任务</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">点击「添加任务」开始吧</p>
        </div>
      )}

      {/* ===== 底部安全区 ===== */}
      <div className="h-10" />
    </div>
  );
}

// ============================================================
// 普通任务行
// ============================================================
function TaskRow({ task, onToggle, showDivider }: { task: ScheduleTask; onToggle: () => void; showDivider: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center gap-3 px-4 py-3 min-h-[52px]"
    >
      {showDivider && (
        <div className="absolute left-[52px] right-0 top-0" style={{ borderTop: "0.5px solid #EBEBEB" }} />
      )}
      {/* 勾选圆 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          border: task.isCompleted ? "none" : "2px solid #C7C7CC",
          background: task.isCompleted ? ACCENT : "#FFFFFF",
        }}
      >
        {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
      </button>
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className="text-[17px] truncate"
            style={{
              color: task.isCompleted ? "#AEAEB2" : "#1D1D1F",
              textDecoration: task.isCompleted ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.isImportant && !task.isCompleted && (
            <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-[#6366F1]" />
          )}
        </div>
        {task.note && (
          <p className="text-[13px] text-[#86868B] truncate mt-0.5">{task.note}</p>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================
// 进度条任务卡片
// ============================================================
function ProgressTaskCard({ task, onToggle }: { task: ScheduleTask; onToggle: () => void }) {
  const current = task.progressCurrent ?? task.startValue ?? 0;
  const target = task.targetValue ?? 100;
  const pct = calcProgress(current, target);
  const unit = task.targetUnit || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-[#EBEBEB] p-4"
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
          style={{
            border: task.isCompleted ? "none" : "2px solid #C7C7CC",
            background: task.isCompleted ? ACCENT : "#FFFFFF",
          }}
        >
          {task.isCompleted && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />}
        </button>
        <span
          className="text-[17px] font-medium truncate flex-1"
          style={{
            color: task.isCompleted ? "#AEAEB2" : "#1D1D1F",
            textDecoration: task.isCompleted ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
        {/* 状态点 */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: task.isCompleted ? GREEN : pct >= 100 ? GREEN : ACCENT }}
        />
      </div>

      {/* 进度信息 */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[13px] text-[#86868B]">
          {current} / {target} {unit}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: ACCENT }}>
          {pct}%
        </span>
      </div>

      {/* 进度条 */}
      <div className="mt-1.5 h-1.5 rounded-full bg-[#F5F5F5] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: task.isCompleted ? GREEN : ACCENT }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* 备注 */}
      {task.note && (
        <p className="mt-1.5 text-[13px] text-[#86868B] truncate">{task.note}</p>
      )}
    </motion.div>
  );
}
