"use client";

import { useEffect, useState } from "react";
import { guideEngine, type GuideStep, type GuideContext } from "@/lib/engine/GuideEngine";
import MascotIllustration from "@/components/ui/MascotIllustration";
import { X, ArrowRight, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function GuideModal({ context, onComplete }: { context: GuideContext; onComplete: () => void }) {
  const [step, setStep] = useState<GuideStep | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const s = guideEngine.getCurrentStep(context);
    if (s) { setStep(s); setTimeout(() => setVisible(true), 500); }
  }, [context]);

  const handleNext = () => {
    if (step) guideEngine.markComplete(step.id);
    const next = guideEngine.getCurrentStep(context);
    if (next) { setVisible(false); setTimeout(() => { setStep(next); setVisible(true); }, 300); }
    else { setVisible(false); onComplete(); }
  };

  const handleSkip = () => { if (step?.canSkip) handleNext(); };

  if (!step) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center"
          onClick={handleNext}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-[400px] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20">
                <MascotIllustration state={step.mascotState} size={80} />
              </div>
            </div>

            <h3 className="text-lg font-semibold text-center mb-2" style={{ color: "var(--text-primary)" }}>
              {step.title}
            </h3>
            <p className="text-sm text-center leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
              {step.message}
            </p>

            <div className="flex gap-3">
              {step.canSkip && (
                <button onClick={handleSkip}
                  className="flex-1 py-3 border rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <SkipForward className="w-4 h-4" /> 跳过
                </button>
              )}
              <button onClick={handleNext}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)" }}>
                {step.id === "complete" ? "开始吧" : "下一步"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button onClick={() => { setVisible(false); onComplete(); }}
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors">
              <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            </button>

            <div className="flex justify-center gap-1.5 mt-4">
              {["welcome","explain","demo_assistant","create_first","checkin_tutorial","complete"].map((id) => (
                <div key={id}
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ backgroundColor: id === step.id ? "var(--brand-primary)" : "var(--border)" }} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
