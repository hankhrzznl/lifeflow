"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CalendarDays, FolderKanban, MoreHorizontal,
  Pencil, Plus, Target, Trash2, X,
} from "lucide-react";
import type { Goal, Priority, ProjectV2 } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/types";
import {
  createProjectV2, deleteProjectV2, getAllGoals, getAllProjectsV2, updateProjectV2,
} from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import ActionSheet from "@/components/ui/ActionSheet";
import Dialog from "@/components/ui/Dialog";
import OverviewHeader from "@/components/layout/OverviewHeader";
import QuickCaptureBar from "@/components/layout/QuickCaptureBar";
import CaptureInbox from "@/components/layout/CaptureInbox";
import CharacterFrame from "@/components/CharacterFrame";

// ==================== 常量与工具 ====================

// 与规划页一致的项目可选颜色
const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#5856D6"];

function getProjectColor(project: ProjectV2): string {
  return project.color || COLORS[0];
}

function getPriorityLabel(priority: Priority): string {
  const config = PRIORITY_CONFIG.find((p) => p.key === priority);
  return config?.label || "未设置";
}

function getPriorityColor(priority: Priority): string {
  const config = PRIORITY_CONFIG.find((p) => p.key === priority);
  return config ? `${config.bg} ${config.color}` : "bg-gray-100 dark:bg-gray-800 text-gray-600";
}

type ProjectFilter = "all" | "none" | number;

// ==================== 筛选 Chip ====================

function FilterChip({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${
        active
          ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

// ==================== 目标卡片 ====================

function GoalCard({
  goal, project, index, onClick,
}: {
  goal: Goal; project: ProjectV2 | undefined; index: number; onClick: () => void;
}) {
  // eslint-disable-next-line react-hooks/purity -- 渲染期取当前时间判断目标是否逾期,属预期的相对时间展示
  const overdue = !!goal.deadline && goal.deadline < Date.now() && goal.progress < 100;
  const projectColor = project ? getProjectColor(project) : undefined;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
          {goal.name}
        </span>
        {goal.priority && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${getPriorityColor(goal.priority)}`}>
            {getPriorityLabel(goal.priority)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {project ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: `${projectColor}1A`, color: projectColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: projectColor }} />
            {project.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            无项目
          </span>
        )}
        {goal.deadline && (
          <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
            <CalendarDays className="w-3 h-3" />
            截止 {new Date(goal.deadline).toLocaleDateString("zh-CN")}
            {overdue && "（已逾期）"}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">进度</span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{goal.progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${goal.progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full rounded-full bg-indigo-500"
          />
        </div>
      </div>
    </motion.button>
  );
}

// ==================== 项目新建/编辑弹窗 ====================

function ProjectFormModal({
  open, project, onClose, onSaved,
}: {
  open: boolean; project: ProjectV2 | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 弹窗打开时同步回填表单初值,受控表单重置的必要写法
    setName(project?.name ?? "");
    setColor(project?.color || COLORS[0]);
  }, [open, project]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (project?.id) {
        await updateProjectV2(project.id, { name: name.trim(), color });
        showToast({ message: "项目已更新", type: "success" });
      } else {
        await createProjectV2(name.trim(), color);
        showToast({ message: "项目已创建", type: "success" });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      showToast({ message: "保存失败", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {project ? "编辑项目" : "新建项目"}
              </h2>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">项目名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例：考研、健身、工作"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">项目颜色</label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-label={`选择颜色 ${c}`}
                      className={`w-8 h-8 rounded-full transition-all ${
                        color === c ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-900 scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                取消
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ==================== 主页面 ====================

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  // 目标筛选
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");

  // 项目管理
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectV2 | null>(null);
  const [sheetProject, setSheetProject] = useState<ProjectV2 | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectV2 | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [projectList, goalList] = await Promise.all([getAllProjectsV2(), getAllGoals()]);
      setProjects(projectList);
      setGoals(goalList);
    } catch (err) {
      console.error("Failed to load home data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 异步数据加载:从 Dexie 拉取首页数据是外部系统同步,effect 中触发属必要
  useEffect(() => { loadData(); }, [loadData]);

  const projectMap = useMemo(() => {
    const map = new Map<number, ProjectV2>();
    for (const p of projects) if (p.id != null) map.set(p.id, p);
    return map;
  }, [projects]);

  // 进行中的目标：默认按截止日期升序，无截止的排最后
  const activeGoals = useMemo(() => {
    return goals
      .filter((g) => g.status === "active")
      .sort((a, b) => {
        const da = a.deadline ?? Number.POSITIVE_INFINITY;
        const db = b.deadline ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [goals]);

  const filteredGoals = useMemo(() => {
    if (projectFilter === "all") return activeGoals;
    if (projectFilter === "none") return activeGoals.filter((g) => !g.projectId);
    return activeGoals.filter((g) => g.projectId === projectFilter);
  }, [activeGoals, projectFilter]);

  const noProjectCount = useMemo(() => activeGoals.filter((g) => !g.projectId).length, [activeGoals]);

  const goalCountOf = useCallback(
    (projectId: number) => goals.filter((g) => g.projectId === projectId).length,
    [goals]
  );

  const deleteTargetGoalCount = deleteTarget?.id != null ? goalCountOf(deleteTarget.id) : 0;

  const openCreateProject = () => {
    setEditingProject(null);
    setFormOpen(true);
  };

  const openEditProject = (project: ProjectV2) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget?.id == null) return;
    const id = deleteTarget.id;
    try {
      await deleteProjectV2(id);
      showToast({ message: "项目已删除，其下目标已变为无项目", type: "success" });
      if (projectFilter === id) setProjectFilter("all");
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast({ message: "删除失败", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <OverviewHeader />

        {/* 顶部快速捕捉栏（产品核心闭环） */}
        <div className="mt-6">
          <QuickCaptureBar inboxExpanded={inboxExpanded} onToggleInbox={() => setInboxExpanded((v) => !v)} />
          <CaptureInbox visible={inboxExpanded} />
        </div>

        {/* 人物框 */}
        <div className="mt-6">
          <CharacterFrame />
        </div>

        {/* ==================== 目标卡片区 ==================== */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">进行中的目标</h2>
              <span className="text-xs text-gray-400">{filteredGoals.length}</span>
            </div>
            <Link
              href="/planner"
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              去规划页
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 项目筛选条 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
            <FilterChip active={projectFilter === "all"} onClick={() => setProjectFilter("all")}>
              全部
              <span className="opacity-60">{activeGoals.length}</span>
            </FilterChip>
            {projects.map((p) => {
              const count = activeGoals.filter((g) => g.projectId === p.id).length;
              return (
                <FilterChip key={p.id} active={projectFilter === p.id} onClick={() => setProjectFilter(p.id!)}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getProjectColor(p) }} />
                  {p.name}
                  <span className="opacity-60">{count}</span>
                </FilterChip>
              );
            })}
            <FilterChip active={projectFilter === "none"} onClick={() => setProjectFilter("none")}>
              无项目
              <span className="opacity-60">{noProjectCount}</span>
            </FilterChip>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
            </div>
          ) : activeGoals.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
              <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-500 mb-1">暂无进行中的目标</p>
              <p className="text-xs text-gray-400 mb-4">去规划页创建你的第一个目标，开始推进吧</p>
              <Link
                href="/planner"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                去规划页新建目标
              </Link>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">该筛选条件下暂无目标</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGoals.map((goal, i) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  project={goal.projectId != null ? projectMap.get(goal.projectId) : undefined}
                  index={i}
                  onClick={() => router.push(`/goals/${goal.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ==================== 项目管理区 ==================== */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">项目管理</h2>
              <span className="text-xs text-gray-400">{projects.length}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={openCreateProject}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建项目
            </motion.button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
              <FolderKanban className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-gray-500 mb-1">暂无项目</p>
              <p className="text-xs text-gray-400">点击右上角「新建项目」，用项目给目标分组</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getProjectColor(p) }}
                  />
                  <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
                    {p.name}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{goalCountOf(p.id!)} 个目标</span>

                  {/* 桌面端：内联操作按钮 */}
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditProject(p)}
                      aria-label={`编辑项目 ${p.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      aria-label={`删除项目 ${p.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>

                  {/* 移动端：⋯ 打开 ActionSheet */}
                  <button
                    onClick={() => setSheetProject(p)}
                    aria-label={`项目 ${p.name} 更多操作`}
                    className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* 移动端项目操作 ActionSheet */}
        <ActionSheet
          open={sheetProject != null}
          onClose={() => setSheetProject(null)}
          title={sheetProject?.name}
          actions={sheetProject ? [
            {
              label: "编辑项目",
              icon: <Pencil className="w-4 h-4" />,
              onClick: () => openEditProject(sheetProject),
            },
            {
              label: "删除项目",
              icon: <Trash2 className="w-4 h-4" />,
              danger: true,
              onClick: () => setDeleteTarget(sheetProject),
            },
          ] : []}
        />

        {/* 删除项目确认框 */}
        <Dialog
          open={deleteTarget != null}
          onClose={() => setDeleteTarget(null)}
          type="confirm"
          variant="danger"
          title={deleteTarget ? `删除项目「${deleteTarget.name}」？` : "删除项目？"}
          description={
            deleteTargetGoalCount > 0
              ? `其下 ${deleteTargetGoalCount} 个目标将变为无项目，目标本身不会被删除。`
              : "该项目下暂无目标，删除后不可恢复。"
          }
          confirmLabel="删除"
          onConfirm={handleConfirmDelete}
        />

        {/* 新建/编辑项目弹窗 */}
        <ProjectFormModal
          open={formOpen}
          project={editingProject}
          onClose={() => setFormOpen(false)}
          onSaved={loadData}
        />
      </div>
    </div>
  );
}
