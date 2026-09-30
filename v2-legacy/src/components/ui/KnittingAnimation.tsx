"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// 类型
// ============================================================

interface KnitPoint {
  x: number;
  y: number;
}

interface KnittingAnimationContextType {
  triggerKnit: (from: KnitPoint) => void;
}

const KnittingAnimationContext = createContext<KnittingAnimationContextType | null>(null);

// ============================================================
// Context Hook
// ============================================================

export function useKnittingAnimation() {
  const ctx = useContext(KnittingAnimationContext);
  return ctx?.triggerKnit ?? (() => {});
}

// ============================================================
// Provider
// ============================================================

export function KnittingAnimationProvider({ children }: { children: ReactNode }) {
  const [knits, setKnits] = useState<{ id: number; from: KnitPoint }[]>([]);
  let nextId = 0;

  const triggerKnit = useCallback((from: KnitPoint) => {
    const id = Date.now();
    setKnits((prev) => [...prev, { id, from }]);
    setTimeout(() => {
      setKnits((prev) => prev.filter((k) => k.id !== id));
    }, 800);
  }, []);

  return (
    <KnittingAnimationContext.Provider value={{ triggerKnit }}>
      {children}

      {/* 浮动动画层 */}
      <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden>
        <AnimatePresence>
          {knits.map((k) => (
            <motion.div
              key={k.id}
              initial={{
                x: k.from.x - 4,
                y: k.from.y - 4,
                scale: 1,
                opacity: 1,
              }}
              animate={{
                x: k.from.x - 60,
                y: k.from.y - 60,
                scale: 0.3,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
              className="absolute"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "var(--brand-primary)",
                boxShadow: "0 0 6px rgba(232,141,103,0.5)",
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </KnittingAnimationContext.Provider>
  );
}
