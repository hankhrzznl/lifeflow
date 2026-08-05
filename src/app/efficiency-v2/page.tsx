"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Target, Copy, Download, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  type GoalV2,
  getAllGoalsV2,
  getKeyResultsV2,
  getGoalV2,
  goalV2DB,
  deleteGoalV2,
  getDailyActionsByDateV2,
} from "@/lib/db/goal-v2.db";
import { GOAL_V2_AI_PROMPT, parseImportedGoal, validateImportedGoal } from "@/lib/goal-v2-import-parser";
import { showToast } from "@/components/ui/Toast";

// ─── 今日日期 ──────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 状态徽章 ──────────────────────────────────────────────
function StatusBadge({ status }: { status: GoalV2["status"] }) {
  const label: Record<GoalV2["status"], string> = {
    active: "进行中",
    completed: "已完成",
    paused: "已暂停",
  };
  const colors: Record<GoalV2["status"], { bg: string; fg: string }> = {
    active: { bg: "rgba(52, 199, 89, 0.12)", fg: "#34C759" },
    completed: { bg: "rgba(142, 142, 147, 0.15)", fg: "#8E8E93" },
    paused: { bg: "rgba(255, 149, 0, 0.12)", fg: "#FF9500" },
  };
  const c = colors[status];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {label[status]}
    </span>
  );
}

// ─── 进度条 ──────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className="w-full h-[6px] rounded-full overflow-hidden"
      style={{ backgroundColor: "var(--lifeflow-background)" }}
    >
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ backgroundColor: "var(--lifeflow-primary)" }}
      />
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────
export default function EfficiencyV2Page() {
  const router = useRouter();

  const goals = useLiveQuery(() => getAllGoalsV2(), [], [] as GoalV2[]);
  const allKeyResults = useLiveQuery(
    () => goalV2DB.goalV2KeyResults.toArray(),
    [],
    [],
  );

  // 导入对话框状态
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // 按 goalId 统计关键结果数量
  const krCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const kr of allKeyResults ?? []) {
      map.set(kr.goalId, (map.get(kr.goalId) ?? 0) + 1);
    }
    return map;
  }, [allKeyResults]);

  const goalList = goals ?? [];

  // ── 今日日行动（T18-5：目标页焦点 = 活跃目标 + 今日日行动） ──
  const todayActions = useLiveQuery(
    () => getDailyActionsByDateV2(todayStr()),
    [],
    [],
  );
  const todayPending = useMemo(() => {
    return (todayActions ?? [])
      .filter(a => !a.isCompleted)
      .sort((a, b) => (a.time || "09:00").localeCompare(b.time || "09:00"))
      .slice(0, 5);
  }, [todayActions]);
  const todayDoneCount = useMemo(
    () => (todayActions ?? []).filter(a => a.isCompleted).length,
    [todayActions],
  );

  // ── 复制提示词 ──
  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GOAL_V2_AI_PROMPT);
      showToast({ type: "success", message: "提示词已复制，发送给 AI 获取导入计划" });
    } catch {
      showToast({ type: "error", message: "复制失败，请手动复制" });
    }
  }, []);

  // ── 导入解析 ──
  const handleImport = useCallback(async () => {
    setImportError("");
    setImporting(true);
    try {
      const data = parseImportedGoal(importText);
      const validation = validateImportedGoal(data);
      if (!validation.valid) {
        setImportError(validation.errors.join("\n"));
        setImporting(false);
        return;
      }
      // 跳转到创建页面，通过 sessionStorage 传递数据（避免 URL 长度限制截断）
      sessionStorage.setItem('import_goal', JSON.stringify(data));
      window.location.href = '/efficiency-v2/new';
    } catch (e: any) {
      setImportError(`解析失败：${e.message || '格式错误，请检查 AI 返回的 JSON'}`);
      setImporting(false);
    }
  }, [importText, router]);

  // ── 删除目标 ──
  const handleDeleteGoal = useCallback(async (goalId: string, title: string) => {
    if (!window.confirm(`确定删除目标「${title}」？所有相关数据将被永久删除。`)) return;
    await deleteGoalV2(goalId);
    showToast({ type: "success", message: `已删除「${title}」` });
  }, []);

  // ─── 空状态 ──────────────────────────────────────────
  if (goalList.length === 0) {
    return (
      <div
        className="mx-auto relative flex flex-col items-center justify-center min-h-screen"
        style={{ maxWidth: 430, padding: "0 24px" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-6 w-full"
          style={{
            backgroundColor: "var(--color-surface-card)",
            borderRadius: "var(--lifeflow-radius-medium)",
            boxShadow: "var(--shadow-card)",
            padding: "48px 24px",
          }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--color-surface-secondary)" }}
          >
            <Target
              className="w-10 h-10"
              style={{ color: "var(--color-text-disabled)" }}
              strokeWidth={2}
            />
          </div>
          <p
            className="text-[17px] font-medium"
            style={{
              color: "var(--color-text-secondary)",
              letterSpacing: "-0.022em",
            }}
          >
            还没有目标，开始创建你的第一个目标吧
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <button
              type="button"
              onClick={() => router.push("/efficiency-v2/new")}
              className="inline-flex items-center justify-center h-11 px-7 rounded-full text-[16px] font-semibold"
              style={{
                backgroundColor: "var(--lifeflow-primary)",
                color: "var(--color-text-inverse)",
                boxShadow: "var(--shadow-tab-center)",
              }}
            >
              新建目标
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex-1 h-10 rounded-lg text-[13px] font-medium"
                style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
              >
                复制提示词
              </button>
              <button
                type="button"
                onClick={() => setShowImportDialog(true)}
                className="flex-1 h-10 rounded-lg text-[13px] font-semibold text-white"
                style={{ background: "var(--lifeflow-primary)" }}
              >
                导入计划
              </button>
            </div>
          </div>
        </motion.div>

        {/* 空状态也需要导入对话框 */}
        <ImportDialog
          open={showImportDialog}
          importText={importText}
          setImportText={setImportText}
          importError={importError}
          setImportError={setImportError}
          importing={importing}
          onClose={() => setShowImportDialog(false)}
          onImport={handleImport}
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto relative"
      style={{ maxWidth: 430, minHeight: "100vh", paddingBottom: 100 }}
    >
      {/* ===== Header ===== */}
      <div
        className="px-5 pt-[var(--safe-area-top)] pb-4 flex items-center justify-between"
        style={{ paddingTop: "max(var(--safe-area-top), 16px)" }}
      >
        <h1
          className="text-title-large font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          目标 V2
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}
          >
            <Copy className="w-3.5 h-3.5" />
            复制提示词
          </button>
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium"
            style={{ background: "var(--lifeflow-primary)", color: "#fff" }}
          >
            <Download className="w-3.5 h-3.5" />
            导入
          </button>
        </div>
      </div>

      {/* ===== 今日焦点（T18-5：今日日行动优先呈现） ===== */}
      {todayPending.length > 0 && (
        <div className="px-4 mb-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] p-4"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)", borderLeft: "3px solid #6366F1" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#EEF2FF" }}>
                <Target className="w-4 h-4" style={{ color: "#6366F1" }} />
              </div>
              <span className="text-[13px] font-semibold" style={{ color: "#6366F1" }}>今日焦点</span>
              <span className="text-[11px] ml-auto" style={{ color: "var(--color-text-secondary)" }}>
                {todayDoneCount} 已完成
              </span>
            </div>
            <div className="flex flex-col">
              {todayPending.map((a, i) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 py-2"
                  style={{ borderTop: i > 0 ? "1px solid var(--lifeflow-border)" : "none" }}
                >
                  <span
                    className="w-[20px] h-[20px] rounded-full border-2 flex-shrink-0"
                    style={{ borderColor: "#6366F1", backgroundColor: "transparent" }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {a.title}
                    </span>
                  </span>
                  <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                    {a.time || "--"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--color-text-disabled)" }}>
              今日日行动来自进行中的目标，勾选在首页/日程完成
            </p>
          </motion.div>
        </div>
      )}

      {/* ===== Goal Grid（活跃目标优先） ===== */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {[...goalList]
          .sort((a, b) => {
            const rank: Record<string, number> = { active: 0, paused: 1, completed: 2 };
            return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
          })
          .map((goal, i) => {
          const krCount = krCountMap.get(goal.id) ?? 0;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.06,
                duration: 0.35,
                ease: "easeOut",
              }}
              className="rounded-[20px] overflow-hidden flex flex-col cursor-pointer active:scale-[0.97] transition-transform relative group"
              style={{
                backgroundColor: "var(--color-surface-card)",
                border: "1px solid var(--lifeflow-border)",
                boxShadow: "var(--shadow-card)",
              }}
              onClick={() => router.push(`/efficiency-v2/goals/${goal.id}`)}
            >
              {/* 彩色顶条 */}
              <div
                className="h-[4px] shrink-0"
                style={{ backgroundColor: goal.color || "var(--lifeflow-primary)" }}
              />

              {/* 删除按钮 — 始终可见 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteGoal(goal.id, goal.title);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center z-10 active:scale-90 transition-transform"
                style={{ background: "rgba(0,0,0,0.3)" }}
                aria-label="删除目标"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
              </button>

              {/* 卡片内容 */}
              <div className="flex flex-col gap-2.5 p-3.5 flex-1">
                {/* 标题 */}
                <h3
                  className="text-[15px] font-semibold leading-tight line-clamp-2"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {goal.title}
                </h3>

                {/* 愿景（截断） */}
                {goal.vision && (
                  <p
                    className="text-[12px] leading-relaxed line-clamp-2"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {goal.vision}
                  </p>
                )}

                {/* 进度条 */}
                <div className="mt-auto flex flex-col gap-1.5">
                  <ProgressBar value={goal.progress} />
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--color-text-disabled)" }}
                  >
                    {goal.progress}%
                  </span>
                </div>

                {/* 底部 row：状态徽章 + KR 数 */}
                <div className="flex items-center justify-between mt-1">
                  <StatusBadge status={goal.status} />
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--color-text-disabled)" }}
                  >
                    {krCount} 个关键结果
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ===== FAB 新建目标 ===== */}
      <button
        type="button"
        onClick={() => router.push("/efficiency-v2/new")}
        className="fixed right-4 bottom-[180px] z-40 flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "var(--lifeflow-primary)",
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
        }}
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {/* ===== 导入对话框 ===== */}
      <ImportDialog
        open={showImportDialog}
        importText={importText}
        setImportText={setImportText}
        importError={importError}
        setImportError={setImportError}
        importing={importing}
        onClose={() => setShowImportDialog(false)}
        onImport={handleImport}
      />
    </div>
  );
}

// ─── 导入对话框组件 ──────────────────────────────────────────
function ImportDialog({
  open, importText, setImportText, importError, setImportError, importing, onClose, onImport,
}: {
  open: boolean;
  importText: string;
  setImportText: (v: string) => void;
  importError: string;
  setImportError: (v: string) => void;
  importing: boolean;
  onClose: () => void;
  onImport: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-[20px] p-5 flex flex-col"
        style={{ maxWidth: 400, background: "var(--color-surface-card)", maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
          导入 AI 计划
        </h3>
        <p className="text-[12px] mb-3" style={{ color: "var(--color-text-secondary)" }}>
          粘贴 AI 返回的 JSON 内容，一键创建目标
        </p>
        <textarea
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
          placeholder="请粘贴 AI 返回的 JSON 内容..."
          className="w-full rounded-[10px] p-3 text-[13px] outline-none resize-none"
          style={{
            color: "var(--color-text-primary)",
            background: "var(--lifeflow-muted)",
            border: importError ? "1px solid #FF3B30" : "1px solid var(--lifeflow-border)",
            minHeight: 200,
            fontFamily: "monospace",
          }}
        />
        {importError && (
          <p className="text-[12px] mt-1.5" style={{ color: "#FF3B30" }}>{importError}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-[10px] text-[14px] font-medium"
            style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={!importText.trim() || importing}
            className="flex-1 h-10 rounded-[10px] text-[14px] font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--lifeflow-primary)" }}
          >
            {importing ? "解析中..." : "导入并创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
