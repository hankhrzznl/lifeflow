"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Send, ChevronDown } from "lucide-react";
import { db } from "@/lib/db";
import { getAllProjectsV2 } from "@/lib/db";
import type { ProjectV2 } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

// ==================== 主组件 ====================

export default function QuickCaptureBar({
  inboxExpanded,
  onToggleInbox,
}: {
  inboxExpanded?: boolean;
  onToggleInbox?: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tags, setTags] = useState<ProjectV2[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载项目作为标签数据
  useEffect(() => {
    getAllProjectsV2().then((list) => setTags(list));
  }, []);

  // 发送
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    try {
      await db.capture.add({
        content: inputValue.trim(),
        status: "inbox" as const,
        tags: [...selectedTags],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      showToast({ message: "想法已捕捉", type: "success" });
      setInputValue("");
      setSelectedTags([]);
      setIsFocused(false);
      inputRef.current?.blur();
    } catch (err) {
      console.error("Failed to capture:", err);
      showToast({ message: "保存失败", type: "error" });
    }
  };

  // 标签点击
  const handleTagClick = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tagName));
    } else {
      setSelectedTags((prev) => [...prev, tagName]);
    }
    const tagText = `#${tagName}`;
    if (!inputValue.includes(tagText)) {
      setInputValue((prev) => (prev ? `${prev} ${tagText}` : tagText));
    }
    inputRef.current?.focus();
  };

  // 回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  // 动画
  const tagContainerVariants = {
    hidden: { height: 0, opacity: 0, transition: { duration: 0.2 } },
    visible: {
      height: "auto",
      opacity: 1,
      transition: {
        duration: 0.25,
        staggerChildren: 0.04,
        delayChildren: 0.05,
      },
    },
  };

  const tagItemVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 4 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2 } },
  };

  const barVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
  };

  return (
    <motion.div
      variants={barVariants}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 
                 dark:border-gray-700 shadow-lg p-2.5 sm:p-3"
    >
      {/* 主输入行 */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 闪电图标 */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
          <Zap size={20} className="text-white" strokeWidth={2} />
        </div>

        {/* 输入框 */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="快速记录想法..."
          className="h-10 sm:h-11 flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4
                     text-sm text-gray-900 dark:text-white
                     placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-violet-500 
                     focus:ring-offset-1 dark:focus:ring-offset-gray-900
                     focus:bg-white dark:focus:bg-gray-800
                     transition-all duration-200"
        />

        {/* 发送按钮 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-violet-600 hover:bg-violet-700
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center flex-shrink-0
                     transition-colors duration-200"
        >
          <Send size={18} className="text-white" strokeWidth={2} />
        </motion.button>

        {/* 展开/收起 */}
        <button
          onClick={onToggleInbox}
          className="text-sm text-gray-500 hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200
                     transition-colors duration-200 flex-shrink-0 flex items-center gap-0.5"
        >
          <span>{inboxExpanded ? "收起" : "展开"}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${inboxExpanded ? "rotate-180" : ""}`} strokeWidth={2} />
        </button>
      </div>

      {/* 标签选择器（聚焦时展开） */}
      <AnimatePresence>
        {isFocused && tags.length > 0 && (
          <motion.div
            variants={tagContainerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2 flex-wrap pt-2 mt-2 
                          border-t border-gray-100 dark:border-gray-800"
            >
              {tags.map((tag) => (
                <motion.button
                  key={tag.id}
                  variants={tagItemVariants}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTagClick(tag.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium
                             border transition-all duration-150
                             ${
                               selectedTags.includes(tag.name)
                                 ? "bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300"
                                 : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                             }`}
                >
                  #{tag.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
