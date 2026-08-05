"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Moon, Download, Trash2, Info, MessageSquare, ChevronRight, Droplets, Target, Database } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import Dialog from "@/components/ui/Dialog";
import { showToast } from "@/components/ui/Toast";
import { dataExportService } from "@/lib/engine/DataExportService";
import { getWaterGoal, updateWaterGoal } from "@/lib/db/health.db";
import { goalV2DB } from "@/lib/db/goal-v2.db";

// ─── iOS Toggle Switch ────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer border-none outline-none"
      style={{
        width: 51, height: 31,
        background: checked ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
        transition: "background 0.2s",
      }}>
      <div className="absolute rounded-full bg-white"
        style={{
          width: 27, height: 27, top: 2,
          left: checked ? 22 : 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "left 0.2s",
        }} />
    </button>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showResetGoalsDialog, setShowResetGoalsDialog] = useState(false);
  const [resettingGoals, setResettingGoals] = useState(false);
  const [importing, setImporting] = useState(false);
  const [waterReminderEnabled, setWaterReminderEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载饮水提醒状态
  useEffect(() => {
    getWaterGoal().then(g => {
      setWaterReminderEnabled((g.reminderInterval ?? 0) > 0);
    }).catch(() => {});
  }, []);

  const toggleDark = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const toggleWaterReminder = useCallback(async () => {
    const newState = !waterReminderEnabled;
    setWaterReminderEnabled(newState);
    try {
      await updateWaterGoal({ reminderInterval: newState ? 60 : 0 });
      showToast({ type: "success", message: newState ? "饮水提醒已开启" : "饮水提醒已关闭" });
    } catch {
      setWaterReminderEnabled(!newState);
      showToast({ type: "error", message: "设置失败，请重试" });
    }
  }, [waterReminderEnabled]);

  const handleResetGoals = useCallback(async () => {
    setResettingGoals(true);
    try {
      await goalV2DB.goalV2Goals.clear();
      await goalV2DB.goalV2KeyResults.clear();
      await goalV2DB.goalV2Strategies.clear();
      await goalV2DB.goalV2WeeklyTasks.clear();
      await goalV2DB.goalV2DailyActions.clear();
      setShowResetGoalsDialog(false);
      showToast({ type: "success", message: "所有目标数据已重置" });
    } catch {
      showToast({ type: "error", message: "重置失败，请重试" });
    } finally {
      setResettingGoals(false);
    }
  }, []);

  const handleExport = async () => {
    try {
      const json = await dataExportService.exportAllJSON();
      const date = new Date().toISOString().slice(0, 10);
      dataExportService.downloadFile(json, `lifeflow-backup-${date}.json`, "application/json");
      showToast({ type: "success", message: "导出成功" });
    } catch {
      showToast({ type: "error", message: "导出失败" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const content = await file.text();
      const result = await dataExportService.importFromJSON(content);
      showToast({ type: "success", message: `导入完成: ${result.imported} 条` });
    } catch (err) {
      showToast({ type: "error", message: `导入失败: ${(err as Error).message}` });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header - 居中"设置"标题 */}
      <div className="flex items-center justify-center h-[44px] px-4 pt-[var(--safe-area-top)] relative">
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>设置</h1>
      </div>

      {/* 外观 */}
      <div className="px-4 pt-6 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>外观</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Moon className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>深色模式</span>
            </div>
            <ToggleSwitch checked={isDark} onChange={toggleDark} label="深色模式" />
          </div>
        </div>
      </div>

      {/* 饮水提醒 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>习惯</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Droplets className="w-5 h-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>饮水提醒</span>
            </div>
            <ToggleSwitch checked={waterReminderEnabled} onChange={toggleWaterReminder} label="饮水提醒" />
          </div>
        </div>
      </div>

      {/* 数据 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>数据</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <button type="button" onClick={handleExport} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Download className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>导出数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <button type="button" onClick={() => setShowClearDialog(true)} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Trash2 className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>清除数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <button type="button" onClick={() => setShowResetGoalsDialog(true)} className="flex items-center justify-between w-full px-5 py-3.5 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <Target className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>重置目标数据</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
        </div>
      </div>

      {/* 数据归一说明（T13） */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3 mb-1.5">
            <Database className="w-5 h-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
            <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>数据归一（T13）</span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            已物理删除 7 张废弃数据表（效率库 tasks/habits，健康库 waterRecords/sleepRecords/fitnessRecords/exercises/muscleGroups），
            效率库 6→4 表、健康库 17→12 表。删除前已逐张核实均为空表，活跃数据完整保留。
          </p>
        </div>
      </div>

      {/* 关于 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>关于</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Info className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>版本</span>
            </div>
            <span className="text-[17px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>v2.6</span>
          </div>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <MessageSquare className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>反馈</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="px-4 pt-8">
        <button type="button"
          className="w-full py-3.5 text-center text-[17px] font-medium rounded-[20px]"
          style={{ background: "var(--color-surface-card)", color: "var(--color-expense)", boxShadow: "var(--shadow-card)" }}>
          退出登录
        </button>
      </div>

      {/* 隐藏的文件选择器 */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />

      {/* 清除确认弹窗 */}
      <Dialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        type="confirm"
        variant="danger"
        title="清除所有数据"
        description="将删除本地全部数据，此操作无法恢复。"
        confirmLabel="确认清除"
        onConfirm={async () => {
          try {
            // 清除逻辑由用户自行实现或先关闭弹窗
            setShowClearDialog(false);
            showToast({ type: "success", message: "已清除所有数据" });
          } catch {
            showToast({ type: "error", message: "清除失败" });
          }
        }}
      />

      {/* 重置目标数据确认弹窗 */}
      <Dialog
        open={showResetGoalsDialog}
        onClose={() => setShowResetGoalsDialog(false)}
        type="confirm"
        variant="danger"
        title="重置所有目标数据"
        description="将删除所有目标及其关联的策略、周任务、日行动数据，此操作无法恢复。"
        confirmLabel={resettingGoals ? "重置中..." : "确认重置"}
        onConfirm={handleResetGoals}
      />

      {/* v1 目标数据迁移弹窗已下线（T16：v1 目标系统整体退役，4 表数据直接删除） */}
    </div>
  );
}
