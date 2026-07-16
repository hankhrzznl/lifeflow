/**
 * 回顾师 —— 本地周报生成引擎
 * 统计计算 + 条件模板 + 同义词轮换 = 有温度的文案
 */

import type { EngineDailyAtom, EngineGoal } from "./types";

export interface WeekStats {
  totalAtoms: number;
  completedAtoms: number;
  completionRate: number;
  streakDays: number;
  bestDay: { date: string; count: number };
  missedDays: string[];
  vsLastWeek: number;
}

interface ReviewSection {
  title: string;
  content: string;
}

// 同义词轮换
class RotatingPhrase {
  private idx = 0;
  constructor(private phrases: string[]) {}
  next(): string {
    return this.phrases[this.idx++ % this.phrases.length];
  }
}

// 条件文案
function ratePraise(rate: number): string {
  if (rate >= 100) return "完美达成！你这一周的表现简直无可挑剔";
  if (rate >= 80) return "非常棒！大部分时间都坚持下来了，这种节奏很好";
  if (rate >= 60) return "整体不错，虽然有几天的波动，但大方向是对的";
  if (rate >= 40) return "这周有点起伏，但至少有在行动，比停滞不前强多了";
  if (rate >= 20) return "这周确实有些困难，但每一小步都算数";
  return "没关系，下周我们一起重新开始";
}

function streakPraise(streak: number): string {
  if (streak >= 7) return "连续打卡一整周！这种自律太让人佩服了";
  if (streak >= 5) return "连续打卡了这么多天，习惯正在成形";
  if (streak >= 3) return "连续打卡的表现很稳定，继续保持";
  if (streak >= 1) return "至少有一天坚持下来了，这就是好的开始";
  return "这周没有连续打卡的记录，下周我们试试从小目标开始";
}

function wowComment(v: number): string {
  if (v >= 20) return "比上周进步了很多，上升趋势很明显";
  if (v >= 5) return "相比上周稳中有升，不错的进步";
  if (v >= -5) return "和上周基本持平，保持稳定也是一种能力";
  if (v >= -20) return "这周比上周有所回落，找找原因调整一下";
  return "这周下滑比较明显，需要重新审视计划是否合理";
}

const openers = new RotatingPhrase([
  "这一周过得真快呀",
  "又是充实的一周呢",
  "这周小织一直在关注你的进度",
  "时光如梭，新的一周又要开始了",
  "一周的时间说长不长，说短不短",
]);

const suggestions = new RotatingPhrase([
  "下周试试把最重要的任务安排在精力最好的时段",
  "小织建议你下周设置一个更具体的触发提示，比如'早餐后立即开始'",
  "如果任务总是完不成，可能是拆解得不够细，试试把大任务再拆小一点",
  "下周给自己设置一个小奖励吧，连续打卡3天就奖励自己一杯喜欢的饮品",
  "试试'两分钟法则'：如果一件事2分钟能做完，立刻去做",
  "下周的重点不是做得多，而是每天都做一点",
]);

export class ReviewerEngine {
  generateWeeklyReview(stats: WeekStats, goals: EngineGoal[], userNotes = ""): ReviewSection[] {
    const sections: ReviewSection[] = [];

    sections.push({
      title: "小织的问候",
      content: `${openers.next()}！${ratePraise(stats.completionRate)}。本周完成率${stats.completionRate}%，${streakPraise(stats.streakDays)}。`,
    });

    sections.push({ title: "本周数据", content: this.dataOverview(stats) });

    const highlights = this.findHighlights(stats, goals);
    if (highlights.length) sections.push({ title: "本周亮点", content: highlights.join("\n") });

    const issues = this.findIssues(stats);
    if (issues.length) sections.push({ title: "需要关注", content: issues.join("\n") });

    sections.push({ title: "目标进展", content: this.goalProgress(goals) });

    if (stats.vsLastWeek !== 0) {
      sections.push({
        title: "趋势对比",
        content: `相比上周，完成率${stats.vsLastWeek > 0 ? "提升了" : "下降了"}${Math.abs(stats.vsLastWeek)}%。${wowComment(stats.vsLastWeek)}。`,
      });
    }

    sections.push({ title: "小织的建议", content: suggestions.next() });

    if (userNotes.trim()) sections.push({ title: "我的反思", content: userNotes });

    sections.push({
      title: "下周见",
      content: "新的一周，新的开始。小织会一直陪着你，把大目标拆成每天能做的小事。加油！",
    });

    return sections;
  }

  /** 生成每日简报 */
  generateDailyBrief(completed: number, total: number, streak: number): string {
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (rate === 100)
      return streak >= 3
        ? `太棒了！连续${streak}天全部完成，小织为你骄傲！`
        : "今天全部完成了！保持这个势头！";
    if (rate >= 60) return `完成了${completed}/${total}项，还剩一点，再接再厉！`;
    if (completed > 0) return `完成了${completed}项，虽然不多，但每一步都算数。`;
    return "今天还没有打卡哦，哪怕完成一件小事也是进步~";
  }

  /** 生成目标达成祝贺 */
  generateGoalCompletion(title: string, daysUsed: number): string {
    return `恭喜！「${title}」目标达成！用了${daysUsed}天的坚持，小织全程见证。接下来，设定一个新目标吧！`;
  }

  private dataOverview(s: WeekStats): string {
    const lines = [
      `• 完成任务：${s.completedAtoms}/${s.totalAtoms}项`,
      `• 完成率：${s.completionRate}%`,
      `• 连续打卡：${s.streakDays}天`,
    ];
    if (s.bestDay.count > 0) lines.push(`• 最高产日：${s.bestDay.date}（${s.bestDay.count}项）`);
    if (s.missedDays.length > 0) lines.push(`• 未打卡：${s.missedDays.length}天`);
    return lines.join("\n");
  }

  private findHighlights(stats: WeekStats, goals: EngineGoal[]): string[] {
    const h: string[] = [];
    if (stats.completionRate >= 80) h.push("本周完成率超过80%，是非常优秀的表现");
    if (stats.streakDays >= 5) h.push(`连续${stats.streakDays}天打卡，习惯正在稳固形成`);
    const top = goals
      .filter((g) => g.status === "active" && g.progress > 0)
      .sort((a, b) => b.progress - a.progress)[0];
    if (top) h.push(`「${top.title}」进展最顺利，已完成${top.progress}%`);
    return h;
  }

  private findIssues(stats: WeekStats): string[] {
    const i: string[] = [];
    if (stats.completionRate < 50) i.push("整体完成率偏低，建议检查任务量是否过大");
    if (stats.missedDays.length >= 3)
      i.push(`有${stats.missedDays.length}天未打卡，可以设置提醒或降低单日任务量`);
    if (stats.streakDays === 0 && stats.totalAtoms > 0)
      i.push("没有连续打卡记录，试试从每天只做一件小事开始");
    return i;
  }

  private goalProgress(goals: EngineGoal[]): string {
    const active = goals.filter((g) => g.status === "active");
    if (!active.length) return "暂无进行中的目标";
    return active.map((g) => `• ${g.title}：${this.bar(g.progress)} ${g.progress}%`).join("\n");
  }

  private bar(pct: number, w = 10): string {
    const f = Math.round((pct / 100) * w);
    return "█".repeat(f) + "░".repeat(w - f);
  }
}

export const reviewerEngine = new ReviewerEngine();

export function calculateWeekStats(atoms: EngineDailyAtom[], lastWeekAtoms: EngineDailyAtom[]): WeekStats {
  const total = atoms.length;
  const completed = atoms.filter((a) => a.isCompleted).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  let streak = 0;
  const sorted = [...new Set(atoms.map((a) => a.scheduledDate))]
    .filter((d) => atoms.some((a) => a.scheduledDate === d && a.isCompleted))
    .sort()
    .reverse();
  for (const d of sorted) {
    if (atoms.some((a) => a.scheduledDate === d && a.isCompleted)) streak++;
    else break;
  }

  const dayCounts: Record<string, number> = {};
  atoms
    .filter((a) => a.isCompleted)
    .forEach((a) => {
      dayCounts[a.scheduledDate] = (dayCounts[a.scheduledDate] || 0) + 1;
    });
  const best = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

  const allDates = [...new Set(atoms.map((a) => a.scheduledDate))].sort();
  const missed = allDates.filter(
    (d) =>
      atoms.filter((a) => a.scheduledDate === d).length > 0 &&
      !atoms.some((a) => a.scheduledDate === d && a.isCompleted)
  );

  const lwt = lastWeekAtoms.length;
  const lwc = lastWeekAtoms.filter((a) => a.isCompleted).length;
  const lwr = lwt > 0 ? (lwc / lwt) * 100 : 0;

  return {
    totalAtoms: total,
    completedAtoms: completed,
    completionRate: rate,
    streakDays: streak,
    bestDay: best ? { date: best[0], count: best[1] } : { date: "", count: 0 },
    missedDays: missed,
    vsLastWeek: Math.round(rate - lwr),
  };
}
