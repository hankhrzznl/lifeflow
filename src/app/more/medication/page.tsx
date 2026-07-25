"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft, Pill, Plus, X, Circle, Check, Trash2, Pencil,
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
  { key: "morning", label: "早晨", time: "08:00", icon: "🌅" },
  { key: "noon", label: "中午", time: "12:00", icon: "☀️" },
  { key: "evening", label: "晚上", time: "18:00", icon: "🌆" },
  { key: "bedtime", label: "睡前", time: "22:00", icon: "🌙" },
] as const;

type TimeSlotKey = (typeof TIME_SLOTS)[number]["key"];

const COLORS = ["#DC2626", "#FF9500", "#34C759", "#007AFF", "#5856D6", "#FF2D55", "#AF52DE", "#00C7BE"];

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

// ============================================================
// 主组件
// ============================================================

export default function MedicationPage() {
  const router = useRouter();
  const today = todayStr();

  const medicines = useLiveQuery(() => getMedicines(), [], [] as MedicineDefinition[]);
  const todayLogs = useLiveQuery(() => getMedicineLogsByDate(today), [today], [] as MedicineLog[]);

  const activeMedicines = useMemo(() => medicines.filter(m => m.active), [medicines]);

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
  const [form, setForm] = useState({ name: "", dosage: "", color: COLORS[0], selectedSlots: ["morning"] as TimeSlotKey[] });

  const openCreate = () => {
    setEditingMed(null);
    setForm({ name: "", dosage: "", color: COLORS[0], selectedSlots: ["morning"] });
    setShowForm(true);
  };

  const openEdit = (m: MedicineDefinition) => {
    setEditingMed(m);
    setForm({
      name: m.name,
      dosage: m.dosage,
      color: m.color,
      selectedSlots: parseLegacyFrequency(m.frequency),
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
        color: form.color,
      });
      showToast({ type: "success", message: "已更新" });
    } else {
      await addMedicine({
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        frequency: freqValue,
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

  // ── 今日统计（按实际已选时段计算） ──
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

  return (
    <div className="mx-auto pb-[100px]" style={{ maxWidth: 430, minHeight: "100vh", background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="px-5 pt-[var(--safe-area-top)] pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-[34px] font-bold font-['SF_Pro_Display',_-apple-system] leading-tight" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.022em" }}>
            吃药
          </h1>
          <p className="text-[13px] font-medium mt-1" style={{ color: "var(--color-text-secondary)", letterSpacing: "-0.01em" }}>
            用药提醒
          </p>
        </div>
        <button
          onClick={openCreate}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--lifeflow-primary)" }}
        >
          <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
        </button>
      </div>

      <div className="px-4">
        {/* 今日用药 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 mb-4"
          style={{ background: "var(--color-surface-card)", borderRadius: 20, boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5" style={{ color: "var(--lifeflow-primary)" }} />
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                今日用药
              </h2>
            </div>
            {activeMedicines.length > 0 && (
              <span className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--lifeflow-brand-50)", color: "var(--lifeflow-primary)" }}>
                {todayStats.taken}/{todayStats.total}
              </span>
            )}
          </div>

          {activeMedicines.length === 0 ? (
            <div className="py-6 flex flex-col items-center">
              <Pill className="w-10 h-10 mb-3" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>还没有添加药品。点这里添加第一个。</p>
              <button onClick={openCreate} className="mt-3 text-[13px] font-medium" style={{ color: "var(--lifeflow-primary)" }}>
                新建药品
              </button>
            </div>
          ) : (
            <div>
              {activeMedicines.map((med, mi) => {
                const slots = medicineSlots.get(med.id) || [];
                return (
                <div key={med.id}>
                  {mi > 0 && <div className="my-3 h-px" style={{ background: "var(--lifeflow-border)" }} />}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: med.color }} />
                      <span className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {med.name}
                      </span>
                      {med.dosage && (
                        <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: "var(--lifeflow-muted)", color: "var(--color-text-secondary)" }}>
                          {med.dosage}
                        </span>
                      )}
                      <span className="text-[11px] ml-auto" style={{ color: "var(--color-text-disabled)" }}>
                        {slotListSummary(slots)}
                      </span>
                    </div>
                    {/* 只显示已选时段按钮 */}
                    <div className="flex gap-2">
                      {slots.map((slotKey) => {
                        const slot = TIME_SLOTS.find(s => s.key === slotKey)!;
                        const key = `${med.id}_${slotKey}`;
                        const log = logMap.get(key);
                        const isTaken = log?.taken ?? false;
                        return (
                          <button
                            key={slotKey}
                            onClick={() => handleToggle(med.id, slotKey)}
                            className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all active:scale-95"
                            style={{
                              background: isTaken ? `${med.color}15` : "var(--lifeflow-background)",
                              border: `1.5px solid ${isTaken ? med.color : "var(--lifeflow-border)"}`,
                            }}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{
                                background: isTaken ? med.color : "transparent",
                                border: isTaken ? "none" : "1.5px solid var(--color-text-disabled)",
                              }}
                            >
                              {isTaken && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                            <span className="text-[11px] font-medium" style={{ color: isTaken ? med.color : "var(--color-text-disabled)" }}>
                              {slot.label}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--color-text-disabled)" }}>
                              {slot.time}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* 药品管理 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <p className="text-[12px] font-medium mb-2.5 px-1" style={{ color: "var(--color-text-disabled)" }}>
            药品管理
          </p>

          {medicines.length === 0 ? (
            <div
              className="py-10 flex flex-col items-center rounded-[20px]"
              style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
            >
              <Pill className="w-10 h-10 mb-3" style={{ color: "var(--color-text-disabled)" }} />
              <p className="text-[14px]" style={{ color: "var(--color-text-secondary)" }}>暂无药品记录</p>
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
                  className="p-3.5 rounded-[16px] flex items-center gap-3"
                  style={{
                    background: "var(--color-surface-card)",
                    boxShadow: "var(--shadow-card)",
                    opacity: med.active ? 1 : 0.5,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${med.color}20` }}
                  >
                    <Pill className="w-5 h-5" style={{ color: med.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                      {med.name}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-text-disabled)" }}>
                      {med.dosage && `${med.dosage} · `}{slotListLabel(slots)}
                      {!med.active && " · 已停用"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggleActive(med)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                      title={med.active ? "停用" : "启用"}>
                      <Circle className="w-4 h-4" style={{ color: med.active ? med.color : "var(--color-text-disabled)" }}
                        fill={med.active ? med.color : "none"} />
                    </button>
                    <button onClick={() => openEdit(med)} className="w-8 h-8 flex items-center justify-center rounded-lg">
                      <Pencil className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
                    </button>
                    <button onClick={() => handleDelete(med)} className="w-8 h-8 flex items-center justify-center rounded-lg">
                      <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-disabled)" }} />
                    </button>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

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
                  <button onClick={() => setShowForm(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--lifeflow-muted)" }}>
                    <X className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />
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
                    className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
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
                    className="w-full px-4 py-3 rounded-xl text-[15px] outline-none"
                    style={{ background: "var(--lifeflow-background)", color: "var(--color-text-primary)" }}
                  />
                </div>

                {/* 时段选择器（替代旧版频率选择） */}
                <div className="mb-4">
                  <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>
                    服用时段 · {slotListSummary(form.selectedSlots)}
                  </label>
                  <div className="flex gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const active = form.selectedSlots.includes(slot.key);
                      return (
                        <button
                          key={slot.key}
                          onClick={() => toggleFormSlot(slot.key)}
                          className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all active:scale-95"
                          style={{
                            background: active ? `${form.color}15` : "var(--lifeflow-background)",
                            border: `1.5px solid ${active ? form.color : "var(--lifeflow-border)"}`,
                          }}
                        >
                          <span className="text-[18px]">{slot.icon}</span>
                          <span className="text-[12px] font-medium" style={{ color: active ? form.color : "var(--color-text-disabled)" }}>
                            {slot.label}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--color-text-disabled)" }}>
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

                {/* 颜色 */}
                <div className="mb-6">
                  <label className="text-[13px] font-medium mb-2 block" style={{ color: "var(--color-text-secondary)" }}>
                    颜色
                  </label>
                  <div className="flex gap-3">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                        style={{ background: c, transform: form.color === c ? "scale(1.15)" : "scale(1)" }}>
                        {form.color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleSave}
                  className="w-full py-3.5 rounded-full text-white text-[16px] font-semibold active:opacity-90"
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
