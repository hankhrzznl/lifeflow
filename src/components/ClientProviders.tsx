"use client";

import { useEffect, useState } from "react";
import { AgentProvider } from "@/components/agent/AgentProvider";
import { GoalEngine } from "@/services/goal-engine";

function GoalEngineInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    GoalEngine.initialize().then((result) => {
      if (cancelled) return;
      if (!result.success) {
        console.warn("[GoalEngine] 初始化失败:", result.error);
      }
      setReady(true);
      // 延迟执行引擎退役迁移，不阻塞首屏
      setTimeout(async () => {
        if (cancelled) return;
        try {
          const { retireEngineGoals } = await import("@/lib/engineGoalsRetirement");
          const stats = await retireEngineGoals();
          if (stats && !stats.skipped) {
            console.log("[Retirement] 引擎退役迁移完成:", stats);
          }
        } catch (e) {
          console.warn("[Retirement] 退役迁移失败(已跳过):", e);
        }
      }, 500);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AgentProvider>
      <GoalEngineInitializer>{children}</GoalEngineInitializer>
    </AgentProvider>
  );
}
