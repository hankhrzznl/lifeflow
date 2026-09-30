"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft, Pill, PillBottle, Check, Plus, Minus,
} from "lucide-react";
import {
  getMedicines, addMedicine, updateMedicine, deleteMedicine,
  getMedicineLogsByDate, upsertMedicineLog,
} from "@/lib/db/health.db";
import type { MedicineDefinition, MedicineLog } from "@/lib/db/health.db";
import { ensureModuleItem, removeModuleItems } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 常量
// ============================================================

const TIME_SLOTS = [
  { key: "morning", label: "早晨", time: "08:00", hint: "随餐服用" },
  { key: "noon", label: "中午", time: "12:00", hint: "餐后服用" },
  { key: "evening", label: "晚上", time: "18:00", hint: "晚餐后服用" },
  { key: "bedtime", label: "睡前", time: "22:00", hint: "睡前服用" },
] as const;

type TimeSlotKey = (typeof TIME_SLOTS)[number]["key"];

const COLORS = ["#DC2626", "#FF9500", "#34C759", "#007AFF", "#5856D6", "#FF2D55", "#AF52DE", "#00C7BE"];

const MAX_STEPPER_COUNT = 4;

// 画布语义色兜底：模块色 token 可能尚未注入全站，用琥珀色保证可用性
const MED_COLOR = "var(--lifeflow-module-medication, #F59E0B)";
const MED_LIGHT = "var(--lifeflow-module-medication-light, rgba(245,158,11,0.14))";
const SUCCESS_LIGHT = "var(--state-success-light, rgba(52,199,89,0.14))";
const ERROR_LIGHT = "var(--state-error-light, rgba(255,59,48,0.12))";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// ─── frequency 字段兼容解析 ────────────────────────────

/** 旧版 frequency 文本 → TimeSlotKey[] */
function parseLegacyFrequency(freq: string): TimeSlotKey[] {
  // 新版格式：逗号分隔的 slot key
  const allKeys = TIME_SLOTS.map(s => s.key);
  const parts = freq.split(",").map(s => s.trim());
  if (parts.every(p => allKeys.includes(p as TimeSlotKey))) {
    return parts as TimeSlotKey[];
  }
  // 旧版文本格式
  const map: Record<string, TimeSlotKey[]> = {
    "每天1次": ["morning"],
    "每天2次": ["morning", "evening"],
    "每天3次": ["morning", "noon", "evening"],
    "每天4次": ["morning", "noon", "evening", "bedtime"],
    "饭后":     ["morning", "noon", "evening"],
    "睡前":     ["bedtime"],
    "必要时":   [],
  };
  return map[freq] || [];
}

/** TimeSlotKey[] → 显示文本 */
function slotListLabel(slots: TimeSlotKey[]): string {
  if (slots.length === 0) return "必要时";
  return slots.map(s => TIME_SLOTS.find(t => t.key === s)?.label || s).join("、");
}

/** TimeSlotKey[] → 频率概要（如"每天2次"） */
function slotListSummary(slots: TimeSlotKey[]): string {
  const n = slots.length;
  if (n === 0) return "必要时";
  return `每天${n}次`;
}

// ─── 用量 stepper 本地展示解析（仅本地 UI，不落库） ─────
// 画布演示语义：从 dosage 文本中尝试提取「数字 + 中文单位」，
// 例如 "2片" → { count: 2, unit: "片" }；无法解析时回退 { 1, "粒" }。
function parseDosage(dosage: string): { count: number; unit: string } {
  if (!dosage) return { count: 1, unit: "粒" };
  const m = dosage.trim().match(/^(\d+)\s*([粒片包颗袋丸支瓶])/);
  if (m) {
    return {
      count: Math.max(1, Math.min(MAX_STEPPER_COUNT, Number(m[1]))),
      unit: m[2],
    };
  }
  return { count: 1, unit: "粒" };
}

// ============================================================
// 主组件
// ============================================================

export default function MedicationPage() {
  const router = useRouter();
  const today = todayStr();

  const medicines = useLiveQuery(() => getMedicines(), [], [] as MedicineDefinition[]);
  const todayLogs = useLiveQuery(() => getMedicineLogsByDate(today), [today], [] as MedicineLog[]);

  const activeMedicines = useMemo(() => medicines.filter(m => m.active), [medicines]);

  // ── 当前时段 Tab ──
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey>("morning");

  // ── 用量 stepper 本地状态（key: medicineId_slotKey，仅 UI，不新增 Dexie 字段）──
  const [stepperCounts, setStepperCounts] = useState<Record<string, number>>({});

  const setStepperCount = useCallback((key: string, n: number) => {
    setStepperCounts(c => ({ ...c, [key]: Math.max(1, Math.min(MAX_STEPPER_COUNT, n)) }));
  }, []);

  // ── 日志映射 (medicineId_timeSlot → log) ──
  const logMap = useMemo(() => {
    const map = new Map<string, MedicineLog>();
    for (const l of todayLogs) map.set(`${l.medicineId}_${l.timeSlot}`, l);
    return map;
  }, [todayLogs]);

  // ── 每个药品的已选时段缓存 ──
  const medicineSlots = useMemo(() => {
    const map = new Map<string, TimeSlotKey[]>();
    for (const m of medicines) {
      map.set(m.id, parseLegacyFrequency(m.frequency));
    }
    return map;
  }, [medicines]);

  // ── 各时段面板的药品（仅启用中的） ──
  const slotMeds = useMemo(() => {
    const map: Record<TimeSlotKey, MedicineDefinition[]> = {
      morning: [], noon: [], evening: [], bedtime: [],
    };
    for (const m of activeMedicines) {
      const slots = medicineSlots.get(m.id) || [];
      for (const s of slots) {
        if (map[s]) map[s].push(m);
      }
    }
    return map;
  }, [activeMedicines, medicineSlots]);

  // ── 勾选切换 ──
  const handleToggle = useCallback(async (medicineId: string, timeSlot: string) => {
    const key = `${medicineId}_${timeSlot}`;
    const existing = logMap.get(key);
    const nowTaken = !existing?.taken;
    await upsertMedicineLog({
      medicineId,
      date: today,
      timeSlot,
      taken: nowTaken,
    });

    // 同步生成/清除日程事项
    const med = medicines.find(m => m.id === medicineId);
    if (med) {
      const slotDef = TIME_SLOTS.find(s => s.key === timeSlot);
      if (slotDef) {
        const sourceId = `med_${medicineId}_${timeSlot}`;
        if (nowTaken) {
          await ensureModuleItem({
            date: today,
            sourceType: "medication",
            sourceId,
            title: `${med.name}`,
            plannedStart: slotDef.time,
            plannedEnd: addMinutes(slotDef.time, 15),
            color: med.color,
            icon: "Pill",
          });
        } else {
          await removeModuleItems(today, "medication", sourceId);
        }
      }
    }
  }, [today, logMap, medicines]);

  // ── 新增/编辑弹窗 ──
  const [showForm, setShowForm] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineDefinition | null>(null);
  const [form, setForm] = useState({ name: "", dosage: "", color: COLORS[0], selectedSlots: ["morning"] as TimeSlotKey[], deadline: "" });

  const openCreate = () => {
    setEditingMed(null);
    setForm({ name: "", dosage: "", color: COLORS[0], selectedSlots: ["morning"], deadline: "" });
    setShowForm(true);
  };

  const openEdit = (m: MedicineDefinition) => {
    setEditingMed(m);
    setForm({
      name: m.name,
      dosage: m.dosage,
      color: m.color,
      selectedSlots: parseLegacyFrequency(m.frequency),
      deadline: m.deadline || "",
    });
    setShowForm(true);
  };

  const toggleFormSlot = (s: TimeSlotKey) => {
    setForm(f => ({
      ...f,
      selectedSlots: f.selectedSlots.includes(s)
        ? f.selectedSlots.filter(x => x !== s)
        : [...f.selectedSlots, s],
    }));
  };

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { showToast({ type: "warning", message: "药品名称还没填" }); return; }
    if (form.selectedSlots.length === 0) { showToast({ type: "warning", message: "至少选择一个时段" }); return; }

    const freqValue = form.selectedSlots.join(",");

    if (editingMed) {
      await updateMedicine(editingMed.id, {
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        frequency: freqValue,
        deadline: form.deadline || undefined,
        color: form.color,
      });
      showToast({ type: "success", message: "已更新" });
    } else {
      await addMedicine({
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        frequency: freqValue,
        deadline: form.deadline || undefined,
        icon: "Pill",
        color: form.color,
        active: true,
      });
      showToast({ type: "success", message: "已添加" });
    }
    setShowForm(false);
  }, [form, editingMed]);

  const handleDelete = useCallback(async (m: MedicineDefinition) => {
    if (!window.confirm(`确定删除「${m.name}」？`)) return;
    await deleteMedicine(m.id);
    showToast({ type: "success", message: "已删除" });
    if (editingMed?.id === m.id) setShowForm(false);
  }, [editingMed]);

  const handleToggleActive = useCallback(async (m: MedicineDefinition) => {
    await updateMedicine(m.id, { active: !m.active });
  }, []);

  // ── 今日统计（按今日 logs 实际统计：每次 = 每药每时段一次） ──
  const todayStats = useMemo(() => {
    if (activeMedicines.length === 0) return { total: 0, taken: 0 };
    let total = 0, taken = 0;
    for (const m of activeMedicines) {
      const slots = medicineSlots.get(m.id) || [];
      for (const slotKey of slots) {
        total++;
        const key = `${m.id}_${slotKey}`;
        if (logMap.get(key)?.taken) taken++;
      }
    }
    return { total, taken };
  }, [activeMedicines, medicineSlots, logMap]);

  const { total, taken } = todayStats;
  const missed = Math.max(0, total - taken);
  const allDone = total > 0 && taken >= total;
  const progressPct = total > 0 ? Math.round((taken / total) * 100) : 0;

  // ── 今日已选药品（按时段面板已选统计：取今日有 taken 日志的去重药品） ──
  const selectedMedicines = useMemo(() => {
    const picked = new Map<string, MedicineDefinition>();
    for (const l of todayLogs) {
      if (l.taken) {
        const med = medicines.find(m => m.id === l.medicineId);
        if (med) picked.set(med.id, med);
      }
    }
    return [...picked.values()];
  }, [todayLogs, medicines]);

  // ── 打卡按钮：按真实统计反馈，不伪造日志 ──
  const handleCheckin = useCallback(() => {
    if (total === 0) {
      showToast({ type: "info", message: "今天还没有需要服药的药品" });
      return;
    }
    if (allDone) {
      showToast({ type: "success", message: "今日服药已全部完成" });
      return;
    }
    showToast({ type: "warning", message: `还有 ${missed} 次未服，去对应时段勾选吧` });
  }, [total, allDone, missed]);

  return (
    <div className="mx-auto px-4 pt-[calc(var(--safe-area-top,0px)+12px)] pb-[100px] space-y-3" style={{ maxWidth: 430, minHeight: "100vh", background: "var(--lifeflow-background)" }}>
      {/* ===== 顶部导航 ===== */}
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label="返回理想日"
          className="w-9 h-9 rounded-full bg-[var(--lifeflow-muted)] flex items-center justify-center text-[var(--color-text-primary)] transition-colors hover:bg-[var(--lifeflow-border)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
        >
          <ChevronLeft className="w-5 h-5 shrink-0" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight truncate">吃药规划</h1>
          <p className="text-[12px] text-[var(--color-text-secondary)] leading-normal">按时段服药</p>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: MED_LIGHT }}>
          <Pill className="w-4 h-4 shrink-0" style={{ color: MED_COLOR }} />
        </div>
      </header>

      {/* ===== 按时段 segmented tab ===== */}
      <div role="tablist" aria-label="选择服药时段" className="p-1 bg-[var(--lifeflow-muted)] rounded-[16px] grid grid-cols-4 gap-1">
        {TIME_SLOTS.map(slot => {
          const active = activeSlot === slot.key;
          return (
            <button
              key={slot.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveSlot(slot.key)}
              className={`h-9 text-[13px] font-medium rounded-[10px] transition-colors cursor-pointer [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--lifeflow-muted)] ${
                active
                  ? "font-semibold"
                  : "text-[var(--color-text-secondary)] hover:opacity-80"
              }`}
              style={active ? { background: MED_LIGHT, color: MED_COLOR } : undefined}
            >
              {slot.label}
            </button>
          );
        })}
      </div>

      {/* ===== 时段面板（早晨 / 中午 / 晚上 / 睡前） ===== */}
      {TIME_SLOTS.map(slot => {
        const meds = slotMeds[slot.key];
        return (
          <section
            key={slot.key}
            role="tabpanel"
            aria-label={`${slot.label}用药`}
            style={{ display: slot.key === activeSlot ? undefined : "none" }}
            className="space-y-2.5"
          >
            <div className="flex items-center gap-2 px-1 pt-1">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{slot.label} · {slot.time}</p>
              <span className="text-[12px] text-[var(--color-text-secondary)]">{slot.hint}</span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {slot.key === activeSlot && (
                <motion.div
                  key={activeSlot}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-2.5"
                >
                  {meds.length === 0 ? (
                    <div className="bg-[var(--lifeflow-card)] rounded-[12px] shadow-[var(--shadow-card)] py-8 flex flex-col items-center gap-2">
                      <PillBottle className="w-9 h-9 shrink-0 text-[var(--color-text-disabled)]" />
                      <p className="text-[13px] text-[var(--color-text-secondary)]">该时段还没有需要服用的药品</p>
                      <button
                        onClick={openCreate}
                        className="text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)] rounded-full"
                        style={{ color: MED_COLOR }}
                      >
                        新建药品
                      </button>
                    </div>
                  ) : (
                    meds.map(med => {
                      const slots = medicineSlots.get(med.id) || [];
                      const slotKey = slot.key;
                      const key = `${med.id}_${slotKey}`;
                      const isTaken = logMap.get(key)?.taken ?? false;
                      const base = parseDosage(med.dosage);
                      const count = stepperCounts[key] ?? base.count;
                      const unit = base.unit;
                      return (
                        <div
                          key={med.id}
                          className="bg-[var(--lifeflow-card)] rounded-[12px] shadow-[var(--shadow-card)] p-3 flex items-center gap-3"
                        >
                          {/* 勾选圆钮 */}
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isTaken}
                            aria-label={`选择${med.name}`}
                            onClick={() => handleToggle(med.id, slotKey)}
                            className="w-6 h-6 rounded-full border-[1.5px] flex items-center justify-center text-[var(--color-text-inverse)] shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lifeflow-card)]"
                            style={{
                              background: isTaken ? MED_COLOR : "transparent",
                              borderColor: isTaken ? MED_COLOR : "var(--lifeflow-border)",
                            }}
                          >
                            <Check
                              className="w-3.5 h-3.5 shrink-0"
                              strokeWidth={3}
                              style={{
                                opacity: isTaken ? 1 : 0,
                                transform: isTaken ? "scale(1)" : "scale(.5)",
                                transition: "opacity .18s ease, transform .18s ease",
                              }}
                            />
                          </button>

                          {/* 药品图标 + 名称 */}
                          <div className="min-w-0 flex-1 flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: MED_LIGHT }}>
                              <PillBottle className="w-4 h-4 shrink-0" style={{ color: MED_COLOR }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight truncate">{med.name}</p>
                              <p className="text-[12px] text-[var(--color-text-secondary)] leading-normal truncate">
                                {slotListSummary(slots)}{med.dosage ? ` · ${med.dosage}` : ""}
                              </p>
                            </div>
                          </div>

                          {/* 用量 stepper（本地 UI 状态） */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`减少${med.name}用量`}
                              disabled={!isTaken || count <= 1}
                              onClick={() => setStepperCount(key, count - 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                              style={{
                                background: isTaken ? MED_LIGHT : "var(--lifeflow-muted)",
                                color: isTaken ? MED_COLOR : "var(--color-text-disabled)",
                              }}
                            >
                              <Minus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                            </button>
                            <span className="w-7 text-center text-[13px] font-semibold text-[var(--color-text-primary)]">{count}</span>
                            <button
                              type="button"
                              aria-label={`增加${med.name}用量`}
                              disabled={!isTaken || count >= MAX_STEPPER_COUNT}
                              onClick={() => setStepperCount(key, count + 1)}
                              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                              style={{
                                background: isTaken ? MED_LIGHT : "var(--lifeflow-muted)",
                                color: isTaken ? MED_COLOR : "var(--color-text-disabled)",
                              }}
                            >
                              <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                            </button>
                            <span className="text-[12px] text-[var(--color-text-secondary)] ml-0.5">{unit}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}

      {/* ===== 今日服药打卡进度条卡 ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--lifeflow-card)] rounded-[16px] shadow-[var(--shadow-card)] p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight">今日按时服药</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)] leading-normal">
              已完成 <span className="font-semibold" style={{ color: MED_COLOR }}>{taken}</span>
              <span className="text-[var(--color-text-disabled)]">/{total}</span> 次
              {missed > 0 && (
                <>
                  <span className="text-[var(--color-text-disabled)]"> · </span>
                  <span className="text-[var(--state-error)]">漏服 {missed} 次</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCheckin}
            disabled={allDone}
            className="shrink-0 h-9 px-4 rounded-full flex items-center gap-1.5 text-[13px] font-semibold transition-colors active:scale-95 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lifeflow-card)]"
            style={{
              background: allDone ? SUCCESS_LIGHT : MED_LIGHT,
              color: allDone ? "var(--state-success)" : MED_COLOR,
            }}
          >
            <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            <span>打卡</span>
          </button>
        </div>
        {/* knit-track / knit-fill 进度条 */}
        <div
          className="relative h-[6px] rounded-full overflow-hidden mt-3"
          role="progressbar"
          aria-label="今日服药完成度"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={taken}
          style={{ background: "var(--lifeflow-knit-bg)" }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-500 ease-in-out"
            style={{
              width: `${progressPct}%`,
              background: allDone ? "var(--state-success)" : MED_COLOR,
            }}
          />
        </div>
      </motion.section>

      {/* ===== 今日用药计划摘要卡 ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-[var(--lifeflow-card)] rounded-[16px] shadow-[var(--shadow-card)] px-4 py-3.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight">今日用药计划</p>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)] leading-normal">
              今日已选 <span className="font-semibold" style={{ color: MED_COLOR }}>{selectedMedicines.length}</span> 种药
            </p>
          </div>
          <span className="text-[12px] text-[var(--color-text-disabled)] leading-normal text-right max-w-[50%] truncate">
            {selectedMedicines.length ? `已选：${selectedMedicines.map(m => m.name).join("、")}` : "还没有选择药品"}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-center text-[var(--color-text-secondary)] leading-normal">勾选即自动同步到「日程」，按时段提醒用药</p>
      </motion.section>

      {/* ===== 药品管理（增删改，功能不变） ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between px-1 pt-1 pb-2">
          <p className="text-[12px] font-medium text-[var(--color-text-disabled)]">药品管理</p>
          <button
            onClick={openCreate}
            className="h-8 px-3 rounded-full flex items-center gap-1 text-[13px] font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
            style={{ background: MED_LIGHT, color: MED_COLOR }}
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            <span>新建</span>
          </button>
        </div>

        {medicines.length === 0 ? (
          <div
            className="py-10 flex flex-col items-center rounded-[16px]"
            style={{ background: "var(--lifeflow-card)", boxShadow: "var(--shadow-card)" }}
          >
            <Pill className="w-10 h-10 mb-3 text-[var(--color-text-disabled)]" />
            <p className="text-[14px] text-[var(--color-text-secondary)]">暂无药品记录</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {medicines.map((med, i) => {
              const slots = medicineSlots.get(med.id) || [];
              return (
                <motion.div
                  key={med.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-3.5 rounded-[12px] flex items-center gap-3"
                  style={{
                    background: "var(--lifeflow-card)",
                    boxShadow: "var(--shadow-card)",
                    opacity: med.active ? 1 : 0.55,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: `${med.color}20` }}
                  >
                    <Pill className="w-5 h-5 shrink-0" style={{ color: med.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                      {med.name}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-disabled)]">
                      {med.dosage && `${med.dosage} · `}{slotListLabel(slots)}
                      {!med.active && " · 已停用"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleActive(med)}
                      className="h-8 px-2.5 rounded-full text-[12px] font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                      style={{ background: "var(--lifeflow-muted)", color: med.active ? med.color : "var(--color-text-disabled)" }}
                    >
                      {med.active ? "停用" : "启用"}
                    </button>
                    <button
                      onClick={() => openEdit(med)}
                      className="h-8 px-2.5 rounded-full text-[12px] font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                      style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(med)}
                      className="h-8 px-2.5 rounded-full text-[12px] font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                      style={{ background: ERROR_LIGHT, color: "var(--state-error)" }}
                    >
                      删除
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* ===== 新增/编辑弹窗 ===== */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 z-50 bg-black/40"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-[20px] max-w-[430px] mx-auto"
              style={{
                background: "var(--color-surface-card)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="flex justify-center pt-2 pb-3">
                <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
              </div>

              <div className="px-5 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[20px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                    {editingMed ? "编辑药品" : "新建药品"}
                  </h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="h-8 px-3 rounded-full text-[13px] font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                    style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}
                  >
                    关闭
                  </button>
                </div>

                {/* 名称 */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    药品名称
                  </label>
                  <input
                    type="text" placeholder="例如：维生素C"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-[12px] text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                    autoFocus
                  />
                </div>

                {/* 剂量 */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    剂量
                  </label>
                  <input
                    type="text" placeholder="例如：1片 / 500mg"
                    value={form.dosage}
                    onChange={(e) => setForm(f => ({ ...f, dosage: e.target.value }))}
                    className="w-full px-4 py-3 rounded-[12px] text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                  />
                </div>

                {/* 时段选择器（替代旧版频率选择） */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>
                    服用时段 · {slotListSummary(form.selectedSlots)}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const active = form.selectedSlots.includes(slot.key);
                      return (
                        <button
                          key={slot.key}
                          onClick={() => toggleFormSlot(slot.key)}
                          className="flex flex-col items-center gap-1 py-3 rounded-[12px] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                          style={{
                            background: active ? `${form.color}15` : "var(--lifeflow-background)",
                            border: `1.5px solid ${active ? form.color : "var(--lifeflow-border)"}`,
                          }}
                        >
                          <span className="text-[12px] font-medium" style={{ color: active ? form.color : "var(--color-text-disabled)" }}>
                            {slot.label}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-disabled)]">
                            {slot.time}
                          </span>
                          {active && (
                            <Check className="w-3 h-3" style={{ color: form.color }} strokeWidth={3} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 截止日期 */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-1.5 block" style={{ color: "var(--color-text-secondary)" }}>
                    截止日期（可选）
                  </label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full px-4 py-3 rounded-[12px] text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                  />
                </div>

                {/* 颜色 */}
                <div className="mb-6">
                  <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>
                    颜色
                  </label>
                  <div className="flex gap-3">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                        style={{ background: c, transform: form.color === c ? "scale(1.15)" : "scale(1)" }}>
                        {form.color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleSave}
                  className="w-full py-3.5 rounded-full text-white text-[16px] font-semibold active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lifeflow-ring)]"
                  style={{ background: "var(--lifeflow-primary)" }}>
                  {editingMed ? "保存修改" : "新建药品"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
