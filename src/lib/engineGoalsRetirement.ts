// ============================================================
// 引擎 goals 表一次性退役迁移
//
// 将仅存在于引擎库的目标数据合并到主库 LifeFlowDB。
// 幂等、先备份、可重入。
//
// 注意：此模块只能在阶段 5（引擎定位落地）完成后存活。
// 引擎 goals 表物理保留但全应用停止读写。
// ============================================================

import { goalDB } from "@/services/goal-engine";
import { db } from "./db";
import { createGoal, createPlan, getGoal, getPlansByGoal, deleteGoal } from "./db";
import {
  toLocalDateStr, todayLocal, mainGoalKey,
  engineCategoryToGoalType, enginePriorityToMain, engineDeadlineToTs,
} from "./goalMapping";
import type { Goal as EngineGoal, Milestone, DailyAtom, GoalProgressSnapshot } from "@/types/goal";
import type { Task } from "./types";

const MIGRATION_KEY = "engine_goals_retired_v1";
const BACKUP_KEY = "lifeflow_engine_goals_backup_v1";

export interface RetirementStats {
  skipped?: boolean;
  mergedCount: number;
  newGoalsCount: number;
  milestonesBackfilled: number;
  atomsBackfilled: number;
  snapshotsBackfilled: number;
}

/**
 * 执行引擎 goals 一次性退役迁移
 *
 * - 幂等：migrationMarkers 已标记则跳过
 * - 备份：全量 goals 写入 localStorage
 * - 合并：逐引擎 goal 查重/新建主库 goal → plan → task → 回填 mainPlanId/mainTaskId
 */
export async function retireEngineGoals(): Promise<RetirementStats> {
  // 1. 检查迁移标记
  const marker = await db.migrationMarkers.where("key").equals(MIGRATION_KEY).first();
  if (marker) {
    console.info("[Retirement] 迁移已完成，跳过");
    return { skipped: true, mergedCount: 0, newGoalsCount: 0, milestonesBackfilled: 0, atomsBackfilled: 0, snapshotsBackfilled: 0 };
  }

  // 2. 备份引擎 goals
  const engineGoals = await goalDB.goals.toArray();
  if (engineGoals.length === 0) {
    // 无数据也要写标记，防止下次再检查
    await db.migrationMarkers.add({ key: MIGRATION_KEY, executedAt: Date.now() });
    console.info("[Retirement] 引擎无目标数据，标记完成");
    return { mergedCount: 0, newGoalsCount: 0, milestonesBackfilled: 0, atomsBackfilled: 0, snapshotsBackfilled: 0 };
  }

  try {
    const msCount = await goalDB.milestones.count();
    const wtCount = await goalDB.weeklyTasks.count();
    const atomCount = await goalDB.dailyAtoms.count();
    const snapCount = await goalDB.progressSnapshots.count();

    const backup = {
      timestamp: new Date().toISOString(),
      goals: engineGoals,
      counts: { milestones: msCount, weeklyTasks: wtCount, dailyAtoms: atomCount, progressSnapshots: snapCount },
    };
    const backupStr = JSON.stringify(backup);
    try {
      localStorage.setItem(BACKUP_KEY, backupStr);
      console.info(`[Retirement] 备份完成: ${backupStr.length} bytes, ${engineGoals.length} 个目标`);
    } catch {
      // localStorage 超容量则中止
      console.error("[Retirement] 备份写入 localStorage 失败（可能超容量），中止迁移");
      return { mergedCount: 0, newGoalsCount: 0, milestonesBackfilled: 0, atomsBackfilled: 0, snapshotsBackfilled: 0 };
    }
  } catch (err) {
    console.error("[Retirement] 备份阶段出错:", err);
    return { mergedCount: 0, newGoalsCount: 0, milestonesBackfilled: 0, atomsBackfilled: 0, snapshotsBackfilled: 0 };
  }

  // 3. 逐引擎 goal 合并到主库
  let mergedCount = 0;
  let newGoalsCount = 0;
  let milestonesBackfilled = 0;
  let atomsBackfilled = 0;
  let snapshotsBackfilled = 0;

  for (const eg of engineGoals) {
    try {
      // 3a. 查重：按规范化标题
      const normalizedTitle = eg.title.trim().toLowerCase();
      const existingGoals = await db.goals.toArray();
      let mainGoalId: number | null = existingGoals.find(
        (g) => g.name.trim().toLowerCase() === normalizedTitle
      )?.id ?? null;

      // 3b. 未找到 → 新建主库目标
      if (mainGoalId === null) {
        mainGoalId = await createGoal({
          name: eg.title,
          description: eg.description || "",
          type: engineCategoryToGoalType(eg.category),
          deadline: eg.deadline ? engineDeadlineToTs(eg.deadline) : undefined,
          priority: enginePriorityToMain(eg.priority),
          status: eg.status,
          progress: eg.progress || 0,
          progressLocked: false,
          weight: 1,
        });
        newGoalsCount++;
      }

      const engineGoalId = mainGoalKey(mainGoalId);

      // 3c. 里程碑 → Plan 回填
      const milestones = await goalDB.milestones.where("goalId").equals(eg.id).toArray();
      for (const ms of milestones) {
        if (ms.mainPlanId) continue; // 已回填的跳过

        // 查找或创建 Plan
        const existingPlans = await getPlansByGoal(mainGoalId);
        let plan = existingPlans.find((p) => p.name.trim().toLowerCase() === ms.title.trim().toLowerCase());
        if (!plan) {
          const planId = await createPlan({
            goalId: mainGoalId,
            name: ms.title,
            startDate: ms.startDate || todayLocal(),
            endDate: ms.deadline || undefined,
            weight: ms.weight || 1,
            status: ms.status === "completed" ? "completed"
              : ms.status === "overdue" ? "active"
              : ms.status === "active" ? "active"
              : "active",
            progress: ms.progress || 0,
            order: ms.sortOrder || 0,
          });
          plan = { id: planId, name: ms.title, startDate: ms.startDate || todayLocal() } as any;
        }

        // 回填 mainPlanId
        await goalDB.milestones.update(ms.id, {
          mainPlanId: plan!.id,
          goalId: engineGoalId,
        });
        milestonesBackfilled++;

        // 3d. 原子项 → Task 回填
        const wts = await goalDB.weeklyTasks.where("milestoneId").equals(ms.id).toArray();
        for (const wt of wts) {
          // 更新 weeklyTask 的 milestoneId 不需要改（milestone.id 不变）

          const atoms = await goalDB.dailyAtoms.where("weeklyTaskId").equals(wt.id).toArray();
          for (const atom of atoms) {
            if (atom.mainTaskId) continue; // 已回填的跳过

            // 查找或创建 Task
            const existingTasks = await db.tasks
              .where("goalId").equals(mainGoalId)
              .filter((t) => t.title?.trim().toLowerCase() === atom.title.trim().toLowerCase())
              .toArray();
            let task = existingTasks[0];
            if (!task) {
              const taskId = await db.tasks.add({
                title: atom.title,
                type: "daily",
                status: atom.isCompleted ? "done" : "active",
                goalId: mainGoalId,
                planId: plan!.id,
                priority: "not-urgent-not-important",
                startTime: new Date(atom.scheduledDate + "T00:00:00").getTime(),
                endTime: new Date(atom.scheduledDate + "T23:59:59").getTime(),
                createdAt: Date.parse(atom.createdAt) || Date.now(),
                updatedAt: Date.parse(atom.updatedAt) || Date.now(),
              });
              task = { id: taskId } as any;
            }

            // 回填 mainTaskId
            await goalDB.dailyAtoms.update(atom.id, {
              mainTaskId: task.id,
            });
            atomsBackfilled++;
          }
        }
      }

      // 3e. 快照 goalId 改写
      const snapshots = await goalDB.progressSnapshots.where("goalId").equals(eg.id).toArray();
      for (const snap of snapshots) {
        if (snap.goalId === engineGoalId) continue; // 已改写
        await goalDB.progressSnapshots.update(snap.id, { goalId: engineGoalId });
        snapshotsBackfilled++;
      }

      mergedCount++;
    } catch (err) {
      console.warn(`[Retirement] 迁移引擎目标 "${eg.title}" 失败:`, err);
      // 继续下一个，不中断整体流程
    }
  }

  // 4. 写入迁移标记
  await db.migrationMarkers.add({ key: MIGRATION_KEY, executedAt: Date.now() });

  console.info(
    `[Retirement] 迁移完成: 合并 ${mergedCount} 个目标, 新建 ${newGoalsCount} 个, ` +
    `回填 ${milestonesBackfilled} 里程碑 / ${atomsBackfilled} 原子项 / ${snapshotsBackfilled} 快照`
  );

  return {
    mergedCount,
    newGoalsCount,
    milestonesBackfilled,
    atomsBackfilled,
    snapshotsBackfilled,
  };
}
