"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft, FolderKanban,
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, ExternalLink,
  Timer, CalendarRange, StickyNote,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getAllProjects } from "@/lib/db/efficiency.db";
import type { Project } from "@/lib/db/efficiency.db";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  GraduationCap, Heart, ClipboardList, Target, Gamepad2, FolderOpen,
  Clock, Wallet, Droplets, Moon, Dumbbell, Pill, StretchHorizontal,
  Utensils, Flower2, FolderKanban,
};

export default function ProjectsPage() {
  const router = useRouter();

  const allProjects = useLiveQuery(() => getAllProjects(), [], [] as Project[]);

  const bigProjects = allProjects.filter(p => p.projectType === 'big');
  const smallProjects = allProjects.filter(p => p.projectType === 'small');

  const [activeBigId, setActiveBigId] = useState<string>("");

  const navigateTo = useCallback((p: Project) => {
    if (p.moreRoute) router.push(p.moreRoute);
  }, [router]);

  const getIcon = (name: string) => ICON_MAP[name] || FolderKanban;

  const defaultSmall = useMemo(() => {
    return activeBigId
      ? smallProjects.filter(p => p.isDefault && p.parentProjectId === activeBigId)
      : smallProjects.filter(p => p.isDefault);
  }, [smallProjects, activeBigId]);

  return (
    <div className="pb-[120px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[var(--safe-area-top)] pb-2">
        <button
          type="button" onClick={() => router.push("/")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--color-surface-secondary)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--color-text-primary)" }} />
        </button>
        <h1 className="text-title-nav mx-2 truncate" style={{ color: "var(--color-text-primary)" }}>全部功能</h1>
        <div className="w-8" />
      </div>

      <div className="px-4">
        <p className="text-[12px] mb-2.5" style={{ color: "var(--color-text-disabled)" }}>13 个模块</p>
        {/* Big Project Tags */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>项目分类</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveBigId("")}
              className="h-9 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={{
                background: !activeBigId ? "var(--lifeflow-primary)" : "var(--color-surface-secondary)",
                color: !activeBigId ? "var(--lifeflow-primary-foreground)" : "var(--color-text-secondary)",
              }}
            >全部</button>
            {bigProjects.map(bp => {
              const Icon = getIcon(bp.icon);
              return (
                <button key={bp.id} onClick={() => setActiveBigId(activeBigId === bp.id ? "" : bp.id)}
                  className="h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    background: activeBigId === bp.id ? bp.color : "var(--color-surface-secondary)",
                    color: activeBigId === bp.id ? "#fff" : "var(--color-text-secondary)",
                    border: activeBigId !== bp.id ? "1px solid var(--lifeflow-border)" : "none",
                  }}
                ><Icon className="w-3.5 h-3.5" />{bp.name}</button>
              );
            })}
          </div>
        </motion.div>

        {/* Default Small Projects */}
        {defaultSmall.length > 0 && (
          <div className="mb-5">
            <p className="text-[12px] font-medium mb-2.5" style={{ color: "var(--color-text-disabled)" }}>功能模块</p>
            <div className="grid grid-cols-2 gap-2.5">
              {defaultSmall.map((p, i) => {
                const Icon = getIcon(p.icon);
                return (
                  <motion.button key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigateTo(p)}
                    className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                    style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color}20` }}>
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
                  </motion.button>
                );
              })}
              {/* 专注 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.03 }}
                onClick={() => router.push("/more/focus")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#6366F120" }}>
                  <Timer className="w-5 h-5" style={{ color: "#6366F1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>专注</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 倒数日 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.06 }}
                onClick={() => router.push("/more/countdown")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F59E0B20" }}>
                  <CalendarRange className="w-5 h-5" style={{ color: "#F59E0B" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>倒数日</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
              {/* 备忘录 */}
              <motion.button
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: defaultSmall.length * 0.03 + 0.09 }}
                onClick={() => router.push("/more/notes")}
                className="p-3.5 rounded-[16px] flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#8B5CF620" }}>
                  <StickyNote className="w-5 h-5" style={{ color: "#8B5CF6" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>备忘录</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-disabled)" }} />
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
