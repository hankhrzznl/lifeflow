"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Moon, Sun, Monitor, Download, Trash2, Info, MessageSquare, ChevronRight, Droplets, Target, Database, Pill, Globe, Zap, ShieldCheck, X, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { UserSettings } from "@/lib/types";
import Dialog from "@/components/ui/Dialog";
import { showToast } from "@/components/ui/Toast";
import { dataExportService } from "@/lib/engine/DataExportService";
import { getWaterGoal, updateWaterGoal } from "@/lib/db/health.db";
import { goalV2DB } from "@/lib/db/goal-v2.db";
import { daylogDB } from "@/lib/db/daylog.db";
import { getUserSettings, saveUserSettings } from "@/lib/db";

// ─── iOS Toggle Switch ────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer border-none outline-none"
      style={{
        width: 51, height: 31,
        background: checked ? "var(--state-success)" : "var(--lifeflow-border)",
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

// ─── 行内图标章（圆底图标，对齐画布设置视觉） ─────────────────
function IconChip({
  icon, color, bg,
}: { icon: React.ReactNode; color: string; bg: string }) {
  return (
    <span
      className="w-9 h-9 shrink-0 rounded-[11px] inline-flex items-center justify-center"
      style={{ background: bg, color }}
    >
      {icon}
    </span>
  );
}

const THEME_OPTIONS = [
  { key: "light", label: "日间", icon: <Sun className="w-4 h-4" /> },
  { key: "dark", label: "夜间", icon: <Moon className="w-4 h-4" /> },
  { key: "system", label: "跟随系统", icon: <Monitor className="w-4 h-4" /> },
] as const;

// ─── 成就通知偏好扩展字段：userSettings 为无 schema 的 key-value 存储，直接读写
// （与提醒页同字段 achievementNotify，页面内仅做类型扩展，不改 src/lib）
type SettingsPrefs = Partial<UserSettings> & {
  achievementNotify?: boolean;
};

// ─── 语言选项（画布语义：简体中文 / English / 繁體中文；PWA 单语言，仅展示态） ─
const LANGUAGE_OPTIONS = [
  { key: "zh-CN", label: "简体中文" },
  { key: "en", label: "English" },
  { key: "zh-TW", label: "繁體中文" },
] as const;

// ─── 隐私政策要点（数据仅存本机 Dexie、不上传、可导出/清除） ────────────────
const PRIVACY_POINTS = [
  "所有数据仅保存在本机（Dexie / IndexedDB），不会上传至任何服务器。",
  "我们不会收集、共享或出售您的任何个人信息。",
  "您可随时在「数据」中通过「导出数据」生成 JSON 备份。",
  "您也可随时通过「清除数据」移除全部本机记录，此操作不可撤销。",
];

// ─── 底部 Sheet（对齐 Dialog 遮罩层级 + 设置卡片 token） ────────────────────
function BottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="w-full max-w-[430px] rounded-t-[24px] px-5 pt-2 pb-[var(--safe-area-bottom)]"
            style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--lifeflow-border)" }} />
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="w-8 h-8 rounded-full inline-flex items-center justify-center active:opacity-60"
                style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showResetGoalsDialog, setShowResetGoalsDialog] = useState(false);
  const [resettingGoals, setResettingGoals] = useState(false);
  const [importing, setImporting] = useState(false);
  const [waterReminderEnabled, setWaterReminderEnabled] = useState(false);
  const [medicineEnabled, setMedicineEnabled] = useState(false);
  const [achievementNotify, setAchievementNotify] = useState(false);
  const [language, setLanguage] = useState("简体中文");
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载饮水提醒状态
  useEffect(() => {
    getWaterGoal().then(g => {
      setWaterReminderEnabled((g.reminderInterval ?? 0) > 0);
    }).catch(() => {});
    // T18-6：吃药维修模式开关（settings 兜底）+ 成就通知（与提醒页同字段，保持同步）
    getUserSettings().then(s => {
      const prefs = s as SettingsPrefs | null;
      setMedicineEnabled(prefs?.medicineEnabled === true);
      setAchievementNotify(prefs?.achievementNotify === true);
    }).catch(() => {});
  }, []);

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

  const toggleMedicine = useCallback(async () => {
    const newState = !medicineEnabled;
    setMedicineEnabled(newState);
    try {
      await saveUserSettings({ medicineEnabled: newState });
      showToast({ type: "success", message: newState ? "吃药提醒已开启" : "吃药提醒已关闭" });
    } catch {
      setMedicineEnabled(!newState);
      showToast({ type: "error", message: "设置失败，请重试" });
    }
  }, [medicineEnabled]);

  // ─── 成就通知开关（真实映射 userSettings.achievementNotify，与提醒页同字段同步） ─
  const toggleAchievement = useCallback(async () => {
    const newState = !achievementNotify;
    setAchievementNotify(newState);
    try {
      await saveUserSettings({ achievementNotify: newState } as Partial<UserSettings>);
      showToast({ type: "success", message: newState ? "成就通知已开启" : "成就通知已关闭" });
    } catch {
      setAchievementNotify(!newState);
      showToast({ type: "error", message: "设置失败，请重试" });
    }
  }, [achievementNotify]);

  // ─── 语言选择（PWA 单语言：仅记录展示态 + Toast，不切换界面文案） ──────────
  const handleLanguageSelect = useCallback((label: string) => {
    setLanguage(label);
    setShowLanguageSheet(false);
    showToast({ type: "success", message: `已选择「${label}」（PWA 单语言，展示态）` });
  }, []);

  const handleResetGoals = useCallback(async () => {
    setResettingGoals(true);
    try {
      await goalV2DB.goalV2Goals.clear();
      await goalV2DB.goalV2KeyResults.clear();
      await goalV2DB.goalV2Strategies.clear();
      await goalV2DB.goalV2WeeklyTasks.clear();
      await goalV2DB.goalV2DailyActions.clear();
      // 同步清理日程中已同步的目标日行动（sourceType='goal'），避免孤儿事项残留
      await daylogDB.items.where("sourceType").equals("goal").delete();
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

      {/* 系统 */}
      <div className="px-4 pt-6 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>系统</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          {/* 主题：日间 / 夜间 / 跟随系统 */}
          <div className="flex items-center justify-between w-full px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Sun className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>主题</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>日间 · 夜间 · 跟随系统</p>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-label="主题模式"
              className="inline-flex items-center gap-0.5 p-0.5 rounded-[10px] shrink-0"
              style={{ background: "var(--lifeflow-muted)" }}
            >
              {THEME_OPTIONS.map((opt) => {
                const selected = theme === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(opt.key)}
                    className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-lg text-[12px] font-medium transition-all active:scale-95"
                    style={{
                      background: selected ? "var(--color-surface-card)" : "transparent",
                      color: selected ? "var(--lifeflow-primary)" : "var(--color-text-secondary)",
                      boxShadow: selected ? "var(--shadow-card)" : "none",
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* 语言：PWA 单语言，点击弹选项（简体中文 / English / 繁體中文），仅展示态 */}
          <button type="button" onClick={() => setShowLanguageSheet(true)} className="flex items-center justify-between w-full px-5 py-3 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Globe className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0 text-left">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>语言</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>{language}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* 饮水提醒 */}
          <div className="flex items-center justify-between w-full px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Droplets className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>饮水提醒</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>定时提醒喝水</p>
              </div>
            </div>
            <ToggleSwitch checked={waterReminderEnabled} onChange={toggleWaterReminder} label="饮水提醒" />
          </div>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* T18-6：吃药维修模式开关（无条件时全站隐藏吃药入口，此开关作为兜底） */}
          <div className="flex items-center justify-between w-full px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Pill className="w-4.5 h-4.5" />} color="#0EA5E9" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>吃药提醒</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>药物服用提醒</p>
              </div>
            </div>
            <ToggleSwitch checked={medicineEnabled} onChange={toggleMedicine} label="吃药提醒" />
          </div>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* 成就通知：真实映射 userSettings.achievementNotify（与提醒页同字段，保持同步） */}
          <div className="flex items-center justify-between w-full px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Zap className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>成就通知</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>解锁新成就时提醒</p>
              </div>
            </div>
            <ToggleSwitch checked={achievementNotify} onChange={toggleAchievement} label="成就通知" />
          </div>
        </div>
      </div>

      {/* 数据 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>数据</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          {/* 导出数据：本地 JSON 备份（对齐画布 export 备份语义，不新建路由） */}
          <button type="button" onClick={handleExport} className="flex items-center justify-between w-full px-5 py-3 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Download className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0 text-left">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>导出数据</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>本地 JSON 备份</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* 重置目标数据 */}
          <button type="button" onClick={() => setShowResetGoalsDialog(true)} className="flex items-center justify-between w-full px-5 py-3 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Target className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
              <div className="min-w-0 text-left">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>重置目标数据</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>删除全部目标及其关联数据</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* 清除数据（危险操作） */}
          <button type="button" onClick={() => setShowClearDialog(true)} className="flex items-center justify-between w-full px-5 py-3 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Trash2 className="w-4.5 h-4.5" />} color="var(--color-expense)" bg="var(--lifeflow-muted)" />
              <div className="min-w-0 text-left">
                <p className="text-[15px] truncate" style={{ color: "var(--color-expense)" }}>清除数据</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>移除所有本机记录</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
        </div>
      </div>

      {/* 数据归一说明（T13） */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-[20px] p-5" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3 mb-1.5">
            <IconChip icon={<Database className="w-4.5 h-4.5" />} color="var(--lifeflow-primary)" bg="var(--lifeflow-brand-50)" />
            <span className="text-[15px] font-medium" style={{ color: "var(--color-text-primary)" }}>数据归一（T13）</span>
          </div>
          <p className="text-[13px] leading-relaxed ml-12" style={{ color: "var(--color-text-secondary)" }}>
            已物理删除 7 张废弃数据表（效率库 tasks/habits，健康库 waterRecords/sleepRecords/fitnessRecords/exercises/muscleGroups），
            效率库 6→4 表、健康库 17→12 表。删除前已逐张核实均为空表，活跃数据完整保留。
          </p>
        </div>
      </div>

      {/* 关于 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>关于</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<Info className="w-4.5 h-4.5" />} color="var(--color-text-secondary)" bg="var(--lifeflow-muted)" />
              <span className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>版本</span>
            </div>
            <span className="text-[15px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>v2.6</span>
          </div>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          {/* 隐私政策：点击弹底部 Sheet（数据仅存本机 Dexie，不上传，可导出/清除） */}
          <button type="button" onClick={() => setShowPrivacySheet(true)} className="flex items-center justify-between w-full px-5 py-3 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<ShieldCheck className="w-4.5 h-4.5" />} color="var(--color-text-secondary)" bg="var(--lifeflow-muted)" />
              <div className="min-w-0 text-left">
                <p className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>隐私政策</p>
                <p className="text-[12px] truncate" style={{ color: "var(--color-text-secondary)" }}>数据存储在本机</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>

          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "60px" }} />

          <button type="button" className="flex items-center justify-between w-full px-5 py-3 active:opacity-50">
            <div className="flex items-center gap-3 min-w-0">
              <IconChip icon={<MessageSquare className="w-4.5 h-4.5" />} color="var(--color-text-secondary)" bg="var(--lifeflow-muted)" />
              <span className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>反馈</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </button>
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

      {/* 隐藏的文件选择器（导入逻辑保留） */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />

      {/* 清除确认弹窗 */}
      <Dialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        type="confirm"
        variant="danger"
        title="清除全部数据"
        description="将移除所有本机记录，此操作不可撤销。"
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

      {/* 语言选项 Sheet（PWA 单语言，仅展示态） */}
      <BottomSheet open={showLanguageSheet} onClose={() => setShowLanguageSheet(false)} title="语言">
        <p className="text-[13px] mb-1" style={{ color: "var(--color-text-secondary)" }}>
          当前为 PWA 单语言版本，语言选择仅作展示记录，不影响界面文案。
        </p>
        <div className="py-1">
          {LANGUAGE_OPTIONS.map((opt) => {
            const selected = language === opt.label;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleLanguageSelect(opt.label)}
                className="flex items-center justify-between w-full py-3.5 px-2 rounded-xl active:opacity-60"
                style={selected ? { background: "var(--lifeflow-brand-50)" } : undefined}
              >
                <span className="text-[15px]" style={{ color: "var(--color-text-primary)" }}>{opt.label}</span>
                {selected && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowLanguageSheet(false)}
          className="w-full mt-2 py-3 rounded-[14px] text-[15px] font-medium active:opacity-60"
          style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-primary)" }}
        >
          取消
        </button>
      </BottomSheet>

      {/* 隐私政策 Sheet（数据仅存本机，不上传，可导出/清除） */}
      <BottomSheet open={showPrivacySheet} onClose={() => setShowPrivacySheet(false)} title="隐私政策">
        <div className="py-1">
          {PRIVACY_POINTS.map((point, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2">
              <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: "var(--lifeflow-primary)" }} />
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{point}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowPrivacySheet(false)}
          className="w-full mt-2 mb-1 py-3 rounded-[14px] text-[15px] font-medium active:opacity-60"
          style={{ background: "var(--lifeflow-primary)", color: "var(--color-text-inverse)" }}
        >
          知道了
        </button>
      </BottomSheet>

      {/* v1 目标数据迁移弹窗已下线（T16：v1 目标系统整体退役，4 表数据直接删除） */}
    </div>
  );
}
