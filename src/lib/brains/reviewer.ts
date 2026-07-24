/**
 * ReviewerBrain — 周期回顾引擎
 * 跨模块聚合数据，生成周/月回顾摘要
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
  period: "weekly" | "monthly";
  dateRange: DateRange;
  summaries: ReviewModuleSummary[];
  overviewText: string;
}

function getWeekRange(): DateRange {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = new Date(now); mon.setDate(now.getDate() - diff);
  const sun = new Date(now);
  return {
    start: fmtDate(mon),
    end: fmtDate(sun),
  };
}

function getMonthRange(): DateRange {
  const now = new Date();
  return {
    start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: fmtDate(now),
  };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export class ReviewerBrain {
  async generateReview(period: "weekly" | "monthly" = "weekly"): Promise<ReviewResult> {
    const dateRange = period === "weekly" ? getWeekRange() : getMonthRange();
    const summaries = await Promise.all([
      this.reviewGoals(dateRange),
      this.reviewFinance(dateRange),
      this.reviewWater(dateRange),
      this.reviewSleep(dateRange),
      this.reviewFitness(dateRange),
      this.reviewSchedule(dateRange),
      this.reviewMedication(dateRange),
    ]);

    const overviewText = this.buildOverview(summaries, period);

    return { period, dateRange, summaries, overviewText };
  }

  async reviewGoals(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { efficiencyDB } = await import("@/lib/db/efficiency.db");
      const goals = await efficiencyDB.goals.toArray();
      const active = goals.filter((g: any) => g.status === "active");
      const completedThisPeriod = goals.filter((g: any) => {
        if (g.status !== "completed") return false;
        if (!g.completedAt) return false;
        return g.completedAt >= new Date(range.start).getTime();
      });

      const tasks = await efficiencyDB.tasks.toArray();
      const tasksDone = tasks.filter((t: any) => t.status === "done").length;
      const tasksTotal = tasks.length;
      const rate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

      const highlights: ReviewHighlight[] = [];
      if (completedThisPeriod.length > 0) {
        highlights.push({
          module: "goals",
          label: "本周完成目标",
          value: `${completedThisPeriod.length} 个`,
          trend: "up",
          detail: completedThisPeriod.map((g: any) => g.title).join("、"),
        });
      }
      highlights.push({
        module: "goals",
        label: "任务完成率",
        value: `${rate}%`,
        trend: rate >= 70 ? "up" : rate >= 40 ? "stable" : "down",
      });

      return {
        module: "goals",
        icon: "Target",
        label: "目标与任务",
        stats: {
          "进行中目标": active.length,
          "本周完成": completedThisPeriod.length,
          "任务完成率": `${rate}%`,
          "总任务数": tasksTotal,
        },
        highlights,
      };
    } catch {
      return { module: "goals", icon: "Target", label: "目标与任务", stats: {}, highlights: [] };
    }
  }

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

      // Category breakdown
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

  async reviewWater(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const logs = await healthDB.waterLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const totalMl = logs.reduce((s: number, l: any) => s + (l.amount || 0), 0);
      const days = Math.max(1, Math.ceil((new Date(range.end).getTime() - new Date(range.start).getTime()) / 86400000));
      const avgMl = Math.round(totalMl / days);
      const goal = (await healthDB.waterGoals.toArray())[0]?.dailyTarget || 2000;

      return {
        module: "water",
        icon: "Droplets",
        label: "饮水",
        stats: {
          "总饮水": `${totalMl}ml`,
          "日均饮水": `${avgMl}ml`,
          "每日目标": `${goal}ml`,
          "记录天数": logs.length,
        },
        highlights: [{
          module: "water",
          label: "日均饮水",
          value: `${avgMl}ml`,
          trend: avgMl >= goal ? "up" : avgMl >= goal * 0.7 ? "stable" : "down",
        }],
      };
    } catch {
      return { module: "water", icon: "Droplets", label: "饮水", stats: {}, highlights: [] };
    }
  }

  async reviewSleep(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const logs = await healthDB.sleepLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const onTime = logs.filter((l: any) => l.isOnTime).length;
      const rate = logs.length > 0 ? Math.round((onTime / logs.length) * 100) : 0;

      const times = logs
        .map((l: any) => l.actualTime)
        .filter(Boolean)
        .sort();
      const medianTime = times.length > 0 ? times[Math.floor(times.length / 2)] : "--";

      return {
        module: "sleep",
        icon: "Moon",
        label: "睡眠",
        stats: {
          "记录天数": logs.length,
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

  async reviewFitness(range: DateRange): Promise<ReviewModuleSummary> {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const sessions = await healthDB.workoutSessions
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const stretchLogs = await healthDB.stretchLogs
        .where("date")
        .between(range.start, range.end, true, true)
        .toArray();

      const totalSessions = sessions.length + (stretchLogs?.length || 0);

      return {
        module: "fitness",
        icon: "Dumbbell",
        label: "健身与拉伸",
        stats: {
          "训练次数": sessions.length,
          "拉伸次数": stretchLogs?.length || 0,
          "总活动": totalSessions,
        },
        highlights: totalSessions > 0 ? [{
          module: "fitness",
          label: "本周活动天数",
          value: `${totalSessions}`,
          trend: totalSessions >= 3 ? "up" : "stable",
        }] : [],
      };
    } catch {
      return { module: "fitness", icon: "Dumbbell", label: "健身与拉伸", stats: {}, highlights: [] };
    }
  }

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

      // 按 sourceType 分组统计
      const bySource: Record<string, number> = {};
      for (const item of items) {
        const st = (item as any).sourceType || "unknown";
        bySource[st] = (bySource[st] || 0) + 1;
      }

      // 找出最多未完成的一天
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
        label: "日程回顾",
        stats,
        highlights,
      };
    } catch {
      return { module: "schedule", icon: "Calendar", label: "日程回顾", stats: {}, highlights: [] };
    }
  }

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

  private buildOverview(summaries: ReviewModuleSummary[], period: string): string {
    const periodLabel = period === "weekly" ? "本周" : "本月";
    const parts: string[] = [];

    for (const s of summaries) {
      if (!s.stats || Object.keys(s.stats).length === 0) continue;
      switch (s.module) {
        case "goals":
          parts.push(`${s.stats["进行中目标"] || 0} 个目标进行中`);
          break;
        case "finance":
          parts.push(`支出 ¥${s.stats["支出"] || 0}`);
          break;
        case "water":
          parts.push(`日均饮水 ${s.stats["日均饮水"] || "0ml"}`);
          break;
        case "sleep":
          parts.push(`早睡达标率 ${s.stats["达标率"] || "0%"}`);
          break;
        case "fitness":
          parts.push(`${s.stats["总活动"] || 0} 次健身/拉伸`);
          break;
        case "schedule":
          parts.push(`完成率 ${s.stats["完成率"] || "0%"}`);
          break;
        case "medication":
          parts.push(`服药依从率 ${s.stats["依从率"] || "0%"}`);
          break;
      }
    }

    if (parts.length === 0) return `${periodLabel}暂无数据。`;

    return `${periodLabel}概况：${parts.join(" · ")}。`;
  }
}

export const reviewerBrain = new ReviewerBrain();
