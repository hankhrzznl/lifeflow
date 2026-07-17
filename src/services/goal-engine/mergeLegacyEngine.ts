/**
 * 一次性数据合并迁移：把旧库 LifeFlowEngine 的数据按业务键合并进幸存库 LifeFlowGoalEngine
 * 幂等 + 备份 + 去重
 */

import Dexie from "dexie";
import { goalDB } from "./schema";
import { hasMigrationMarker, setMigrationMarker } from "@/lib/migrationMarkers";

const MERGE_MARKER = "engine_merge_v1";

export interface MergeStats {
  goals: { new: number; skipped: number };
  milestones: { new: number; skipped: number };
  weeklyTasks: { new: number; skipped: number };
  dailyAtoms: { new: number; skipped: number };
  progressSnapshots: { new: number; skipped: number };
}

export async function mergeLegacyEngineDB(): Promise<MergeStats | null> {
  if (await hasMigrationMarker(MERGE_MARKER)) {
    await dropLegacyEngineDB();
    console.log("[Merge] 已合并过，跳过");
    return null;
  }

  let legacyDB: Dexie;
  try {
    legacyDB = new Dexie("LifeFlowEngine");
    legacyDB.version(1).stores({
      goals: "id,status,category,priority,deadline,healthStatus",
      milestones: "id,goalId,status",
      weeklyTasks: "id,milestoneId,weekNumber,year",
      dailyAtoms: "id,weeklyTaskId,scheduledDate,status",
      progressSnapshots: "id,goalId,[goalId+year+weekNumber]",
    });
    await legacyDB.open();
  } catch {
    await setMigrationMarker(MERGE_MARKER);
    await dropLegacyEngineDB();
    return null;
  }

  await backupLegacyDB(legacyDB);

  const db = goalDB as unknown as Record<string, Dexie.Table<Record<string, unknown>, string>>;

  const stats: MergeStats = {
    goals: { new: 0, skipped: 0 },
    milestones: { new: 0, skipped: 0 },
    weeklyTasks: { new: 0, skipped: 0 },
    dailyAtoms: { new: 0, skipped: 0 },
    progressSnapshots: { new: 0, skipped: 0 },
  };

  const idMap = new Map<string, string>();

  // goals
  const legacyGoals = (await legacyDB.table("goals").toArray()) as Record<string, unknown>[];
  for (const lg of legacyGoals) {
    const existing = await goalDB.goals
      .where("title").equals(lg.title as string)
      .and((g) => g.category === (lg.category as string))
      .first();
    if (existing) {
      idMap.set(lg.id as string, existing.id);
      stats.goals.skipped++;
    } else {
      await db.goals.put(lg);
      idMap.set(lg.id as string, lg.id as string);
      stats.goals.new++;
    }
  }

  // milestones
  const legacyMS = (await legacyDB.table("milestones").toArray()) as Record<string, unknown>[];
  for (const lm of legacyMS) {
    const mappedGoalId = idMap.get(lm.goalId as string) || (lm.goalId as string);
    const allMS = await goalDB.milestones.where("goalId").equals(mappedGoalId).toArray();
    const found = allMS.find((m) => m.title === (lm.title as string));
    if (found) {
      idMap.set(lm.id as string, found.id);
      stats.milestones.skipped++;
    } else {
      await db.milestones.put({ ...lm, goalId: mappedGoalId });
      idMap.set(lm.id as string, lm.id as string);
      stats.milestones.new++;
    }
  }

  // weeklyTasks
  const legacyWT = (await legacyDB.table("weeklyTasks").toArray()) as Record<string, unknown>[];
  for (const lw of legacyWT) {
    const mappedMSId = idMap.get(lw.milestoneId as string) || (lw.milestoneId as string);
    const all = await goalDB.weeklyTasks.where("milestoneId").equals(mappedMSId).toArray();
    const found = all.find((t) => t.weekNumber === (lw.weekNumber as number) && t.year === (lw.year as number));
    if (found) {
      idMap.set(lw.id as string, found.id);
      stats.weeklyTasks.skipped++;
    } else {
      await db.weeklyTasks.put({ ...lw, milestoneId: mappedMSId });
      idMap.set(lw.id as string, lw.id as string);
      stats.weeklyTasks.new++;
    }
  }

  // dailyAtoms
  const legacyDA = (await legacyDB.table("dailyAtoms").toArray()) as Record<string, unknown>[];
  for (const la of legacyDA) {
    const mappedWTId = idMap.get(la.weeklyTaskId as string) || (la.weeklyTaskId as string);
    const all = await goalDB.dailyAtoms.where("weeklyTaskId").equals(mappedWTId).toArray();
    const found = all.find((a) => a.scheduledDate === (la.scheduledDate as string) && a.title === (la.title as string));
    if (found) {
      idMap.set(la.id as string, found.id);
      stats.dailyAtoms.skipped++;
    } else {
      await db.dailyAtoms.put({ ...la, weeklyTaskId: mappedWTId });
      idMap.set(la.id as string, la.id as string);
      stats.dailyAtoms.new++;
    }
  }

  // progressSnapshots
  const legacyPS = (await legacyDB.table("progressSnapshots").toArray()) as Record<string, unknown>[];
  for (const lp of legacyPS) {
    const mappedGoalId = idMap.get(lp.goalId as string) || (lp.goalId as string);
    const newId = `snap_${mappedGoalId}_${lp.year as number}w${lp.weekNumber}`;
    const existing = await goalDB.progressSnapshots.get(newId);
    if (existing) {
      stats.progressSnapshots.skipped++;
    } else {
      const { type, ...rest } = lp as Record<string, unknown>;
      await db.progressSnapshots.put({
        ...rest, id: newId, goalId: mappedGoalId,
      });
      stats.progressSnapshots.new++;
    }
  }

  await setMigrationMarker(MERGE_MARKER);
  localStorage.removeItem("lifeflow_engine_migrated_v1");
  await dropLegacyEngineDB();

  console.log("[Merge] 完成:", stats);
  return stats;
}

async function backupLegacyDB(legacyDB: Dexie): Promise<void> {
  try {
    const tables = ["goals", "milestones", "weeklyTasks", "dailyAtoms", "progressSnapshots"];
    const data: Record<string, unknown[]> = {};
    for (const t of tables) data[t] = await legacyDB.table(t).toArray();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeflow-engine-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("[Merge] 备份已下载");
  } catch (e) {
    console.warn("[Merge] 备份下载失败:", e);
  }
}

export async function dropLegacyEngineDB(): Promise<void> {
  if (await hasMigrationMarker(MERGE_MARKER)) {
    try {
      indexedDB.deleteDatabase("LifeFlowEngine");
      console.log("[Merge] 旧库已删除");
    } catch { /* ok */ }
  }
}

