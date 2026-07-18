"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Minus, Plus, Sparkles, Check } from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type ScheduleTask } from "@/lib/db/efficiency.db";
import BottomSheet from "@/components/common/BottomSheet";
import { plannerBrain } from "@/lib/brains/planner";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计令牌
// ============================================================

const ACCENT = "#5865F2";
const NEW_COLORS = ["#5865F2", "#FF9500", "#34C759", "#E94057"];

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
        background: on ? ACCENT : "#E5E5E5",
        transition: "background 200ms",
      }}
    >
      <motion.span
        className="absolute bg-white rounded-full"
        style={{ top: 2, width: 27, height: 27, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
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
  const isEdit = Boolean(editId);

  const { addGoal, confirmBreakdown, loadGoals } = useEfficiencyStore();

  const [title, setTitle] = useState("");
  const [color, setColor] = useState(NEW_COLORS[0]);
  const [goalType, setGoalType] = useState<"count" | "habit">("count");
  const [targetCount, setTargetCount] = useState(5);
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

  // ─── 编辑模式：载入现有目标 ───
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    efficiencyDB.goals.get(editId).then((goal) => {
      if (cancelled) return;
      if (goal) {
        setTitle(goal.title);
        setColor(goal.color || NEW_COLORS[0]);
        setGoalType(goal.goalType || "count");
        setTargetCount(goal.targetCount || 5);
        setDeadline(goal.deadline || getDefaultDeadline());
        setNote(goal.note || "");
      } else {
        showToast({ type: "error", message: "目标不存在" });
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [editId]);

  const canSubmit = title.trim().length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        color,
        deadline,
        goalType,
        targetCount,
        note: note.trim(),
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
  }, [canSubmit, isEdit, editId, title, color, deadline, goalType, targetCount, note, useAI, addGoal, loadGoals, router]);

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ===== 页头 ===== */}
      <div className="bg-white border-b border-[#EAEAEA]">
        <div className="h-[44px] px-4 flex items-center justify-between relative max-w-[430px] mx-auto">
          <button
            type="button"
            onClick={() => router.push("/efficiency")}
            className="text-[17px] text-[#86868B]"
          >
            取消
          </button>
          <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#1D1D1F]">
            {isEdit ? "编辑目标" : "新建目标"}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="text-[17px] font-medium transition-opacity"
            style={{ color: canSubmit ? ACCENT : "#9F9FA0", opacity: saving ? 0.5 : 1 }}
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
          className="bg-white rounded-[8px] border border-[#EBEBEB] px-4 py-4"
        >
          <p className="text-[14px] text-[#86868B] mb-2">目标名称</p>
          <div
            className="h-12 rounded-[10px] bg-[#F5F5F7] px-4 flex items-center"
            style={focused ? { boxShadow: "0 0 0 1px #5865F2" } : undefined}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入目标名称"
              autoFocus={!isEdit}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="flex-1 bg-transparent outline-none text-[17px] text-[#1D1D1F] placeholder-[#9F9FA0]"
              style={{ caretColor: ACCENT }}
            />
          </div>
        </motion.div>

        {/* 卡片 2 · 项目标签 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-[8px] border border-[#EBEBEB] px-4 pt-4 pb-[18px]"
        >
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => showToast({ type: "info", message: "功能开发中" })}
          >
            <span className="text-[14px] text-[#86868B]">项目标签</span>
            <ChevronRight className="w-4 h-4 text-[#86868B]" />
          </div>
          {/* 色点行 + 横线 */}
          <div className="relative mt-[30px] flex items-center gap-4">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#EBEBEB]" />
            {NEW_COLORS.map((c) => {
              const selected = color === c;
              return (
                <motion.button
                  key={c}
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setColor(c)}
                  className="relative z-10 w-2 h-2 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: c,
                    boxShadow: selected
                      ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${c}`
                      : undefined,
                  }}
                >
                  {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* 卡片 3 · 目标类型 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[8px] border border-[#EBEBEB] px-4 pt-4 pb-4"
        >
          <p className="text-[14px] text-[#86868B] mb-4">目标类型</p>

          {/* 分段控件 */}
          <div className="h-10 w-full rounded-[10px] bg-[#F5F5F7] p-[2px] flex">
            {(["count", "habit"] as const).map((type) => {
              const active = goalType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGoalType(type)}
                  className="flex-1 rounded-[8px] text-[14px] transition-colors"
                  style={{
                    color: active ? ACCENT : "#86868B",
                    fontWeight: active ? 500 : 400,
                    background: active ? "#EEF0FF" : "transparent",
                  }}
                >
                  {type === "count" ? "次数目标" : "习惯目标"}
                </button>
              );
            })}
          </div>

          {/* 步进器行 */}
          <div className="flex items-center justify-between mt-5">
            <span className="text-[17px] text-[#1D1D1F]">
              完成 <span className="font-semibold">{targetCount}</span> 次
            </span>
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => setTargetCount((n) => Math.max(1, n - 1))}
                disabled={targetCount <= 1}
                className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center transition-opacity"
                style={{ opacity: targetCount <= 1 ? 0.4 : 1 }}
              >
                <Minus className="w-4 h-4 text-white" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => setTargetCount((n) => Math.min(999, n + 1))}
                className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center"
              >
                <Plus className="w-4 h-4 text-white" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* 卡片 4 · 截止日期 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-[8px] border border-[#EBEBEB] px-4 h-[76px] flex items-center justify-between relative"
        >
          <span className="text-[14px] text-[#86868B]">截止日期</span>
          <div className="flex items-center gap-1">
            <span className="text-[15px] text-[#1D1D1F]">{deadline}</span>
            <ChevronRight className="w-4 h-4 text-[#86868B]" />
          </div>
          <input
            type="date"
            value={deadline}
            onChange={(e) => e.target.value && setDeadline(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </motion.div>

        {/* 卡片 5 · 备注 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-[8px] border border-[#EBEBEB] px-4 pt-4 pb-4"
        >
          <p className="text-[14px] text-[#86868B] mb-2">备注</p>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注…"
            className="w-full rounded-[10px] bg-[#F5F5F7] px-4 py-3 text-[14px] text-[#1D1D1F] placeholder-[#9F9FA0] resize-none outline-none"
          />
        </motion.div>

        {/* 卡片 6 · 智能拆解（仅新建模式） */}
        {!isEdit && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-[8px] border border-[#EBEBEB] px-4 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#5865F2]" />
                <span className="text-[15px] font-medium text-[#1D1D1F]">智能拆解</span>
              </div>
              <Toggle on={useAI} onToggle={() => setUseAI((v) => !v)} />
            </div>
            <p className="text-[13px] text-[#86868B] mt-1">
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
            <Sparkles className="w-4 h-4 text-[#5865F2]" />
            <span className="text-sm font-medium text-[#5865F2]">{strategyInfo.label}</span>
            <span className="text-xs text-gray-400">置信度 {strategyInfo.confidence}%</span>
          </div>
        )}
        <div className="space-y-2 mb-4">
          {previewTasks.map((task, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <div
                className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                style={{ backgroundColor: task.isImportant ? "#FF9500" : "#5865F2" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {task.type === "multi_day" ? `${task.startDate} ~ ${task.endDate}` : task.date}
                  {task.plannedTime > 0 && ` · ${task.plannedTime}分钟`}
                </div>
                {task.note && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.note}</div>}
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
          className="w-full py-3 rounded-xl text-white font-medium text-sm bg-[#5865F2]"
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
