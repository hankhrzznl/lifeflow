"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Plus, ChevronRight, ChevronDown, Trash2, Edit2,
  Trophy, TrendingUp, TrendingDown, Minus,
  Dumbbell, Target, Award, Calendar, Clock, Flame, TrendingUp as TrendingIcon
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import {
  getAllMuscleGroups,
  getSubMusclesByGroup,
  getAllSubMuscles,
  getPresetExercisesBySubMuscle,
  getMuscleRecordsByExercise,
  getRecentMuscleRecords,
  addMuscleRecord,
  deleteMuscleRecord,
  initializeMuscleData,
  calculateWeeklyProgress,
  getPersonalBest,
  updateMuscleGroup,
  deleteMuscleGroup,
  updateSubMuscle,
  deleteSubMuscle,
  addMuscleGroup,
  addSubMuscle,
  addPresetExercise,
} from "@/lib/db";
import {
  MuscleGroup,
  SubMuscle,
  PresetExercise,
  MuscleRecord,
  RPE_LABELS,
  REST_TIME_PRESETS,
} from "@/lib/types";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-800/50 backdrop-blur-lg rounded-2xl p-4 border border-gray-700/50 ${className}`}>
      {children}
    </div>
  );
}

function TrendIndicator({ direction, changePercent }: { direction: 'up' | 'down' | 'stable'; changePercent: number }) {
  if (direction === 'up') {
    return (
      <div className="flex items-center gap-1 text-green-400">
        <TrendingUp className="w-4 h-4" />
        <span className="text-sm font-medium">+{changePercent.toFixed(1)}%</span>
      </div>
    );
  }
  if (direction === 'down') {
    return (
      <div className="flex items-center gap-1 text-red-400">
        <TrendingDown className="w-4 h-4" />
        <span className="text-sm font-medium">{changePercent.toFixed(1)}%</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-gray-400">
      <Minus className="w-4 h-4" />
      <span className="text-sm font-medium">0%</span>
    </div>
  );
}

function MuscleGroupCard({
  group,
  subMuscles,
  onSelect,
  onManageSubMuscles,
  onSelectSubMuscle,
}: {
  group: MuscleGroup;
  subMuscles: SubMuscle[];
  onSelect: (group: MuscleGroup, subMuscles: SubMuscle[]) => void;
  onManageSubMuscles: (group: MuscleGroup) => void;
  onSelectSubMuscle: (group: MuscleGroup, subMuscle: SubMuscle) => void;
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
            onClick={(e) => {
              e.stopPropagation();
              onManageSubMuscles(group);
            }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4 text-gray-400" />
          </button>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
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
                  onClick={() => onSelectSubMuscle(group, subMuscle)}
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-white font-medium">{subMuscle.name}</p>
                    <p className="text-xs text-gray-400">{subMuscle.description || '暂无描述'}</p>
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

function SubMuscleManagerModal({
  isOpen,
  onClose,
  muscleGroup,
  subMuscles,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  muscleGroup: MuscleGroup;
  subMuscles: SubMuscle[];
  onSuccess: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingSubMuscle, setEditingSubMuscle] = useState<SubMuscle | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubMuscle = async () => {
    if (!newName.trim()) {
      showToast({ message: "请输入小肌肉名称", type: "error", duration: 2000 });
      return;
    }

    setIsSubmitting(true);
    try {
      await addSubMuscle({
        muscleGroupId: muscleGroup.id!,
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        order: subMuscles.length + 1,
      });
      showToast({ message: "小肌肉已添加", type: "success", duration: 2000 });
      setNewName("");
      setNewDescription("");
      onSuccess();
    } catch (error) {
      console.error('Failed to add sub muscle:', error);
      showToast({ message: "添加失败", type: "error", duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubMuscle = async () => {
    if (!editingSubMuscle || !editName.trim()) {
      showToast({ message: "请输入小肌肉名称", type: "error", duration: 2000 });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSubMuscle(editingSubMuscle.id!, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      showToast({ message: "小肌肉已更新", type: "success", duration: 2000 });
      setEditingSubMuscle(null);
      onSuccess();
    } catch (error) {
      console.error('Failed to update sub muscle:', error);
      showToast({ message: "更新失败", type: "error", duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubMuscle = async (subMuscle: SubMuscle) => {
    if (!confirm(`确定要删除"${subMuscle.name}"吗？这将同时删除所有相关的训练记录。`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteSubMuscle(subMuscle.id!);
      showToast({ message: "小肌肉已删除", type: "success", duration: 2000 });
      onSuccess();
    } catch (error) {
      console.error('Failed to delete sub muscle:', error);
      showToast({ message: "删除失败", type: "error", duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (subMuscle: SubMuscle) => {
    setEditingSubMuscle(subMuscle);
    setEditName(subMuscle.name);
    setEditDescription(subMuscle.description || "");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl border border-gray-700"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${muscleGroup.color}20` }}>
              {muscleGroup.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{muscleGroup.name}</h3>
              <p className="text-sm text-gray-400">管理小肌肉</p>
            </div>
          </div>

          {/* 添加新小肌肉 */}
          {!editingSubMuscle && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-xl">
              <h4 className="font-medium text-white mb-3">添加新小肌肉</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="小肌肉名称"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="描述（可选）"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddSubMuscle}
                  disabled={isSubmitting}
                  className="w-full py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                >
                  添加
                </button>
              </div>
            </div>
          )}

          {/* 编辑小肌肉 */}
          {editingSubMuscle && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-xl">
              <h4 className="font-medium text-white mb-3">编辑小肌肉</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="小肌肉名称"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="描述（可选）"
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingSubMuscle(null)}
                    className="flex-1 py-2 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleEditSubMuscle}
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 小肌肉列表 */}
          <div>
            <h4 className="font-medium text-white mb-3">现有小肌肉</h4>
            <div className="space-y-2">
              {subMuscles.map((subMuscle) => (
                <div
                  key={subMuscle.id}
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">{subMuscle.name}</p>
                    <p className="text-xs text-gray-400">{subMuscle.description || '暂无描述'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(subMuscle)}
                      className="p-1.5 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubMuscle(subMuscle)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
              {subMuscles.length === 0 && (
                <p className="text-gray-400 text-center py-4">暂无小肌肉</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full py-3 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800 transition-colors"
            >
              关闭
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function EditMuscleModal({
  isOpen,
  onClose,
  mode,
  muscleGroup,
  subMuscle,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: 'group' | 'subMuscle';
  muscleGroup?: MuscleGroup;
  subMuscle?: SubMuscle;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(subMuscle?.name || muscleGroup?.name || "");
  const [description, setDescription] = useState(subMuscle?.description || muscleGroup?.description || "");
  const [icon, setIcon] = useState(muscleGroup?.icon || "💪");
  const [color, setColor] = useState(muscleGroup?.color || "#6366F1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (subMuscle) {
      setName(subMuscle.name);
      setDescription(subMuscle.description || "");
    } else if (muscleGroup) {
      setName(muscleGroup.name);
      setDescription(muscleGroup.description || "");
      setIcon(muscleGroup.icon);
      setColor(muscleGroup.color);
    }
  }, [subMuscle, muscleGroup]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast({ message: "请输入名称", type: "error", duration: 2000 });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'group' && muscleGroup) {
        await updateMuscleGroup(muscleGroup.id!, {
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
          color,
        });
        showToast({ message: "肌肉群已更新", type: "success", duration: 2000 });
      } else if (mode === 'subMuscle' && subMuscle) {
        await updateSubMuscle(subMuscle.id!, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        showToast({ message: "小肌肉已更新", type: "success", duration: 2000 });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update:', error);
      showToast({ message: "更新失败", type: "error", duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除吗？这将同时删除所有相关的训练记录。')) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'group' && muscleGroup) {
        await deleteMuscleGroup(muscleGroup.id!);
        showToast({ message: "肌肉群已删除", type: "success", duration: 2000 });
      } else if (mode === 'subMuscle' && subMuscle) {
        await deleteSubMuscle(subMuscle.id!);
        showToast({ message: "小肌肉已删除", type: "success", duration: 2000 });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast({ message: "删除失败", type: "error", duration: 2000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-xl border border-gray-700"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Edit2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                编辑{mode === 'group' ? '肌肉群' : '小肌肉'}
              </h3>
              <p className="text-sm text-gray-400">修改或删除</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">描述</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
                className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {mode === 'group' && (
              <>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">图标</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="输入emoji"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-3xl"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">颜色</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-12 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-3 border border-red-500 text-red-500 rounded-xl font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              删除
            </button>
            <div className="flex-1 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AddRecordModal({
  isOpen,
  onClose,
  muscleGroups,
  subMuscles,
  presetExercises,
  onSuccess,
  initialSubMuscle,
}: {
  isOpen: boolean;
  onClose: () => void;
  muscleGroups: MuscleGroup[];
  subMuscles: SubMuscle[];
  presetExercises: PresetExercise[];
  onSuccess: () => void;
  initialSubMuscle?: SubMuscle | null;
}) {
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  const [selectedSubMuscle, setSelectedSubMuscle] = useState<SubMuscle | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState(7);
  const [restTime, setRestTime] = useState(60);
  const [feeling, setFeeling] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState(1);
  const [equipment, setEquipment] = useState("");

  // 从肌群卡片点击子肌肉项时自动预选
  useEffect(() => {
    if (initialSubMuscle && isOpen) {
      const parentGroup = muscleGroups.find(g => g.id === initialSubMuscle.muscleGroupId);
      if (parentGroup) {
        setSelectedGroup(parentGroup);
        setSelectedSubMuscle(initialSubMuscle);
        setStep(2);
      }
    }
  }, [initialSubMuscle, isOpen]);

  const filteredSubMuscles = selectedGroup
    ? subMuscles.filter(s => s.muscleGroupId === selectedGroup.id)
    : [];

  const filteredExercises = selectedSubMuscle
    ? presetExercises.filter(e => e.subMuscleId === selectedSubMuscle.id)
    : [];

  const handleSubmit = async () => {
    if (!selectedSubMuscle || !exerciseName || !weight) {
      showToast({ message: "请填写完整信息", type: "error", duration: 2000 });
      return;
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const isNewExercise = !filteredExercises.some(e => e.name === exerciseName);

    if (isNewExercise && equipment.trim()) {
      try {
        await addPresetExercise({
          name: exerciseName.trim(),
          subMuscleId: selectedSubMuscle.id!,
          equipment: equipment.trim() || undefined,
          isCustom: true,
        });
        showToast({ message: "已保存为预设动作", type: "success", duration: 2000 });
      } catch (error) {
        console.error('Failed to save preset exercise:', error);
      }
    }

    await addMuscleRecord({
      subMuscleId: selectedSubMuscle.id!,
      exerciseName,
      sets: parseInt(sets) || 3,
      reps: parseInt(reps) || 10,
      weight: parseFloat(weight) || 0,
      rpe,
      restTime,
      feeling,
      date: dateStr,
      timestamp: Date.now(),
      notes: notes || undefined,
    });

    showToast({ message: "训练记录已添加", type: "success", duration: 2000 });
    onSuccess();
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setSelectedGroup(null);
    setSelectedSubMuscle(null);
    setExerciseName("");
    setSets("3");
    setReps("10");
    setWeight("");
    setRpe(7);
    setRestTime(60);
    setFeeling('medium');
    setNotes("");
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-xl border border-gray-700 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">添加训练记录</h3>
              <p className="text-sm text-gray-400">记录你的力量训练</p>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">选择大肌群</label>
                <div className="grid grid-cols-3 gap-3">
                  {muscleGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setSelectedGroup(group);
                        setSelectedSubMuscle(null);
                        setExerciseName("");
                      }}
                      className={`p-4 rounded-xl text-center transition-all ${
                        selectedGroup?.id === group.id
                          ? 'ring-2 ring-indigo-500 bg-indigo-500/20'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div
                        className="text-3xl mb-2"
                        style={{ backgroundColor: `${group.color}20` }}
                      >
                        {group.icon}
                      </div>
                      <p className="text-white font-medium text-sm">{group.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedGroup && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <label className="text-sm text-gray-400 mb-2 block">选择小肌肉</label>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredSubMuscles.map((subMuscle) => (
                      <button
                        key={subMuscle.id}
                        onClick={() => {
                          setSelectedSubMuscle(subMuscle);
                        }}
                        className={`p-3 rounded-xl text-center transition-all ${
                          selectedSubMuscle?.id === subMuscle.id
                            ? 'ring-2 ring-indigo-500 bg-indigo-500/20'
                            : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      >
                        <p className="text-white font-medium">{subMuscle.name}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {selectedSubMuscle && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <label className="text-sm text-gray-400 mb-2 block">选择或输入动作</label>
                  <div className="flex gap-2 mb-3">
                    <select
                      value=""
                      onChange={(e) => setExerciseName(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">选择预设动作</option>
                      {filteredExercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.name}>
                          {exercise.name} {exercise.equipment && `(${exercise.equipment})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="或输入自定义动作名称"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                  />
                  {exerciseName && !filteredExercises.some(e => e.name === exerciseName) && (
                    <div className="mt-2">
                      <label className="text-sm text-gray-400 mb-2 block">器材（保存为预设动作）</label>
                      <input
                        type="text"
                        value={equipment}
                        onChange={(e) => setEquipment(e.target.value)}
                        placeholder="如：哑铃、杠铃、自重等（选填）"
                        className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">输入器材名称可将此动作保存为预设动作</p>
                    </div>
                  )}
                </motion.div>
              )}

              {selectedSubMuscle && exerciseName && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setStep(2)}
                  className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors"
                >
                  下一步
                </motion.button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">组数</label>
                  <input
                    type="number"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">每组次数</label>
                  <input
                    type="number"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">重量(kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">RPE (努力程度) - {RPE_LABELS[rpe]}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={rpe}
                  onChange={(e) => setRpe(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>非常轻松</span>
                  <span>力竭</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">组间休息时间</label>
                <div className="flex gap-2">
                  {REST_TIME_PRESETS.map((time) => (
                    <button
                      key={time}
                      onClick={() => setRestTime(time)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        restTime === time
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {time}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">训练感受</label>
                <div className="flex gap-3">
                  {[
                    { key: 'easy' as const, label: '轻松', emoji: '😊', color: 'bg-green-500' },
                    { key: 'medium' as const, label: '适中', emoji: '😐', color: 'bg-yellow-500' },
                    { key: 'hard' as const, label: '吃力', emoji: '😫', color: 'bg-red-500' },
                  ].map(({ key, label, emoji, color }) => (
                    <button
                      key={key}
                      onClick={() => setFeeling(key)}
                      className={`flex-1 py-3 rounded-xl text-center transition-all ${
                        feeling === key
                          ? `ring-2 ring-indigo-500 ${color}`
                          : 'bg-gray-800'
                      }`}
                    >
                      <div className="text-2xl mb-1">{emoji}</div>
                      <p className="text-white text-sm font-medium">{label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">备注（可选）</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="添加备注..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 rounded-xl text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-700 rounded-xl text-gray-300 font-medium hover:bg-gray-800 transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors"
                >
                  保存记录
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function WeeklyProgressCard({ stats }: { stats: Awaited<ReturnType<typeof calculateWeeklyProgress>> }) {
  return (
    <Card className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-700/30">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-white">本周训练总结</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-indigo-500/10 rounded-xl">
          <p className="text-3xl font-bold text-indigo-400">{stats.totalWorkouts}</p>
          <p className="text-xs text-gray-400 mt-1">训练次数</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 rounded-xl">
          <p className="text-3xl font-bold text-purple-400">{stats.muscleGroupsCovered}</p>
          <p className="text-xs text-gray-400 mt-1">覆盖肌群</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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

function RecentRecordsCard({ records, subMuscles }: { records: MuscleRecord[]; subMuscles: SubMuscle[] }) {
  const subMuscleMap = new Map(subMuscles.map(s => [s.id, s]));

  const groupedByDate = records.reduce((acc, record) => {
    if (!acc[record.date]) acc[record.date] = [];
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, MuscleRecord[]>);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <span className="font-semibold text-white">最近训练</span>
        </div>
        <span className="text-sm text-gray-400">{records.length} 条记录</span>
      </div>

      {Object.keys(groupedByDate).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedByDate).slice(0, 7).map(([date, dayRecords]) => (
            <div key={date}>
              <h4 className="text-sm text-gray-400 mb-2">{date}</h4>
              <div className="space-y-2">
                {dayRecords.map((record) => {
                  const subMuscle = subMuscleMap.get(record.subMuscleId);
                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium">{record.exerciseName}</p>
                          {record.isPersonalBest && (
                            <Trophy className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {subMuscle?.name} · {record.sets}组 × {record.reps}次 · {record.weight}kg
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-indigo-400 font-medium">
                          RPE {record.rpe}
                        </p>
                        <p className="text-xs text-gray-500">
                          {record.feeling === 'easy' ? '😊' : record.feeling === 'medium' ? '😐' : '😫'}
                        </p>
                      </div>
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

function MuscleProgressChart({
  records,
  onSelectExercise
}: {
  records: MuscleRecord[];
  onSelectExercise: (exerciseName: string) => void;
}) {
  const uniqueExercises = [...new Set(records.map(r => r.exerciseName))];

  const chartData = uniqueExercises.slice(0, 5).map(exercise => {
    const exerciseRecords = records
      .filter(r => r.exerciseName === exercise)
      .sort((a, b) => a.timestamp - b.timestamp);

    const groupedByDate: Record<string, { maxWeight: number; date: string }> = {};
    
    exerciseRecords.forEach(record => {
      if (!groupedByDate[record.date] || groupedByDate[record.date].maxWeight < record.weight) {
        groupedByDate[record.date] = {
          date: record.date,
          maxWeight: record.weight
        };
      }
    });

    return {
      exercise,
      data: Object.values(groupedByDate).slice(-10).map(item => ({
        date: item.date.split('-').slice(1).join('/'),
        weight: item.maxWeight
      }))
    };
  }).filter(chart => chart.data.length > 1);

  const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <TrendingIcon className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-white">肌肉成长趋势</span>
      </div>

      {chartData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData[0].data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                label={{ value: '重量(kg)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              {chartData.length > 1 && (
                <Legend />
              )}
              {chartData.map((chart, index) => (
                <Line
                  key={chart.exercise}
                  type="monotone"
                  dataKey="weight"
                  data={chart.data}
                  name={chart.exercise}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ fill: colors[index % colors.length], r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-3">选择动作查看详情</p>
            <div className="grid grid-cols-2 gap-2">
              {uniqueExercises.slice(0, 8).map((exercise, index) => (
                <button
                  key={exercise}
                  onClick={() => onSelectExercise(exercise)}
                  className="px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors flex items-center gap-2"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="truncate">{exercise}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <TrendingIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">暂无足够数据</p>
          <p className="text-sm text-gray-500 mt-1">至少需要2次训练记录才能生成趋势图</p>
        </div>
      )}
    </Card>
  );
}

export default function MusclePage() {
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [subMuscles, setSubMuscles] = useState<SubMuscle[]>([]);
  const [presetExercises, setPresetExercises] = useState<PresetExercise[]>([]);
  const [recentRecords, setRecentRecords] = useState<MuscleRecord[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<Awaited<ReturnType<typeof calculateWeeklyProgress>>>({
    totalWorkouts: 0,
    muscleGroupsCovered: 0,
    personalBests: 0,
    totalVolume: 0,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [quickSubMuscle, setQuickSubMuscle] = useState<SubMuscle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [managingMuscleGroup, setManagingMuscleGroup] = useState<MuscleGroup | null>(null);
  const [editingGroup, setEditingGroup] = useState<MuscleGroup | null>(null);
  const [editingSubMuscle, setEditingSubMuscle] = useState<SubMuscle | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await initializeMuscleData();
      const [groups, allSubMuscles, exercises, records, stats] = await Promise.all([
        getAllMuscleGroups(),
        getAllSubMuscles(),
        Promise.resolve([]), // 暂时不加载所有预设动作
        getRecentMuscleRecords(50),
        calculateWeeklyProgress(),
      ]);

      // 去重：按名称保留唯一的肌肉群
      const uniqueGroups: MuscleGroup[] = [];
      const seenNames = new Set<string>();
      for (const group of groups) {
        if (!seenNames.has(group.name)) {
          seenNames.add(group.name);
          uniqueGroups.push(group);
        }
      }

      // 去重子肌肉
      const uniqueSubMuscles: SubMuscle[] = [];
      const seenSubMuscleKeys = new Set<string>();
      for (const subMuscle of allSubMuscles) {
        const key = `${subMuscle.muscleGroupId}-${subMuscle.name}`;
        if (!seenSubMuscleKeys.has(key)) {
          seenSubMuscleKeys.add(key);
          uniqueSubMuscles.push(subMuscle);
        }
      }

      setMuscleGroups(uniqueGroups);
      setSubMuscles(uniqueSubMuscles);
      setPresetExercises(exercises);
      setRecentRecords(records);
      setWeeklyStats(stats);
    } catch (error) {
      console.error('Failed to load muscle data:', error);
      showToast({ message: "加载数据失败", type: "error", duration: 2000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectGroup = async (group: MuscleGroup, _subMuscles: SubMuscle[]) => {
    try {
      const exercises = await Promise.all(
        _subMuscles.map(s => getPresetExercisesBySubMuscle(s.id!))
      );
      setPresetExercises(exercises.flat());
    } catch (error) {
      console.error('Failed to load exercises:', error);
    }
  };

  const handleSelectSubMuscle = (group: MuscleGroup, subMuscle: SubMuscle) => {
    setQuickSubMuscle(subMuscle);
    setShowAddModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-gray-700 border-t-indigo-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg"
      >
        <Plus className="w-5 h-5" />
        添加训练记录
      </motion.button>

      <WeeklyProgressCard stats={weeklyStats} />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Dumbbell className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">肌肉群管理</span>
        </div>
        <div className="space-y-3">
          {muscleGroups.map((group) => {
            const groupSubMuscles = subMuscles.filter(s => s.muscleGroupId === group.id);
            return (
              <MuscleGroupCard
                key={group.id}
                group={group}
                subMuscles={groupSubMuscles}
                onSelect={handleSelectGroup}
                onManageSubMuscles={setManagingMuscleGroup}
                onSelectSubMuscle={handleSelectSubMuscle}
              />
            );
          })}
        </div>
      </Card>

      <MuscleProgressChart records={recentRecords} onSelectExercise={() => {}} />

      <RecentRecordsCard records={recentRecords} subMuscles={subMuscles} />

      <AddRecordModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setQuickSubMuscle(null); }}
        muscleGroups={muscleGroups}
        subMuscles={subMuscles}
        presetExercises={presetExercises}
        onSuccess={loadData}
        initialSubMuscle={quickSubMuscle}
      />

      {managingMuscleGroup && (
        <SubMuscleManagerModal
          isOpen={!!managingMuscleGroup}
          onClose={() => setManagingMuscleGroup(null)}
          muscleGroup={managingMuscleGroup}
          subMuscles={subMuscles.filter(s => s.muscleGroupId === managingMuscleGroup.id)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
