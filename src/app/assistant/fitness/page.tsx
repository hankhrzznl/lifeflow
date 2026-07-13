"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Dumbbell, Edit2, Trash2, Trophy,
  Flame, Award, Clock, ArrowRight,
  BookOpen, Activity, CheckSquare, Square, X,
  List, RotateCcw, Copy,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import {
  getAllMuscleGroups,
  getAllSubMuscles,
  getPresetExercisesBySubMuscle,
  getRecentMuscleRecords,
  addMuscleRecord,
  deleteMuscleRecord,
  updateMuscleRecord,
  initializeMuscleData,
  calculateWeeklyProgress,
  updateSubMuscle,
  deleteSubMuscle,
  addSubMuscle,
  addPresetExercise,
  getAllCustomTrainingPlans,
  addCustomTrainingPlan,
  deleteCustomTrainingPlan,
  getGoalsByProject,
  getAllProjectsV2,
} from "@/lib/db";
import { notifyGoalProgressUpdate } from "@/lib/linkage";
import type {
  MuscleGroup, SubMuscle, PresetExercise, MuscleRecord,
  CustomTrainingPlan, PlanTrainingDay,
  Goal,
} from "@/lib/types";
import { RPE_LABELS, REST_TIME_PRESETS } from "@/lib/types";

// ==================== 热身/拉伸预设动作 ====================

const WARMUP_EXERCISES = [
  { name: "跳绳", duration: "3-5分钟", icon: "🪢" },
  { name: "开合跳", duration: "2分钟", icon: "⭐" },
  { name: "高抬腿", duration: "30秒×3组", icon: "🦵" },
  { name: "肩部环绕", duration: "30秒", icon: "🔄" },
  { name: "髋关节环绕", duration: "30秒", icon: "🔃" },
  { name: "动态拉伸", duration: "3分钟", icon: "🤸" },
  { name: "泡沫轴放松", duration: "5分钟", icon: "🫧" },
  { name: "猫牛式", duration: "10次", icon: "🐱" },
];

const STRETCH_EXERCISES = [
  { name: "胸部拉伸", duration: "每侧30秒", icon: "💪" },
  { name: "背阔肌拉伸", duration: "每侧30秒", icon: "🔙" },
  { name: "股四头肌拉伸", duration: "每侧30秒", icon: "🦵" },
  { name: "腘绳肌拉伸", duration: "每侧30秒", icon: "🦿" },
  { name: "肩部拉伸", duration: "每侧30秒", icon: "🏋️" },
  { name: "髋屈肌拉伸", duration: "每侧30秒", icon: "🦴" },
  { name: "小腿拉伸", duration: "每侧30秒", icon: "🦶" },
  { name: "三头肌拉伸", duration: "每侧30秒", icon: "💪" },
  { name: "全身拉伸", duration: "5分钟", icon: "🧘" },
  { name: "婴儿式", duration: "1分钟", icon: "👶" },
  { name: "鸽子式", duration: "每侧1分钟", icon: "🕊️" },
  { name: "下犬式", duration: "1分钟", icon: "🐕" },
];

// ==================== Sub-components ====================

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-800/50 backdrop-blur-lg rounded-2xl p-4 border border-gray-700/50 ${className}`}>
      {children}
    </div>
  );
}

// ==================== Muscle Group Card ====================

function MuscleGroupCard({
  group,
  subMuscles,
  onSelect,
  onManageSubMuscles,
  onSelectSubMuscle,
  selectedSubMuscleId,
}: {
  group: MuscleGroup;
  subMuscles: SubMuscle[];
  onSelect: (group: MuscleGroup, subMuscles: SubMuscle[]) => void;
  onManageSubMuscles: (group: MuscleGroup) => void;
  onSelectSubMuscle: (subMuscle: SubMuscle) => void;
  selectedSubMuscleId?: number | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="hover:border-gray-600 transition-all">
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => {
            setIsExpanded(!isExpanded);
            if (!isExpanded) onSelect(group, subMuscles);
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${group.color}20` }}
          >
            {group.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{group.name}</h3>
            <p className="text-sm text-gray-400">{group.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{subMuscles.length}个小肌肉</span>
          <button
            onClick={(e) => { e.stopPropagation(); onManageSubMuscles(group); }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4 text-gray-400" />
          </button>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
              {subMuscles.map((subMuscle) => (
                <div
                  key={subMuscle.id}
                  onClick={() => onSelectSubMuscle(subMuscle)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${
                    selectedSubMuscleId === subMuscle.id
                      ? "bg-indigo-500/20 border border-indigo-500/30"
                      : "bg-gray-700/30 hover:bg-gray-700/50"
                  }`}
                >
                  <div>
                    <p className="text-white font-medium">{subMuscle.name}</p>
                    <p className="text-xs text-gray-400">{subMuscle.description || "暂无描述"}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ==================== Sub Muscle Manager Modal ====================

function SubMuscleManagerModal({
  isOpen, onClose, muscleGroup, subMuscles, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; muscleGroup: MuscleGroup; subMuscles: SubMuscle[]; onSuccess: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingSubMuscle, setEditingSubMuscle] = useState<SubMuscle | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) { showToast({ message: "请输入小肌肉名称", type: "error", duration: 2000 }); return; }
    setIsSubmitting(true);
    try {
      await addSubMuscle({ muscleGroupId: muscleGroup.id!, name: newName.trim(), description: newDescription.trim() || undefined, order: subMuscles.length + 1 });
      showToast({ message: "小肌肉已添加", type: "success", duration: 2000 });
      setNewName(""); setNewDescription(""); onSuccess();
    } catch { showToast({ message: "添加失败", type: "error", duration: 2000 }); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!editingSubMuscle || !editName.trim()) { showToast({ message: "请输入小肌肉名称", type: "error", duration: 2000 }); return; }
    setIsSubmitting(true);
    try {
      await updateSubMuscle(editingSubMuscle.id!, { name: editName.trim(), description: editDescription.trim() || undefined });
      showToast({ message: "小肌肉已更新", type: "success", duration: 2000 });
      setEditingSubMuscle(null); onSuccess();
    } catch { showToast({ message: "更新失败", type: "error", duration: 2000 }); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (sub: SubMuscle) => {
    if (!confirm(`确定要删除"${sub.name}"吗？这将同时删除所有相关的训练记录。`)) return;
    setIsSubmitting(true);
    try { await deleteSubMuscle(sub.id!); showToast({ message: "小肌肉已删除", type: "success", duration: 2000 }); onSuccess(); }
    catch { showToast({ message: "删除失败", type: "error", duration: 2000 }); }
    finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl border border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${muscleGroup.color}20` }}>{muscleGroup.icon}</div>
            <div><h3 className="text-xl font-bold text-white">{muscleGroup.name}</h3><p className="text-sm text-gray-400">管理小肌肉</p></div>
          </div>
          {!editingSubMuscle && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-xl">
              <h4 className="font-medium text-white mb-3">添加新小肌肉</h4>
              <div className="space-y-3">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="小肌肉名称"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="描述（可选）"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={handleAdd} disabled={isSubmitting}
                  className="w-full py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50">添加</button>
              </div>
            </div>
          )}
          {editingSubMuscle && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-xl">
              <h4 className="font-medium text-white mb-3">编辑小肌肉</h4>
              <div className="space-y-3">
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="小肌肉名称"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="描述（可选）"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-2">
                  <button onClick={() => setEditingSubMuscle(null)} className="flex-1 py-2 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors">取消</button>
                  <button onClick={handleEdit} disabled={isSubmitting} className="flex-1 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50">保存</button>
                </div>
              </div>
            </div>
          )}
          <div>
            <h4 className="font-medium text-white mb-3">现有小肌肉</h4>
            <div className="space-y-2">
              {subMuscles.map((subMuscle) => (
                <div key={subMuscle.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl">
                  <div className="flex-1"><p className="text-white font-medium">{subMuscle.name}</p><p className="text-xs text-gray-400">{subMuscle.description || "暂无描述"}</p></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingSubMuscle(subMuscle); setEditName(subMuscle.name); setEditDescription(subMuscle.description || ""); }} className="p-1.5 hover:bg-gray-600 rounded-lg transition-colors"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                    <button onClick={() => handleDelete(subMuscle)} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              ))}
              {subMuscles.length === 0 && <p className="text-gray-400 text-center py-4">暂无小肌肉</p>}
            </div>
          </div>
          <div className="mt-6">
            <button onClick={onClose} className="w-full py-3 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors">关闭</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== Add Record Modal (two-step) ====================

function AddRecordModal({
  isOpen, onClose, muscleGroups, subMuscles, presetExercises, onSuccess, selectedGoalId,
}: {
  isOpen: boolean; onClose: () => void; muscleGroups: MuscleGroup[]; subMuscles: SubMuscle[]; presetExercises: PresetExercise[]; onSuccess: () => void; selectedGoalId: number | null;
}) {
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  const [selectedSubMuscle, setSelectedSubMuscle] = useState<SubMuscle | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState(7);
  const [restTime, setRestTime] = useState(60);
  const [feeling, setFeeling] = useState<"easy" | "medium" | "hard">("medium");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState(1);
  const [equipment, setEquipment] = useState("");

  const filteredSubMuscles = selectedGroup ? subMuscles.filter((s) => s.muscleGroupId === selectedGroup.id) : [];
  const filteredExercises = selectedSubMuscle ? presetExercises.filter((e) => e.subMuscleId === selectedSubMuscle.id) : [];

  const resetForm = () => {
    setSelectedGroup(null); setSelectedSubMuscle(null); setExerciseName(""); setSets("3"); setReps("10");
    setWeight(""); setRpe(7); setRestTime(60); setFeeling("medium"); setNotes(""); setStep(1); setEquipment("");
  };

  const handleSubmit = async () => {
    if (!selectedSubMuscle || !exerciseName || !weight) { showToast({ message: "请填写完整信息", type: "error", duration: 2000 }); return; }
    const today = new Date().toISOString().split("T")[0];
    const isNewExercise = !filteredExercises.some((e) => e.name === exerciseName);
    if (isNewExercise && equipment.trim()) {
      try { await addPresetExercise({ name: exerciseName.trim(), subMuscleId: selectedSubMuscle.id!, equipment: equipment.trim() || undefined, isCustom: true }); }
      catch { /* non-critical */ }
    }
    await addMuscleRecord({
      subMuscleId: selectedSubMuscle.id!, exerciseName, sets: parseInt(sets) || 3, reps: parseInt(reps) || 10,
      weight: parseFloat(weight) || 0, rpe, restTime, feeling, date: today, timestamp: Date.now(), notes: notes || undefined,
      goalId: selectedGoalId || undefined,
    });
    if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
    showToast({ message: "训练记录已添加", type: "success", duration: 2000 });
    onSuccess(); onClose(); resetForm();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-xl border border-gray-700 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"><Plus className="w-6 h-6 text-white" /></div>
            <div><h3 className="text-xl font-bold text-white">添加训练记录</h3><p className="text-sm text-gray-400">记录你的力量训练</p></div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">选择大肌群</label>
                <div className="grid grid-cols-3 gap-3">
                  {muscleGroups.map((group) => (
                    <button key={group.id} onClick={() => { setSelectedGroup(group); setSelectedSubMuscle(null); setExerciseName(""); }}
                      className={`p-4 rounded-xl text-center transition-all ${selectedGroup?.id === group.id ? "ring-2 ring-indigo-500 bg-indigo-500/20" : "bg-gray-800 hover:bg-gray-700"}`}>
                      <div className="text-3xl mb-2" style={{ backgroundColor: `${group.color}20` }}>{group.icon}</div>
                      <p className="text-white font-medium text-sm">{group.name}</p>
                    </button>
                  ))}
                </div>
              </div>
              {selectedGroup && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="text-sm text-gray-400 mb-2 block">选择小肌肉</label>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredSubMuscles.map((subMuscle) => (
                      <button key={subMuscle.id} onClick={() => setSelectedSubMuscle(subMuscle)}
                        className={`p-3 rounded-xl text-center transition-all ${selectedSubMuscle?.id === subMuscle.id ? "ring-2 ring-indigo-500 bg-indigo-500/20" : "bg-gray-800 hover:bg-gray-700"}`}>
                        <p className="text-white font-medium">{subMuscle.name}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {selectedSubMuscle && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="text-sm text-gray-400 mb-2 block">选择或输入动作</label>
                  <select value="" onChange={(e) => setExerciseName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3">
                    <option value="">选择预设动作</option>
                    {filteredExercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.name}>{exercise.name} {exercise.equipment && `(${exercise.equipment})`}</option>
                    ))}
                  </select>
                  <input type="text" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="或输入自定义动作名称"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3" />
                  {exerciseName && !filteredExercises.some((e) => e.name === exerciseName) && (
                    <div className="mt-2">
                      <label className="text-sm text-gray-400 mb-2 block">器材（保存为预设动作）</label>
                      <input type="text" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="如：哑铃、杠铃、自重等（选填）"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <p className="text-xs text-gray-500 mt-1">输入器材名称可将此动作保存为预设动作</p>
                    </div>
                  )}
                </motion.div>
              )}
              {selectedSubMuscle && exerciseName && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setStep(2)}
                  className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors">下一步</motion.button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-sm text-gray-400 mb-2 block">组数</label><input type="number" value={sets} onChange={(e) => setSets(e.target.value)} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" /></div>
                <div><label className="text-sm text-gray-400 mb-2 block">每组次数</label><input type="number" value={reps} onChange={(e) => setReps(e.target.value)} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" /></div>
                <div><label className="text-sm text-gray-400 mb-2 block">重量(kg)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center" /></div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">RPE (努力程度) - {RPE_LABELS[rpe]}</label>
                <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>非常轻松</span><span>力竭</span></div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">组间休息时间</label>
                <div className="flex gap-2">
                  {REST_TIME_PRESETS.map((time) => (
                    <button key={time} onClick={() => setRestTime(time)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${restTime === time ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>{time}s</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">训练感受</label>
                <div className="flex gap-3">
                  {[
                    { key: "easy" as const, label: "轻松", emoji: "😊", color: "bg-green-500" },
                    { key: "medium" as const, label: "适中", emoji: "😐", color: "bg-yellow-500" },
                    { key: "hard" as const, label: "吃力", emoji: "😫", color: "bg-red-500" },
                  ].map(({ key, label, emoji, color }) => (
                    <button key={key} onClick={() => setFeeling(key)}
                      className={`flex-1 py-3 rounded-xl text-center transition-all ${feeling === key ? `ring-2 ring-indigo-500 ${color}` : "bg-gray-800"}`}>
                      <div className="text-2xl mb-1">{emoji}</div><p className="text-white text-sm font-medium">{label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="text-sm text-gray-400 mb-2 block">备注（可选）</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="添加备注..." rows={3} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors">上一步</button>
                <button onClick={handleSubmit} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors">保存记录</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== Edit Record Modal ====================

function EditRecordModal({
  isOpen, onClose, record, subMuscles, onSuccess, selectedGoalId,
}: {
  isOpen: boolean; onClose: () => void; record: MuscleRecord | null; subMuscles: SubMuscle[]; onSuccess: () => void; selectedGoalId: number | null;
}) {
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState(7);
  const [restTime, setRestTime] = useState(60);
  const [feeling, setFeeling] = useState<"easy" | "medium" | "hard">("medium");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setSets(String(record.sets));
      setReps(String(record.reps));
      setWeight(String(record.weight));
      setRpe(record.rpe);
      setRestTime(record.restTime);
      setFeeling(record.feeling);
      setNotes(record.notes || "");
    }
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    setIsSubmitting(true);
    try {
      await updateMuscleRecord(record.id!, {
        sets: parseInt(sets) || 3, reps: parseInt(reps) || 10, weight: parseFloat(weight) || 0,
        rpe, restTime, feeling, notes: notes || undefined,
      });
      showToast({ message: "训练记录已更新", type: "success", duration: 2000 });
      onSuccess(); onClose();
    } catch { showToast({ message: "更新失败", type: "error", duration: 2000 }); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm("确定要删除这条训练记录吗？")) return;
    setIsSubmitting(true);
    try { await deleteMuscleRecord(record.id!); if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); } showToast({ message: "记录已删除", type: "success", duration: 2000 }); onSuccess(); onClose(); }
    catch { showToast({ message: "删除失败", type: "error", duration: 2000 }); }
    finally { setIsSubmitting(false); }
  };

  if (!isOpen || !record) return null;

  const sm = subMuscles.find((s) => s.id === record.subMuscleId);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-xl border border-gray-700 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center"><Edit2 className="w-6 h-6 text-white" /></div>
            <div>
              <h3 className="text-xl font-bold text-white">编辑训练记录</h3>
              <p className="text-sm text-gray-400">{record.exerciseName}{sm ? ` · ${sm.name}` : ""}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-sm text-gray-400 mb-2 block">组数</label><input type="number" value={sets} onChange={(e) => setSets(e.target.value)} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center" /></div>
              <div><label className="text-sm text-gray-400 mb-2 block">每组次数</label><input type="number" value={reps} onChange={(e) => setReps(e.target.value)} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center" /></div>
              <div><label className="text-sm text-gray-400 mb-2 block">重量(kg)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center" /></div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">RPE (努力程度) - {RPE_LABELS[rpe]}</label>
              <input type="range" min="1" max="10" value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>非常轻松</span><span>力竭</span></div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">组间休息时间</label>
              <div className="flex gap-2">
                {REST_TIME_PRESETS.map((time) => (
                  <button key={time} onClick={() => setRestTime(time)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${restTime === time ? "bg-amber-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>{time}s</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">训练感受</label>
              <div className="flex gap-3">
                {[
                  { key: "easy" as const, label: "轻松", emoji: "😊", color: "bg-green-500" },
                  { key: "medium" as const, label: "适中", emoji: "😐", color: "bg-yellow-500" },
                  { key: "hard" as const, label: "吃力", emoji: "😫", color: "bg-red-500" },
                ].map(({ key, label, emoji, color }) => (
                  <button key={key} onClick={() => setFeeling(key)}
                    className={`flex-1 py-3 rounded-xl text-center transition-all ${feeling === key ? `ring-2 ring-amber-500 ${color}` : "bg-gray-800"}`}>
                    <div className="text-2xl mb-1">{emoji}</div><p className="text-white text-sm font-medium">{label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div><label className="text-sm text-gray-400 mb-2 block">备注（可选）</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" /></div>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-3 border border-red-500 text-red-500 rounded-xl font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50">删除</button>
              <button onClick={onClose} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors">取消</button>
              <button onClick={handleSave} disabled={isSubmitting} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50">保存</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== Warmup / Stretch Modal ====================

function WarmupStretchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"warmup" | "stretch">("warmup");
  if (!isOpen) return null;

  const exercises = tab === "warmup" ? WARMUP_EXERCISES : STRETCH_EXERCISES;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div><h3 className="text-xl font-bold text-white">热身 / 拉伸动作库</h3><p className="text-sm text-gray-400">训练前后参考动作</p></div>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setTab("warmup")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tab === "warmup" ? "bg-green-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              🔥 热身
            </button>
            <button onClick={() => setTab("stretch")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tab === "stretch" ? "bg-teal-500 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              🧘 拉伸
            </button>
          </div>

          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{ex.icon}</span>
                  <span className="text-white font-medium">{ex.name}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-lg">{ex.duration}</span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button onClick={onClose} className="w-full py-3 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors">关闭</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== Training Plan Creator Modal ====================

function TrainingPlanModal({
  isOpen, onClose, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"muscle_building" | "fat_loss" | "cardio">("muscle_building");
  const [goal, setGoal] = useState("");
  const [weeklyFrequency, setWeeklyFrequency] = useState(4);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [focusAreasStr, setFocusAreasStr] = useState("");
  const [cycleWeeks, setCycleWeeks] = useState(4);
  const [hasDeloadWeek, setHasDeloadWeek] = useState(true);
  const [deloadWeekFrequency, setDeloadWeekFrequency] = useState(4);
  const [planNotes, setPlanNotes] = useState("");
  const [trainingDays, setTrainingDays] = useState<PlanTrainingDay[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addDay = () => {
    setTrainingDays((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: `第${prev.length + 1}天`, duration: 60, exercises: [], description: "" },
    ]);
  };

  const removeDay = (dayId: string) => {
    setTrainingDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  const updateDay = (dayId: string, updates: Partial<PlanTrainingDay>) => {
    setTrainingDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...updates } : d)));
  };

  const addExerciseToDay = (dayId: string) => {
    setTrainingDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, { id: crypto.randomUUID(), name: "", sets: 3, reps: 10, restTime: 60 }] }
          : d
      )
    );
  };

  const removeExerciseFromDay = (dayId: string, exId: string) => {
    setTrainingDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d)));
  };

  const updateExercise = (dayId: string, exId: string, updates: Partial<PlanTrainingDay["exercises"][0]>) => {
    setTrainingDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...updates } : e)) } : d
      )
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) { showToast({ message: "请输入计划名称", type: "error", duration: 2000 }); return; }
    setIsSubmitting(true);
    try {
      await addCustomTrainingPlan({
        name: name.trim(),
        type,
        goal: goal.trim() || "增肌塑形",
        weeklyFrequency,
        sessionDuration,
        focusAreas: focusAreasStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        cycleWeeks,
        hasDeloadWeek,
        deloadWeekFrequency: hasDeloadWeek ? deloadWeekFrequency : undefined,
        trainingDays,
        notes: planNotes.trim() || undefined,
      });
      showToast({ message: "训练计划已创建", type: "success", duration: 2000 });
      onSuccess();
      onClose();
      resetForm();
    } catch { showToast({ message: "创建失败", type: "error", duration: 2000 }); }
    finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
    setName(""); setType("muscle_building"); setGoal(""); setWeeklyFrequency(4); setSessionDuration(60);
    setFocusAreasStr(""); setCycleWeeks(4); setHasDeloadWeek(true); setDeloadWeekFrequency(4);
    setPlanNotes(""); setTrainingDays([]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"><BookOpen className="w-6 h-6 text-white" /></div>
            <div><h3 className="text-xl font-bold text-white">创建训练计划</h3><p className="text-sm text-gray-400">保存为预设训练方案</p></div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">计划名称</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：推拉腿分割计划"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">训练类型</label>
                <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="muscle_building">增肌</option>
                  <option value="fat_loss">减脂</option>
                  <option value="cardio">心肺</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">每周训练天数</label>
                <input type="number" value={weeklyFrequency} onChange={(e) => setWeeklyFrequency(parseInt(e.target.value) || 1)} min={1} max={7}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">训练目标</label>
              <input type="text" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="如：增肌10kg、减脂5kg"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">每次时长(分钟)</label>
                <input type="number" value={sessionDuration} onChange={(e) => setSessionDuration(parseInt(e.target.value) || 30)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">周期(周)</label>
                <input type="number" value={cycleWeeks} onChange={(e) => setCycleWeeks(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">重点肌群（逗号分隔）</label>
              <input type="text" value={focusAreasStr} onChange={(e) => setFocusAreasStr(e.target.value)} placeholder="如：胸部, 背部, 腿部"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={hasDeloadWeek} onChange={(e) => setHasDeloadWeek(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                <span className="text-sm text-gray-300">包含减载周</span>
              </label>
              {hasDeloadWeek && (
                <span className="text-xs text-gray-400">每{deloadWeekFrequency}周</span>
              )}
            </div>

            {/* Training days */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">训练日安排</label>
                <button onClick={addDay} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus className="w-3 h-3" /> 添加训练日</button>
              </div>
              <div className="space-y-3">
                {trainingDays.map((day, di) => (
                  <div key={day.id} className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <input type="text" value={day.name} onChange={(e) => updateDay(day.id, { name: e.target.value })}
                        className="px-3 py-1 bg-gray-700 rounded-lg text-white text-sm font-medium border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{day.exercises.length}个动作</span>
                        <button onClick={() => removeDay(day.id)} className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"><X className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </div>
                    <input type="text" value={day.description || ""} onChange={(e) => updateDay(day.id, { description: e.target.value })}
                      placeholder="训练日描述（可选）"
                      className="w-full px-3 py-1 bg-gray-700/50 rounded-lg text-gray-300 text-xs border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2" />
                    {day.exercises.map((ex, ei) => (
                      <div key={ex.id} className="grid grid-cols-12 gap-1 mb-1 items-center">
                        <input type="text" value={ex.name} onChange={(e) => updateExercise(day.id, ex.id, { name: e.target.value })}
                          placeholder="动作名" className="col-span-4 px-2 py-1 bg-gray-700 rounded-lg text-white text-xs border border-gray-600 focus:outline-none" />
                        <input type="number" value={ex.sets} onChange={(e) => updateExercise(day.id, ex.id, { sets: parseInt(e.target.value) || 0 })}
                          placeholder="组" className="col-span-2 px-1 py-1 bg-gray-700 rounded-lg text-white text-xs border border-gray-600 focus:outline-none text-center" />
                        <input type="number" value={ex.reps} onChange={(e) => updateExercise(day.id, ex.id, { reps: parseInt(e.target.value) || 0 })}
                          placeholder="次" className="col-span-2 px-1 py-1 bg-gray-700 rounded-lg text-white text-xs border border-gray-600 focus:outline-none text-center" />
                        <input type="number" value={ex.restTime} onChange={(e) => updateExercise(day.id, ex.id, { restTime: parseInt(e.target.value) || 0 })}
                          placeholder="休" className="col-span-2 px-1 py-1 bg-gray-700 rounded-lg text-white text-xs border border-gray-600 focus:outline-none text-center" />
                        <button onClick={() => removeExerciseFromDay(day.id, ex.id)} className="col-span-2 p-1 hover:bg-red-500/20 rounded-lg transition-colors flex justify-center"><X className="w-3 h-3 text-red-400" /></button>
                      </div>
                    ))}
                    <button onClick={() => addExerciseToDay(day.id)} className="text-xs text-blue-400 hover:text-blue-300 mt-1">+ 添加动作</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">备注（可选）</label>
              <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} rows={2}
                placeholder="训练计划备注..." className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors">取消</button>
              <button onClick={handleSubmit} disabled={isSubmitting}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">创建计划</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== Training Plan List / Selector ====================

function TrainingPlanListModal({
  isOpen, onClose, plans, onDelete,
}: {
  isOpen: boolean; onClose: () => void; plans: CustomTrainingPlan[]; onDelete: (id: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const typeLabels: Record<string, string> = { muscle_building: "增肌", fat_loss: "减脂", cardio: "心肺" };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto shadow-xl border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center"><List className="w-6 h-6 text-white" /></div>
            <div><h3 className="text-xl font-bold text-white">训练计划模板</h3><p className="text-sm text-gray-400">{plans.length}个方案</p></div>
          </div>

          {plans.length === 0 ? (
            <div className="text-center py-8"><BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" /><p className="text-gray-400">暂无训练计划</p><p className="text-sm text-gray-500 mt-1">创建一个预设训练方案吧</p></div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
                    onClick={() => setExpandedId(expandedId === plan.id ? null : (plan.id ?? null))}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-lg">
                          {plan.type === "muscle_building" ? "💪" : plan.type === "fat_loss" ? "🔥" : "🏃"}
                        </div>
                        <div>
                          <p className="text-white font-medium">{plan.name}</p>
                          <p className="text-xs text-gray-400">
                            {typeLabels[plan.type]} · {plan.weeklyFrequency}天/周 · {plan.sessionDuration}分钟/次 · {plan.cycleWeeks}周周期
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); if (plan.id) onDelete(plan.id); }}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        {expandedId === plan.id ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                    {plan.goal && <p className="text-xs text-violet-400 mt-2">目标：{plan.goal}</p>}
                    {plan.focusAreas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {plan.focusAreas.map((a, i) => <span key={i} className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">{a}</span>)}
                      </div>
                    )}
                  </div>
                  <AnimatePresence>
                    {expandedId === plan.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-gray-700 pt-3 space-y-3">
                          {plan.trainingDays.map((day) => (
                            <div key={day.id} className="bg-gray-700/50 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-medium text-sm">{day.name}</span>
                                <span className="text-xs text-gray-400">{day.duration}分钟</span>
                              </div>
                              {day.description && <p className="text-xs text-gray-400 mb-2">{day.description}</p>}
                              <div className="space-y-1">
                                {day.exercises.map((ex, i) => (
                                  <div key={ex.id || i} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-300">{ex.name}</span>
                                    <span className="text-gray-500">{ex.sets}组×{ex.reps}次 · 间歇{ex.restTime}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {plan.notes && <p className="text-xs text-gray-500 italic">{plan.notes}</p>}
                          <div className="flex gap-2 text-xs text-gray-400">
                            <span>{plan.cycleWeeks}周计划</span>
                            {plan.hasDeloadWeek && <span>· 含减载周</span>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <button onClick={onClose} className="w-full py-3 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors">关闭</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ==================== Weekly Progress Card ====================

function WeeklyProgressCard({ stats }: { stats: { totalWorkouts: number; muscleGroupsCovered: number; personalBests: number; totalVolume: number } }) {
  return (
    <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/30">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-white">本周训练总结</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-indigo-500/10 rounded-xl">
          <p className="text-3xl font-bold text-indigo-400">{stats.totalWorkouts}</p>
          <p className="text-xs text-gray-400 mt-1">训练次数</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 rounded-xl">
          <p className="text-3xl font-bold text-purple-400">{stats.muscleGroupsCovered}</p>
          <p className="text-xs text-gray-400 mt-1">覆盖肌群</p>
        </div>
        <div className="text-center p-3 bg-green-500/10 rounded-xl">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award className="w-5 h-5 text-green-400" />
            <p className="text-2xl font-bold text-green-400">{stats.personalBests}</p>
          </div>
          <p className="text-xs text-gray-400">个人最佳</p>
        </div>
        <div className="text-center p-3 bg-orange-500/10 rounded-xl">
          <p className="text-2xl font-bold text-orange-400">{stats.totalVolume.toLocaleString()}</p>
          <p className="text-xs text-gray-400">总训练量</p>
        </div>
      </div>
    </Card>
  );
}

// ==================== Recent Records Card (with edit + batch delete) ====================

function RecentRecordsCard({
  records, subMuscles, onEdit, onBatchDelete,
}: {
  records: MuscleRecord[]; subMuscles: SubMuscle[]; onEdit: (record: MuscleRecord) => void; onBatchDelete: (ids: number[]) => void;
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const subMuscleMap = new Map(subMuscles.map((s) => [s.id, s]));
  const groupedByDate = records.reduce((acc, record) => {
    if (!acc[record.date]) acc[record.date] = [];
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, MuscleRecord[]>);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;
    onBatchDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id!).filter(Boolean)));
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <span className="font-semibold text-white">最近训练</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{records.length} 条记录</span>
          <button
            onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${selectMode ? "bg-red-500/20 text-red-400" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            {selectMode ? "取消" : "批量管理"}
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="flex items-center justify-between mb-3 p-2 bg-red-500/10 rounded-xl">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-gray-300">
            {selectedIds.size === records.length ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === records.length ? "取消全选" : "全选"}
          </button>
          <span className="text-xs text-gray-400">已选 {selectedIds.size} 条</span>
          <button onClick={handleBatchDelete} disabled={selectedIds.size === 0}
            className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">批量删除</button>
        </div>
      )}

      {Object.keys(groupedByDate).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedByDate).slice(0, 7).map(([date, dayRecords]) => (
            <div key={date}>
              <h4 className="text-sm text-gray-400 mb-2">{date}</h4>
              <div className="space-y-2">
                {dayRecords.map((record) => {
                  const subMuscle = subMuscleMap.get(record.subMuscleId);
                  return (
                    <div key={record.id} className={`flex items-center justify-between p-3 rounded-xl transition-colors ${selectedIds.has(record.id!) ? "bg-red-500/10 border border-red-500/30" : "bg-gray-700/30"}`}>
                      {selectMode && (
                        <button onClick={() => toggleSelect(record.id!)} className="mr-2">
                          {selectedIds.has(record.id!) ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-gray-500" />}
                        </button>
                      )}
                      <div className="flex-1 cursor-pointer" onClick={() => !selectMode && onEdit(record)}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium">{record.exerciseName}</p>
                          {record.isPersonalBest && <Trophy className="w-4 h-4 text-yellow-400" />}
                        </div>
                        <p className="text-xs text-gray-400">
                          {subMuscle?.name} · {record.sets}组 × {record.reps}次 · {record.weight}kg
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm text-indigo-400 font-medium">RPE {record.rpe}</p>
                        <p className="text-xs text-gray-500">{record.feeling === "easy" ? "😊" : record.feeling === "medium" ? "😐" : "😫"}</p>
                      </div>
                      {!selectMode && (
                        <button onClick={() => onEdit(record)} className="ml-2 p-1.5 hover:bg-gray-600 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Dumbbell className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">暂无训练记录</p>
          <p className="text-sm text-gray-500 mt-1">开始记录你的力量训练吧</p>
        </div>
      )}
    </Card>
  );
}

// ==================== Recovery Hints Card ====================

function RecoveryHintCard({
  muscleGroups, subMuscles, records,
}: {
  muscleGroups: MuscleGroup[]; subMuscles: SubMuscle[]; records: MuscleRecord[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // For each muscle group, find the most recent training date
  const recoveryMap = new Map<number, { lastDate: string; daysAgo: number }>();

  for (const r of records) {
    const sm = subMuscles.find((s) => s.id === r.subMuscleId);
    if (!sm) continue;
    const mgId = sm.muscleGroupId;
    const existing = recoveryMap.get(mgId);
    if (!existing || r.date > existing.lastDate) {
      const recordDate = new Date(r.date + "T00:00:00");
      const diffDays = Math.floor((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      recoveryMap.set(mgId, { lastDate: r.date, daysAgo: diffDays });
    }
  }

  const hints = muscleGroups
    .map((mg) => ({
      ...mg,
      daysAgo: recoveryMap.get(mg.id!)?.daysAgo,
    }))
    .filter((h) => h.daysAgo !== undefined)
    .sort((a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0));

  if (hints.length === 0) return null;

  const getColorClass = (days: number) => {
    if (days <= 2) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (days <= 5) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-5 h-5 text-teal-400" />
        <span className="font-semibold text-white">肌群恢复提示</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">距上次训练天数（仅供参考）</p>
      <div className="flex flex-wrap gap-2">
        {hints.map((hint) => (
          <div key={hint.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${getColorClass(hint.daysAgo ?? 99)}`}>
            <span>{hint.icon}</span>
            <span className="font-medium">{hint.name}</span>
            <span>{hint.daysAgo}天前</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ==================== Main Page ====================

export default function FitnessPage() {
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [subMuscles, setSubMuscles] = useState<SubMuscle[]>([]);
  const [presetExercises, setPresetExercises] = useState<PresetExercise[]>([]);
  const [recentRecords, setRecentRecords] = useState<MuscleRecord[]>([]);
  const [weeklyStats, setWeeklyStats] = useState({ totalWorkouts: 0, muscleGroupsCovered: 0, personalBests: 0, totalVolume: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWarmupModal, setShowWarmupModal] = useState(false);
  const [showPlanCreator, setShowPlanCreator] = useState(false);
  const [showPlanList, setShowPlanList] = useState(false);
  const [trainingPlans, setTrainingPlans] = useState<CustomTrainingPlan[]>([]);
  const [selectedSubMuscleId, setSelectedSubMuscleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [managingMuscleGroup, setManagingMuscleGroup] = useState<MuscleGroup | null>(null);
  const [editingRecord, setEditingRecord] = useState<MuscleRecord | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const router = useRouter();

  const loadData = async () => {
    setIsLoading(true);
    try {
      await initializeMuscleData();
      const [groups, allSubMuscles, records, stats, plans] = await Promise.all([
        getAllMuscleGroups(),
        getAllSubMuscles(),
        getRecentMuscleRecords(50),
        calculateWeeklyProgress(),
        getAllCustomTrainingPlans(),
      ]);

      const uniqueGroups: MuscleGroup[] = [];
      const seenNames = new Set<string>();
      for (const group of groups) { if (!seenNames.has(group.name)) { seenNames.add(group.name); uniqueGroups.push(group); } }

      const uniqueSubMuscles: SubMuscle[] = [];
      const seenSubMuscleKeys = new Set<string>();
      for (const sm of allSubMuscles) {
        const key = `${sm.muscleGroupId}-${sm.name}`;
        if (!seenSubMuscleKeys.has(key)) { seenSubMuscleKeys.add(key); uniqueSubMuscles.push(sm); }
      }

      setMuscleGroups(uniqueGroups);
      setSubMuscles(uniqueSubMuscles);
      setRecentRecords(records);
      setWeeklyStats(stats);
      setTrainingPlans(plans);
    } catch (error) {
      console.error("Failed to load muscle data:", error);
      showToast({ message: "加载数据失败", type: "error", duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const allProjects = await getAllProjectsV2();
        const allGoals: Goal[] = [];
        for (const p of allProjects) {
          const g = await getGoalsByProject(p.id!);
          allGoals.push(...g.filter(g => g.type === "fitness" && (g.status === "active" || g.status === "paused")));
        }
        setGoals(allGoals);
      } catch {}
    };
    loadGoals();
  }, []);

  const handleSelectGroup = async (_group: MuscleGroup, _subMuscles: SubMuscle[]) => {
    try {
      const exercises = await Promise.all(_subMuscles.map((s) => getPresetExercisesBySubMuscle(s.id!)));
      setPresetExercises(exercises.flat());
    } catch { /* ignore */ }
  };

  const handleSelectSubMuscle = (subMuscle: SubMuscle) => {
    setSelectedSubMuscleId((prev) => (prev === subMuscle.id ? null : (subMuscle.id ?? null)));
  };

  const handleBatchDelete = async (ids: number[]) => {
    try {
      await Promise.all(ids.map((id) => deleteMuscleRecord(id)));
      if (selectedGoalId) { notifyGoalProgressUpdate(selectedGoalId); }
      showToast({ message: `已删除 ${ids.length} 条记录`, type: "success", duration: 2000 });
      loadData();
    } catch { showToast({ message: "删除失败", type: "error", duration: 2000 }); }
  };

  const handleDeletePlan = async (id: number) => {
    if (!confirm("确定要删除这个训练计划吗？")) return;
    try { await deleteCustomTrainingPlan(id); showToast({ message: "计划已删除", type: "success", duration: 2000 }); loadData(); }
    catch { showToast({ message: "删除失败", type: "error", duration: 2000 }); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
        <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10 flex items-center justify-center py-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-gray-700 border-t-indigo-500 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/assistant" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">健身</h1>
            <p className="text-xs text-gray-400">力量训练记录 · 计划管理</p>
          </div>
        </div>

        {/* 关联健身目标 */}
        {goals.length > 0 && (
          <div className="mb-4 bg-orange-500/10 rounded-xl p-3 mx-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-orange-400 flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5" /> 关联健身目标
              </span>
              <select
                value={selectedGoalId ?? ""}
                onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : null)}
                className="text-xs bg-gray-800 rounded-lg px-2 py-1 border border-gray-700 text-gray-300"
              >
                <option value="">不关联</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.progress}%)</option>
                ))}
              </select>
            </div>
            {selectedGoalId && (() => {
              const g = goals.find(g => g.id === selectedGoalId);
              if (!g) return null;
              return (
                <button onClick={() => router.push(`/projects/${g.projectId}/goals/${g.id}`)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-200">{g.name}</span>
                    <span className="font-medium text-gray-300">{g.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${g.progress >= 100 ? "bg-emerald-500" : "bg-orange-500"}`} style={{ width: `${Math.min(g.progress, 100)}%` }} />
                  </div>
                </button>
              );
            })()}
          </div>
        )}

        <div className="space-y-4">
          {/* Action buttons row */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddModal(true)}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg">
              <Plus className="w-5 h-5" />添加训练记录
            </motion.button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowWarmupModal(true)}
                className="w-full py-3 bg-gray-700 text-gray-300 rounded-xl font-medium flex items-center justify-center gap-1 text-sm hover:bg-gray-600 transition-colors">
                <Activity className="w-4 h-4" />热身/拉伸
              </button>
              <button onClick={() => setShowPlanCreator(true)}
                className="w-full py-3 bg-gray-700 text-gray-300 rounded-xl font-medium flex items-center justify-center gap-1 text-sm hover:bg-gray-600 transition-colors">
                <BookOpen className="w-4 h-4" />创建计划
              </button>
            </div>
          </div>

          {/* Training plans quick access */}
          {trainingPlans.length > 0 && (
            <button onClick={() => setShowPlanList(true)}
              className="w-full py-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-300 font-medium flex items-center justify-center gap-2 hover:bg-violet-500/20 transition-colors text-sm">
              <Copy className="w-4 h-4" />选用训练计划模板（{trainingPlans.length}个方案）
            </button>
          )}

          {/* Weekly summary */}
          <WeeklyProgressCard stats={weeklyStats} />

          {/* Recovery hints */}
          <RecoveryHintCard muscleGroups={muscleGroups} subMuscles={subMuscles} records={recentRecords} />

          {/* Muscle group management */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Dumbbell className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-white">肌肉群管理</span>
            </div>
            <div className="space-y-3">
              {muscleGroups.map((group) => {
                const groupSubMuscles = subMuscles.filter((s) => s.muscleGroupId === group.id);
                return (
                  <MuscleGroupCard key={group.id} group={group} subMuscles={groupSubMuscles}
                    onSelect={handleSelectGroup} onManageSubMuscles={setManagingMuscleGroup}
                    onSelectSubMuscle={handleSelectSubMuscle} selectedSubMuscleId={selectedSubMuscleId} />
                );
              })}
            </div>
          </Card>

          {/* Sub-muscle filtered records */}
          {selectedSubMuscleId && (() => {
            const selectedSm = subMuscles.find((s) => s.id === selectedSubMuscleId);
            const filteredRecords = recentRecords.filter((r) => r.subMuscleId === selectedSubMuscleId);
            if (!selectedSm) return null;
            return (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <h3 className="text-sm font-bold text-white">{selectedSm.name}</h3>
                  </div>
                  <button onClick={() => setSelectedSubMuscleId(null)} className="text-xs text-gray-400 hover:text-gray-300">清除筛选</button>
                </div>
                <RecentRecordsCard records={filteredRecords} subMuscles={subMuscles} onEdit={setEditingRecord} onBatchDelete={handleBatchDelete} />
              </div>
            );
          })()}

          {/* All records */}
          {!selectedSubMuscleId && (
            <RecentRecordsCard records={recentRecords} subMuscles={subMuscles} onEdit={setEditingRecord} onBatchDelete={handleBatchDelete} />
          )}

          {/* Bottom link to stats */}
          <div className="pt-2">
            <Link href="/stats#fitness"
              className="w-full py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-300 font-medium flex items-center justify-center gap-2 hover:bg-gray-700/50 transition-colors text-sm">
              查看完整训练数据统计 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Modals */}
        <AddRecordModal isOpen={showAddModal} onClose={() => setShowAddModal(false)}
          muscleGroups={muscleGroups} subMuscles={subMuscles} presetExercises={presetExercises} onSuccess={loadData} selectedGoalId={selectedGoalId} />

        {managingMuscleGroup && (
          <SubMuscleManagerModal isOpen={!!managingMuscleGroup} onClose={() => setManagingMuscleGroup(null)}
            muscleGroup={managingMuscleGroup} subMuscles={subMuscles.filter((s) => s.muscleGroupId === managingMuscleGroup.id)} onSuccess={loadData} />
        )}

        <EditRecordModal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)}
          record={editingRecord} subMuscles={subMuscles} onSuccess={loadData} selectedGoalId={selectedGoalId} />

        <WarmupStretchModal isOpen={showWarmupModal} onClose={() => setShowWarmupModal(false)} />

        <TrainingPlanModal isOpen={showPlanCreator} onClose={() => setShowPlanCreator(false)} onSuccess={loadData} />

        <TrainingPlanListModal isOpen={showPlanList} onClose={() => setShowPlanList(false)}
          plans={trainingPlans} onDelete={handleDeletePlan} />
      </div>
    </div>
  );
}
