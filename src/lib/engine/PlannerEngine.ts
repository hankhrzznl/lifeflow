/**
 * 拆解师 —— 纯本地规则引擎，将Goal智能拆解为四级结构
 * 技术：日期算法 + 参数化模板 + 心理学阶段模型
 */

import type { EngineGoal, EngineMilestone, EngineWeeklyTask, EngineDailyAtom } from "./types";
import type { EngineTemplateParams } from "./types";

// ============ 日期工具 ============

export class DateMath {
  static daysBetween(start: string, end: string): number {
    const d1 = new Date(start + "T00:00:00");
    const d2 = new Date(end + "T00:00:00");
    return Math.ceil((d2.getTime() - d1.getTime()) / 86400000);
  }

  static workDaysBetween(start: string, end: string): number {
    let count = 0;
    const d = new Date(start + "T00:00:00");
    const endD = new Date(end + "T00:00:00");
    while (d <= endD) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  static addWorkDays(date: string, n: number): string {
    const d = new Date(date + "T00:00:00");
    let added = 0;
    while (added < n) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) added++;
    }
    return d.toISOString().split("T")[0];
  }

  static addDays(date: string, n: number): string {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  }

  static ebbinghausDays = [1, 2, 4, 7, 15, 30];

  static weekStart(date: string): string {
    const d = new Date(date + "T00:00:00");
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0];
  }

  static dateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const d = new Date(start + "T00:00:00");
    const endD = new Date(end + "T00:00:00");
    while (d <= endD) {
      dates.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  static isWorkDay(date: string): boolean {
    const day = new Date(date + "T00:00:00").getDay();
    return day !== 0 && day !== 6;
  }
}

type ParamBag = Record<string, unknown>;

function getP<K extends string>(p: unknown, key: K, def: unknown): unknown {
  return (p as ParamBag)[key] ?? def;
}

// ============ 拆解结果 ============

export interface SplitResult {
  goal: EngineGoal;
  milestones: EngineMilestone[];
  weeklyTasks: EngineWeeklyTask[];
  dailyAtoms: EngineDailyAtom[];
}

interface SplitStrategy {
  readonly name: string;
  readonly category: string;
  generate(goal: EngineGoal, params: Record<string, unknown>): SplitResult;
}

// ============ 备考策略 ============

class ExamStrategy implements SplitStrategy {
  name = "备考策略";
  category = "exam";

  generate(goal: EngineGoal, params: Record<string, unknown>): SplitResult {
    const start = goal.createdAt.split("T")[0];
    const totalDays = DateMath.daysBetween(start, goal.deadline);
    const dailyHours = (params.dailyHours as number) || 3;
    const subjects = (params.subjects as string[]) || ["科目一", "科目二", "科目三"];
    const now = new Date().toISOString();

    const milestones: EngineMilestone[] = [];
    const weeklyTasks: EngineWeeklyTask[] = [];
    const dailyAtoms: EngineDailyAtom[] = [];

    const phases = [
      { name: "基础学习阶段", weight: 35, desc: "完成所有科目的基础章节阅读和笔记整理" },
      { name: "强化训练阶段", weight: 25, desc: "每科目完成至少100道练习题，正确率>70%" },
      { name: "冲刺复习阶段", weight: 25, desc: "错题全部重做正确，薄弱章节二次学习" },
      { name: "模考调整阶段", weight: 15, desc: "模拟考试分数达到目标通过线的110%" },
    ];

    let weekNum = 0;
    let sortOrder = 0;

    phases.forEach((phase, phaseIdx) => {
      const phaseWeeks = Math.max(1, Math.round((totalDays / 7) * (phase.weight / 25)));
      const msStart = DateMath.addWorkDays(start, weekNum * 7);
      const msEnd = DateMath.addWorkDays(msStart, phaseWeeks * 7);

      milestones.push({
        id: crypto.randomUUID(), goalId: goal.id, title: phase.name,
        startDate: msStart, deadline: msEnd, weight: phase.weight, progress: 0,
        status: phaseIdx === 0 ? "active" : "pending",
        deliverable: `${phase.name}完成`, acceptanceCriteria: phase.desc,
        sortOrder: sortOrder++, createdAt: now, updatedAt: now,
      });

      for (let w = 0; w < phaseWeeks; w++) {
        weekNum++;
        const ws = DateMath.addWorkDays(start, (weekNum - 1) * 7);
        const we = DateMath.addWorkDays(ws, 6);
        const subject = subjects[w % subjects.length];
        const year = new Date(ws + "T00:00:00").getFullYear();

        const wtId = crypto.randomUUID();
        weeklyTasks.push({
          id: wtId, milestoneId: milestones[milestones.length - 1].id,
          title: `第${weekNum}周：${subject}${["基础学习", "专项训练", "综合复习", "模拟考试"][phaseIdx]}`,
          weekNumber: weekNum, year, plannedStart: ws, plannedEnd: we,
          quantityTarget: dailyHours * 5, quantityUnit: "小时",
          weight: 100, progress: 0, status: "active", sortOrder: weekNum,
          createdAt: now, updatedAt: now,
        });

        const workDays = DateMath.dateRange(ws, we).filter(DateMath.isWorkDay);
        workDays.forEach((date, dayIdx) => {
          dailyAtoms.push({
            id: crypto.randomUUID(), weeklyTaskId: wtId,
            title: `${subject} — ${this.dayTopic(phaseIdx, dayIdx)}`,
            scheduledDate: date, quantity: dailyHours, isCompleted: false,
            completedAt: undefined, actualQuantity: undefined, checkInId: undefined,
            status: "pending" as const, sortOrder: dayIdx, createdAt: now, updatedAt: now,
          });
        });

        if (phaseIdx >= 1 && w > 0) {
          const reviewDay = workDays[workDays.length - 1];
          if (reviewDay) {
            dailyAtoms.push({
              id: crypto.randomUUID(), weeklyTaskId: wtId,
              title: `艾宾浩斯复习 — ${subject}`, scheduledDate: reviewDay, quantity: 1,
              isCompleted: false, completedAt: undefined, actualQuantity: undefined,
              checkInId: undefined, status: "pending" as const,
              sortOrder: workDays.length, createdAt: now, updatedAt: now,
            });
          }
        }
      }
    });

    return { goal, milestones, weeklyTasks, dailyAtoms };
  }

  private dayTopic(phase: number, day: number): string {
    const t = [
      ["阅读教材","整理笔记","观看讲解","做基础题","章节总结"],
      ["专项练习A","专项练习B","易错题训练","知识点回顾","周测"],
      ["综合复习","薄弱环节","真题演练","错题重做","知识点串联"],
      ["全真模拟","分析错题","查漏补缺","重点背诵","心态调整"],
    ];
    return t[phase]?.[day] ?? "学习";
  }
}

// ============ 运动策略 ============

class FitnessStrategy implements SplitStrategy {
  name = "运动策略"; category = "fitness";
  generate(goal: EngineGoal, params: Record<string, unknown>): SplitResult {
    const start = goal.createdAt.split("T")[0];
    const totalDays = DateMath.daysBetween(start, goal.deadline);
    const totalWeeks = Math.max(1, Math.floor(totalDays / 7));
    const level = (params.level as string) || "beginner";
    const fType = (params.fitnessType as string) || "strength";
    const now = new Date().toISOString();

    const milestones: EngineMilestone[] = [];
    const weeklyTasks: EngineWeeklyTask[] = [];
    const dailyAtoms: EngineDailyAtom[] = [];

    const adapt = Math.max(2, Math.floor(totalWeeks * 0.25));
    const build = Math.max(3, Math.floor(totalWeeks * 0.5));
    const solid = Math.max(1, totalWeeks - adapt - build);

    const phaseDefs = [
      { name:"适应期", weight:20, weeks:adapt, days:level==="beginner"?3:4, label:"建立习惯", del:"运动习惯养成", crit:"连续两周按计划完成训练" },
      { name:"强化期", weight:50, weeks:build, days:level==="beginner"?4:5, label:"提升强度", del:"体能显著提升", crit:"训练重量/时长达到阶段目标" },
      { name:"巩固期", weight:30, weeks:solid, days:level==="beginner"?3:4, label:"巩固成果", del:"稳定运动习惯", crit:"能自主安排训练" },
    ];

    let weekNum = 0, mOrder = 0;
    phaseDefs.forEach((pd, pi) => {
      const msEnd = DateMath.addWorkDays(start, (weekNum + pd.weeks) * 7);
      milestones.push({
        id: crypto.randomUUID(), goalId: goal.id, title: pd.name,
        startDate: DateMath.addWorkDays(start, weekNum * 7), deadline: msEnd,
        weight: pd.weight, progress: 0, status: pi === 0 ? "active" : "pending",
        deliverable: pd.del, acceptanceCriteria: pd.crit, sortOrder: mOrder++,
        createdAt: now, updatedAt: now,
      });

      for (let w = 0; w < pd.weeks; w++) {
        weekNum++;
        const ws = DateMath.addWorkDays(start, (weekNum - 1) * 7);
        const we = DateMath.addWorkDays(ws, 6);
        const year = new Date(ws + "T00:00:00").getFullYear();

        const wtId = crypto.randomUUID();
        weeklyTasks.push({
          id: wtId, milestoneId: milestones[milestones.length - 1].id,
          title: `第${weekNum}周：${pd.label}`, weekNumber: weekNum, year,
          plannedStart: ws, plannedEnd: we, quantityTarget: pd.days,
          quantityUnit: "次训练", weight: 100, progress: 0, status: "active",
          sortOrder: weekNum, createdAt: now, updatedAt: now,
        });

        const weekDates = DateMath.dateRange(ws, we);
        const trainDays = this.selectTrainDays(weekDates, pd.days);
        trainDays.forEach((date, idx) => {
          dailyAtoms.push({
            id: crypto.randomUUID(), weeklyTaskId: wtId,
            title: this.trainTitle(fType, pi, idx), scheduledDate: date,
            quantity: this.trainDuration(fType, level, pi), isCompleted: false,
            completedAt: undefined, actualQuantity: undefined, checkInId: undefined,
            status: "pending" as const, sortOrder: idx, createdAt: now, updatedAt: now,
          });
        });
      }
    });

    return { goal, milestones, weeklyTasks, dailyAtoms };
  }

  private selectTrainDays(dates: string[], count: number): string[] {
    const pri = [1,3,5,2,4];
    return [...dates].sort((a,b)=>pri.indexOf(new Date(a+"T00:00:00").getDay())-pri.indexOf(new Date(b+"T00:00:00").getDay())).slice(0,count);
  }
  private trainTitle(type: string, phase: number, idx: number): string {
    const t: Record<string,string[][]> = {
      strength:[["全身适应","核心激活","上肢入门"],["胸+三头","背+二头","腿部训练","肩部+核心","全身循环"],["推日","拉日","腿日","弱项强化"]],
      cardio:[["快走30分","慢跑入门","间歇走跑"],["慢跑","间歇跑","长距离慢跑","节奏跑","恢复跑"],["法特莱克跑","节奏跑","长距离跑","轻松恢复"]],
      flexibility:[["全身拉伸","肩颈放松","脊柱灵活"],["瑜伽基础","髋部打开","后弯练习","前屈深化","平衡练习"],["流瑜伽","深度拉伸","冥想放松"]],
    };
    return (t[type]?.[phase] ?? t.strength[0])[idx % (t[type]?.[phase]?.length ?? 3)];
  }
  private trainDuration(type: string, level: string, phase: number): number {
    const b:Record<string,number>={strength:45,cardio:30,flexibility:30};
    const l:Record<string,number>={beginner:.7,intermediate:1,advanced:1.3};
    return Math.round((b[type]??45)*(l[level]??1)*([.8,1,1.1][phase]??1));
  }
}

// ============ 习惯策略 ============

class HabitStrategy implements SplitStrategy {
  name = "习惯策略"; category = "habit";
  generate(goal: EngineGoal, params: Record<string, unknown>): SplitResult {
    const days = (params.habitDays as number) || 21;
    const freq = (params.frequency as string) || "daily";
    const cue = (params.cue as string) || "早餐后";
    const start = goal.createdAt.split("T")[0];
    const now = new Date().toISOString();

    const milestones: EngineMilestone[] = [];
    const weeklyTasks: EngineWeeklyTask[] = [];
    const dailyAtoms: EngineDailyAtom[] = [];

    const phases = days === 66
      ? [{ name:"初建期(1-21天)",d:21,w:35 },{ name:"稳定期(22-49天)",d:28,w:35 },{ name:"固化期(50-66天)",d:17,w:30 }]
      : [{ name:"反抗期(1-7天)",d:7,w:30 },{ name:"不稳定期(8-14天)",d:7,w:35 },{ name:"稳定期(15-21天)",d:7,w:35 }];

    let dayOff = 0, mOrder = 0, wNum = 0;
    phases.forEach((p, pi) => {
      const msEnd = DateMath.addWorkDays(start, dayOff + p.d);
      milestones.push({
        id: crypto.randomUUID(), goalId: goal.id, title: p.name,
        startDate: DateMath.addWorkDays(start, dayOff), deadline: msEnd,
        weight: p.w, progress: 0, status: pi === 0 ? "active" : "pending",
        deliverable: `${p.d}天连续打卡`, acceptanceCriteria: p.name,
        sortOrder: mOrder++, createdAt: now, updatedAt: now,
      });

      const weeks = Math.ceil(p.d / 7);
      for (let w = 0; w < weeks; w++) {
        wNum++;
        const ws = DateMath.addWorkDays(start, dayOff + w * 7);
        const we = DateMath.addWorkDays(ws, 6);
        const year = new Date(ws + "T00:00:00").getFullYear();

        const wtId = crypto.randomUUID();
        weeklyTasks.push({
          id: wtId, milestoneId: milestones[milestones.length - 1].id,
          title: `第${wNum}周：${goal.title}`, weekNumber: wNum, year,
          plannedStart: ws, plannedEnd: we,
          quantityTarget: freq === "daily" ? 7 : 5, quantityUnit: "天打卡",
          weight: 100, progress: 0, status: "active", sortOrder: wNum,
          createdAt: now, updatedAt: now,
        });

        DateMath.dateRange(ws, we).forEach((date) => {
          if (freq === "workdays" && !DateMath.isWorkDay(date)) return;
          dailyAtoms.push({
            id: crypto.randomUUID(), weeklyTaskId: wtId,
            title: `${cue} — ${goal.title}`, scheduledDate: date, quantity: 1,
            isCompleted: false, completedAt: undefined, actualQuantity: undefined,
            checkInId: undefined, status: "pending" as const,
            sortOrder: 0, createdAt: now, updatedAt: now,
          });
        });
      }
      dayOff += p.d;
    });

    return { goal, milestones, weeklyTasks, dailyAtoms };
  }
}

// ============ 存款策略 ============

class SavingsStrategy implements SplitStrategy {
  name = "存款策略"; category = "savings";
  generate(goal: EngineGoal, params: Record<string, unknown>): SplitResult {
    const target = (params.targetAmount as number) || 10000;
    const income = (params.monthlyIncome as number) || 5000;
    const rate = (params.savingsRate as number) || 0.3;
    const start = goal.createdAt.split("T")[0];
    const now = new Date().toISOString();

    const monthly = Math.round(income * rate);
    const months = Math.max(1, Math.ceil(target / monthly));

    const milestones: EngineMilestone[] = [];
    const weeklyTasks: EngineWeeklyTask[] = [];
    const dailyAtoms: EngineDailyAtom[] = [];

    const labels = ["起步储蓄","半程达成","冲刺阶段","目标达成"];
    [0.25,0.5,0.75,1].forEach((pct, idx) => {
      const amt = Math.round(target * pct);
      const msEnd = DateMath.addWorkDays(start, Math.floor(months * pct) * 30);
      milestones.push({
        id: crypto.randomUUID(), goalId: goal.id, title: labels[idx],
        startDate: idx === 0 ? start : DateMath.addWorkDays(start, Math.floor(months * ([0.25,0.5,0.75][idx-1] ?? 0)) * 30),
        deadline: msEnd, weight: 25, progress: 0,
        status: idx === 0 ? "active" : "pending",
        deliverable: `累计${amt}元`, acceptanceCriteria: `储蓄账户达到${amt}元`,
        sortOrder: idx, createdAt: now, updatedAt: now,
      });
    });

    const totalWeeks = Math.ceil(months * 4.33);
    for (let w = 0; w < totalWeeks; w++) {
      const ws = DateMath.addWorkDays(start, w * 7);
      const we = DateMath.addWorkDays(ws, 6);
      const mNum = Math.floor(w / 4.33) + 1;
      const msIdx = Math.min(Math.floor((w / totalWeeks) * 4), 3);
      const year = new Date(ws + "T00:00:00").getFullYear();

      const wtId = crypto.randomUUID();
      weeklyTasks.push({
        id: wtId, milestoneId: milestones[msIdx].id,
        title: `第${mNum}月第${(w % 4) + 1}周：记账+储蓄`,
        weekNumber: w + 1, year, plannedStart: ws, plannedEnd: we,
        quantityTarget: Math.round(monthly / 4.33), quantityUnit: "元",
        weight: 100, progress: 0, status: "active", sortOrder: w + 1,
        createdAt: now, updatedAt: now,
      });

      DateMath.dateRange(ws, we).forEach((date) => {
        dailyAtoms.push({
          id: crypto.randomUUID(), weeklyTaskId: wtId,
          title: "记录今日开支", scheduledDate: date, quantity: 1,
          isCompleted: false, completedAt: undefined, actualQuantity: undefined,
          checkInId: undefined, status: "pending" as const,
          sortOrder: 0, createdAt: now, updatedAt: now,
        });
      });

      const sun = DateMath.dateRange(ws, we).find((d) => new Date(d + "T00:00:00").getDay() === 0);
      if (sun) {
        dailyAtoms.push({
          id: crypto.randomUUID(), weeklyTaskId: wtId,
          title: `存入本周储蓄(${Math.round(monthly / 4.33)}元)`,
          scheduledDate: sun, quantity: Math.round(monthly / 4.33),
          isCompleted: false, completedAt: undefined, actualQuantity: undefined,
          checkInId: undefined, status: "pending" as const,
          sortOrder: 10, createdAt: now, updatedAt: now,
        });
      }
    }

    return { goal, milestones, weeklyTasks, dailyAtoms };
  }
}

// ============ 再规划引擎 ============

export interface ReplanResult {
  shouldReplan: boolean;
  reason: string;
  newPlan: SplitResult | null;
  adjustmentType: "extend" | "reduce_daily" | "split_further" | "none";
}

export class ReplanEngine {
  analyze(goal: EngineGoal, _ms: EngineMilestone[], _atoms: EngineDailyAtom[]): ReplanResult {
    const start = goal.createdAt.split("T")[0];
    const now = new Date().toISOString().split("T")[0];
    const totalDays = DateMath.daysBetween(start, goal.deadline);
    const daysPassed = DateMath.daysBetween(start, now);
    const tp = daysPassed / totalDays;
    const gap = goal.progress / 100 - tp;

    if (gap < -0.3)
      return { shouldReplan: true, reason: `进度严重滞后：时间过去${Math.round(tp*100)}%，但只完成${goal.progress}%。建议延长期限或大幅减少任务量。`, adjustmentType: "extend", newPlan: null };
    if (gap < -0.15) {
      const rp = 100 - goal.progress;
      const rd = DateMath.daysBetween(now, goal.deadline);
      return { shouldReplan: true, reason: `进度滞后：建议每日推进速度从${Math.round((goal.progress/Math.max(daysPassed,1))*10)/10}%调整到${Math.round((rp/rd)*10)/10}%。`, adjustmentType: "reduce_daily", newPlan: null };
    }
    return { shouldReplan: false, reason: "", adjustmentType: "none", newPlan: null };
  }

  executeReplan(_goal: EngineGoal, atoms: EngineDailyAtom[], type: "reduce_daily"): EngineDailyAtom[] {
    const now = new Date().toISOString().split("T")[0];
    const future = atoms.filter((a) => a.scheduledDate >= now && !a.isCompleted);
    if (type === "reduce_daily") {
      const dates = [...new Set(future.map((a) => a.scheduledDate))].sort();
      const keep = dates.filter((_, i) => i % 2 === 0);
      return future.filter((a) => keep.includes(a.scheduledDate));
    }
    return future;
  }
}

// ============ 主引擎 ============

export class PlannerEngine {
  private strategies = new Map<string, SplitStrategy>();
  private replanEngine = new ReplanEngine();

  constructor() {
    this.strategies.set("exam", new ExamStrategy());
    this.strategies.set("fitness", new FitnessStrategy());
    this.strategies.set("habit", new HabitStrategy());
    this.strategies.set("savings", new SavingsStrategy());
  }

  split(goal: EngineGoal, params?: EngineTemplateParams): SplitResult {
    const bag = (params ?? {}) as unknown as Record<string, unknown>;
    const strategy = this.strategies.get(goal.category);
    if (strategy) return strategy.generate(goal, bag);
    return this.genericSplit(goal);
  }

  checkAndReplan(goal: EngineGoal, ms: EngineMilestone[], atoms: EngineDailyAtom[]): ReplanResult {
    return this.replanEngine.analyze(goal, ms, atoms);
  }

  executeReplan(goal: EngineGoal, atoms: EngineDailyAtom[], type: "reduce_daily" | "extend"): EngineDailyAtom[] {
    return this.replanEngine.executeReplan(goal, atoms, type === "extend" ? "reduce_daily" : type);
  }

  private genericSplit(goal: EngineGoal): SplitResult {
    const start = goal.createdAt.split("T")[0];
    const totalDays = DateMath.daysBetween(start, goal.deadline);
    const totalWeeks = Math.max(1, Math.floor(totalDays / 7));
    const msCount = Math.min(3, totalWeeks);
    const now = new Date().toISOString();

    const milestones: EngineMilestone[] = [];
    const weeklyTasks: EngineWeeklyTask[] = [];
    const dailyAtoms: EngineDailyAtom[] = [];

    for (let i = 0; i < msCount; i++) {
      milestones.push({
        id: crypto.randomUUID(), goalId: goal.id, title: `阶段${i + 1}`,
        startDate: i === 0 ? start : DateMath.addWorkDays(start, Math.floor((i / msCount) * totalWeeks) * 7),
        deadline: DateMath.addWorkDays(start, Math.floor(((i + 1) / msCount) * totalWeeks) * 7),
        weight: Math.round(100 / msCount), progress: 0,
        status: i === 0 ? "active" : "pending",
        deliverable: `完成阶段${i + 1}`, acceptanceCriteria: "按计划完成",
        sortOrder: i, createdAt: now, updatedAt: now,
      });
    }

    for (let w = 0; w < totalWeeks; w++) {
      const msIdx = Math.min(Math.floor((w / totalWeeks) * msCount), msCount - 1);
      const ws = DateMath.addWorkDays(start, w * 7);
      const we = DateMath.addWorkDays(ws, 6);
      const year = new Date(ws + "T00:00:00").getFullYear();

      const wtId = crypto.randomUUID();
      weeklyTasks.push({
        id: wtId, milestoneId: milestones[msIdx].id, title: `第${w + 1}周`,
        weekNumber: w + 1, year, plannedStart: ws, plannedEnd: we,
        quantityTarget: 5, quantityUnit: "天执行",
        weight: 100, progress: 0, status: "active", sortOrder: w + 1,
        createdAt: now, updatedAt: now,
      });

      DateMath.dateRange(ws, we).filter(DateMath.isWorkDay).forEach((date, idx) => {
        dailyAtoms.push({
          id: crypto.randomUUID(), weeklyTaskId: wtId,
          title: `${goal.title} — 执行`, scheduledDate: date, quantity: 1,
          isCompleted: false, completedAt: undefined, actualQuantity: undefined,
          checkInId: undefined, status: "pending" as const,
          sortOrder: idx, createdAt: now, updatedAt: now,
        });
      });
    }

    return { goal, milestones, weeklyTasks, dailyAtoms };
  }

  getAvailableStrategies(): Array<{ id: string; name: string }> {
    return Array.from(this.strategies.entries()).map(([k, v]) => ({ id: k, name: v.name }));
  }
}

export const plannerEngine = new PlannerEngine();
