/**
 * InsightBrain — 关联性分析引擎
 * 发现习惯与结果之间的相关性
 */

export interface AnalysisInput {
  /** 每日睡眠时长记录 */
  sleepRecords?: { date: string; duration: number }[];
  /** 每日饮水记录 */
  waterRecords?: { date: string; totalMl: number }[];
  /** 每日情绪评分 */
  moodRecords?: { date: string; score: number }[];
  /** 运动记录 */
  workoutRecords?: { date: string; duration: number; calories: number }[];
  /** 任务完成记录 */
  taskCompletions?: { date: string; count: number }[];
}

export interface Correlation {
  factorX: string;
  factorY: string;
  coefficient: number; // -1 ~ 1
  strength: "weak" | "moderate" | "strong";
  description: string;
}

export interface InsightResult {
  correlations: Correlation[];
  keyFinding: string;
}

export class InsightBrain {
  /**
   * 分析多维数据，找出行为与结果之间的相关性
   */
  analyze(data: AnalysisInput): InsightResult {
    // TODO: 实际逻辑 — 皮尔逊相关系数 / 多元线性回归
    // 1. 对齐各数据源到同一日期轴
    // 2. 计算两两之间的相关系数
    // 3. 筛选 |r| > 0.3 的显著相关
    // 4. 生成自然语言洞察
    return {
      correlations: [],
      keyFinding: "",
    };
  }
}
