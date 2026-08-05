import { efficiencyDB } from "@/lib/db/efficiency.db";
import {
  goalV2DB,
  deleteGoalV2,
  type GoalV2,
  type StrategyV2,
  type WeeklyTaskV2,
  type DailyActionV2,
} from "@/lib/db/goal-v2.db";
import type { Goal } from "@/lib/db/efficiency.db";

// ============================================================
// efficiency v1 → GoalV2 目标数据一键迁移（T9）
// 原则：
//  1. v1 数据永不删除 —— 迁移只做"复制"
//  2. 全程可重入 —— 已迁移的 v1 目标自动跳过，不会产生重复
//  3. 可回滚 —— 回滚仅删除本次迁移创建的 v2 目标，v1 原数据完好
//  4. 备份 —— v1 完整快照存于本地（localStorage 注册表 + 可下载 JSON）
// ============================================================

const REGISTRY_KEY = "lifeflow_migration_v1v2_goals";

interface MigrationRegistry {
  version: 1;
  migratedAt: number;
  backup: Goal[];                   // v1 完整快照（原始数据，不丢）
  mapping: Record<string, string>;  // v1Id → v2Id
}

function loadRegistry(): MigrationRegistry | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as MigrationRegistry) : null;
  } catch {
    return null;
  }
}

function saveRegistry(reg: MigrationRegistry): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
}

// ─── 状态查询 ────────────────────────────────────────────────

export interface V1GoalMigrationStatus {
  v1Count: number;        // v1 目标总数
  v2Count: number;        // v2 目标总数
  migratedCount: number;  // 已迁移的 v1 目标数
  pendingCount: number;   // 待迁移数
  hasBackup: boolean;     // 是否已生成备份
  backupBytes: number;    // 备份大小（字节）
}

export async function getV1GoalMigrationStatus(): Promise<V1GoalMigrationStatus> {
  const v1Goals = await efficiencyDB.goals.toArray();
  const v2Count = await goalV2DB.goalV2Goals.count();
  const reg = loadRegistry();
  const migratedCount = reg ? Object.keys(reg.mapping).length : 0;
  return {
    v1Count: v1Goals.length,
    v2Count,
    migratedCount,
    pendingCount: Math.max(0, v1Goals.length - migratedCount),
    hasBackup: !!reg,
    backupBytes: reg ? JSON.stringify(reg.backup).length : 0,
  };
}

// ─── 执行迁移（可重入） ──────────────────────────────────────

export async function runV1GoalMigration(): Promise<{ migrated: number; skipped: number }> {
  const v1Goals = await efficiencyDB.goals.toArray();
  let reg = loadRegistry();
  if (!reg) {
    // 首次迁移：建立 v1 完整快照备份
    reg = { version: 1, migratedAt: Date.now(), backup: v1Goals, mapping: {} };
  }
  let migrated = 0;
  let skipped = 0;
  for (const g of v1Goals) {
    if (reg.mapping[g.id]) {
      skipped++;
      continue;
    }
    const v2Id = await migrateGoal(g);
    reg.mapping[g.id] = v2Id;
    migrated++;
  }
  reg.migratedAt = Date.now();
  saveRegistry(reg);
  return { migrated, skipped };
}

// ─── 回滚（仅删除迁移创建的 v2 目标，v1 数据保留） ─────────────

export async function rollbackV1GoalMigration(): Promise<{ rolledBack: number }> {
  const reg = loadRegistry();
  if (!reg) return { rolledBack: 0 };
  const v2Ids = Object.values(reg.mapping);
  for (const v2Id of v2Ids) {
    await deleteGoalV2(v2Id).catch(() => {});
  }
  localStorage.removeItem(REGISTRY_KEY);
  return { rolledBack: v2Ids.length };
}

// ─── 下载 v1 备份 ────────────────────────────────────────────

export function exportV1GoalBackup(): boolean {
  const reg = loadRegistry();
  if (!reg || reg.backup.length === 0) return false;
  const blob = new Blob([JSON.stringify(reg.backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifeflow-v1-目标备份-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

// ─── 字段映射 ────────────────────────────────────────────────

function mapStatus(s: Goal["status"]): GoalV2["status"] {
  // v2 无 archived，归档目标降级为 paused（数据仍在备份中完整保留）
  if (s === "archived") return "paused";
  return s;
}

function buildVision(g: Goal): string {
  const lines: string[] = [];
  if (g.note) lines.push(g.note);
  if (g.deadline) lines.push(`截止：${g.deadline}`);
  // 注意：应用启动清理会把 goalType 统一改写为 'task'，因此习惯打卡数据以
  // daysLog 为准判断，而不是 goalType。
  const days = g.daysLog ? Object.keys(g.daysLog).filter((d) => g.daysLog?.[d]).length : 0;
  if (days > 0) {
    lines.push(`习惯目标 · 已打卡 ${days} 天`);
  }
  return lines.join("\n");
}

/** 周日为一周开始（与 WeeklyTaskV2.weekStart 约定一致） */
function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function migrateGoal(g: Goal): Promise<string> {
  const v2Id = crypto.randomUUID();
  // 1. 目标本体
  await goalV2DB.goalV2Goals.add({
    id: v2Id,
    title: g.title,
    vision: buildVision(g),
    color: g.color || "#5865F2",
    status: mapStatus(g.status),
    progress: Math.min(100, Math.max(0, g.progress || 0)),
    createdAt: g.createdAt || Date.now(),
  } satisfies GoalV2);

  // 2. 习惯打卡记录 → v2 日行动（策略 → 周任务 → 日行动）
  // 以 daysLog 有无打卡为准（goalType 可能已被启动清理改写为 'task'）
  if (g.daysLog && Object.keys(g.daysLog).some((d) => g.daysLog?.[d])) {
    await migrateHabitDays(v2Id, g);
  }
  return v2Id;
}

async function migrateHabitDays(v2GoalId: string, g: Goal): Promise<void> {
  const dates = Object.keys(g.daysLog || {})
    .filter((d) => g.daysLog?.[d])
    .sort();
  if (dates.length === 0) return;

  const strategyId = crypto.randomUUID();
  await goalV2DB.goalV2Strategies.add({
    id: strategyId,
    goalId: v2GoalId,
    name: "习惯打卡",
    description: "由 v1 习惯打卡记录自动迁移",
    sortOrder: 0,
    cycleType: "daily",
  } satisfies StrategyV2);

  // 按周分组
  const weeks = new Map<string, string[]>();
  for (const d of dates) {
    const ws = weekStartOf(d);
    const list = weeks.get(ws) ?? [];
    list.push(d);
    weeks.set(ws, list);
  }

  let wtIndex = 0;
  for (const [ws, days] of weeks) {
    const weeklyTaskId = crypto.randomUUID();
    await goalV2DB.goalV2WeeklyTasks.add({
      id: weeklyTaskId,
      strategyId,
      goalId: v2GoalId,
      title: `打卡周 ${ws}`,
      weekStart: ws,
      deliverable: "",
      isCompleted: false,
      sortOrder: wtIndex++,
    } satisfies WeeklyTaskV2);

    let daIndex = 0;
    for (const d of days) {
      await goalV2DB.goalV2DailyActions.add({
        id: crypto.randomUUID(),
        weeklyTaskId,
        strategyId,
        goalId: v2GoalId,
        date: d,
        title: `打卡 ${g.title}`,
        time: "",
        duration: 0,
        isCompleted: true,
        sortOrder: daIndex++,
      } satisfies DailyActionV2);
    }
  }
}
