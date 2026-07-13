"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Send, ChevronDown } from "lucide-react";
import { createTask, getAllProjectsV2, getGoalsByProject, getPlansByGoal } from "@/lib/db";
import type { ProjectV2, Goal, Plan } from "@/lib/types";
import { showToast } from "@/components/ui/Toast";

export default function QuickCaptureBar({
  inboxExpanded,
  onToggleInbox,
  inboxCount = 0,
}: {
  inboxExpanded?: boolean;
  onToggleInbox?: () => void;
  inboxCount?: number;
}) {
  const [inputValue, setInputValue] = useState("");
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllProjectsV2().then((list) => setProjects(list));
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      getGoalsByProject(selectedProjectId).then((list) => setGoals(list));
      setSelectedGoalId(null);
      setSelectedPlanId(null);
      setPlans([]);
    } else {
      setGoals([]);
      setSelectedGoalId(null);
      setSelectedPlanId(null);
      setPlans([]);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedGoalId) {
      getPlansByGoal(selectedGoalId).then((list) => setPlans(list));
      setSelectedPlanId(null);
    } else {
      setPlans([]);
      setSelectedPlanId(null);
    }
  }, [selectedGoalId]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    try {
      const taskData: any = {
        title: inputValue.trim(),
        type: "daily",
        status: "active",
        tags: [...selectedTags],
      };

      if (selectedProjectId) {
        taskData.projectId = selectedProjectId;
      }
      if (selectedGoalId) {
        taskData.goalId = selectedGoalId;
      }
      if (selectedPlanId) {
        taskData.planId = selectedPlanId;
      }

      await createTask(taskData);

      showToast({ message: "想法已捕捉", type: "success" });
      setInputValue("");
      setSelectedTags([]);
      setShowTagSelector(false);
      if (!inboxExpanded && onToggleInbox) onToggleInbox();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to capture:", err);
      showToast({ message: "保存失败", type: "error" });
    }
  };

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.endsWith("#")) {
      setShowTagSelector(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

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
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
          <Zap size={20} className="text-white" strokeWidth={2} />
        </div>

        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 sm:h-11 bg-gray-100 dark:bg-gray-800 rounded-xl px-2 text-xs text-gray-600 dark:text-gray-400 border-0 focus:outline-none focus:ring-2 focus:ring-violet-500 flex-shrink-0 max-w-[100px] sm:max-w-[120px] appearance-none cursor-pointer"
        >
          <option value="">项目</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <AnimatePresence mode="wait">
          {selectedProjectId && (
            <motion.select
              key="goal-select"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              value={selectedGoalId ?? ""}
              onChange={(e) => setSelectedGoalId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 sm:h-11 bg-gray-100 dark:bg-gray-800 rounded-xl px-2 text-xs text-gray-600 dark:text-gray-400 border-0 focus:outline-none focus:ring-2 focus:ring-violet-500 flex-shrink-0 max-w-[100px] sm:max-w-[120px] appearance-none cursor-pointer"
            >
              <option value="">目标</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </motion.select>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {selectedGoalId && (
            <motion.select
              key="plan-select"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              value={selectedPlanId ?? ""}
              onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 sm:h-11 bg-gray-100 dark:bg-gray-800 rounded-xl px-2 text-xs text-gray-600 dark:text-gray-400 border-0 focus:outline-none focus:ring-2 focus:ring-violet-500 flex-shrink-0 max-w-[100px] sm:max-w-[120px] appearance-none cursor-pointer"
            >
              <option value="">计划</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </motion.select>
          )}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {}}
          onBlur={() => setTimeout(() => setShowTagSelector(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="快速记录想法...（输入 # 添加标签）"
          className="h-10 sm:h-11 flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4
                     text-sm text-gray-900 dark:text-white
                     placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-violet-500 
                     focus:ring-offset-1 dark:focus:ring-offset-gray-900
                     focus:bg-white dark:focus:bg-gray-800
                     transition-all duration-200 min-w-[100px]"
        />

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

        <button
          onClick={onToggleInbox}
          className="text-sm text-gray-500 hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200
                     transition-colors duration-200 flex-shrink-0 flex items-center gap-1"
        >
          <span>{inboxExpanded ? "收起" : "展开"}</span>
          {!inboxExpanded && inboxCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-violet-500 rounded-full">
              {inboxCount}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${inboxExpanded ? "rotate-180" : ""}`} strokeWidth={2} />
        </button>
      </div>

      <AnimatePresence>
        {showTagSelector && projects.length > 0 && (
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
              {projects.map((tag) => (
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