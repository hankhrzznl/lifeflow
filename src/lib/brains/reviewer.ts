/**
 * ReviewerBrain — 周期复盘引擎
 * 跨模块聚合数据，生成日/周/月/年复盘摘要
 */

export interface DateRange {
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD
}

export interface ReviewHighlight {
  module: string;
  label: string;
  value: string;
  trend: "up" | "down" | "stable";
  detail?: string;
}

export interface ReviewModuleSummary {
  module: string;
  icon: string;
  label: string;
  stats: Record<string, string | number>;
  highlights: ReviewHighlight[];
}

export interface ReviewResult {
  period: "daily" | "weekly" | "monthly" | "yearly";
  dateRange: DateRange;
  summaries: ReviewModuleSummary[];
  overviewText: string;
}

export type ReviewPeriod = "daily" | "weekly" | "monthly" | "yearly";

// ============================================================
// 日期工具
// ============================================================

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(period: ReviewPeriod, offset: number = 0): DateRange {
  const now = new Date();
  switch (period) {
    case "daily": {
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      const ds = fmtDate(d);
      return { start: ds, end: ds };
    }
    case "weekly": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // 周一 as start
      const mon = new Date(now);
      mon.setDate(mon.getDate() - diff - offset * 7);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      return { start: fmtDate(mon), end: fmtDate(sun) };
    }
    case "monthly": {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
      return { start: fmtDate(d), end: fmtDate(end) };
    }
    case "yearly": {
      const year = now.getFullYear() - offset;
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
  }
}

function daysInRange(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

// ============================================================
// ReviewerBrain
// ============================================================

export class ReviewerBrain {
  /**
   * 生成指定周期的复盘数据
   * @param period 日/周/月/年
   * @param offset 偏移量，0=当前周期，1=上一周期，依此类推
   */
  async generateReview(period: ReviewPeriod = "weekly", offset: number = 0): Promise<ReviewResult> {
    const dateRange = getDateRange(period, offset);
    const summaries = await this.generateSummaries(dateRange);
    const overviewText = this.buildOverview(summaries, period);
    return { period, dateRange, summaries, overviewText };
  }

  /**
   * 获取多个历史周期的复盘数据
   */
  async getHistoricalReviews(period: ReviewPeriod, count: number = 4): Promise<ReviewResult[]> {
    const results: ReviewResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.generateReview(period, i));
    }
    return results;
  }

  private async generateSummaries(range: DateRange): Promise<ReviewModuleSummary[]> {
    return Promise.all([
      this.reviewGoals(range),
      this.reviewFinance(range),
      this.reviewWater(range),
      this.reviewSleep(range),
      this.reviewFitness(range),
      this.reviewDiet(range),
      this.reviewWellness(range),
      this.reviewPosture(range),
      this.reviewSchedule(range),
      this.reviewMedication(range),
    ]);
  }

  // ── 目标 ──────────────────────────────────────────────────

  async reviewGoals(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      // GoalV2 数据
      const { goalV2DB } = await import("@/lib/db/goal-v2.db");
      const goals = await goalV2DB.goalV2Goals.toArray();
      const activeGoals = goals.filter(g => g.status === "active" || !g.status);

      // 获取本周的日行动完成率
      const dailyActions = await goalV2DB.goalV2DailyActions
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();
      const totalDA = dailyActions.length;
      const completedDA = dailyActions.filter(a => a.isCompleted).length;
      const daRate = totalDA > 0 ? Math.round((completedDA / totalDA) * 100) : 0;

      // 关键结果进展
      const allKRs = await goalV2DB.goalV2KeyResults.toArray();
      let krProgress = 0;
      let krCount = 0;
      for (const kr of allKRs) {
        if (kr.targetValue > 0) {
          krProgress += Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
          krCount++;
        }
      }
      const avgKrProgress = krCount > 0 ? Math.round(krProgress / krCount) : 0;

      const highlights: ReviewHighlight[] = [];
      highlights.push({
        module: "goals",
        label: "日行动完成率",
        value: `${daRate}%`,
        trend: daRate >= 80 ? "up" : daRate >= 50 ? "stable" : "down",
      });
      if (avgKrProgress > 0) {
        highlights.push({
          module: "goals",
          label: "关键结果平均进度",
          value: `${avgKrProgress}%`,
          trend: avgKrProgress >= 50 ? "up" : avgKrProgress >= 25 ? "stable" : "down",
        });
      }

      return {
        module: "goals",
        icon: "Target",
        label: "目标",
        stats: {
          "进行中目标": activeGoals.length,
          "日行动完成": `${completedDA}/${totalDA}`,
          "完成率": `${daRate}%`,
          "关键结果进度": avgKrProgress > 0 ? `${avgKrProgress}%` : "暂无",
        },
        highlights,
      };
    } catch {
      return { module: "goals", icon: "Target", label: "目标", stats: {}, highlights: [] };
    }
  }

  // ── 记账 ──────────────────────────────────────────────────

  async reviewFinance(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { accountingDB } = await import("@/lib/db/accounting.db");
      const txns = await accountingDB.transactions
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const income = txns.filter((t: any) => t.type === "income")
        .reduce((s: number, t: any) => s + t.amount, 0);
      const expense = txns.filter((t: any) => t.type === "expense")
        .reduce((s: number, t: any) => s + t.amount, 0);

      const catMap: Record<string, number> = {};
      for (const t of txns) {
        if (t.type !== "expense" || !t.categoryId) continue;
        const cat = await accountingDB.categories.get(t.categoryId);
        const name = (cat as any)?.name || "其他";
        catMap[name] = (catMap[name] || 0) + t.amount;
      }
      const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

      const highlights: ReviewHighlight[] = [];
      if (txns.length > 0 && topCat) {
        highlights.push({
          module: "finance",
          label: "最大支出类别",
          value: topCat[0],
          trend: "stable",
          detail: `¥${topCat[1].toFixed(0)}`,
        });
      }

      return {
        module: "finance",
        icon: "Wallet",
        label: "记账",
        stats: {
          "收入": `¥${income.toFixed(0)}`,
          "支出": `¥${expense.toFixed(0)}`,
          "结余": `¥${(income - expense).toFixed(0)}`,
          "交易笔数": txns.length,
        },
        highlights,
      };
    } catch {
      return { module: "finance", icon: "Wallet", label: "记账", stats: {}, highlights: [] };
    }
  }

  // ── 饮水 ──────────────────────────────────────────────────

  async reviewWater(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { daylogDB } = await import("@/lib/db/daylog.db");
      const items = await daylogDB.items
        .where("date")
        .between(range.start, range.end, true, true)
        .filter((i: any) => i.sourceType === "water")
        .toArray();

      const days = daysInRange(range.start, range.end);
      const totalCups = items.length;
      const completedCups = items.filter((i: any) => i.isCompleted).length;
      const avgCups = days > 0 ? (totalCups / days).toFixed(1) : "0";
      const rate = totalCups > 0 ? Math.round((completedCups / totalCups) * 100) : 0;

      // 按日期统计达标天数（按 13 杯目标简单估算）
      const byDate: Record<string, number> = {};
      for (const item of items) {
        byDate[item.date] = (byDate[item.date] || 0) + 1;
      }
      const target = 13;
      const okDays = Object.values(byDate).filter(c => c >= target).length;

      const highlights: ReviewHighlight[] = [{
        module: "water",
        label: "饮水完成率",
        value: `${rate}%`,
        trend: rate >= 80 ? "up" : rate >= 50 ? "stable" : "down",
      }];

      return {
        module: "water",
        icon: "Droplets",
        label: "饮水",
        stats: {
          "总杯数": totalCups,
          "完成杯数": completedCups,
          "完成率": `${rate}%`,
          "日均杯数": avgCups,
          "达标天数": `${okDays}/${days}`,
        },
        highlights,
      };
    } catch {
      return { module: "water", icon: "Droplets", label: "饮水", stats: {}, highlights: [] };
    }
  }

  // ── 睡眠 ──────────────────────────────────────────────────

  async reviewSleep(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const logs = await healthDB.sleepLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const days = daysInRange(range.start, range.end);
      const onTime = logs.filter((l: any) => l.isOnTime).length;
      const rate = logs.length > 0 ? Math.round((onTime / logs.length) * 100) : 0;

      const times = logs.map((l: any) => l.actualTime).filter(Boolean).sort();
      const medianTime = times.length > 0 ? times[Math.floor(times.length / 2)] : "--";

      return {
        module: "sleep",
        icon: "Moon",
        label: "睡眠",
        stats: {
          "记录天数": `${logs.length}/${days}`,
          "达标次数": onTime,
          "达标率": `${rate}%`,
          "中位入睡": medianTime,
        },
        highlights: [{
          module: "sleep",
          label: "早睡达标率",
          value: `${rate}%`,
          trend: rate >= 80 ? "up" : rate >= 50 ? "stable" : "down",
        }],
      };
    } catch {
      return { module: "sleep", icon: "Moon", label: "睡眠", stats: {}, highlights: [] };
    }
  }

  // ── 训练 ──────────────────────────────────────────────────

  async reviewFitness(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const sessions = await healthDB.workoutSessions
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const days = daysInRange(range.start, range.end);
      const sessionDays = new Set(sessions.map((s: any) => s.date)).size;
      const totalSessions = sessions.length;
      const avgRpe = sessions.length > 0
        ? Math.round(sessions.reduce((s: number, x: any) => s + (x.rpe || 0), 0) / sessions.length)
        : 0;

      return {
        module: "fitness",
        icon: "Dumbbell",
        label: "训练",
        stats: {
          "训练天数": `${sessionDays}/${days}`,
          "训练次数": totalSessions,
          "平均 RPE": avgRpe > 0 ? `${avgRpe}` : "暂无",
          "最多连续": "--",
        },
        highlights: totalSessions > 0 ? [{
          module: "fitness",
          label: "训练天数",
          value: `${sessionDays} 天`,
          trend: sessionDays >= Math.ceil(days / 2) ? "up" : "stable",
        }] : [],
      };
    } catch {
      return { module: "fitness", icon: "Dumbbell", label: "训练", stats: {}, highlights: [] };
    }
  }

  // ── 饮食 ──────────────────────────────────────────────────

  async reviewDiet(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const logs = await lifeDB.dietLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const days = daysInRange(range.start, range.end);
      const logDays = new Set(logs.map(l => l.date)).size;
      const totalMeals = logs.length;

      return {
        module: "diet",
        icon: "Utensils",
        label: "饮食",
        stats: {
          "记录天数": `${logDays}/${days}`,
          "总餐数": totalMeals,
          "日均餐数": days > 0 ? (totalMeals / days).toFixed(1) : "0",
        },
        highlights: logDays > 0 ? [{
          module: "diet",
          label: "记录天数",
          value: `${logDays} 天`,
          trend: logDays >= Math.ceil(days * 0.7) ? "up" : "stable",
        }] : [],
      };
    } catch {
      return { module: "diet", icon: "Utensils", label: "饮食", stats: {}, highlights: [] };
    }
  }

  // ── 养生 ──────────────────────────────────────────────────

  async reviewWellness(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const logs = await lifeDB.wellnessLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const days = daysInRange(range.start, range.end);
      const logDays = new Set(logs.map(l => l.date)).size;
      const gongfaCount = logs.filter(l => l.type === "gongfa").length;
      const tigangCount = logs.filter(l => l.type === "tigang").length;

      return {
        module: "wellness",
        icon: "Heart",
        label: "养生",
        stats: {
          "记录天数": `${logDays}/${days}`,
          "功法": gongfaCount,
          "提肛": tigangCount,
          "总练习": logs.length,
        },
        highlights: logDays > 0 ? [{
          module: "wellness",
          label: "养生天数",
          value: `${logDays} 天`,
          trend: "stable",
        }] : [],
      };
    } catch {
      return { module: "wellness", icon: "Heart", label: "养生", stats: {}, highlights: [] };
    }
  }

  // ── 体态拉伸 ──────────────────────────────────────────────

  async reviewPosture(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const logs = await healthDB.stretchLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const days = daysInRange(range.start, range.end);
      const stretchDays = new Set(logs.map(l => l.date)).size;
      const totalSets = logs.reduce((s: number, l: any) => s + (l.sets || 0), 0);
      const totalReps = logs.reduce((s: number, l: any) => s + (l.reps || 0), 0);

      return {
        module: "posture",
        icon: "StretchHorizontal",
        label: "体态拉伸",
        stats: {
          "拉伸天数": `${stretchDays}/${days}`,
          "总组数": totalSets,
          "总次数": totalReps,
        },
        highlights: stretchDays > 0 ? [{
          module: "posture",
          label: "拉伸天数",
          value: `${stretchDays} 天`,
          trend: stretchDays >= Math.ceil(days / 2) ? "up" : "stable",
        }] : [],
      };
    } catch {
      return { module: "posture", icon: "StretchHorizontal", label: "体态拉伸", stats: {}, highlights: [] };
    }
  }

  // ── 日程 ──────────────────────────────────────────────────

  async reviewSchedule(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { daylogDB } = await import("@/lib/db/daylog.db");
      const items = await daylogDB.items
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const totalCount = items.length;
      const completedCount = items.filter((i: any) => i.isCompleted).length;
      const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      const calibratedCount = items.filter((i: any) => i.isCorrected).length;
      const calibrationRate = totalCount > 0 ? Math.round((calibratedCount / totalCount) * 100) : 0;
      const uncompletedCount = totalCount - completedCount;

      const bySource: Record<string, number> = {};
      for (const item of items) {
        const st = (item as any).sourceType || "unknown";
        bySource[st] = (bySource[st] || 0) + 1;
      }

      const byDate: Record<string, number> = {};
      for (const item of items) {
        if (!item.isCompleted) {
          byDate[item.date] = (byDate[item.date] || 0) + 1;
        }
      }
      let worstDay = "";
      let worstCount = 0;
      for (const [date, count] of Object.entries(byDate)) {
        if (count > worstCount) {
          worstDay = date;
          worstCount = count;
        }
      }

      const highlights: ReviewHighlight[] = [];
      highlights.push({
        module: "schedule",
        label: "完成率",
        value: `${completionRate}%`,
        trend: completionRate >= 80 ? "up" : completionRate >= 50 ? "stable" : "down",
      });
      highlights.push({
        module: "schedule",
        label: "校准率",
        value: `${calibrationRate}%`,
        trend: calibrationRate >= 60 ? "up" : calibrationRate >= 30 ? "stable" : "down",
      });
      if (worstDay) {
        highlights.push({
          module: "schedule",
          label: "最多未完成的一天",
          value: worstDay,
          trend: "down",
          detail: `${worstCount} 项未完成`,
        });
      }

      const stats: Record<string, string | number> = {
        "总事项数": totalCount,
        "已完成": completedCount,
        "完成率": `${completionRate}%`,
        "已校准": calibratedCount,
        "校准率": `${calibrationRate}%`,
        "未完成": uncompletedCount,
      };
      for (const [st, cnt] of Object.entries(bySource)) {
        const labelMap: Record<string, string> = {
          routine: "作息",
          course: "课程",
          manual: "手动",
          habit: "习惯",
          task: "任务",
        };
        stats[`${labelMap[st] || st}`] = cnt;
      }

      return {
        module: "schedule",
        icon: "Calendar",
        label: "日程复盘",
        stats,
        highlights,
      };
    } catch {
      return { module: "schedule", icon: "Calendar", label: "日程复盘", stats: {}, highlights: [] };
    }
  }

  // ── 用药 ──────────────────────────────────────────────────

  async reviewMedication(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const logs = await healthDB.medicineLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();
      const medicines = await healthDB.medicines.toArray();
      const activeMeds = medicines.filter((m: any) => m.active);

      const totalCount = logs.length;
      const takenCount = logs.filter((l: any) => l.taken).length;
      const complianceRate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

      const highlights: ReviewHighlight[] = [{
        module: "medication",
        label: "服药依从率",
        value: `${complianceRate}%`,
        trend: complianceRate >= 90 ? "up" : complianceRate >= 70 ? "stable" : "down",
      }];

      return {
        module: "medication",
        icon: "Pill",
        label: "用药",
        stats: {
          "应吃次数": totalCount,
          "已吃次数": takenCount,
          "依从率": `${complianceRate}%`,
          "有效药品数": activeMeds.length,
        },
        highlights,
      };
    } catch {
      return { module: "medication", icon: "Pill", label: "用药", stats: {}, highlights: [] };
    }
  }

  // ── 概览文案 ──────────────────────────────────────────────

  private buildOverview(summaries: ReviewModuleSummary[], period: string): string {
    const periodLabel =
      period === "daily" ? "昨日" :
      period === "weekly" ? "本周" :
      period === "monthly" ? "本月" : "今年";
    const parts: string[] = [];

    for (const s of summaries) {
      if (!s.stats || Object.keys(s.stats).length === 0) continue;
      switch (s.module) {
        case "goals":
          parts.push(`${s.stats["进行中目标"] || 0} 个目标, 日行动完成率 ${s.stats["完成率"] || "0%"}`);
          break;
        case "finance":
          parts.push(`支出 ${s.stats["支出"] || 0}`);
          break;
        case "water":
          parts.push(`饮水 ${s.stats["达标天数"] || "0/0"}`);
          break;
        case "sleep":
          parts.push(`早睡 ${s.stats["达标率"] || "0%"}`);
          break;
        case "fitness":
          parts.push(`训练 ${s.stats["训练天数"] || "0/0"}`);
          break;
        case "diet":
          parts.push(`饮食 ${s.stats["记录天数"] || "0/0"}`);
          break;
        case "wellness":
          parts.push(`养生 ${s.stats["记录天数"] || "0/0"}`);
          break;
        case "posture":
          parts.push(`拉伸 ${s.stats["拉伸天数"] || "0/0"}`);
          break;
        case "schedule":
          parts.push(`日程完成率 ${s.stats["完成率"] || "0%"}`);
          break;
        case "medication":
          parts.push(`服药 ${s.stats["依从率"] || "0%"}`);
          break;
      }
    }

    if (parts.length === 0) return `${periodLabel}暂无数据。`;
    return `${periodLabel}概况：${parts.join(" · ")}。`;
  }
}

export const reviewerBrain = new ReviewerBrain();
