import { db } from "./db";
import type { CustomGoalType, Goal } from "./types";

// ==================== 自定义目标类型管理 ====================

/**
 * 获取所有启用的目标类型（内置+自定义）
 */
export async function getEnabledGoalTypes(): Promise<CustomGoalType[]> {
  return db.customGoalTypes.where("enabled").equals(true as any).toArray();
}

/**
 * 获取所有目标类型
 */
export async function getAllGoalTypes(): Promise<CustomGoalType[]> {
  return db.customGoalTypes.toArray();
}

/**
 * 创建自定义目标类型
 */
export async function createCustomGoalType(
  data: Omit<CustomGoalType, "id" | "createdAt" | "updatedAt" | "isBuiltIn" | "enabled">
): Promise<number> {
  const existing = await db.customGoalTypes.where("key").equals(data.key).first();
  if (existing) throw new Error("类型标识已存在");

  return db.customGoalTypes.add({
    ...data,
    isBuiltIn: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * 更新目标类型
 */
export async function updateCustomGoalType(
  id: number,
  updates: Partial<CustomGoalType>
): Promise<void> {
  await db.customGoalTypes.update(id, { ...updates, updatedAt: Date.now() });
}

/**
 * 删除自定义目标类型（内置不可删）
 */
export async function deleteCustomGoalType(id: number): Promise<void> {
  const ct = await db.customGoalTypes.get(id);
  if (!ct) return;
  if (ct.isBuiltIn) throw new Error("内置类型不可删除");

  // 将关联目标改为 task 类型
  const goals = await db.goals.where("customTypeId").equals(id).toArray();
  for (const g of goals) {
    await db.goals.update(g.id!, { customTypeId: undefined, type: "task" });
  }

  await db.customGoalTypes.delete(id);
}

/**
 * 根据 customTypeId 计算目标进度
 */
export async function calculateCustomGoalProgress(goal: Goal): Promise<number> {
  if (!goal.customTypeId) return 0;

  const ct = await db.customGoalTypes.get(goal.customTypeId);
  if (!ct) return 0;

  const targetValue = goal.targetValue || 0;
  if (targetValue <= 0) return 0;

  const startTime = goal.createdAt || (goal.deadline || Date.now()) - 30 * 24 * 60 * 60 * 1000;
  const endTime = goal.deadline || Date.now();

  switch (ct.calcMode) {
    case "cumulative": {
      // 正向累计型：实际完成/目标值
      let actual = 0;
      if (ct.dataSource === "task") {
        const tasks = await db.tasks
          .where("goalId").equals(goal.id!)
          .filter(t => t.status === "done" && t.updatedAt >= startTime && t.updatedAt <= endTime)
          .count();
        actual = tasks;
      }
      return Math.min(100, Math.round((actual / targetValue) * 100));
    }
    case "daily_avg": {
      // 日均型
      if (ct.dataSource === "task") {
        const doneTasks = await db.tasks
          .where("goalId").equals(goal.id!)
          .filter(t => t.status === "done")
          .count();
        const days = Math.max(1, Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)));
        const avgDaily = doneTasks / days;
        return Math.min(100, Math.round((avgDaily / targetValue) * 100));
      }
      return 0;
    }
    case "check_rate": {
      // 达标率型
      const tasks = await db.tasks
        .where("goalId").equals(goal.id!)
        .toArray();
      const total = tasks.length;
      if (total === 0) return 0;
      const done = tasks.filter(t => t.status === "done").length;
      return Math.min(100, Math.round((done / total) * 100));
    }
    default:
      return 0;
  }
}

/**
 * 注册插件提供的自定义类型
 */
export async function registerPluginGoalType(
  pluginName: string,
  definition: {
    key: string; name: string; icon: string; color: string;
    dataSource: CustomGoalType["dataSource"];
    unit: string; calcMode: CustomGoalType["calcMode"];
  }
): Promise<number> {
  const existing = await db.customGoalTypes.where("key").equals(definition.key).first();
  if (existing) return existing.id!;

  return db.customGoalTypes.add({
    ...definition,
    isBuiltIn: false,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
