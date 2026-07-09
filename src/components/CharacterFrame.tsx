"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets, Moon, Zap, Plus, Undo2, User, Settings, X,
} from "lucide-react";
import {
  getUserSettings, saveUserSettings,
  getTodayWaterRecord, addWaterIntake, undoLastWaterIntake,
  getTodaySelfAssessment, saveSelfAssessment,
  getDaySchedule,
} from "@/lib/db";

const DEFAULT_CUP_SIZES = [200, 300, 500];

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function calcSleepFromSchedule(daySchedule: any): { nightHours: number; napHours: number; isAfterNap: boolean } {
  if (!daySchedule?.events) return { nightHours: 0, napHours: 0, isAfterNap: false };
  
  const sleepEvents: any[] = [];
  for (const ev of daySchedule.events) {
    if (ev.title?.includes("睡")) {
      const start = ev.actualStartTime || ev.startTime;
      const end = ev.actualEndTime || ev.endTime;
      if (!start || !end) continue;
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      const startMin = sh * 60 + sm;
      sleepEvents.push({ minutes: mins, startMin, startTime: start });
    }
  }
  
  // 按时长排序：长的 = 晚上睡觉，短的 = 午睡
  sleepEvents.sort((a, b) => b.minutes - a.minutes);
  
  const nightHours = sleepEvents.length > 0 ? sleepEvents[0].minutes / 60 : 0;
  const napHours = sleepEvents.length > 1 ? sleepEvents[1].minutes / 60 : 0;
  
  // 判断当前是否在午睡之后
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let isAfterNap = false;
  if (sleepEvents.length > 1) {
    // 午睡开始时间
    const napStart = sleepEvents[1].startMin;
    isAfterNap = nowMin >= napStart;
  }
  
  return { nightHours, napHours, isAfterNap };
}

// ==================== 自我评分面板 ====================

function SelfAssessmentPanel({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (physicalScore: number, moodScore: number) => void;
}) {
  const [physical, setPhysical] = useState(50);
  const [mood, setMood] = useState(50);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">自我感觉评分</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 身体状态 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">身体状态</label>
            <span className="text-lg font-bold text-rose-500">{physical}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={physical}
            onChange={(e) => setPhysical(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>很差</span><span>极佳</span>
          </div>
        </div>

        {/* 情绪 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">情绪</label>
            <span className="text-lg font-bold text-amber-500">{mood}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>很差</span><span>极佳</span>
          </div>
        </div>

        <button
          onClick={() => onSave(physical, mood)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-semibold text-sm
            hover:from-rose-600 hover:to-amber-600 transition-all active:scale-95"
        >
          确认评分
        </button>
      </motion.div>
    </motion.div>
  );
}

// ==================== 设置面板 ====================

function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: { sleepTarget: number; napTarget: number; weight: number; cupSizes: number[]; waterTarget: number };
  onSave: (s: { sleepTarget: number; napTarget: number; weight: number; cupSizes: number[] }) => void;
  onClose: () => void;
}) {
  const [sleepTarget, setSleepTarget] = useState(settings.sleepTarget);
  const [napTarget, setNapTarget] = useState(settings.napTarget);
  const [weight, setWeight] = useState(settings.weight);
  const [cupSizes, setCupSizes] = useState(settings.cupSizes);

  const previewWaterTarget = Math.round(weight * 30);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">设置</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 睡眠目标 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">晚上睡眠目标（小时）</label>
            <span className="text-lg font-bold text-indigo-500">{sleepTarget}h</span>
          </div>
          <input
            type="range"
            min={4}
            max={12}
            step={0.5}
            value={sleepTarget}
            onChange={(e) => setSleepTarget(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>4h</span><span>12h</span>
          </div>
        </div>

        {/* 午睡目标 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">午睡目标（小时）</label>
            <span className="text-lg font-bold text-orange-500">{napTarget}h</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.1}
            value={napTarget}
            onChange={(e) => setNapTarget(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0h</span><span>0.5h</span>
          </div>
        </div>

        {/* 体重 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">体重（kg）</label>
            <span className="text-lg font-bold text-emerald-500">{weight}kg</span>
          </div>
          <input
            type="range"
            min={40}
            max={120}
            step={1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>40kg</span><span>120kg</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            推荐饮水：{previewWaterTarget}ml/天（35ml/kg）
          </p>
        </div>

        {/* 水杯预设值 */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">水杯预设值（ml）</label>
          <div className="flex gap-2">
            {cupSizes.map((size, idx) => (
              <input
                key={idx}
                type="number"
                min={50}
                max={2000}
                step={50}
                value={size}
                onChange={(e) => {
                  const val = Math.max(50, Math.min(2000, Number(e.target.value) || 50));
                  const next = [...cupSizes];
                  next[idx] = val;
                  setCupSizes(next);
                }}
                className="flex-1 px-3 py-2 rounded-xl text-sm text-center font-medium
                  bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
                  border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-blue-400"
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => onSave({ sleepTarget, napTarget, weight, cupSizes })}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 text-white font-semibold text-sm
            hover:from-indigo-600 hover:to-emerald-600 transition-all active:scale-95"
        >
          保存设置
        </button>
      </motion.div>
    </motion.div>
  );
}

// ==================== 人物框主体 ====================

export default function CharacterFrame() {
  const [settings, setSettings] = useState({ sleepTarget: 8, napTarget: 0.5, weight: 60, cupSizes: DEFAULT_CUP_SIZES, waterTarget: 1800, avatarDataUrl: undefined as string | undefined });
  const [sleepHours, setSleepHours] = useState(0);
  const [napHours, setNapHours] = useState(0);
  const [isAfterNap, setIsAfterNap] = useState(false);
  const [waterMl, setWaterMl] = useState(0);
  const [selfAssessment, setSelfAssessment] = useState<{ physicalScore: number; moodScore: number } | null>(null);
  const [showSelfPanel, setShowSelfPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载数据
  useEffect(() => {
    const load = async () => {
      try {
        const s = await getUserSettings();
        const waterTarget = Math.round(s.weight * 30);
        setSettings({
          sleepTarget: s.sleepTarget,
          napTarget: s.napTarget ?? 0.5,
          weight: s.weight,
          cupSizes: s.cupSizes ?? DEFAULT_CUP_SIZES,
          waterTarget,
          avatarDataUrl: s.avatarDataUrl,
        });

        // 睡眠数据
        const today = getTodayStr();
        const ds = await getDaySchedule(today);
        const { nightHours, napHours: nap, isAfterNap: afterNap } = calcSleepFromSchedule(ds);
        setSleepHours(nightHours);
        setNapHours(nap);
        setIsAfterNap(afterNap);

        // 饮水数据
        const wr = await getTodayWaterRecord();
        if (wr) setWaterMl(wr.totalMl);

        // 自我评分
        const sa = await getTodaySelfAssessment();
        if (sa) setSelfAssessment({ physicalScore: sa.physicalScore, moodScore: sa.moodScore });
      } catch (err) {
        console.error("CharacterFrame load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 睡眠进度
  const sleepPct = Math.min((sleepHours / settings.sleepTarget) * 100, 100);
  const napPct = napHours > 0 ? Math.min((napHours / settings.napTarget) * 100, 100) : 0;
  const sleepScore = isAfterNap
    ? Math.round(Math.min(sleepHours / settings.sleepTarget * 80 + napHours / settings.napTarget * 20, 100))
    : Math.round(Math.min((sleepHours / settings.sleepTarget) * 100, 100));

  // 饮水进度
  const waterPct = Math.min((waterMl / settings.waterTarget) * 100, 100);
  const waterScore = Math.round(Math.min((waterMl / settings.waterTarget) * 100, 100));

  // 自我评分
  const selfScore = selfAssessment
    ? Math.round((selfAssessment.physicalScore + selfAssessment.moodScore) / 2)
    : 0;

  // 怒气总分
  const rageTotal = selfScore + sleepScore + waterScore;

  // 动画判断
  const isGlowing = rageTotal >= 240 && rageTotal < 270;
  const isAnimated = rageTotal >= 270;

  // 饮水操作
  const handleDrink = useCallback(async (ml: number) => {
    try {
      const wr = await addWaterIntake(ml);
      setWaterMl(wr.totalMl);
    } catch (err) {
      console.error("addWaterIntake error:", err);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    try {
      const wr = await undoLastWaterIntake();
      setWaterMl(wr.totalMl);
    } catch {
      // 没有可撤销的
    }
  }, []);

  // 自我评分保存
  const handleSelfSave = useCallback(async (physicalScore: number, moodScore: number) => {
    await saveSelfAssessment(physicalScore, moodScore);
    setSelfAssessment({ physicalScore, moodScore });
    setShowSelfPanel(false);
  }, []);

  // 设置保存
  const handleSettingsSave = useCallback(async (s: { sleepTarget: number; napTarget: number; weight: number; cupSizes: number[] }) => {
    await saveUserSettings(s);
    const waterTarget = Math.round(s.weight * 30);
    setSettings((prev) => ({ ...prev, ...s, waterTarget }));
    setShowSettings(false);
  }, []);

  // 头像上传
  const handleAvatarUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await saveUserSettings({ avatarDataUrl: dataUrl });
        setSettings((prev) => ({ ...prev, avatarDataUrl: dataUrl }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="skeleton w-16 h-16 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        animate={isAnimated ? {
          boxShadow: [
            "0 0 10px rgba(234,179,8,0.4), 0 0 20px rgba(234,179,8,0.2)",
            "0 0 25px rgba(234,179,8,0.7), 0 0 50px rgba(234,179,8,0.4)",
            "0 0 10px rgba(234,179,8,0.4), 0 0 20px rgba(234,179,8,0.2)",
          ],
          scale: [1, 1.008, 1],
        } : {}}
        transition={isAnimated ? {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        } : {}}
        style={isAnimated ? {} : undefined}
        className={`rounded-3xl bg-white dark:bg-gray-900 p-5 transition-all duration-500 ${
          isGlowing || isAnimated
            ? "border-2 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
            : "border border-gray-100 dark:border-gray-800 shadow-sm"
        }`}
      >
        {/* 顶部：头像 + 状态条 */}
        <div className="flex items-start gap-4">
          {/* 头像 */}
          <button
            onClick={handleAvatarUpload}
            className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200 dark:border-gray-700
              hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group"
            title="点击更换头像"
          >
            {settings.avatarDataUrl ? (
              <img src={settings.avatarDataUrl} alt="头像" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                <User className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* 状态条 */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {/* HP - 睡眠 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-red-400" /> 睡眠
                </span>
                <span className="text-xs font-bold text-red-500">
                  {isAfterNap
                    ? `夜 ${sleepHours.toFixed(1)}/${settings.sleepTarget}h · 午 ${napHours.toFixed(1)}/${settings.napTarget}h`
                    : `${sleepHours.toFixed(1)}/${settings.sleepTarget}h`
                  }
                </span>
              </div>
              {isAfterNap ? (
                <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((sleepPct / 100) * 80, 80)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-l-full"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((napPct / 100) * 20, 20)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-r-full"
                  />
                </div>
              ) : (
                <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sleepPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                  />
                </div>
              )}
            </div>

            {/* MP - 饮水 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-blue-400" /> 饮水
                </span>
                <span className="text-xs font-bold text-blue-500">{waterMl}/{settings.waterTarget}ml</span>
              </div>
              <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${waterPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
                />
              </div>
            </div>

            {/* 怒气条 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Zap className={`w-3.5 h-3.5 ${isAnimated ? "text-yellow-400" : isGlowing ? "text-yellow-500" : "text-orange-400"}`} /> 综合
                </span>
                <span className={`text-xs font-bold ${isAnimated ? "text-yellow-500 animate-pulse" : isGlowing ? "text-yellow-600" : "text-orange-500"}`}>
                  {rageTotal}/300
                </span>
              </div>
              <div className="w-full h-4 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                {/* 自我感觉段 */}
                <div
                  className="h-full bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-500 relative"
                  style={{ width: `${(selfScore / 300) * 100}%` }}
                  title={`自我感觉: ${selfScore}/100`}
                />
                {/* 睡眠段 */}
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-orange-400 transition-all duration-500"
                  style={{ width: `${(sleepScore / 300) * 100}%` }}
                  title={`睡眠: ${sleepScore}/100`}
                />
                {/* 饮水段 */}
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-500"
                  style={{ width: `${(waterScore / 300) * 100}%` }}
                  title={`饮水: ${waterScore}/100`}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>感觉 {selfScore}</span>
                <span>睡眠 {sleepScore}</span>
                <span>饮水 {waterScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮行 */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {/* 饮水按钮 */}
          {settings.cupSizes.map((ml) => (
            <button
              key={ml}
              onClick={() => handleDrink(ml)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors active:scale-95"
            >
              <Plus className="w-3 h-3" />
              {ml}ml
            </button>
          ))}
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Undo2 className="w-3 h-3" />
            撤销
          </button>

          <div className="flex-1" />

          {/* 自我评分按钮 */}
          <button
            onClick={() => setShowSelfPanel(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400
              hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
          >
            <Zap className="w-3 h-3" />
            自我评分
            {selfScore > 0 && <span className="text-[10px] ml-0.5">({selfScore})</span>}
          </button>

          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
              bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>

        {/* 状态文案 */}
        {rageTotal >= 240 && (
          <div className={`mt-3 text-center text-sm font-bold tracking-wide ${
            rageTotal >= 300
              ? "text-yellow-500 animate-pulse"
              : rageTotal >= 270
              ? "text-yellow-600"
              : "text-yellow-500"
          }`}>
            {rageTotal >= 300 ? "完美" : rageTotal >= 270 ? "状态极佳" : "状态良好"}
          </div>
        )}
      </motion.div>

      {/* 弹窗 */}
      <AnimatePresence>
        {showSelfPanel && (
          <SelfAssessmentPanel
            onClose={() => setShowSelfPanel(false)}
            onSave={handleSelfSave}
          />
        )}
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSave={handleSettingsSave}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
