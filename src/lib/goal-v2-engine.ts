/**
 * GoalV2 Engine — 进度计算 + 策略模板 + DailyAction ↔ Item 同步
 */
import { goalV2DB } from "@/lib/db/goal-v2.db";
import type {
  GoalV2, KeyResultV2, StrategyV2, WeeklyTaskV2, DailyActionV2,
} from "@/lib/db/goal-v2.db";
import { daylogDB, addItem, ensureModuleItem } from "@/lib/db/daylog.db";

// ============================================================
// 策略模板
// ============================================================

export interface StrategyTemplate {
  name: string;
  description: string;
  weeklyTaskTitle: string;
  weeklyTaskDeliverable: string;
  dailyActionTitle: string;
  dailyActionTime: string;
  dailyActionDuration: number;
}

export const STRATEGY_TEMPLATES: Record<string, StrategyTemplate[]> = {
  fitness: [
    {
      name: "饮食控制",
      description: "通过控制热量摄入和优化营养结构，创造每日 500kcal 缺口",
      weeklyTaskTitle: "学会看营养成分表，戒掉含糖饮料",
      weeklyTaskDeliverable: "记录 3 天饮食，识别所有隐形糖来源",
      dailyActionTitle: "早餐：两个鸡蛋 + 无糖豆浆 + 全麦面包",
      dailyActionTime: "08:00",
      dailyActionDuration: 20,
    },
    {
      name: "力量训练",
      description: "通过抗阻训练增加肌肉量，提高基础代谢",
      weeklyTaskTitle: "本周完成 3 次力量训练，掌握深蹲和俯卧撑标准动作",
      weeklyTaskDeliverable: "录下自己最标准的一组训练视频",
      dailyActionTitle: "力量训练：深蹲 3×12 次 + 俯卧撑 3×8 次",
      dailyActionTime: "18:30",
      dailyActionDuration: 45,
    },
    {
      name: "有氧燃脂",
      description: "通过中等强度有氧运动直接消耗脂肪",
      weeklyTaskTitle: "本周完成 3 次 30 分钟以上有氧运动",
      weeklyTaskDeliverable: "记录每次心率和完成时间",
      dailyActionTitle: "快走/慢跑 30 分钟",
      dailyActionTime: "07:00",
      dailyActionDuration: 30,
    },
  ],
  skill: [
    {
      name: "知识输入",
      description: "系统性地获取新知识，建立知识框架",
      weeklyTaskTitle: "本周完成指定章节的学习并做笔记",
      weeklyTaskDeliverable: "输出一份思维导图笔记",
      dailyActionTitle: "阅读指定章节 30 分钟并做笔记",
      dailyActionTime: "07:30",
      dailyActionDuration: 30,
    },
    {
      name: "刻意练习",
      description: "针对薄弱环节进行高强度重复训练",
      weeklyTaskTitle: "本周完成 5 次刻意练习，记录进步曲线",
      weeklyTaskDeliverable: "记录每次练习成绩，对比上周",
      dailyActionTitle: "刻意练习 20 分钟并记录数据",
      dailyActionTime: "20:00",
      dailyActionDuration: 20,
    },
    {
      name: "输出检验",
      description: "通过输出倒逼输入，检验学习效果",
      weeklyTaskTitle: "本周完成一篇总结文章或一次模拟测试",
      weeklyTaskDeliverable: "提交文章或测试结果",
      dailyActionTitle: "用学到的新概念解释一个实际问题",
      dailyActionTime: "21:00",
      dailyActionDuration: 15,
    },
  ],
  finance: [
    {
      name: "开源增收",
      description: "拓展收入渠道，提升个人变现能力",
      weeklyTaskTitle: "本周调研一个潜在增收渠道并制定计划",
      weeklyTaskDeliverable: "输出调研报告和行动清单",
      dailyActionTitle: "花 15 分钟研究一个增收方向",
      dailyActionTime: "12:00",
      dailyActionDuration: 15,
    },
    {
      name: "支出管理",
      description: "建立预算体系，控制非必要开支",
      weeklyTaskTitle: "本周建立月度预算框架，追踪每一笔支出",
      weeklyTaskDeliverable: "本周支出汇总表",
      dailyActionTitle: "记录当天全部支出并分类",
      dailyActionTime: "21:30",
      dailyActionDuration: 10,
    },
    {
      name: "投资理财",
      description: "学习和实践资产配置",
      weeklyTaskTitle: "本周完成一次投资组合复盘",
      weeklyTaskDeliverable: "更新持仓记录和收益统计",
      dailyActionTitle: "查看投资账户，记录当日变动",
      dailyActionTime: "09:00",
      dailyActionDuration: 10,
    },
  ],
  career: [
    {
      name: "专业深耕",
      description: "提升核心专业技能，建立专业壁垒",
      weeklyTaskTitle: "本周完成一个专业方向的深度学习",
      weeklyTaskDeliverable: "输出学习总结或实践成果",
      dailyActionTitle: "阅读专业文章并做笔记 25 分钟",
      dailyActionTime: "07:30",
      dailyActionDuration: 25,
    },
    {
      name: "跨部门协作",
      description: "提升协作效率，扩大影响力",
      weeklyTaskTitle: "本周主动和 2 个同事进行 1on1 交流",
      weeklyTaskDeliverable: "记录交流收获和后续行动",
      dailyActionTitle: "主动跟进一个协作任务进度",
      dailyActionTime: "10:00",
      dailyActionDuration: 15,
    },
    {
      name: "向上汇报",
      description: "提升表达能力和工作可见度",
      weeklyTaskTitle: "本周准备一份工作进展简报",
      weeklyTaskDeliverable: "完成汇报材料的初稿",
      dailyActionTitle: "花 10 分钟整理今天的工作成果",
      dailyActionTime: "17:30",
      dailyActionDuration: 10,
    },
  ],
};

// ============================================================
// 进度计算引擎
// ============================================================

/**
 * 计算单个目标的进度
 * Goal progress = KeyResult 进度的平均值
 */
export async function recalculateGoalProgress(goalId: string): Promise<void> {
  const goal = await goalV2DB.goalV2Goals.get(goalId);
  if (!goal) return;

  const keyResults = await goalV2DB.goalV2KeyResults.where('goalId').equals(goalId).toArray();

  if (keyResults.length === 0) {
    // 没有关键结果时，从 DailyAction 聚合
    const strategies = await goalV2DB.goalV2Strategies.where('goalId').equals(goalId).toArray();
    if (strategies.length === 0) {
      await goalV2DB.goalV2Goals.update(goalId, { progress: 0 });
      return;
    }
    let totalProgress = 0;
    for (const s of strategies) {
      totalProgress += await getStrategyProgressByDA(s.id);
    }
    const avgProgress = Math.round(totalProgress / strategies.length);
    await goalV2DB.goalV2Goals.update(goalId, { progress: avgProgress });
    return;
  }

  // 有关键结果：用关键结果计算
  let totalProgress = 0;
  for (const kr of keyResults) {
    if (kr.targetValue <= 0) continue;
    const krProgress = Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
    totalProgress += krProgress;
  }
  const avgProgress = Math.round(totalProgress / keyResults.length);
  await goalV2DB.goalV2Goals.update(goalId, { progress: avgProgress });
}

/**
 * 通过策略下的 DailyAction 计算策略进度
 */
async function getStrategyProgressByDA(strategyId: string): Promise<number> {
  const actions = await goalV2DB.goalV2DailyActions.where('strategyId').equals(strategyId).toArray();
  if (actions.length === 0) return 0;
  const completed = actions.filter(a => a.isCompleted).length;
  return Math.round((completed / actions.length) * 100);
}

// ============================================================
// DailyAction ↔ Item 同步
// ============================================================

/**
 * 在 DailyAction 完成/取消完成时同步写入/删除 Item
 */
export async function syncDailyActionToItem(action: DailyActionV2): Promise<void> {
  if (action.isCompleted && !action.itemId) {
    // 完成 → 创建 Item
    const itemId = await ensureModuleItem({
      date: action.date,
      sourceType: "habit",
      sourceId: action.id,
      title: action.title,
      plannedStart: action.time,
      plannedEnd: addMinutes(action.time, action.duration),
      color: "#6366F1",
      icon: "Target",
      isCompleted: true,
    });
    if (itemId) {
      await goalV2DB.goalV2DailyActions.update(action.id, { itemId });
    }
  } else if (!action.isCompleted && action.itemId) {
    // 取消完成 → 删除 Item
    await daylogDB.items.delete(action.itemId);
    await goalV2DB.goalV2DailyActions.update(action.id, { itemId: undefined });
  }
}

/**
 * 批量同步：当修改多个 DailyAction 后调用
 */
export async function syncAllDailyActionsByDate(date: string): Promise<void> {
  const actions = await goalV2DB.goalV2DailyActions.where('date').equals(date).toArray();
  for (const a of actions) {
    await syncDailyActionToItem(a);
  }
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// ============================================================
// 每周初始时间计算
// ============================================================

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // 减到周日
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
