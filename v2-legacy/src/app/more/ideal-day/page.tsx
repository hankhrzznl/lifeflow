"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Moon, Sunrise, Dumbbell, GraduationCap, Droplets, Timer, Sun, AlarmClock, Check, CalendarDays } from "lucide-react";
import { getIdealDayConfig, saveIdealDayConfig, getScheduleMode, switchScheduleMode, buildIdealDayPreview, buildStudySlots, formatMinutes, applyIdealDayBlueprint } from "@/lib/ideal-day";
import { defaultIdealDayConfig, type IdealDayConfig, type IdealDayMode } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

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

// ─── 配置行（左标签 + 右侧输入） ─────────────────────────────
function ConfigRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between w-full px-5 py-3.5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <span className="text-[16px] truncate" style={{ color: "var(--color-text-primary)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="time" value={value} onChange={(e) => onChange(e.target.value)}
      className="text-[16px] text-right bg-transparent outline-none w-[92px]"
      style={{ color: "var(--color-text-primary)", border: "none" }} />
  );
}

function NumberInput({ value, onChange, step = 0.5, min = 0.5, max = 16 }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <input type="number" value={value} step={step} min={min} max={max}
      onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n))); }}
      className="text-[16px] text-right bg-transparent outline-none w-[64px]"
      style={{ color: "var(--color-text-primary)", border: "none" }} />
  );
}

export default function IdealDayPage() {
  const router = useRouter();
  const [config, setConfig] = useState<IdealDayConfig>(defaultIdealDayConfig());
  const [loaded, setLoaded] = useState(false);
  // T21-7：当前作息模式（暑假/开学）
  const [mode, setMode] = useState<IdealDayMode>('summer');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    getScheduleMode().then(setMode);
    getIdealDayConfig().then((c) => { setConfig(c); setLoaded(true); });
  }, []);

  const preview = useMemo(() => (loaded ? buildIdealDayPreview(config) : null), [loaded, config]);
  const studySlots = useMemo(() => (loaded ? buildStudySlots(config) : []), [loaded, config]);

  const set = <K extends keyof IdealDayConfig>(key: K, value: IdealDayConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));
  const setStudy = (patch: Partial<IdealDayConfig["study"]>) =>
    setConfig((prev) => ({ ...prev, study: { ...prev.study, ...patch } }));

  const handleSave = async () => {
    await saveIdealDayConfig(config);
    // T19-2：蓝图 → 自动排程（作息模板同步 + 学习/训练/留白事项生成）
    await applyIdealDayBlueprint();
    showToast({ type: "success", message: config.enabled ? "理想日蓝图已保存并排程" : "理想日蓝图已保存" });
  };

  // T21-7：一键切换作息模式（保存当前编辑 → 切换 → 模板预置 → 自动重排）
  const handleSwitchMode = async (next: IdealDayMode) => {
    if (next === mode || switching || !loaded) return;
    setSwitching(true);
    try {
      await saveIdealDayConfig(config);          // 静默保存当前编辑到当前模式槽位
      const res = await switchScheduleMode(next); // 切换模式 + 开学模板预置 + 自动重排
      const nextConfig = await getIdealDayConfig();
      setConfig(nextConfig);
      setMode(next);
      showToast({ type: "success", message: res.applied ? `已切换至${next === 'school' ? '开学' : '暑假'}作息并重排` : "已处于该模式" });
    } catch {
      showToast({ type: "error", message: "切换失败，请重试" });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="flex items-center justify-center h-[44px] px-4 pt-[var(--safe-area-top)] relative">
        <button type="button" onClick={() => router.back()} className="absolute left-4 top-[calc(var(--safe-area-top)+4px)] p-1" aria-label="返回">
          <ChevronLeft className="w-6 h-6" style={{ color: "var(--lifeflow-primary)" }} />
        </button>
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>理想日蓝图</h1>
      </div>

      {/* 作息模式（T21-7 双作息：暑假/开学一键切换） */}
      <div className="px-4 pt-6 pb-2">
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <CalendarDays className="w-5 h-5 shrink-0" style={{ color: "#F59E0B" }} />
              <div className="min-w-0">
                <p className="text-[16px] font-medium" style={{ color: "var(--color-text-primary)" }}>作息模式</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>暑假/开学两套作息，切换后自动重排今日起 7 天</p>
              </div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <div className="flex rounded-full p-1" style={{ background: "var(--lifeflow-muted)" }}>
              {([
                { key: 'summer', label: '暑假' },
                { key: 'school', label: '开学' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSwitchMode(key)}
                  disabled={switching}
                  className="flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all"
                  style={{
                    background: mode === key ? "var(--color-surface-card)" : "transparent",
                    color: mode === key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    boxShadow: mode === key ? "var(--shadow-card)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 总开关 */}
      <div className="px-4 pt-6 pb-2">
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <Sun className="w-5 h-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <div className="min-w-0">
                <p className="text-[16px] font-medium" style={{ color: "var(--color-text-primary)" }}>启用理想日系统</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>开启后按蓝图自动排程并追踪达成率</p>
              </div>
            </div>
            <ToggleSwitch checked={config.enabled} onChange={() => set("enabled", !config.enabled)} label="启用理想日" />
          </div>
        </div>
      </div>

      {/* 睡眠作息 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>睡眠与作息（8h = 夜间 7.5h + 午睡 0.5h）</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<Moon className="w-5 h-5 shrink-0" style={{ color: "#6366F1" }} />} label="上床时间">
            <TimeInput value={config.sleepBedTime} onChange={(v) => set("sleepBedTime", v)} />
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<Sunrise className="w-5 h-5 shrink-0" style={{ color: "#F59E0B" }} />} label="起床时间">
            <TimeInput value={config.sleepWakeTime} onChange={(v) => set("sleepWakeTime", v)} />
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<Sun className="w-5 h-5 shrink-0" style={{ color: "#3B82F6" }} />} label="午睡时间">
            <TimeInput value={config.napTime} onChange={(v) => set("napTime", v)} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>/</span>
            <NumberInput value={config.napMinutes} onChange={(v) => set("napMinutes", Math.round(v))} step={5} min={0} max={120} />
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<AlarmClock className="w-5 h-5 shrink-0" style={{ color: "#14B8A6" }} />} label="洗漱+早餐完成">
            <TimeInput value={config.wakeRoutineEnd} onChange={(v) => set("wakeRoutineEnd", v)} />
          </ConfigRow>
        </div>
      </div>

      {/* 健身 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>健身（周一/三/五力量 · 周二/四有氧 · 3大项轮换）</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <ConfigRow icon={<Dumbbell className="w-5 h-5 shrink-0" style={{ color: "#F97316" }} />} label="健身时间">
            <TimeInput value={config.workoutStart} onChange={(v) => set("workoutStart", v)} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>-</span>
            <TimeInput value={config.workoutEnd} onChange={(v) => set("workoutEnd", v)} />
          </ConfigRow>
        </div>
      </div>

      {/* 学习 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>学习（主目标 ≥ 次目标 2 倍）</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <ConfigRow icon={<GraduationCap className="w-5 h-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />} label="每日学习时长">
            <NumberInput value={config.study.totalHours} onChange={(v) => setStudy({ totalHours: v })} step={0.5} min={1} max={12} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>小时</span>
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<Sun className="w-5 h-5 shrink-0" style={{ color: "#F59E0B" }} />} label="学习开始时间">
            <TimeInput value={config.studyStart} onChange={(v) => set("studyStart", v)} />
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<GraduationCap className="w-5 h-5 shrink-0" style={{ color: "#6366F1" }} />} label="主目标（省考）">
            <NumberInput value={config.study.primaryGoalHours} onChange={(v) => setStudy({ primaryGoalHours: v })} step={0.5} min={0.5} max={12} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>小时</span>
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<GraduationCap className="w-5 h-5 shrink-0" style={{ color: "#10B981" }} />} label="次目标（四级）">
            <NumberInput value={config.study.secondaryGoalHours} onChange={(v) => setStudy({ secondaryGoalHours: v })} step={0.5} min={0.5} max={6} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>小时</span>
          </ConfigRow>
        </div>
      </div>

      {/* 饮水 + 娱乐配额 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>饮水与自由时间</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <ConfigRow icon={<Droplets className="w-5 h-5 shrink-0" style={{ color: "#3B82F6" }} />} label="饮水目标">
            <NumberInput value={config.waterTargetMl} onChange={(v) => set("waterTargetMl", Math.round(v))} step={100} min={500} max={5000} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>ml</span>
          </ConfigRow>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <ConfigRow icon={<Timer className="w-5 h-5 shrink-0" style={{ color: "#8B5CF6" }} />} label="娱乐配额">
            <NumberInput value={config.leisureQuotaMinutes} onChange={(v) => set("leisureQuotaMinutes", Math.round(v))} step={15} min={0} max={480} />
            <span className="text-[14px]" style={{ color: "var(--color-text-disabled)" }}>分钟/天</span>
          </ConfigRow>
        </div>
      </div>

      {/* 执行引导开关 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>执行引导</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Timer className="w-5 h-5 shrink-0" style={{ color: "var(--lifeflow-primary)" }} />
              <span className="text-[16px] truncate" style={{ color: "var(--color-text-primary)" }}>学习时段免打扰</span>
            </div>
            <ToggleSwitch checked={config.focusEnabled} onChange={() => set("focusEnabled", !config.focusEnabled)} label="免打扰" />
          </div>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Timer className="w-5 h-5 shrink-0" style={{ color: "#F59E0B" }} />
              <span className="text-[16px] truncate" style={{ color: "var(--color-text-primary)" }}>娱乐配额超时提醒</span>
            </div>
            <ToggleSwitch checked={config.quotaTrackEnabled} onChange={() => set("quotaTrackEnabled", !config.quotaTrackEnabled)} label="配额追踪" />
          </div>
        </div>
      </div>

      {/* 今日蓝图预览 */}
      {preview && config.enabled && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>今日蓝图预览</p>
          <div className="rounded-[20px] p-5 space-y-2" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
            {[
              { icon: <Moon className="w-4 h-4" style={{ color: "#6366F1" }} />, text: `睡眠 ${preview.sleepNight}（${formatMinutes(450)}）` },
              { icon: <Sun className="w-4 h-4" style={{ color: "#F59E0B" }} />, text: `午睡 ${preview.nap}（${formatMinutes(config.napMinutes)}）` },
              { icon: <AlarmClock className="w-4 h-4" style={{ color: "#14B8A6" }} />, text: preview.wakeRoutine },
              { icon: <Dumbbell className="w-4 h-4" style={{ color: "#F97316" }} />, text: preview.workout },
              ...studySlots.map((s, i) => ({
                icon: <GraduationCap className="w-4 h-4" style={{ color: i === 0 ? "#6366F1" : "#10B981" }} />,
                text: `${s.goalName} ${s.start}-${s.end}（${formatMinutes(s.minutes)}）`,
              })),
              { icon: <Droplets className="w-4 h-4" style={{ color: "#3B82F6" }} />, text: `饮水 ${preview.waterTargetMl}ml（三时段）` },
              { icon: <Timer className="w-4 h-4" style={{ color: "#8B5CF6" }} />, text: `自由时间 8h，娱乐配额 ${formatMinutes(preview.leisureMinutes)}` },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 flex justify-center shrink-0">{row.icon}</div>
                <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>{row.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 保存 */}
      <div className="px-4 pt-8">
        <button type="button" onClick={handleSave}
          className="w-full py-3.5 text-center text-[16px] font-semibold rounded-[20px] flex items-center justify-center gap-2"
          style={{ background: "var(--lifeflow-primary)", color: "#fff", boxShadow: "var(--shadow-card)" }}>
          <Check className="w-5 h-5" /> 保存蓝图
        </button>
      </div>
    </div>
  );
}
