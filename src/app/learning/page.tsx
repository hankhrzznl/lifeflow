"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, BookOpen, Moon, Sparkles, Dumbbell, Target, Sprout, Repeat } from "lucide-react";
import { getSubmodulesByParent, initializeSubmodules } from "@/lib/db";
import type { Submodule } from "@/lib/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  GraduationCap, BookOpen, Moon, Sparkles, Dumbbell,
  Target, Sprout, Repeat,
};

export default function LearningHubPage() {
  const router = useRouter();
  const [submodules, setSubmodules] = useState<Submodule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await initializeSubmodules();
      const list = await getSubmodulesByParent("learning");
      setSubmodules(list);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="skeleton w-64 h-48 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            ← 返回主页
          </button>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">学习</h1>
          <p className="text-slate-400 mt-1">毕业 · 考公</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {submodules.map((s, index) => {
            const Icon = ICON_MAP[s.icon] || GraduationCap;
            return (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(s.href)}
                className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${s.from} ${s.via} ${s.to} p-6 md:p-7 text-left text-white shadow-lg shadow-slate-200/60 min-h-[180px] md:min-h-[200px] flex flex-col`}
              >
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/20 to-transparent rounded-bl-full pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.8} />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1.5">{s.name}</h2>
                  <p className="text-white/80 text-sm md:text-base">{s.description}</p>
                  <div className="mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:translate-x-1 transition-transform">
                    <span>进入</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
