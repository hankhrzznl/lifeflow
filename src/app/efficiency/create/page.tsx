"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Minus, Plus, Sparkles } from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { useLiveQuery } from "dexie-react-hooks";
import { efficiencyDB, getAllProjects, type ScheduleTask, type Project } from "@/lib/db/efficiency.db";
import BottomSheet from "@/components/common/BottomSheet";
import { plannerBrain } from "@/lib/brains/planner";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌
// ============================================================

function getDefaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// iOS Switch
// ============================================================

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="shrink-0 relative"
      style={{
        width: 51,
        height: 31,
        borderRadius: 15.5,
        background: on ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
        transition: "background 200ms",
      }}
    >
      <motion.span
        className="absolute rounded-full"
        style={{
          top: 2,
          width: 27,
          height: 27,
          backgroundColor: "var(--color-text-inverse)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
        animate={{ left: on ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ============================================================
// 主组件
// ============================================================

function CreateGoalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const incomingProjectId = searchParams.get("projectId");
  const isEdit = Boolean(editId);

  const { addGoal, confirmBreakdown, loadGoals } = useEfficiencyStore();

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(incomingProjectId || "");
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [focused, setFocused] = useState(false);

  const [useAI, setUseAI] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<Omit<ScheduleTask, "id" | "createdAt">[]>([]);
  const [previewGoalId, setPreviewGoalId] = useState("");
  const [strategyInfo, setStrategyInfo] = useState<{ label: string; confidence: number } | null>(null);

  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  // ─── 编辑模式：载入现有目标 ───
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    efficiencyDB.goals.get(editId).then((goal) => {
      if (cancelled) return;
      if (goal) {
        setTitle(goal.title);
        setDeadline(goal.deadline || getDefaultDeadline());
        setNote(goal.note || "");
        if (goal.projectId) {
          setProjectId(goal.projectId);
        }
      } else {
        showToast({ type: "error", message: "目标不存在" });
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [editId]);

  // ─── 新建模式：默认选中「无项目」 ───
  useEffect(() => {
    if (isEdit || incomingProjectId) return;
    if (projects.length > 0 && !projectId) {
      const none = projects.find((p) => p.name === "无项目");
      if (none) setProjectId(none.id);
    }
  }, [isEdit, incomingProjectId, projects, projectId]);

  const canSubmit = title.trim().length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        deadline,
        goalType: "task" as const,
        note: note.trim(),
        projectId: projectId || undefined,
      };

      if (isEdit && editId) {
        await efficiencyDB.goals.update(editId, data);
        await loadGoals();
        showToast({ type: "success", message: "已保存" });
        router.push("/efficiency");
      } else if (useAI) {
        const goalId = await addGoal({ ...data, status: "active" });
        const strategy = plannerBrain.analyze(title.trim());
        const tasks = plannerBrain.generateTasks(strategy, goalId);
        setPreviewTasks(tasks);
        setPreviewGoalId(goalId);
        setStrategyInfo({ label: strategy.label, confidence: strategy.confidence });
        setPreviewOpen(true);
        setSaving(false);
      } else {
        await addGoal({ ...data, status: "active" });
        router.push("/efficiency");
      }
    } catch {
      setSaving(false);
      showToast({ type: "error", message: "保存失败" });
    }
  }, [canSubmit, isEdit, editId, title, deadline, note, projectId, useAI, addGoal, loadGoals, router]);

  if (!loaded) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--lifeflow-background)" }}>
      {/* ===== 页头 ===== */}
      <div style={{ backgroundColor: "var(--color-surface-card)", borderBottom: "1px solid var(--lifeflow-border)" }}>
        <div className="h-[44px] px-4 flex items-center justify-between relative max-w-[430px] mx-auto">
          <button
            type="button"
            onClick={() => router.push("/efficiency")}
            className="text-[17px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            取消
          </button>
          <span
            className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {isEdit ? "编辑目标" : "新建目标"}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="text-[17px] font-medium transition-opacity"
            style={{
              color: canSubmit ? "var(--lifeflow-primary)" : "var(--color-text-disabled)",
              opacity: saving ? 0.5 : 1,
            }}
          >
            保存
          </button>
        </div>
      </div>

      {/* ===== 卡片组 ===== */}
      <div className="max-w-[430px] mx-auto px-4 pt-6 flex flex-col gap-6">
        {/* 卡片 1 · 目标名称 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[8px] px-4 py-4"
          style={{
            backgroundColor: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <p className="text-[14px] mb-2" style={{ color: "var(--color-text-secondary)" }}>目标名称</p>
          <div
            className="h-12 rounded-[10px] px-4 flex items-center"
            style={{
              backgroundColor: "var(--lifeflow-muted)",
              ...(focused ? { boxShadow: "0 0 0 1px var(--lifeflow-primary)" } : {}),
            }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入目标名称"
              autoFocus={!isEdit}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent outline-none text-[17px] placeholder-[var(--color-text-disabled)]"
              style={{ color: "var(--color-text-primary)", caretColor: "var(--lifeflow-primary)" }}
            />
          </div>
        </motion.div>

        {/* 卡片 2 · 所属项目 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[8px] px-4 py-4"
          style={{
            backgroundColor: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <p className="text-[14px] mb-2" style={{ color: "var(--color-text-secondary)" }}>所属项目</p>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full outline-none text-[15px]"
            style={{
              color: "var(--color-text-primary)",
              backgroundColor: "var(--lifeflow-muted)",
              borderRadius: "8px",
              height: "40px",
              padding: "0 12px",
            }}
          >
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </motion.div>

        {/* 卡片 3 · 截止日期 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[8px] px-4 h-[76px] flex items-center justify-between relative"
          style={{
            backgroundColor: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <span className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>截止日期</span>
          <div className="flex items-center gap-1">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{deadline}</span>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
          </div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => e.target.value && setDeadline(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </motion.div>

        {/* 卡片 4 · 备注 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-[8px] px-4 pt-4 pb-4"
          style={{
            backgroundColor: "var(--color-surface-card)",
            border: "1px solid var(--lifeflow-border)",
          }}
        >
          <p className="text-[14px] mb-2" style={{ color: "var(--color-text-secondary)" }}>备注</p>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注…"
            className="w-full rounded-[10px] px-4 py-3 text-[14px] placeholder-[var(--color-text-disabled)] resize-none outline-none"
            style={{
              color: "var(--color-text-primary)",
              backgroundColor: "var(--lifeflow-muted)",
            }}
          />
        </motion.div>

        {/* 卡片 5 · 智能拆解（仅新建模式） */}
        {!isEdit && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-[8px] px-4 py-4"
            style={{
              backgroundColor: "var(--color-surface-card)",
              border: "1px solid var(--lifeflow-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
                <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>智能拆解</span>
              </div>
              <Toggle on={useAI} onToggle={() => setUseAI((v) => !v)} />
            </div>
            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
              开启后自动将目标拆解为多阶段任务
            </p>
          </motion.div>
        )}
      </div>

      {/* ===== 智能拆解预览 ===== */}
      <BottomSheet
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          router.push("/efficiency");
        }}
        title="智能拆解预览"
      >
        {strategyInfo && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <Sparkles className="w-4 h-4" style={{ color: "var(--lifeflow-primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--lifeflow-primary)" }}>{strategyInfo.label}</span>
            <span className="text-xs" style={{ color: "var(--color-text-disabled)" }}>置信度 {strategyInfo.confidence}%</span>
          </div>
        )}
        <div className="space-y-2 mb-4">
          {previewTasks.map((task, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--lifeflow-muted)" }}>
              <div
                className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                style={{ backgroundColor: task.isImportant ? "var(--state-warning)" : "var(--lifeflow-primary)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{task.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-disabled)" }}>
                  {task.type === "multi_day" ? `${task.startDate} ~ ${task.endDate}` : task.date}
                  {task.plannedTime > 0 && ` · ${task.plannedTime}分钟`}
                </div>
                {task.note && (
                  <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--color-text-secondary)" }}>{task.note}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={async () => {
            await confirmBreakdown(previewGoalId, previewTasks);
            setPreviewOpen(false);
            router.push("/efficiency");
          }}
          className="w-full py-3 rounded-xl text-white font-medium text-sm"
          style={{ backgroundColor: "var(--lifeflow-primary)" }}
        >
          确认并保存 ({previewTasks.length} 个任务)
        </button>
      </BottomSheet>
    </div>
  );
}

export default function CreateGoalPage() {
  return (
    <Suspense fallback={null}>
      <CreateGoalInner />
    </Suspense>
  );
}
