"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Play, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";

const FAN_ANGLES = [225, 180, 135];
const FAN_RADIUS = 64;

const actions = [
  {
    label: "捕捉想法",
    icon: Pencil,
    path: "/capture",
  },
  {
    label: "规划日程",
    icon: CalendarPlus,
    path: "/planner",
  },
  {
    label: "开始专注",
    icon: Play,
    path: "/focus",
  },
];

export default function FAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const fabSpring = {
    type: "spring" as const,
    stiffness: 400,
    damping: 25,
  };

  return (
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50">
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            {actions.map((action, i) => {
              const angleRad = (FAN_ANGLES[i] * Math.PI) / 180;
              const x = Math.cos(angleRad) * FAN_RADIUS;
              const y = Math.sin(angleRad) * FAN_RADIUS;
              return (
                <motion.button
                  key={action.label}
                  className="absolute right-0 bottom-16 z-50 flex items-center gap-2.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2.5 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow"
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, x, y, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  transition={{
                    ...fabSpring,
                    delay: i * 0.04,
                  }}
                  onClick={() => {
                    router.push(action.path);
                    setOpen(false);
                  }}
                >
                  <action.icon className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium whitespace-nowrap">
                    {action.label}
                  </span>
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      <motion.button
        className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-xl flex items-center justify-center text-white hover:shadow-2xl transition-shadow"
        onClick={() => setOpen(!open)}
        animate={{ rotate: open ? 45 : 0 }}
        transition={fabSpring}
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
