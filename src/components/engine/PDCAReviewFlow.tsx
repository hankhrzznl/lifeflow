"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Check, Lightbulb, AlertTriangle, Rocket,
  Download, Save, Plus, X, Sparkles, Target, Clock, TrendingUp,
  Calendar, ArrowRight,
} from "lucide-react";
import { reviewDataService } from "@/lib/engine/ReviewDataService";
import { snapshotService } from "@/lib/engine/SnapshotService";
import { goalService } from "@/lib/engine/GoalService";
import { weeklyTaskService } from "@/lib/engine/WeeklyTaskService";
import type { ReviewData } from "@/lib/engine/ReviewDataService";
import type { EngineGoal, EngineGoalCategory } from "@/lib/engine/types";

// ============================================================
// 类型
// ============================================================

interface Highlight {
  text: string;
  goalId?: string;
}
interface Problem {
  text: string;
  tag: string;
  severity: "low" | "medium" | "high";
}
interface Improvement {
  text: string;
  convertToTask: boolean;
}

// ============================================================
// Step 配置
// ============================================================

const STEPS = [
  { num: 1, title: "执行概况", pdca: "Plan/Do" },
  { num: 2, title: "亮点记录", pdca: "Do" },
  { num: 3, title: "问题分析", pdca: "Check" },
  { num: 4, title: "改进计划", pdca: "Act" },
  { num: 5, title: "生成报告", pdca: "PDCA" },
  { num: 6, title: "应用调整", pdca: "Act" },
];

const PROBLEM_TAGS = [
  "时间管理", "精力不足", "外部干扰", "目标不清晰", "执行困难", "其他",
];
const PROBLEM_SEVERITY = [
  { value: "low" as const, label: "轻微", color: "bg-amber-200 text-amber-700" },
  { value: "medium" as const, label: "中等", color: "bg-orange-200 text-orange-700" },
  { value: "high" as const, label: "严重", color: "bg-red-200 text-red-700" },
];

const SMART_RECOMMENDATIONS: Record<string, string[]> = {
  "时间管理": ["尝试番茄工作法（25分钟专注+5分钟休息）", "提前一晚规划次日待办", "减少无效会议和社交"],
  "精力不足": ["调整作息，保证7-8小时睡眠", "减少晚间屏幕使用", "增加午休时间"],
  "外部干扰": ["设置免打扰模式", "与家人/同事约定专注时段", "整理工作环境"],
  "目标不清晰": ["重新审视目标优先级", "拆解为更小的可执行任务", "明确每周交付物"],
  "执行困难": ["降低每日任务量，从50%开始", "找一个监督伙伴", "奖励机制"],
  "其他": ["记录更多数据以发现模式", "尝试不同的时间安排"],
};

// ============================================================
// 组件
// ============================================================

interface PDCAReviewFlowProps {
  weekStart: string;
  weekEnd: string;
  onComplete: () => void;
  onExit: () => void;
}

export default function PDCAReviewFlow({
  weekStart, weekEnd, onComplete, onExit,
}: PDCAReviewFlowProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 2-4 用户输入
  const [highlights, setHighlights] = useState<Highlight[]>([{ text: "" }, { text: "" }, { text: "" }]);
  const [problems, setProblems] = useState<Problem[]>([{ text: "", tag: "", severity: "medium" as const }]);
  const [improvements, setImprovements] = useState<Improvement[]>([{ text: "", convertToTask: false }]);

  // 保存状态
  const [saving, setSaving] = useState(false);

  // 加载数据
  useEffect(() => {
    reviewDataService.loadWeeklyReviewData(weekStart).then((d) => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [weekStart]);

  // 保存复盘报告
  const handleSaveReport = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    try {
      const report = {
        weekRange: data.weekRange,
        completion: data.completion,
        highlights: highlights.filter((h) => h.text.trim()),
        problems: problems.filter((p) => p.text.trim()),
        improvements: improvements.filter((i) => i.text.trim()),
        goalProgress: data.goalProgress,
        insights: data.insights,
      };

      // 保存到 progressSnapshots
      await snapshotService.createWeeklySnapshot();
      onComplete();
    } catch (err) {
      console.error("[PDCA] 保存失败:", err);
    } finally {
      setSaving(false);
    }
  }, [data, highlights, problems, improvements, onComplete]);

  const canNext = useMemo(() => {
    if (step === 2) return highlights.some((h) => h.text.trim().length > 0);
    if (step === 3) return problems.some((p) => p.text.trim().length > 0);
    if (step === 4) return improvements.some((i) => i.text.trim().length > 0);
    return true;
  }, [step, highlights, problems, improvements]);

  if (loading) {
    return <div className="p-8 text-center"><div className="skeleton h-8 w-48 mx-auto rounded" /><p className="text-sm text-gray-400 mt-2">正在加载复盘数据...</p></div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-gray-500">数据加载失败</div>;
  }

  return (
    <div className="space-y-5">
      {/* 步骤进度条 */}
      <div className="flex items-center gap-1">
        {STEPS.map((s) => (
          <div key={s.num} className="flex items-center gap-1 flex-1">
            <div className={`flex-1 h-1 rounded-full ${s.num <= step ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"}`} />
            {s.num < 6 && <div className="w-1" />}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        {STEPS.map((s) => (
          <span key={s.num} className={s.num <= step ? "font-semibold text-indigo-600" : ""}>
            {s.title}
          </span>
        ))}
      </div>

      {/* ── Step 1: 执行概况 ── */}
      {step === 1 && <Step1Execution data={data} onNext={() => setStep(2)} />}

      {/* ── Step 2: 亮点记录 ── */}
      {step === 2 && (
        <Step2Highlights
          highlights={highlights}
          setHighlights={setHighlights}
          goals={data.goals}
          completedTitles={data.completedTitles}
          onPrev={() => setStep(1)}
          onNext={() => setStep(3)}
          canNext={canNext}
        />
      )}

      {/* ── Step 3: 问题分析 ── */}
      {step === 3 && (
        <Step3Problems
          problems={problems}
          setProblems={setProblems}
          data={data}
          onPrev={() => setStep(2)}
          onNext={() => setStep(4)}
          canNext={canNext}
        />
      )}

      {/* ── Step 4: 改进计划 ── */}
      {step === 4 && (
        <Step4Improvements
          improvements={improvements}
          setImprovements={setImprovements}
          problems={problems}
          onPrev={() => setStep(3)}
          onNext={() => setStep(5)}
          canNext={canNext}
        />
      )}

      {/* ── Step 5: 复盘报告 ── */}
      {step === 5 && (
        <Step5Report
          data={data}
          highlights={highlights}
          problems={problems}
          improvements={improvements}
          onSave={handleSaveReport}
          saving={saving}
          onPrev={() => setStep(4)}
          onNext={() => setStep(6)}
        />
      )}

      {/* ── Step 6: 应用调整 ── */}
      {step === 6 && (
        <Step6Apply
          improvements={improvements}
          weekStart={weekStart}
          onPrev={() => setStep(5)}
          onComplete={onExit}
        />
      )}
    </div>
  );
}

// ============================================================
// Step 1: 执行概况
// ============================================================

function Step1Execution({ data, onNext }: { data: ReviewData; onNext: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">本周执行概况</h2>
      <p className="text-sm text-gray-500">数据已自动生成，浏览确认后进入下一步</p>

      {/* 完成率大数字 */}
      <div className="flex items-center justify-center py-4">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="8" />
            <motion.circle cx="50" cy="50" r="42" fill="none" stroke="#6366F1" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{ strokeDashoffset: `${2 * Math.PI * 42 * (1 - data.completion.rate / 100)}` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-indigo-600">{data.completion.rate}%</span>
            <span className="text-xs text-gray-400">{data.completion.completed}/{data.completion.total}</span>
          </div>
        </div>
      </div>

      {/* 目标进度对比 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">目标进度</h3>
        {data.goalProgress.map((g) => (
          <div key={g.goalId} className="flex items-center gap-3 text-sm">
            <span className="flex-1 truncate text-gray-600 dark:text-gray-400">{g.title}</span>
            <span className="text-xs text-gray-400">{g.lastWeek}%</span>
            <ArrowRight className="w-3 h-3 text-gray-300" />
            <span className="font-mono font-semibold text-indigo-600">{g.thisWeek}%</span>
            <span className={`text-xs font-medium ${g.change >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {g.change >= 0 ? "+" : ""}{g.change}%
            </span>
          </div>
        ))}
      </div>

      {/* 时间投入 */}
      {Object.keys(data.timeSpent).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">时间投入</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(data.timeSpent).map(([cat, min]) => (
              <span key={cat} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {cat}: {Math.round(min / 60)}h {min % 60}m
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI 洞察 */}
      <div className="space-y-2 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-800">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
          <Sparkles className="w-4 h-4" /> AI 洞察
        </h3>
        <p className="text-xs text-indigo-600 dark:text-indigo-500">最佳时段: {data.insights.bestTime}</p>
        <p className="text-xs text-indigo-600 dark:text-indigo-500">瓶颈: {data.insights.bottleneck}</p>
        <p className="text-xs text-indigo-600 dark:text-indigo-500">趋势: {data.insights.trend}</p>
      </div>

      <button onClick={onNext} className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 flex items-center justify-center gap-2">
        下一步 <ChevronRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ============================================================
// Step 2: 亮点记录
// ============================================================

function Step2Highlights({
  highlights, setHighlights, goals, completedTitles, onPrev, onNext, canNext,
}: {
  highlights: Highlight[]; setHighlights: (h: Highlight[]) => void;
  goals: EngineGoal[]; completedTitles: string[]; onPrev: () => void; onNext: () => void; canNext: boolean;
}) {
  const update = (idx: number, text: string) => {
    const newH = [...highlights];
    newH[idx] = { ...newH[idx], text };
    setHighlights(newH);
  };
  const setGoal = (idx: number, goalId: string) => {
    const newH = [...highlights];
    newH[idx] = { ...newH[idx], goalId };
    setHighlights(newH);
  };
  const addLine = () => {
    if (highlights.length < 5) setHighlights([...highlights, { text: "" }]);
  };
  const importFromTask = (title: string) => {
    const idx = highlights.findIndex((h) => !h.text.trim());
    if (idx >= 0) update(idx, title);
    else if (highlights.length < 5) setHighlights([...highlights, { text: title }]);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">亮点记录</h2>
      <p className="text-sm text-gray-500">本周最让你骄傲的 3 件事是什么？</p>

      {highlights.map((h, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-xs flex items-center justify-center flex-shrink-0 mt-2">
            {i + 1}
          </span>
          <input
            value={h.text}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`亮点 ${i + 1}...`}
            className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={h.goalId ?? ""}
            onChange={(e) => setGoal(i, e.target.value)}
            className="w-28 px-2 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 focus:outline-none"
          >
            <option value="">关联目标</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title.slice(0, 6)}</option>
            ))}
          </select>
        </div>
      ))}

      {highlights.length < 5 && (
        <button onClick={addLine} className="text-xs text-indigo-500 hover:underline">+ 添加一条</button>
      )}

      {completedTitles.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">从已完成任务导入：</p>
          <div className="flex flex-wrap gap-1">
            {completedTitles.slice(0, 5).map((t) => (
              <button key={t} onClick={() => importFromTask(t)} className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                {t.slice(0, 15)}...
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onPrev} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500">上一步</button>
        <button onClick={onNext} disabled={!canNext} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// Step 3: 问题分析
// ============================================================

function Step3Problems({
  problems, setProblems, data, onPrev, onNext, canNext,
}: {
  problems: Problem[]; setProblems: (p: Problem[]) => void;
  data: ReviewData; onPrev: () => void; onNext: () => void; canNext: boolean;
}) {
  const update = (idx: number, field: keyof Problem, value: string) => {
    const newP = [...problems];
    newP[idx] = { ...newP[idx], [field]: value };
    setProblems(newP);
  };
  const addLine = () => {
    if (problems.length < 5) setProblems([...problems, { text: "", tag: "", severity: "medium" }]);
  };

  // AI 候选问题
  const aiCandidates = useMemo(() => {
    const result: string[] = [];
    if (data.completion.rate < 50) result.push("本周完成率不足50%，可能存在目标设定过高或执行障碍");
    if (data.insights.bottleneck.includes("低")) result.push("某些日子完成率明显偏低，需要均匀分配任务");
    const negChange = data.goalProgress.filter((g) => g.change < 0);
    if (negChange.length > 1) result.push(`${negChange.length}个目标进度倒退，需要调整策略`);
    return result;
  }, [data]);

  const adoptCandidate = (text: string) => {
    const idx = problems.findIndex((p) => !p.text.trim());
    if (idx >= 0) update(idx, "text", text);
    else if (problems.length < 5) setProblems([...problems, { text, tag: "目标不清晰", severity: "medium" }]);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">问题分析</h2>
      <p className="text-sm text-gray-500">本周遇到了哪些阻碍？</p>

      {problems.map((p, i) => (
        <div key={i} className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
            <input
              value={p.text}
              onChange={(e) => update(i, "text", e.target.value)}
              placeholder={`问题 ${i + 1}...`}
              className="flex-1 px-2 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
          <div className="flex gap-2 ml-6 flex-wrap">
            <select value={p.tag} onChange={(e) => update(i, "tag", e.target.value)}
              className="px-2 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 text-xs text-gray-500 focus:outline-none">
              <option value="">选择类型</option>
              {PROBLEM_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {(["low","medium","high"] as const).map((s) => (
              <button key={s}
                onClick={() => update(i, "severity", s)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  p.severity === s ? (s === "high" ? "bg-red-200" : s === "medium" ? "bg-orange-200" : "bg-amber-200") + " text-gray-700"
                  : "bg-white dark:bg-gray-900 text-gray-400"
                }`}>
                {s === "low" ? "轻微" : s === "medium" ? "中等" : "严重"}
              </button>
            ))}
          </div>
        </div>
      ))}

      {problems.length < 5 && (
        <button onClick={addLine} className="text-xs text-indigo-500 hover:underline">+ 添加问题</button>
      )}

      {/* AI 候选 */}
      {aiCandidates.length > 0 && (
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
          <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI 建议
          </p>
          {aiCandidates.map((c, i) => (
            <button key={i} onClick={() => adoptCandidate(c)}
              className="block w-full text-left text-xs text-purple-600 hover:underline mb-1">
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onPrev} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">上一步</button>
        <button onClick={onNext} disabled={!canNext} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
          下一步 <ChevronRight className="w-4 h-4 inline" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// Step 4: 改进计划
// ============================================================

function Step4Improvements({
  improvements, setImprovements, problems, onPrev, onNext, canNext,
}: {
  improvements: Improvement[]; setImprovements: (p: Improvement[]) => void;
  problems: Problem[]; onPrev: () => void; onNext: () => void; canNext: boolean;
}) {
  const update = (idx: number, field: keyof Improvement, value: string | boolean) => {
    const newP = [...improvements];
    newP[idx] = { ...newP[idx], [field]: value };
    setImprovements(newP);
  };
  const addLine = () => {
    setImprovements([...improvements, { text: "", convertToTask: false }]);
  };

  // 智能推荐（根据问题类型）
  const getRecommendations = (problem: Problem): string[] => {
    if (!problem.tag) return [];
    return SMART_RECOMMENDATIONS[problem.tag] ?? [];
  };

  const adoptRecommendation = (text: string) => {
    const idx = improvements.findIndex((i) => !i.text.trim());
    if (idx >= 0) update(idx, "text", text);
    else setImprovements([...improvements, { text, convertToTask: true }]);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">改进计划</h2>
      <p className="text-sm text-gray-500">下周你打算如何改进？</p>

      {improvements.map((imp, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
            <input
              value={imp.text}
              onChange={(e) => update(i, "text", e.target.value)}
              placeholder={`改进计划 ${i + 1}...`}
              className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 ml-6">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={imp.convertToTask}
                onChange={(e) => update(i, "convertToTask", e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
              />
              转化为下周任务
            </label>
          </div>
        </div>
      ))}

      <button onClick={addLine} className="text-xs text-indigo-500 hover:underline">+ 添加改进</button>

      {/* 智能推荐 */}
      {problems.filter((p) => p.tag).length > 0 && (
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800">
          <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> 推荐方案
          </p>
          {problems.filter((p) => p.tag).map((p, i) => (
            <div key={i} className="mb-2">
              <p className="text-xs text-gray-500">针对「{p.tag}」：</p>
              {getRecommendations(p).map((rec, j) => (
                <button key={j} onClick={() => adoptRecommendation(rec)}
                  className="block w-full text-left text-xs text-green-600 hover:underline mb-0.5 ml-2">
                  {rec}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onPrev} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">上一步</button>
        <button onClick={onNext} disabled={!canNext} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
          生成报告 <ChevronRight className="w-4 h-4 inline" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// Step 5: 复盘报告
// ============================================================

function Step5Report({
  data, highlights, problems, improvements, onSave, saving, onPrev, onNext,
}: {
  data: ReviewData;
  highlights: Highlight[]; problems: Problem[]; improvements: Improvement[];
  onSave: () => void; saving: boolean; onPrev: () => void; onNext: () => void;
}) {
  const validH = highlights.filter((h) => h.text.trim());
  const validP = problems.filter((p) => p.text.trim());
  const validI = improvements.filter((i) => i.text.trim());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">复盘报告</h2>

      <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
        {/* PDCA 标签 */}
        <div className="flex gap-1.5 flex-wrap">
          {["Plan", "Do", "Check", "Act"].map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
              {tag}
            </span>
          ))}
        </div>

        {/* 执行数据 */}
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">执行概况</h3>
          <p className="text-gray-600 dark:text-gray-400">
            完成率 {data.completion.rate}%（{data.completion.completed}/{data.completion.total}）
          </p>
          <p className="text-xs text-gray-400">{data.insights.bestTime}</p>
        </div>

        {/* 亮点 */}
        {validH.length > 0 && (
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-emerald-700">亮点</h3>
            {validH.map((h, i) => <p key={i} className="text-gray-600 dark:text-gray-400">• {h.text}</p>)}
          </div>
        )}

        {/* 问题 */}
        {validP.length > 0 && (
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-red-700">问题</h3>
            {validP.map((p, i) => (
              <p key={i} className="text-gray-600 dark:text-gray-400">
                • [{p.tag}] [{p.severity}] {p.text}
              </p>
            ))}
          </div>
        )}

        {/* 改进 */}
        {validI.length > 0 && (
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-blue-700">改进计划</h3>
            {validI.map((i, idx) => (
              <p key={idx} className="text-gray-600 dark:text-gray-400">
                • {i.text} {i.convertToTask && "→ 下周任务"}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onPrev} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">上一步</button>
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
          <Save className="w-4 h-4" /> {saving ? "保存中..." : "保存报告"}
        </button>
        <button onClick={onNext} className="py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium flex items-center gap-1">
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================
// Step 6: 应用调整
// ============================================================

function Step6Apply({
  improvements, weekStart, onPrev, onComplete,
}: {
  improvements: Improvement[]; weekStart: string; onPrev: () => void; onComplete: () => void;
}) {
  const tasksToApply = improvements.filter((i) => i.convertToTask && i.text.trim());
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    for (const imp of tasksToApply) {
      try {
        // 为目标创建一个简单的习惯计划（后续可扩展）
        await weeklyTaskService.create({
          milestoneId: "", // TODO: 需要找到对应里程碑
          title: imp.text,
          plannedStart: weekStart,
          plannedEnd: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          quantityTarget: 7,
          quantityUnit: "次",
          weight: 100,
          sortOrder: 0,
        });
      } catch { /* skip individual errors */ }
    }
    setApplied(true);
    setTimeout(onComplete, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">应用调整</h2>
      <p className="text-sm text-gray-500">将改进计划同步为下周任务</p>

      <div className="space-y-2">
        {tasksToApply.length === 0 ? (
          <p className="text-sm text-gray-400">没有需要转化的任务</p>
        ) : (
          tasksToApply.map((imp, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{imp.text}</span>
            </div>
          ))
        )}
      </div>

      {applied && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 text-center">
          <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-emerald-700">调整已应用，复盘完成！</p>
        </motion.div>
      )}

      {!applied && (
        <div className="flex gap-3">
          <button onClick={onPrev} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">上一步</button>
          <button onClick={handleApply} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-1">
            <Rocket className="w-4 h-4" /> 确认应用
          </button>
        </div>
      )}

      {applied && (
        <button onClick={onComplete} className="w-full py-2.5 rounded-xl bg-gray-800 dark:bg-gray-700 text-white text-sm font-medium">
          返回复盘首页
        </button>
      )}
    </motion.div>
  );
}
