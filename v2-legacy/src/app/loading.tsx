"use client";

import { motion } from "framer-motion";

const container = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function Loading() {
  return (
    <motion.div
      className="p-4 space-y-4"
      variants={container}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="skeleton h-8 w-1/3" />

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>

      <div className="skeleton h-64 rounded-2xl" />

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </motion.div>
  );
}
