"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MascotIllustration from "@/components/ui/MascotIllustration";
import { conflictDetector, type Conflict } from "@/lib/engine/ConflictDetector";

// ============================================================
// 类型
// ============================================================

interface ConflictPanelProps {
  conflicts?: Conflict[];
  onResolve?: (conflictId: string) => void;
  className?: string;
}

// ============================================================
// 严重度配置
// ============================================================

const severityConfig = {
  high: {
    bg: "var(--warning-light)",
    border: "var(--warning)",
    text: "var(--warning)",
    label: "紧急",
    borderClass: "border-l-4",
  },
  medium: {
    bg: "rgba(245,197,66,0.15)",
    border: "var(--knit-thread-partial)",
    text: "var(--knit-thread-partial)",
    label: "警告",
    borderClass: "border-l-4",
  },
  low: {
    bg: "var(--info-light)",
    border: "var(--info)",
    text: "var(--info)",
    label: "提示",
    borderClass: "border-l-4",
  },
};

const typeLabels: Record<string, string> = {
  time_overlap: "时间冲突",
  capacity_overflow: "容量超限",
  deadline_clash: "截止日冲突",
};

// ============================================================
// 单个冲突卡片
// ============================================================

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: Conflict;
  onResolve?: (id: string) => void;
}) {
  const cfg = severityConfig[conflict.severity];
  const borderColor = cfg.border;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-r-fabric overflow-hidden"
      style={{ backgroundColor: cfg.bg, borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* 标签行 */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ color: cfg.text, backgroundColor: cfg.bg }}
              >
                {cfg.label}
              </span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {typeLabels[conflict.type] ?? conflict.type}
              </span>
            </div>

            {/* 描述 */}
            <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>
              {conflict.description}
            </p>

            {/* 涉及目标 */}
            {conflict.involvedGoals.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {conflict.involvedGoals.map((goal, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: "var(--surface-fabric)", color: "var(--text-secondary)" }}
                  >
                    {goal.goalTitle}
                  </span>
                ))}
              </div>
            )}

            {/* 建议 */}
            <p className="text-sm flex items-start gap-1" style={{ color: "var(--brand-secondary)" }}>
              <span className="flex-shrink-0">💡</span>
              <span>{conflict.suggestion}</span>
            </p>
          </div>

          {onResolve && (
            <button
              onClick={() => onResolve(conflict.id)}
              className="ml-3 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--text-inverse)",
              }}
            >
              一键解决
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// 主面板
// ============================================================

export default function ConflictPanel({
  conflicts: externalConflicts,
  onResolve,
  className = "",
}: ConflictPanelProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>(externalConflicts ?? []);
  const [loading, setLoading] = useState(!externalConflicts);

  useEffect(() => {
    if (externalConflicts) {
      setConflicts(externalConflicts);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await conflictDetector.detectAll();
        if (!cancelled) setConflicts(result);
      } catch (err) {
        console.error("[ConflictPanel] 加载失败:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [externalConflicts]);

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-fabric" />
        ))}
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div
        className={`rounded-fabric p-6 text-center ${className}`}
        style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}
      >
        <MascotIllustration state="completed" size={80} />
        <h3
          className="text-lg mt-3 mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          目前没有冲突
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          小织帮你检查过了，一切顺利！
        </p>
      </div>
    );
  }

  // 按严重度排序
  const sorted = [...conflicts].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
  const highCount = conflicts.filter((c) => c.severity === "high").length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 冲突总览 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative">
          <MascotIllustration state="confused" size={48} />
          {highCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
              style={{ backgroundColor: "var(--warning)" }}
            >
              {highCount}
            </span>
          )}
        </div>
        <div>
          <h3
            className="text-lg"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            发现 {conflicts.length} 个冲突
          </h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {highCount > 0 ? `${highCount} 个需要立即处理` : "都标记好了"}
          </p>
        </div>
      </div>

      {/* 冲突列表 */}
      <AnimatePresence>
        {sorted.map((conflict) => (
          <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
        ))}
      </AnimatePresence>
    </div>
  );
}
