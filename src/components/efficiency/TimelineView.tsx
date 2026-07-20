"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CheckCircle, Circle, Target,
  DollarSign, Droplets, Dumbbell, Moon,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getItemsByDate, updateItem, deleteItem,
  type Item,
} from "@/lib/db/daylog.db";
import { getAllProjects, type Project } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";

// ==================== 工具 ====================

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTimeRange(plannedStart: string, plannedEnd: string, actualStart?: string, actualEnd?: string, corrected?: boolean): string {
  const base = `${plannedStart} - ${plannedEnd}`;
  if (!corrected || !actualStart || !actualEnd) return base;
  return `${base} → ${actualStart} - ${actualEnd}`;
}

// ==================== 校准弹窗 ====================

function CalibrateModal({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: Item;
  onClose: () => void;
  onSave: (actualStart: string, actualEnd: string) => Promise<void>;
}) {
  const [start, setStart] = useState(item.isCorrected ? item.actualStart : item.plannedStart);
  const [end, setEnd] = useState(item.isCorrected ? item.actualEnd : item.plannedEnd);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl"
      >
        <h3 className="text-[17px] font-bold text-[#1D1D1F] mb-1">校准时间</h3>
        <p className="text-[13px] text-[#86868B] mb-4">
          计划：{item.plannedStart} — {item.plannedEnd}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-[13px] text-[#86868B] mb-1">实际开始</label>
            <input
              type="time" value={start} onChange={(e) => setStart(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#F5F5F5] text-[15px] outline-none"
            />
          </div>
          <div>
            <label className="block text-[13px] text-[#86868B] mb-1">实际结束</label>
            <input
              type="time" value={end} onChange={(e) => setEnd(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#F5F5F5] text-[15px] outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-[#F2F2F7] text-[#86868B] text-[15px] font-medium">
            取消
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onSave(start, end)}
            className="flex-1 py-2.5 rounded-lg bg-[#6366F1] text-white text-[15px] font-medium"
          >
            保存
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==================== 事项详情弹窗 ====================

function ItemDetailSheet({
  item,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: Item;
  onClose: () => void;
  onUpdate: (updates: Partial<Item>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [costInput, setCostInput] = useState("");
  const [waterInput, setWaterInput] = useState("");
  const [workoutInput, setWorkoutInput] = useState(item.workoutNote || "");
  const [showCalibrate, setShowCalibrate] = useState(false);

  const handleCost = async () => {
    const val = parseFloat(costInput);
    if (isNaN(val) || val <= 0) return;
    await onUpdate({ cost: Math.round(val * 100) });
    showToast({ type: "success", message: `已记录 ¥${costInput}` });
    setCostInput("");
  };

  const handleWater = async () => {
    const val = parseInt(waterInput);
    if (isNaN(val) || val <= 0) return;
    const total = (item.water || 0) + val;
    await onUpdate({ water: total });
    showToast({ type: "success", message: `+${val}ml 喝水` });
    setWaterInput("");
  };

  const handleWorkout = async () => {
    if (!workoutInput.trim()) return;
    await onUpdate({ workoutNote: workoutInput.trim() });
    showToast({ type: "success", message: "训练已记录" });
  };

  const handleCalibrate = async (actualStart: string, actualEnd: string) => {
    await onUpdate({ actualStart, actualEnd, isCorrected: true });
    setShowCalibrate(false);
    showToast({ type: "success", message: "时间已校准" });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40"
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-[20px] max-h-[70vh] overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full bg-[#D4D4D4]" />
        </div>
        <div className="px-4 pb-2">
          <p className="text-[17px] font-semibold text-[#1D1D1F] truncate">{item.title}</p>
          <p className="text-[13px] text-[#86868B] mt-0.5">{item.plannedStart} — {item.plannedEnd}</p>
          {item.isCorrected && (
            <p className="text-[13px] text-[#FF9500] mt-0.5">
              实际：{item.actualStart} — {item.actualEnd}
            </p>
          )}
        </div>

        <div className="px-4 space-y-1 pb-6">
          {/* 校准时间 */}
          <SheetBtn icon={Target} label="校准时间" onClick={() => setShowCalibrate(true)} />

          {/* 记账 */}
          <div className="flex items-center gap-2 py-2">
            <DollarSign className="w-5 h-5 text-[#86868B] flex-shrink-0" />
            <span className="text-[15px] text-[#AEAEB2] flex-shrink-0">¥</span>
            <input
              type="number" value={costInput} onChange={(e) => setCostInput(e.target.value)}
              placeholder="金额" inputMode="decimal"
              className="flex-1 bg-[#F5F5F5] rounded-lg px-3 py-1.5 text-[15px] outline-none"
            />
            <button onClick={handleCost} className="text-[15px] text-[#6366F1] font-medium flex-shrink-0">记录</button>
          </div>
          {item.cost != null && item.cost > 0 && (
            <p className="text-[13px] text-[#86868B] pl-8">已记录 ¥{(item.cost / 100).toFixed(2)}</p>
          )}

          {/* 饮水 */}
          <div className="flex items-center gap-2 py-2">
            <Droplets className="w-5 h-5 text-[#86868B] flex-shrink-0" />
            <span className="text-[15px] text-[#AEAEB2] flex-shrink-0">ml</span>
            <input
              type="number" value={waterInput} onChange={(e) => setWaterInput(e.target.value)}
              placeholder="饮水量" inputMode="numeric"
              className="flex-1 bg-[#F5F5F5] rounded-lg px-3 py-1.5 text-[15px] outline-none"
            />
            <button onClick={handleWater} className="text-[15px] text-[#6366F1] font-medium flex-shrink-0">+1杯</button>
          </div>
          {item.water != null && item.water > 0 && (
            <p className="text-[13px] text-[#86868B] pl-8">今日已喝 {item.water}ml</p>
          )}

          {/* 训练 */}
          <div className="flex items-center gap-2 py-2">
            <Dumbbell className="w-5 h-5 text-[#86868B] flex-shrink-0" />
            <input
              type="text" value={workoutInput} onChange={(e) => setWorkoutInput(e.target.value)}
              placeholder="动作·组数·重量" 
              className="flex-1 bg-[#F5F5F5] rounded-lg px-3 py-1.5 text-[15px] outline-none"
            />
            <button onClick={handleWorkout} className="text-[15px] text-[#6366F1] font-medium flex-shrink-0">记录</button>
          </div>

          {/* 删除 */}
          <SheetBtn
            icon={undefined} label="删除事项" danger
            onClick={async () => { await onDelete(); onClose(); }}
          />
        </div>
      </motion.div>

      {showCalibrate && (
        <CalibrateModal
          open={showCalibrate}
          item={item}
          onClose={() => setShowCalibrate(false)}
          onSave={handleCalibrate}
        />
      )}
    </>
  );
}

function SheetBtn({ icon: Icon, label, danger, onClick }: {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full py-3 text-left"
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" style={{ color: danger ? "#FF3B30" : "#86868B" }} />}
      <span className="text-[15px]" style={{ color: danger ? "#FF3B30" : "#1D1D1F" }}>{label}</span>
    </button>
  );
}

// ==================== 主组件 ====================

export default function TimelineView({ date }: { date: string }) {
  const items = useLiveQuery(() => getItemsByDate(date), [date], [] as Item[]);
  const projects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.color);
    return map;
  }, [projects]);

  const eventsByHour: Record<number, Item[]> = {};
  for (const item of items) {
    const startH = parseInt(item.plannedStart.split(":")[0]);
    if (!eventsByHour[startH]) eventsByHour[startH] = [];
    eventsByHour[startH].push(item);
  }

  const handleUpdate = useCallback(async (item: Item, updates: Partial<Item>) => {
    await updateItem(item.id, { ...updates, updatedAt: Date.now() });
  }, []);

  const handleToggle = useCallback(async (item: Item) => {
    await updateItem(item.id, { isCompleted: !item.isCompleted, updatedAt: Date.now() });
  }, []);

  const handleDelete = useCallback(async (item: Item) => {
    await deleteItem(item.id);
    showToast({ type: "success", message: "已删除" });
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[15px] text-[#AEAEB2]">当日暂无安排</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {HOURS.map((hour) => {
          const hourItems = eventsByHour[hour] || [];
          const hourStr = `${String(hour).padStart(2, "0")}:00`;
          return (
            <div key={hour} className="flex items-start gap-2 min-h-[52px] py-1">
              <span className="w-12 text-xs text-[#AEAEB2] pt-1 flex-shrink-0 text-right">{hourStr}</span>
              <div className="flex-1 space-y-1">
                {hourItems.length === 0 ? (
                  <div className="h-10 rounded-lg border border-dashed" style={{ borderColor: "#EBEBEB" }} />
                ) : (
                  hourItems.map((item) => {
                    const projectColor = projectColorMap.get(item.projectId || "");
                    return (
                      <div key={item.id}
                        className="w-full rounded-xl text-left transition-colors bg-white border border-[#EBEBEB]"
                      >
                        <div className="flex items-center gap-2.5 px-3 py-2.5">
                          {/* 勾选 */}
                          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); handleToggle(item); }}
                            className="flex-shrink-0">
                            {item.isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-[#34C759]" strokeWidth={1.5} />
                            ) : (
                              <Circle className="w-5 h-5 text-[#C7C7CC]" strokeWidth={1.5} />
                            )}
                          </motion.button>

                          {/* 内容 */}
                          <div className="flex-1 min-w-0" onClick={() => setSelectedItem(item)}>
                            <div className="flex items-center gap-2">
                              {projectColor && (
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: projectColor }} />
                              )}
                              <span className={`text-sm truncate ${item.isCompleted ? "line-through text-[#AEAEB2]" : "font-medium text-[#1D1D1F]"}`}>
                                {item.title}
                              </span>
                              <span className="text-xs text-[#AEAEB2] flex-shrink-0">
                                {item.plannedStart} - {item.plannedEnd}
                              </span>
                            </div>
                            {item.isCorrected && (
                              <p className="text-xs text-[#FF9500] mt-0.5">
                                实际：{item.actualStart} — {item.actualEnd}
                              </p>
                            )}
                            {/* 标签 */}
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.cost != null && item.cost > 0 && (
                                <span className="text-[11px] text-[#86868B]">¥{(item.cost / 100).toFixed(0)}</span>
                              )}
                              {item.water != null && item.water > 0 && (
                                <span className="text-[11px] text-[#5AC8FA]">{item.water}ml 水</span>
                              )}
                              {item.workoutNote && (
                                <span className="text-[11px] text-[#FF9500]">{item.workoutNote}</span>
                              )}
                            </div>
                          </div>

                          {/* 校准 */}
                          <motion.button whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] flex-shrink-0">
                            <Target className="w-4 h-4 text-[#FF9500]" strokeWidth={1.5} />
                          </motion.button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 详情弹窗 */}
      <AnimatePresence>
        {selectedItem && (
          <ItemDetailSheet
            key={selectedItem.id}
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdate={(updates) => handleUpdate(selectedItem, updates)}
            onDelete={() => handleDelete(selectedItem)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
