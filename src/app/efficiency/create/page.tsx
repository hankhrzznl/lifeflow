"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles, Calendar } from "lucide-react";
import { useEfficiencyStore } from "@/lib/store/efficiencyStore";
import { efficiencyDB, type ScheduleTask } from "@/lib/db/efficiency.db";
import BottomSheet from "@/components/common/BottomSheet";
import { plannerBrain } from "@/lib/brains/planner";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 设计稿基准: lifeflow-goals/pages/create-goal.html
// 白底 / X关闭 + 居中Tab / 28pt大标题 / 56pt输入卡 / 50pt继续按钮
// ============================================================

const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Segoe UI',sans-serif";
const BRAND = "#5856D6";
const MUTED = "#8E8E93";
const BORDER = "#E5E5EA";
const STRONG = "#C7C7CC";

const COLORS = ["#5856D6", "#34C759", "#FF9500", "#007AFF", "#FF2D55", "#AF52DE"];

function getDefaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CreateGoalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = Boolean(editId);

  const { addGoal, confirmBreakdown, loadGoals } = useEfficiencyStore();

  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  const [paletteOpen, setPaletteOpen] = useState(false);
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
        setColor(goal.color || COLORS[0]);
        setDeadline(goal.deadline || getDefaultDeadline());
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
      if (isEdit && editId) {
        await efficiencyDB.goals.update(editId, {
          title: title.trim(),
          color,
          deadline,
        });
        await loadGoals();
        showToast({ type: "success", message: "已保存" });
        router.push("/efficiency");
      } else if (useAI) {
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
      showToast({ type: "error", message: "保存失败" });
    }
  }, [canSubmit, isEdit, editId, title, color, deadline, useAI, addGoal, loadGoals, router]);

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT }}>
      {/* ===== Top Bar（设计稿: X + 创建目标/模板 Tab） ===== */}
      <div className="relative flex items-center justify-center px-[16pt] mt-[24pt]" style={{ height: "28pt" }}>
        <button
          type="button"
          onClick={() => router.push("/efficiency")}
          aria-label="关闭"
          className="absolute left-[16pt] w-[24pt] h-[24pt] flex items-center justify-center"
        >
          <X className="w-[24pt] h-[24pt]" style={{ color: BRAND }} strokeWidth={2.5} />
        </button>
        <div className="flex gap-[24pt]">
          <span className="relative text-[15pt] font-semibold leading-[20pt]" style={{ color: BRAND }}>
            {isEdit ? "编辑目标" : "创建目标"}
            <span
              className="absolute left-0 right-0"
              style={{ bottom: "-4pt", height: "2pt", background: BRAND, borderRadius: "1pt" }}
            />
          </span>
          <button
            type="button"
            onClick={() => showToast({ type: "info", message: "目标模板开发中" })}
            className="text-[15pt] leading-[20pt]"
            style={{ color: MUTED }}
          >
            模板
          </button>
        </div>
      </div>

      {/* ===== Content ===== */}
      <div className="px-[16pt]" style={{ paddingTop: "64pt" }}>
        <h1 className="text-[28pt] font-bold leading-[34pt] tracking-[0.36pt] text-black m-0">
          {isEdit ? "修改你的目标" : "你想达成什么目标？"}
        </h1>

        {/* 输入卡（设计稿: 56pt / 色点 40pt / 聚焦品牌色边框） */}
        <div
          className="flex items-center bg-white rounded-[12pt] px-[16pt] transition-colors"
          style={{
            marginTop: "24pt",
            height: "56pt",
            border: `1pt solid ${paletteOpen ? BRAND : BORDER}`,
          }}
        >
          <button
            type="button"
            aria-label="选择颜色"
            onClick={() => setPaletteOpen((p) => !p)}
            className="shrink-0 mr-[12pt] flex items-center justify-center transition-transform active:scale-90"
            style={{ width: "40pt", height: "40pt", borderRadius: "50%", background: color }}
          >
            {paletteOpen && <Check className="w-[18pt] h-[18pt]" style={{ color: "#FFF" }} strokeWidth={3} />}
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="目标名称"
            autoFocus={!isEdit}
            className="flex-1 min-w-0 border-none outline-none text-[17pt] text-black bg-transparent placeholder:text-[#8E8E93]"
            style={{ caretColor: BRAND }}
            onFocus={(e) => {
              e.currentTarget.parentElement!.style.borderColor = BRAND;
            }}
            onBlur={(e) => {
              if (!paletteOpen) e.currentTarget.parentElement!.style.borderColor = BORDER;
            }}
          />
        </div>

        {/* 颜色面板（点色点展开） */}
        <AnimatePresence initial={false}>
          {paletteOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="flex gap-[12pt] pt-[16pt] px-[4pt]">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => {
                      setColor(c);
                      setPaletteOpen(false);
                    }}
                    className="relative flex items-center justify-center transition-transform active:scale-90"
                    style={{
                      width: "32pt",
                      height: "32pt",
                      borderRadius: "50%",
                      background: c,
                      boxShadow: color === c ? `0 0 0 2pt #FFF, 0 0 0 3.5pt ${c}` : undefined,
                    }}
                  >
                    {color === c && <Check className="w-[14pt] h-[14pt]" style={{ color: "#FFF" }} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 截止日期（同一卡片语言） */}
        <div
          className="relative flex items-center bg-white rounded-[12pt] px-[16pt] mt-[12pt]"
          style={{ height: "56pt", border: `1pt solid ${BORDER}` }}
        >
          <Calendar className="w-[20pt] h-[20pt] shrink-0 mr-[12pt]" style={{ color: "#FF6B6B" }} />
          <span className="text-[17pt] text-black">截止日期</span>
          <span className="flex-1 text-right text-[15pt]" style={{ color: MUTED }}>
            {deadline.replace(/-/g, "/")}
          </span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => e.target.value && setDeadline(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>

        {/* 智能拆解（编辑模式隐藏） */}
        {!isEdit && (
          <div
            className="bg-white rounded-[12pt] px-[16pt] pt-[16pt] pb-[12pt] mt-[12pt]"
            style={{ border: `1pt solid ${BORDER}` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[8pt]">
                <Sparkles className="w-[20pt] h-[20pt]" style={{ color: BRAND }} />
                <span className="text-[17pt] text-black">智能拆解</span>
              </div>
              <button
                type="button"
                onClick={() => setUseAI(!useAI)}
                className="shrink-0 relative"
                style={{
                  width: "51pt",
                  height: "31pt",
                  borderRadius: "15.5pt",
                  background: useAI ? "#34C759" : BORDER,
                  transition: "background 200ms",
                }}
              >
                <motion.span
                  className="absolute bg-white rounded-full"
                  style={{ top: "2pt", width: "27pt", height: "27pt", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
                  animate={{ left: useAI ? "22pt" : "2pt" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <div className="mt-[4pt]">
              <span className="text-[13pt] leading-[18pt]" style={{ color: MUTED }}>
                开启后自动将目标拆解为多阶段任务
              </span>
            </div>
          </div>
        )}

        {/* 继续按钮（设计稿: 50pt / 灰色禁用 → 品牌色可用） */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit}
          className="w-full rounded-[12pt] text-[17pt] font-medium transition-colors"
          style={{
            marginTop: "32pt",
            height: "50pt",
            background: canSubmit ? BRAND : BORDER,
            color: canSubmit ? "#FFFFFF" : STRONG,
          }}
        >
          {saving ? "保存中…" : isEdit ? "保存" : "继续"}
        </button>
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
            <Sparkles className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-sm font-medium" style={{ color: BRAND }}>{strategyInfo.label}</span>
            <span className="text-xs text-gray-400">置信度 {strategyInfo.confidence}%</span>
          </div>
        )}
        <div className="space-y-2 mb-4">
          {previewTasks.map((task, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
              <div
                className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                style={{ backgroundColor: task.isImportant ? "#FF9500" : BRAND }}
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
          className="w-full py-3 rounded-xl text-white font-medium text-sm"
          style={{ backgroundColor: BRAND }}
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
