"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Circle, AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getProjectV2, getBoard, getSection, updateTask, getTasksBySection } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Task, Section, ProjectV2, Board } from "@/lib/types";

const PRIORITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function SectionTaskListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.projectId);
  const boardId = Number(params.boardId);
  const sectionId = Number(params.sectionId);

  const [project, setProject] = useState<ProjectV2 | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [p, b, s, t] = await Promise.all([
        getProjectV2(projectId),
        getBoard(boardId),
        getSection(sectionId),
        getTasksBySection(sectionId),
      ]);
      if (!p) {
        setError("项目不存在");
        return;
      }
      if (!b) {
        setError("面板不存在");
        return;
      }
      if (!s) {
        setError("分区不存在");
        return;
      }
      setProject(p);
      setBoard(b);
      setSection(s);
      setTasks(t);
    } catch {
      setError("加载任务列表失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, boardId, sectionId]);

  useEffect(() => {
    const load = async () => { await loadData(); };
    load();
  }, [loadData]);

  async function handleToggleStatus(task: Task) {
    if (!task.id) return;
    const newStatus: Task["status"] = task.status === "done" ? "active" : "done";
    try {
      await updateTask(task.id, { status: newStatus });
      await loadData();
    } catch {
      showToast({ message: "更新任务状态失败", type: "error", duration: 3000 });
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/projects/${projectId}/boards/${boardId}`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="skeleton w-4 h-4 rounded" />
              <div className="skeleton h-4 w-48" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-5 h-5 rounded-full" />
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-5 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !project || !board || !section) {
    return (
      <div className="flex flex-col h-full max-h-screen">
        <header className="flex-shrink-0 flex items-center px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
          <button onClick={() => router.push(`/projects/${projectId}/boards/${boardId}`)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
          <h1 className="ml-2 text-lg font-semibold text-[var(--foreground)]">任务</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-14 h-14 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-danger-500" />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">{error || "数据不存在"}</p>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status === "active");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col h-full max-h-screen">
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/projects/${projectId}/boards/${boardId}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--muted-foreground)]" />
          </button>
          <div className="flex items-center gap-2 min-w-0 text-xs text-[var(--muted-foreground)]">
            <Link href={`/projects/${projectId}`} className="hover:text-[var(--foreground)] transition-colors flex-shrink-0">
              项目
            </Link>
            <span className="flex-shrink-0">/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-[var(--foreground)] transition-colors truncate">
              {project.name}
            </Link>
            <span className="flex-shrink-0">/</span>
            <Link href={`/projects/${projectId}/boards/${boardId}`} className="hover:text-[var(--foreground)] transition-colors truncate">
              {board.name}
            </Link>
            <span className="flex-shrink-0">/</span>
            <span className="text-[var(--foreground)] font-medium truncate">
              {section.name}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center mb-5">
              <Circle className="w-10 h-10 text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
              此模块暂无任务
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
              在此分区中添加任务来开始工作
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-1">
                  待处理 ({activeTasks.length})
                </p>
                {activeTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-primary-200 transition-colors"
                  >
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <Circle className="w-5 h-5 text-[var(--muted-foreground)] hover:text-primary-500 transition-colors" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/today?date=${new Date().toISOString().split("T")[0]}`}
                        className="text-sm font-medium text-[var(--foreground)] truncate block hover:text-primary-500 transition-colors"
                      >
                        {task.title}
                      </Link>
                      {task.note && (
                        <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                          {task.note}
                        </p>
                      )}
                    </div>
                    {task.priority && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_COLORS[task.priority] || ""}`}>
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {doneTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide px-1">
                  已完成 ({doneTasks.length})
                </p>
                {doneTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] opacity-60"
                  >
                    <button
                      onClick={() => handleToggleStatus(task)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/today?date=${new Date().toISOString().split("T")[0]}`}
                        className="text-sm font-medium text-[var(--muted-foreground)] truncate line-through block hover:text-primary-500 transition-colors"
                      >
                        {task.title}
                      </Link>
                    </div>
                    {task.priority && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 opacity-50 ${PRIORITY_COLORS[task.priority] || ""}`}>
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
