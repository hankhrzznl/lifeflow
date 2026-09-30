"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Target, CalendarClock, TrendingUp, ArrowRight, X } from "lucide-react";
import { GuideBrain, type GuideStep } from "@/lib/brains/guide";

const STEP_ICONS: Record<string, React.ReactNode> = {
  goal: <Target className="w-5 h-5" />,
  schedule: <CalendarClock className="w-5 h-5" />,
  review: <TrendingUp className="w-5 h-5" />,
};

const GRADIENT = "linear-gradient(135deg, var(--lifeflow-primary) 0%, #7C3AED 100%)";

export default function OnboardingCard() {
  const router = useRouter();
  const [guide] = useState(() => new GuideBrain());
  const [step, setStep] = useState<GuideStep | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const s = guide.getCurrentStep();
    if (s) {
      setStep(s);
      setVisible(true);
    }
  }, [guide]);

  const handleGo = () => {
    if (!step) return;
    guide.markStep(step.id);
    setVisible(false);
    router.push(step.path);
  };

  const handleSkip = () => {
    if (!step) return;
    guide.markStep(step.id);
    const next = guide.getCurrentStep();
    if (next) {
      setStep(next);
    } else {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    guide.completeAll();
    setVisible(false);
  };

  const steps = guide.getAllSteps();
  const total = steps.length;
  const currentIndex = step ? steps.findIndex((s) => s.id === step.id) : 0;

  return (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="px-4 pt-3"
        >
          <div
            className="relative overflow-hidden p-4"
            style={{ background: GRADIENT, borderRadius: 20, boxShadow: "var(--shadow-card)" }}
          >
            {/* 右上角关闭 */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="关闭引导"
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full active:opacity-60"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* 步骤指示：第 N/3 步 + 圆点 */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[12px] font-semibold text-white/85">
                第 {currentIndex + 1}/{total} 步
              </span>
              <div className="flex items-center gap-1">
                {steps.map((s, i) => (
                  <span
                    key={s.id}
                    className="h-1.5 rounded-full"
                    style={{
                      width: i === currentIndex ? 18 : 6,
                      background: i <= currentIndex ? "#fff" : "rgba(255,255,255,0.35)",
                      transition: "all 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 步骤内容 */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-white"
                style={{ background: "rgba(255,255,255,0.18)" }}
              >
                {STEP_ICONS[step.id] ?? null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-white">{step.title}</p>
                <p className="text-[13px] leading-relaxed text-white/80 mt-0.5">{step.description}</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={handleGo}
                className="flex items-center justify-center gap-1.5 h-10 flex-1 rounded-xl font-semibold text-[14px] active:opacity-70"
                style={{ background: "#fff", color: "var(--lifeflow-primary)" }}
              >
                去试试
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="h-10 px-4 rounded-xl text-[14px] font-medium text-white/85 active:opacity-60"
                style={{ background: "rgba(255,255,255,0.14)" }}
              >
                跳过
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
