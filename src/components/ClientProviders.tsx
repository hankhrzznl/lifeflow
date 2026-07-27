"use client";

import { useEffect, useState } from "react";
import { AgentProvider } from "@/components/agent/AgentProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { GoalEngine } from "@/services/goal-engine";
import { requestPermission as requestNotificationPermission } from "@/lib/notificationService";

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

      // 请求浏览器通知权限
      requestNotificationPermission().then(granted => {
        if (granted) console.log("[Notification] 通知权限已获取");
      }).catch(() => {});
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

      // PWA 兜底：确保各 DB 种子数据存在（尤其是 PWA 独立存储分区场景）
      setTimeout(async () => {
        if (cancelled) return;
        try {
          const [{ initializeEfficiencyDB }, { initializeAccountingDB }, { initializeHealthDB }, { initializeLifeDB }]
            = await Promise.all([
              import("@/lib/db/efficiency.db"),
              import("@/lib/db/accounting.db"),
              import("@/lib/db/health.db"),
              import("@/lib/db/life.db"),
            ]);
          await Promise.allSettled([
            initializeEfficiencyDB(),
            initializeAccountingDB(),
            initializeHealthDB(),
            initializeLifeDB(),
          ]);
        } catch (e) {
          console.warn("[DB] 初始化兜底失败:", e);
        }
      }, 300);
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
    <ThemeProvider>
      <AgentProvider>
        <GoalEngineInitializer>{children}</GoalEngineInitializer>
      </AgentProvider>
    </ThemeProvider>
  );
}
