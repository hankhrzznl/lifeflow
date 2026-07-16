"use client";

import { useEffect, useState } from "react";
import { AgentProvider } from "@/components/agent/AgentProvider";
import { GoalEngine } from "@/services/goal-engine";

function GoalEngineInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    GoalEngine.initialize().then((result) => {
      if (!result.success) {
        console.warn("[GoalEngine] 初始化失败:", result.error);
      }
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

// ============================================================
// 引擎数据迁移（非阻塞，失败不阻塞应用启动）
// ============================================================

function EngineMigrationRunner({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // 动态导入，避免阻塞初始渲染
        const { needMigration, runMigration } = await import(
          "@/lib/engine/migrate"
        );

        const check = await needMigration();
        if (!check.needed) {
          console.log(`[Engine Migration] 跳过: ${check.reason}`);
          return;
        }

        console.log(
          `[Engine Migration] 检测到待迁移数据: ${check.mainGoalsCount} goals, ${check.mainPlansCount} plans, ${check.mainTasksCount} tasks`
        );

        if (cancelled) return;

        const result = await runMigration();
        if (result.success) {
          const s = result.stats!;
          console.log(
            `[Engine Migration] 迁移成功: ${s.goals} goals → ${s.milestones} milestones → ${s.weeklyTasks} weeklyTasks → ${s.dailyAtoms} atoms`
          );
        } else {
          console.warn("[Engine Migration] 迁移失败:", result.error);
        }
      } catch (err) {
        console.warn("[Engine Migration] 迁移异常（已跳过）:", err);
      }
    };

    // 延迟 500ms 执行，让 UI 先渲染
    const timer = setTimeout(run, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return <>{children}</>;
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AgentProvider>
      <GoalEngineInitializer>
        <EngineMigrationRunner>{children}</EngineMigrationRunner>
      </GoalEngineInitializer>
    </AgentProvider>
  );
}
