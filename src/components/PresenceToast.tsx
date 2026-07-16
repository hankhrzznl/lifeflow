"use client";

import { useEffect, useState } from "react";
import { presenceEngine, type PresenceReminder } from "@/lib/engine/PresenceEngine";
import MascotIllustration from "@/components/ui/MascotIllustration";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PresenceToast() {
  const [reminder, setReminder] = useState<PresenceReminder | null>(null);

  useEffect(() => {
    const unsub = presenceEngine.onReminder((r) => {
      setReminder(r);
      setTimeout(() => setReminder(null), 5000);
    });
    return unsub;
  }, []);

  return (
    <AnimatePresence>
      {reminder && (
        <motion.div
          initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed top-4 left-4 right-4 z-[60] flex justify-center"
        >
          <div className="bg-white rounded-xl shadow-lg border px-4 py-3 flex items-center gap-3 max-w-md w-full"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-fabric)" }}>
            <div className="w-10 h-10 flex-shrink-0">
              <MascotIllustration
                state={reminder.type === "encouragement" ? "celebrating" : "waiting"} size={40} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>{reminder.message}</p>
            </div>
            <button onClick={() => setReminder(null)} className="p-1 flex-shrink-0">
              <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
