"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Moon, Sun, Settings, Zap, Timer } from "lucide-react";

// ==================== 工具 ====================

function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const weekday = weekdays[date.getDay()];
  return `今天 · ${month}月${day}日 ${weekday}`;
}

function formatDateFull(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// ==================== 图标按钮 ====================

function IconButton({
  icon: Icon,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 
                 dark:bg-gray-800 dark:hover:bg-gray-700
                 flex items-center justify-center transition-all duration-200"
    >
      <Icon size={20} className="text-gray-600 dark:text-gray-300" strokeWidth={1.5} />
      {badge !== undefined && badge > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 
                     bg-red-500 text-white text-[10px] font-bold 
                     rounded-full flex items-center justify-center
                     border-2 border-white dark:border-gray-900"
        >
          {badge > 9 ? "9+" : badge}
        </motion.span>
      )}
    </motion.button>
  );
}

// ==================== 暗黑模式 hook ====================

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved === "dark" || (!saved && prefers);
    setIsDark(dark);
    if (dark) document.documentElement.classList.add("dark");
  }, []);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  return { isDark, toggle };
}

// ==================== 主组件 ====================

export default function OverviewHeader() {
  const router = useRouter();
  const { isDark, toggle } = useDarkMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const today = new Date();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: -4 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" as const },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex items-start justify-between mb-6"
    >
      {/* 左侧日期 */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white" suppressHydrationWarning>
          {formatDate(today)}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400" suppressHydrationWarning>
          {formatDateFull(today)}
        </p>
      </div>

      {/* 右侧图标组 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-1.5 sm:gap-2"
      >
        {/* 捕捉 */}
        <motion.div variants={itemVariants}>
          <IconButton icon={Zap} onClick={() => router.push("/capture")} />
        </motion.div>

        {/* 专注 */}
        <motion.div variants={itemVariants}>
          <IconButton icon={Timer} onClick={() => router.push("/focus")} />
        </motion.div>

        {/* 提醒 */}
        <motion.div variants={itemVariants}>
          <IconButton icon={Bell} onClick={() => router.push("/reminders")} />
        </motion.div>

        {/* 暗黑模式切换 */}
        <motion.div variants={itemVariants}>
          <AnimatePresence mode="wait">
            <motion.button
              key={isDark ? "sun" : "moon"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={toggle}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200
                         dark:bg-gray-800 dark:hover:bg-gray-700
                         flex items-center justify-center transition-colors duration-200"
            >
              {isDark ? (
                <Sun size={20} className="text-gray-600 dark:text-gray-300" strokeWidth={1.5} />
              ) : (
                <Moon size={20} className="text-gray-600 dark:text-gray-300" strokeWidth={1.5} />
              )}
            </motion.button>
          </AnimatePresence>
        </motion.div>

        {/* 设置 */}
        <motion.div variants={itemVariants}>
          <IconButton icon={Settings} onClick={() => router.push("/settings")} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
