"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import type { ScheduleTask } from "@/lib/db/efficiency.db";
import BottomSheet from "@/components/common/BottomSheet";
import { plannerBrain } from "@/lib/brains/planner";

const COLORS = ["#5856D6", "#34C759", "#FF9500", "#007AFF", "#FF2D55", "#AF52DE"];

function getDefaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export default function CreateGoalPage() {
  const router = useRouter();
  const { addGoal, confirmBreakdown } = useEfficiencyStore();

  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  const [saving, setSaving] = useState(false);

  const [useAI, setUseAI] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<Omit<ScheduleTask, 'id' | 'createdAt'>[]>([]);
  const [previewGoalId, setPreviewGoalId] = useState('');
  const [strategyInfo, setStrategyInfo] = useState<{ label: string; confidence: number } | null>(null);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (useAI) {
        const goalId = await addGoal({ title: title.trim(), color, deadline, status: "active" });
        const strategy = plannerBrain.analyze(title.trim());
        const tasks = plannerBrain.generateTasks(strategy, goalId);
        setPreviewTasks(tasks);
        setPreviewGoalId(goalId);
        setStrategyInfo({ label: strategy.label, confidence: strategy.confidence });
        setPreviewOpen(true);
        setSaving(false);
      } else {
        await addGoal({ title: title.trim(), color, deadline, status: "active" });
        router.push("/efficiency");
      }
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-black/5">
        <div className="flex items-center h-12 px-4">
          <button
            onClick={() => router.push("/efficiency")}
            className="flex items-center gap-1 pr-3 -ml-1"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: "#5856D6" }} />
          </button>
          <h1 className="text-base font-semibold" style={{ color: "#5856D6" }}>
            创建目标
          </h1>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm p-5 mx-5 mt-4"
        >
          {/* 目标名称 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目标名称
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入目标名称"
              className="w-full bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
            />
          </div>

          {/* 颜色选择 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              颜色选择
            </label>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                  }}
                >
                  {color === c && (
                    <Check className="w-5 h-5 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 截止日期 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              截止日期
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
            />
          </div>

          {/* 智能拆解 */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: "#5856D6" }} />
                <label className="text-sm font-medium text-gray-700">智能拆解</label>
              </div>
              <button
                onClick={() => setUseAI(!useAI)}
                className={`relative w-12 h-7 rounded-full transition-colors ${useAI ? 'bg-indigo-500' : 'bg-gray-300'}`}
              >
                <motion.div className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
                  animate={{ left: useAI ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              开启后自动将目标拆解为多阶段任务
            </p>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="mx-5 mt-6">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="w-full py-3 rounded-xl text-white font-medium text-sm transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#5856D6" }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            onClick={() => router.push("/efficiency")}
            className="w-full py-3 mt-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            取消
          </button>
        </div>
      </div>

      {/* 智能拆解预览 */}
      <BottomSheet open={previewOpen} onClose={() => { setPreviewOpen(false); router.push("/efficiency"); }} title="智能拆解预览">
        {strategyInfo && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <Sparkles className="w-4 h-4" style={{ color: "#5856D6" }} />
            <span className="text-sm font-medium" style={{ color: "#5856D6" }}>{strategyInfo.label}</span>
            <span className="text-xs text-gray-400">置信度 {strategyInfo.confidence}%</span>
          </div>
        )}
        <div className="space-y-2 mb-4">
          {previewTasks.map((task, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: task.isImportant ? "#FF9500" : "#5856D6" }} />
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
          className="w-full py-3 rounded-xl text-white font-medium text-sm"
          style={{ backgroundColor: "#5856D6" }}
        >
          确认并保存 ({previewTasks.length} 个任务)
        </button>
      </BottomSheet>
    </div>
  );
}
