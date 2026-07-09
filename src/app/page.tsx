"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, FolderKanban,
} from "lucide-react";
import type { ProjectV2, Board } from "@/lib/types";
import { getAllProjectsV2, getBoardsByProject } from "@/lib/db";
import OverviewHeader from "@/components/layout/OverviewHeader";
import QuickCaptureBar from "@/components/layout/QuickCaptureBar";
import CaptureInbox from "@/components/layout/CaptureInbox";
import TodayTimeline from "@/components/schedule/TodayTimeline";
import CharacterFrame from "@/components/CharacterFrame";

// ==================== 工具 ====================

const PROJECT_GRADIENTS = [
  "from-indigo-400 via-violet-400 to-purple-500",
  "from-emerald-400 via-teal-400 to-cyan-500",
  "from-rose-400 via-pink-400 to-fuchsia-500",
  "from-sky-400 via-cyan-400 to-blue-500",
  "from-amber-400 via-orange-400 to-red-500",
  "from-teal-400 via-green-400 to-emerald-500",
  "from-fuchsia-400 via-purple-400 to-violet-500",
  "from-blue-400 via-indigo-400 to-violet-500",
];

function getProjectGradient(index: number): string {
  return PROJECT_GRADIENTS[index % PROJECT_GRADIENTS.length];
}

// ==================== 项目卡片 ====================

function ProjectCard({
  project,
  index,
  boardCount,
  boardNames,
}: {
  project: ProjectV2;
  index: number;
  boardCount: number;
  boardNames: string[];
}) {
  const gradient = getProjectGradient(index);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-7 text-white shadow-lg shadow-slate-200/60 min-h-[200px] md:min-h-[240px] flex flex-col`}
    >
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-5">
          <FolderKanban className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{project.name}</h2>
        <p className="text-white/80 text-sm md:text-base mb-4">
          {boardCount > 0 ? `${boardCount} 个大模块` : "暂无大模块"}
        </p>

        {boardNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {boardNames.slice(0, 4).map((name) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20"
              >
                {name}
              </span>
            ))}
            {boardNames.length > 4 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/20">
                +{boardNames.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-white/90">
          <span>在规划页中管理</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}

// ==================== 主页面 ====================

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [projectBoards, setProjectBoards] = useState<Record<number, Board[]>>({});
  const [loading, setLoading] = useState(true);
  const [inboxExpanded, setInboxExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getAllProjectsV2();
        setProjects(list);

        const map: Record<number, Board[]> = {};
        for (const proj of list) {
          const bds = await getBoardsByProject(proj.id!);
          map[proj.id!] = bds;
        }
        setProjectBoards(map);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <OverviewHeader />

        {/* 人物框 */}
        <div className="mt-6 mb-6">
          <CharacterFrame />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-[240px] rounded-3xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 mb-1">暂无项目</p>
            <p className="text-xs text-gray-400">
              在规划页中创建项目，它们将自动显示在这里
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {projects.map((proj, i) => {
              const boards = projectBoards[proj.id!] || [];
              return (
                <ProjectCard
                  key={proj.id}
                  project={proj}
                  index={i}
                  boardCount={boards.length}
                  boardNames={boards.map((b) => b.name)}
                />
              );
            })}
          </div>
        )}

        {/* 快速捕捉栏 */}
        <div className="mt-8">
          <QuickCaptureBar
            inboxExpanded={inboxExpanded}
            onToggleInbox={() => setInboxExpanded((v) => !v)}
          />
          <CaptureInbox visible={inboxExpanded} />
        </div>

        {/* 日程时间线 */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">今日日程</h2>
          <TodayTimeline />
        </div>
      </div>
    </div>
  );
}
