"use client";

import { useState, useEffect } from "react";
import { aiInsightEngine } from "@/lib/engine/AIInsightEngine";
import MascotIllustration from "@/components/ui/MascotIllustration";
import type { Insight } from "@/lib/engine/AIInsightEngine";

interface AIInsightCardsProps {
  goalId: string;
  className?: string;
}

export default function AIInsightCards({ goalId, className = "" }: AIInsightCardsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [bestTime, bottleneck, trend, conflict] = await Promise.all([
          aiInsightEngine.findBestTime(goalId),
          aiInsightEngine.findBottleneck(goalId),
          aiInsightEngine.analyzeSpeedTrend(goalId),
          aiInsightEngine.generateConflictWarning(goalId),
        ]);

        if (cancelled) return;

        const result: Insight[] = [];
        if (bestTime && !bestTime.includes('数据不足')) {
          result.push({ icon: '⏰', title: '最佳时间', content: bestTime, color: 'var(--brand-primary-light)' });
        }
        if (bottleneck && !bottleneck.includes('数据不足')) {
          result.push({ icon: '🚧', title: '阻力画像', content: bottleneck, color: 'var(--warning-light)' });
        }
        if (trend && !trend.includes('数据不足') && !trend.includes('至少需要')) {
          result.push({ icon: '📈', title: '速度趋势', content: trend, color: 'var(--success-light)' });
        }
        if (conflict) {
          result.push({ icon: '⚡', title: '冲突提醒', content: conflict, color: 'var(--info-light)' });
        }

        setInsights(result);
      } catch (err) {
        console.error('[AIInsightCards] 加载失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [goalId]);

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 rounded-fabric" />
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <MascotIllustration state="waiting" size={60} />
        <p className="text-sm mt-2" style={{ fontFamily: "var(--font-display)", color: "var(--text-secondary)" }}>
          再织几天，小织就能给你建议啦
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-3 ${className}`}>
      {insights.map((insight, i) => (
        <div
          key={i}
          className="rounded-fabric p-4 flex items-start gap-3"
          style={{ backgroundColor: insight.color }}
        >
          <span className="text-2xl flex-shrink-0">{insight.icon}</span>
          <div className="min-w-0">
            <h4
              className="text-sm font-medium mb-1"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              {insight.title}
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {insight.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
