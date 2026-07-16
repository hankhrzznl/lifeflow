import Dexie, { type Table } from "dexie";
import type {
  CaptureItem,
  CalendarEvent,
  FocusLog,
  LegacyProject,
  AgentMemory,
  AgentChatSession,
  Task,
  HabitLog,
  PluginRegistry,
  ProjectV2,
  TrashItem,
  Board,
  Section,
  PluginMetadata,
  TimeSegment,
  FinRecord,
  FinAccount,
  ReviewRecord,
  Reminder,
  ReminderLog,
  HealthRecord,
  WorkoutRecord,
  JournalEntry,
  TrainingPlan,
  TrainingExercise,
  Exercise,
  DailyMetrics,
  MuscleGroup,
  SubMuscle,
  PresetExercise,
  MuscleRecord,
  BodyMetricRecord,
  SleepRecord,
  NutritionRecord,
  RecoveryRecord,
  EnduranceRecord,
  DailyHealthRecord,
  CustomTrainingPlan,
  ScheduleTemplate,
  ScheduleEvent,
  DaySchedule,
  UserSettings,
  DailyWaterRecord,
  DailySelfAssessment,
  FinBudget,
  Goal,
  Plan,
  GoalTemplate,
  AiSettings,
  CustomGoalType,
  CorrelationReport,
} from "./types";
import { recalculateAllProgress } from "./linkage";

export class LifeFlowDB extends Dexie {
  capture!: Table<CaptureItem, number>;
  events!: Table<CalendarEvent, number>;
  focusLogs!: Table<FocusLog, number>;
  projects!: Table<LegacyProject, string>;
  agentMemory!: Table<AgentMemory, number>;
  agentChats!: Table<AgentChatSession, string>;
  tasks!: Table<Task, number>;
  habit_logs!: Table<HabitLog, number>;
  plugin_registry!: Table<PluginRegistry, string>;
  projectV2s!: Table<ProjectV2, number>;
  trashStore!: Table<TrashItem, number>;
  boards!: Table<Board, number>;
  sections!: Table<Section, number>;
  pluginsMeta!: Table<PluginMetadata, number>;
  timeSegments!: Table<TimeSegment, number>;
  finRecords!: Table<FinRecord, number>;
  finAccounts!: Table<FinAccount, number>;
  finBudgets!: Table<FinBudget, number>;
  reviewRecords!: Table<ReviewRecord, number>;
  reminders!: Table<Reminder, number>;
  reminderLogs!: Table<ReminderLog, number>;
  healthRecords!: Table<HealthRecord, number>;
  workouts!: Table<WorkoutRecord, number>;
  journalEntries!: Table<JournalEntry, number>;
  trainingPlans!: Table<TrainingPlan, number>;
  trainingExercises!: Table<TrainingExercise, number>;
  exercises!: Table<Exercise, number>;
  dailyMetrics!: Table<DailyMetrics, number>;
  muscleGroups!: Table<MuscleGroup, number>;
  subMuscles!: Table<SubMuscle, number>;
  presetExercises!: Table<PresetExercise, number>;
  muscleRecords!: Table<MuscleRecord, number>;
  bodyMetricRecords!: Table<BodyMetricRecord, number>;
  sleepRecords!: Table<SleepRecord, number>;
  nutritionRecords!: Table<NutritionRecord, number>;
  recoveryRecords!: Table<RecoveryRecord, number>;
  enduranceRecords!: Table<EnduranceRecord, number>;
  dailyHealthRecords!: Table<DailyHealthRecord, number>;
  customTrainingPlans!: Table<CustomTrainingPlan, number>;
  scheduleTemplates!: Table<ScheduleTemplate, number>;
  scheduleEvents!: Table<ScheduleEvent, number>;
  daySchedules!: Table<DaySchedule, number>;
  userSettings!: Table<UserSettings, number>;
  dailyWaterRecords!: Table<DailyWaterRecord, number>;
  dailySelfAssessments!: Table<DailySelfAssessment, number>;
  goals!: Table<Goal, number>;
  plans!: Table<Plan, number>;
  goalTemplates!: Table<GoalTemplate, number>;
  customGoalTypes!: Table<CustomGoalType, number>;
  correlationReports!: Table<CorrelationReport, number>;
  migrationMarkers!: Table<{ id?: number; key: string; executedAt: number }, number>;

  constructor() {
    super("LifeFlowDB");

    this.version(1).stores({
      capture: "++id, status, createdAt",
      events: "++id, startTime, endTime, planned, projectId, captureSourceId, createdAt",
      focusLogs: "++id, eventId, startTime, createdAt",
      projects: "id, name",
      agentMemory: "++id, dateKey",
      agentChats: "id, updatedAt",
    });

    this.version(2).stores({
      events: "++id, startTime, endTime, planned, projectId, captureSourceId, createdAt, *tags",
    }).upgrade((tx) => {
      return tx.table("events").toCollection().modify((event) => {
        if (!event.tags) event.tags = [];
      });
    });

    this.version(3).stores({
      tasks: "++id, type, status, parentTaskId, startTime, projectId, createdAt, [type+status], *tags",
      habit_logs: "++id, taskId, date, [taskId+date], createdAt",
      plugin_registry: "id, status",
    }).upgrade(async (tx) => {
      const captures = await tx.table("capture").toArray();
      let captureMigrated = 0;
      for (const c of captures) {
        const taskStatus: Task["status"] = c.status === "trash" ? "archived" : "active";
        const taskPlanned = c.status === "planned" ? true : undefined;
        await tx.table("tasks").add({
          title: c.content,
          type: "daily" as const,
          status: taskStatus,
          planned: taskPlanned,
          tags: c.tags || [],
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
        captureMigrated++;
      }

      const events = await tx.table("events").toArray();
      let eventsMigrated = 0;
      for (const e of events) {
        await tx.table("tasks").add({
          title: e.title,
          type: "shortterm" as const,
          status: e.deleted ? ("archived" as const) : ("active" as const),
          planned: e.planned,
          startTime: e.startTime,
          endTime: e.endTime,
          tags: e.tags || [],
          captureSourceId: e.captureSourceId,
          focusSessions: e.focusSessions || [],
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        });
        eventsMigrated++;
      }

      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log(`[LifeFlowDB v3] Migrated ${captureMigrated} captures, ${eventsMigrated} events`);
      }
    });

    this.version(4).stores({
      tasks: "++id, type, status, parentTaskId, startTime, projectId, createdAt, [type+status], *tags, dueDate",
    });

    this.version(5).stores({
      agentMemory: "++id, dateKey",
    });

    this.version(6).stores({
      agentChats: "id, updatedAt",
    });

    this.version(7).stores({
      projects: "id, name, color",
    }).upgrade(async (tx) => {
      const projects = await tx.table("projects").toArray();
      for (const project of projects) {
        await tx.table("projects").update(project.id, { color: "#6366F1" });
      }
    });

    this.version(8).stores({
      timeSegments: "++id, taskId, startTime, endTime, createdAt",
    });

    this.version(9).stores({
      trashStore: "++id, originalTable, originalId, deletedAt",
    });

    this.version(10).stores({
      projectV2s: "++id, createdAt",
    });

    this.version(11).stores({
      boards: "++id, projectId, createdAt",
      sections: "++id, boardId, createdAt",
    });

    this.version(12).stores({
      pluginsMeta: "++id, name, status, isBuiltIn, installedAt",
    }).upgrade(async (tx) => {
      const plugins = await tx.table("plugin_registry").toArray();
      for (const plugin of plugins) {
        await tx.table("pluginsMeta").add({
          id: plugin.id as any,
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          status: plugin.status,
          isBuiltIn: false,
          installedAt: plugin.installedAt,
          updatedAt: plugin.updatedAt,
        });
      }

      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log(`[LifeFlowDB v12] Migrated ${plugins.length} plugins to pluginsMeta`);
      }
    });

    this.version(13).stores({
      healthRecords: "++id, metricType, date, timestamp, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v13] Added healthRecords table");
      }
    });

    this.version(14).stores({
      workouts: "++id, type, date, startTime, createdAt",
      journalEntries: "++id, date, timestamp, category, createdAt",
      trainingPlans: "++id, name, mode, difficulty, createdAt",
      trainingExercises: "++id, planId, order",
      exercises: "++id, name, category, createdAt",
      dailyMetrics: "++id, date, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v14] Added PeakWatch tables (workouts, journalEntries, trainingPlans, trainingExercises, exercises, dailyMetrics)");
      }
    });

    this.version(15).stores({
      muscleGroups: "++id, name, order, createdAt",
      subMuscles: "++id, muscleGroupId, name, order, createdAt",
      presetExercises: "++id, name, subMuscleId, isCustom, createdAt",
      muscleRecords: "++id, subMuscleId, exerciseName, date, timestamp, createdAt",
      bodyMetricRecords: "++id, type, date, timestamp, createdAt",
      sleepRecords: "++id, date, timestamp, createdAt",
      nutritionRecords: "++id, date, timestamp, createdAt",
      recoveryRecords: "++id, date, timestamp, createdAt",
      enduranceRecords: "++id, type, date, timestamp, createdAt",
    }).upgrade(async (tx) => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v15] Added muscle tracking tables");
      }
    });

    this.version(16).stores({
      muscleGroups: "++id, name, order, createdAt",
      subMuscles: "++id, muscleGroupId, name, order, createdAt",
      presetExercises: "++id, name, subMuscleId, isCustom, createdAt",
      muscleRecords: "++id, subMuscleId, exerciseName, date, timestamp, createdAt",
      bodyMetricRecords: "++id, type, date, timestamp, createdAt",
      sleepRecords: "++id, date, timestamp, createdAt",
      nutritionRecords: "++id, date, timestamp, createdAt",
      recoveryRecords: "++id, date, timestamp, createdAt",
      enduranceRecords: "++id, type, date, timestamp, createdAt",
      dailyHealthRecords: "++id, date, timestamp, createdAt",
    }).upgrade(async (tx) => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v16] Added dailyHealthRecords table");
      }
    });

    this.version(17).stores({
      customTrainingPlans: "++id, name, type, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v17] Added customTrainingPlans table");
      }
    });

    this.version(18).stores({
      finRecords: "++id, type, amount, category, date, accountId, createdAt",
      finAccounts: "++id, name, initialBalance, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v18] Added finRecords and finAccounts tables");
      }
    });

    this.version(19).stores({
      dailyHealthRecords: "++id, date, timestamp, weight, sleepDuration, sleepTime, sleepScore, restingHeartRate, bloodOxygen, hrv, vo2Max, sunlightTime, stressLevel, bodyAge, trainingDuration, caloriesBurned, trainingFeeling, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v19] Added new health metrics fields");
      }
    });

    this.version(20).stores({
      submodules: "++id, parentKey, enabled, order, createdAt",
    }).upgrade(async () => {
      // v23+: submodules table deprecated, presets removed
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v20] Added submodules table (deprecated in v23)");
      }
    });

    this.version(21).stores({
      submodules: "++id, projectId, enabled, order, createdAt",
      tasks: "++id, type, status, parentTaskId, startTime, projectId, createdAt, [type+status], *tags, dueDate",
    }).upgrade(async (tx) => {
      // Migrate old Submodule records: parentKey → projectId mapping
      const oldSubmodules = await tx.table("submodules").toArray();
      const oldProjects = await tx.table("projectV2s").toArray();

      // Map old parentKey to default project names
      const parentKeyToName: Record<string, string> = {
        learning: "学习",
        health: "健康",
        growth: "成长",
      };

      // Create default projects if they don't exist
      const projectNameToId: Record<string, number> = {};
      for (const proj of oldProjects) {
        projectNameToId[proj.name] = proj.id!;
      }

      let nextId = oldProjects.length > 0
        ? Math.max(...oldProjects.map((p) => p.id!)) + 1
        : 1;

      for (const [, name] of Object.entries(parentKeyToName)) {
        if (!(name in projectNameToId)) {
          projectNameToId[name] = nextId;
          await tx.table("projectV2s").add({
            id: nextId,
            name,
            color: "#6366F1",
            createdAt: Date.now(),
          });
          nextId++;
        }
      }

      // Update each old submodule
      for (const sm of oldSubmodules) {
        const oldParentKey = (sm as any).parentKey as string | undefined;
        if (oldParentKey && parentKeyToName[oldParentKey]) {
          const projectId = projectNameToId[parentKeyToName[oldParentKey]];
          // Remove old fields and set projectId
          const cleaned: any = {
            id: sm.id,
            projectId,
            name: sm.name,
            description: sm.description || "",
            enabled: sm.enabled ?? true,
            order: sm.order ?? 99,
            createdAt: sm.createdAt || Date.now(),
            updatedAt: sm.updatedAt || Date.now(),
          };
          await tx.table("submodules").put(cleaned);
        } else if (!sm.projectId) {
          // No parentKey and no projectId — assign to first project
          const firstProjId = Object.values(projectNameToId)[0] || 1;
          await tx.table("submodules").update(sm.id!, {
            projectId: firstProjId,
          } as any);
        }
      }

      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v21] Migrated submodules from parentKey to projectId");
      }
    });

    this.version(22).stores({
      scheduleTemplates: "++id, createdAt",
      scheduleEvents: "++id, templateId, order, createdAt",
      daySchedules: "++id, date, templateId, createdAt",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v22] Added schedule template system");
      }
    });

    // v23: Remove deprecated submodules table
    this.version(23).stores({
      submodules: null,
    }).upgrade(async (tx) => {
      try {
        await tx.table("submodules").clear();
      } catch { /* table may not exist */ }
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v23] Removed deprecated submodules table");
      }
    });

    this.version(24).stores({
      userSettings: "++id",
      dailyWaterRecords: "++id, date",
      dailySelfAssessments: "++id, date",
    });

    this.version(25).stores({
      finBudgets: "++id, monthKey",
    }).upgrade(async () => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("[LifeFlowDB v25] Added finBudgets table");
      }
    });

    this.version(26).stores({
      goals: "++id, projectId, type, status, priority, createdAt, updatedAt",
      plans: "++id, goalId, status, order, createdAt, updatedAt",
      tasks: "++id, type, status, parentTaskId, startTime, projectId, goalId, planId, createdAt, [type+status], *tags, dueDate",
      habit_logs: "++id, taskId, goalId, planId, date, [taskId+date], createdAt",
      finRecords: "++id, type, amount, category, date, accountId, goalId, createdAt",
      muscleRecords: "++id, subMuscleId, exerciseName, date, timestamp, goalId, createdAt",
      sleepRecords: "++id, date, timestamp, goalId, createdAt",
      dailyWaterRecords: "++id, date, goalId, createdAt",
      boards: null,
      sections: null,
    }).upgrade(async (tx) => {
      const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost";

      if (isLocal) {
        console.log("[LifeFlowDB v26] Starting migration to goal-plan-task hierarchy...");
      }

      const boards = await tx.table("boards").toArray();
      const sections = await tx.table("sections").toArray();
      const tasks = await tx.table("tasks").toArray();
      const habitLogs = await tx.table("habit_logs").toArray();

      const boardIdToGoalId: Record<number, number> = {};
      const sectionIdToPlanId: Record<number, number> = {};

      for (const board of boards) {
        const projectId = typeof board.projectId === "string" 
          ? parseInt(board.projectId, 10) || 0 
          : (board.projectId ?? 0);

        const description = board.stages && board.stages.length > 0 
          ? JSON.stringify(board.stages) 
          : "";

        const goalId = await tx.table("goals").add({
          projectId,
          name: board.name,
          description,
          type: "task" as const,
          status: "active" as const,
          progress: 0,
          progressLocked: false,
          tags: [],
          weight: 1,
          createdAt: board.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        boardIdToGoalId[board.id!] = goalId;

        if (isLocal) {
          console.log(`[LifeFlowDB v26] Migrated board ${board.id} -> goal ${goalId}`);
        }
      }

      for (const section of sections) {
        const boardId = section.boardId ?? 0;
        const goalId = boardIdToGoalId[boardId] || 0;

        const planId = await tx.table("plans").add({
          goalId,
          name: section.name,
          weight: 1,
          status: "active" as const,
          progress: 0,
          order: section.stageIndex ?? 0,
          createdAt: section.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        sectionIdToPlanId[section.id!] = planId;

        if (isLocal) {
          console.log(`[LifeFlowDB v26] Migrated section ${section.id} -> plan ${planId}`);
        }
      }

      for (const task of tasks) {
        const projectId = typeof task.projectId === "string"
          ? parseInt(task.projectId, 10) || undefined
          : task.projectId;
        const goalId = task.boardId ? boardIdToGoalId[task.boardId] || undefined : undefined;
        const planId = task.sectionId ? sectionIdToPlanId[task.sectionId] || undefined : undefined;

        await tx.table("tasks").update(task.id!, {
          projectId,
          goalId,
          planId,
          weight: task.weight ?? 1,
        });

        if (isLocal) {
          console.log(`[LifeFlowDB v26] Updated task ${task.id}: goalId=${goalId}, planId=${planId}`);
        }
      }

      for (const log of habitLogs) {
        const task = tasks.find(t => t.id === log.taskId);
        if (task) {
          const goalId = task.boardId ? boardIdToGoalId[task.boardId] || undefined : undefined;
          const planId = task.sectionId ? sectionIdToPlanId[task.sectionId] || undefined : undefined;
          await tx.table("habit_logs").update(log.id!, {
            goalId,
            planId,
          });
        }
      }

      const allPlans = await tx.table("plans").toArray();
      for (const plan of allPlans) {
        const planTasks = tasks.filter(t => t.sectionId && sectionIdToPlanId[t.sectionId] === plan.id);
        const completedCount = planTasks.filter(t => t.status === "done").length;
        const totalCount = planTasks.length;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        await tx.table("plans").update(plan.id!, { progress });
      }

      const allGoals = await tx.table("goals").toArray();
      for (const goal of allGoals) {
        const goalPlans = allPlans.filter(p => p.goalId === goal.id);
        if (goalPlans.length === 0) {
          const goalTasks = tasks.filter(t => t.boardId && boardIdToGoalId[t.boardId] === goal.id);
          const completedCount = goalTasks.filter(t => t.status === "done").length;
          const totalCount = goalTasks.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          await tx.table("goals").update(goal.id!, { progress });
        } else {
          const totalWeight = goalPlans.reduce((sum, p) => sum + p.weight, 0);
          let weightedProgress = 0;
          for (const plan of goalPlans) {
            weightedProgress += (plan.progress * plan.weight) / (totalWeight || 1);
          }
          await tx.table("goals").update(goal.id!, { progress: Math.round(weightedProgress) });
        }
      }

      if (isLocal) {
        console.log(`[LifeFlowDB v26] Migration complete. goals: ${allGoals.length}, plans: ${allPlans.length}`);
      }
    });

    this.version(27).stores({
      goals: "++id, projectId, type, status, priority, createdAt, updatedAt",
      plans: "++id, goalId, status, order, createdAt, updatedAt, predecessorPlanIds, isUnlocked",
      goalTemplates: "++id, category, type, isBuiltIn",
    }).upgrade(async (tx) => {
      console.log("[LifeFlowDB v27] Upgrading plans with dependency fields...");
      const allPlans = await tx.table("plans").toArray();
      for (const plan of allPlans) {
        await tx.table("plans").update(plan.id!, {
          predecessorPlanIds: plan.predecessorPlanIds || [],
          isUnlocked: plan.isUnlocked !== undefined ? plan.isUnlocked : true,
        });
      }

      // Insert built-in templates
      const builtInTemplates: GoalTemplate[] = [
        {
          name: "备考学习目标",
          description: "完整的备考学习计划，从基础到冲刺三个阶段",
          category: "study",
          type: "task",
          icon: "📚",
          deadlineDays: 90,
          plans: [
            { name: "基础阶段", weight: 3, daysOffset: 0, tasks: [
              { title: "整理考试大纲和资料", weight: 1, type: "daily" },
              { title: "每日基础知识点学习", weight: 3, type: "daily" },
              { title: "每周基础测试", weight: 1, type: "shortterm" },
              { title: "整理错题本", weight: 1, type: "daily" },
            ]},
            { name: "强化阶段", weight: 4, daysOffset: 30, tasks: [
              { title: "专题突破训练", weight: 3, type: "daily" },
              { title: "模拟考试练习", weight: 2, type: "shortterm" },
              { title: "薄弱环节重点攻克", weight: 2, type: "daily" },
              { title: "每周复盘总结", weight: 1, type: "daily" },
            ]},
            { name: "冲刺阶段", weight: 3, daysOffset: 60, tasks: [
              { title: "全真模拟考试", weight: 3, type: "shortterm" },
              { title: "高频考点速记", weight: 2, type: "daily" },
              { title: "考前心态调整", weight: 1, type: "daily" },
              { title: "最终查漏补缺", weight: 2, type: "daily" },
            ]},
          ],
          isBuiltIn: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          name: "跑步提分目标",
          description: "1000米跑步成绩提升训练计划",
          category: "fitness",
          type: "fitness",
          icon: "🏃",
          deadlineDays: 60,
          plans: [
            { name: "基础耐力期", weight: 3, daysOffset: 0, tasks: [
              { title: "慢跑30分钟", weight: 2, type: "daily" },
              { title: "核心力量训练", weight: 1, type: "daily" },
              { title: "拉伸放松15分钟", weight: 1, type: "daily" },
            ]},
            { name: "间歇提升期", weight: 4, daysOffset: 20, tasks: [
              { title: "400米间歇跑×5组", weight: 3, type: "daily" },
              { title: "下肢力量训练", weight: 2, type: "daily" },
              { title: "配速适应训练", weight: 2, type: "daily" },
            ]},
            { name: "冲刺达标期", weight: 3, daysOffset: 40, tasks: [
              { title: "1000米计时跑", weight: 3, type: "shortterm" },
              { title: "节奏跑训练", weight: 2, type: "daily" },
              { title: "赛前减量调整", weight: 1, type: "daily" },
            ]},
          ],
          isBuiltIn: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          name: "作息调整目标",
          description: "21天养成规律作息习惯",
          category: "life",
          type: "sleep",
          icon: "😴",
          deadlineDays: 21,
          plans: [
            { name: "适应期", weight: 3, daysOffset: 0, tasks: [
              { title: "设置固定闹钟", weight: 1, type: "daily" },
              { title: "睡前1小时放下手机", weight: 2, type: "habit" },
              { title: "记录入睡时间", weight: 1, type: "daily" },
            ]},
            { name: "稳定期", weight: 3, daysOffset: 7, tasks: [
              { title: "保持固定起床时间", weight: 2, type: "habit" },
              { title: "午休不超过30分钟", weight: 1, type: "daily" },
              { title: "睡前轻度拉伸", weight: 1, type: "habit" },
            ]},
            { name: "巩固期", weight: 3, daysOffset: 14, tasks: [
              { title: "每日规律睡眠打卡", weight: 2, type: "habit" },
              { title: "周末不补觉超过1小时", weight: 1, type: "daily" },
              { title: "复盘睡眠质量", weight: 1, type: "daily" },
            ]},
          ],
          isBuiltIn: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          name: "月度储蓄目标",
          description: "建立储蓄习惯，管控月度开支",
          category: "finance",
          type: "finance",
          icon: "💰",
          deadlineDays: 30,
          plans: [
            { name: "预算管控期", weight: 3, daysOffset: 0, tasks: [
              { title: "统计固定支出", weight: 1, type: "daily" },
              { title: "制定月度预算", weight: 1, type: "shortterm" },
              { title: "每日记账", weight: 2, type: "habit" },
            ]},
            { name: "支出削减期", weight: 4, daysOffset: 10, tasks: [
              { title: "识别非必要支出", weight: 1, type: "daily" },
              { title: "取消不必要订阅", weight: 1, type: "shortterm" },
              { title: "比价优化日常消费", weight: 1, type: "daily" },
            ]},
            { name: "复盘调整期", weight: 3, daysOffset: 20, tasks: [
              { title: "计算月度结余", weight: 1, type: "shortterm" },
              { title: "调整下月预算", weight: 1, type: "shortterm" },
              { title: "设置储蓄自动转账", weight: 1, type: "shortterm" },
            ]},
          ],
          isBuiltIn: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          name: "习惯养成目标",
          description: "66天养成一个终身习惯",
          category: "life",
          type: "task",
          icon: "⭐",
          deadlineDays: 66,
          plans: [
            { name: "启动期", weight: 2, daysOffset: 0, tasks: [
              { title: "明确习惯目标和意义", weight: 1, type: "shortterm" },
              { title: "设置每日最小行动", weight: 1, type: "daily" },
              { title: "创建环境提示", weight: 1, type: "daily" },
            ]},
            { name: "成长期", weight: 4, daysOffset: 7, tasks: [
              { title: "每日打卡记录", weight: 3, type: "habit" },
              { title: "每周进度回顾", weight: 1, type: "daily" },
              { title: "调整行动策略", weight: 1, type: "daily" },
            ]},
            { name: "固化期", weight: 4, daysOffset: 33, tasks: [
              { title: "每日打卡不中断", weight: 3, type: "habit" },
              { title: "形成自动化流程", weight: 1, type: "daily" },
              { title: "庆祝达成里程碑", weight: 1, type: "shortterm" },
            ]},
          ],
          isBuiltIn: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const existingTemplates = await tx.table("goalTemplates").count();
      if (existingTemplates === 0) {
        for (const t of builtInTemplates) {
          await tx.table("goalTemplates").add(t);
        }
        console.log(`[LifeFlowDB v27] Inserted ${builtInTemplates.length} built-in templates`);
      }
    });

    this.version(28).stores({
      goals: "++id, projectId, type, status, priority, createdAt, updatedAt, isAiGenerated, warningLevel",
      plans: "++id, goalId, status, order, createdAt, updatedAt, predecessorPlanIds, isUnlocked, isAiGenerated",
      tasks: "++id, type, status, parentTaskId, startTime, projectId, goalId, planId, createdAt, [type+status], *tags, dueDate, isAiGenerated",
    }).upgrade(async (tx) => {
      console.log("[LifeFlowDB v28] Adding AI fields...");
      const allGoals = await tx.table("goals").toArray();
      for (const goal of allGoals) {
        await tx.table("goals").update(goal.id!, {
          isAiGenerated: goal.isAiGenerated || false,
          aiPrompt: goal.aiPrompt || null,
          warningLevel: goal.warningLevel || "normal",
          lastWarningCheck: goal.lastWarningCheck || 0,
          predictedFinishDate: goal.predictedFinishDate || null,
        });
      }

      const allPlans = await tx.table("plans").toArray();
      for (const plan of allPlans) {
        await tx.table("plans").update(plan.id!, {
          isAiGenerated: plan.isAiGenerated || false,
        });
      }

      const allTasks = await tx.table("tasks").toArray();
      for (const task of allTasks) {
        await tx.table("tasks").update(task.id!, {
          isAiGenerated: task.isAiGenerated || false,
        });
      }

      // Initialize AI settings
      const existingSettings = await tx.table("userSettings").toArray();
      for (const s of existingSettings) {
        await tx.table("userSettings").update(s.id!, {
          aiSettings: s.aiSettings || { aiEnabled: true, aiGoalDecompose: true, aiReviewAnalyze: true, aiProgressWarning: true, autoWeeklyReview: false },
        } as any);
      }
    });

    this.version(29).stores({
      customGoalTypes: "++id, key, isBuiltIn, enabled",
      correlationReports: "++id, dateKey",
    }).upgrade(async (tx) => {
      console.log("[LifeFlowDB v29] Initializing custom goal types...");
      
      const builtInTypes: CustomGoalType[] = [
        { key: "task", name: "任务型", icon: "Target", color: "#6366F1", dataSource: "task", unit: "个", calcMode: "cumulative", isBuiltIn: true, enabled: true, createdAt: Date.now(), updatedAt: Date.now() },
        { key: "fitness", name: "健身型", icon: "Dumbbell", color: "#F97316", dataSource: "custom", unit: "次", calcMode: "cumulative", isBuiltIn: true, enabled: true, createdAt: Date.now(), updatedAt: Date.now() },
        { key: "sleep", name: "睡眠型", icon: "Moon", color: "#8B5CF6", dataSource: "custom", unit: "天", calcMode: "check_rate", isBuiltIn: true, enabled: true, createdAt: Date.now(), updatedAt: Date.now() },
        { key: "water", name: "饮水型", icon: "Droplets", color: "#3B82F6", dataSource: "custom", unit: "ml", calcMode: "daily_avg", isBuiltIn: true, enabled: true, createdAt: Date.now(), updatedAt: Date.now() },
        { key: "finance", name: "财务型", icon: "Wallet", color: "#10B981", dataSource: "custom", unit: "元", calcMode: "cumulative", isBuiltIn: true, enabled: true, createdAt: Date.now(), updatedAt: Date.now() },
      ];

      const existing = await tx.table("customGoalTypes").count();
      if (existing === 0) {
        for (const t of builtInTypes) {
          await tx.table("customGoalTypes").add(t);
        }
      }

      // Update goals with customTypeId
      const allGoals = await tx.table("goals").toArray();
      for (const goal of allGoals) {
        if (!goal.customTypeId) {
          const ct = builtInTypes.find(t => t.key === goal.type);
          await tx.table("goals").update(goal.id!, { customTypeId: ct?.id || null });
        }
      }

      // Initialize user settings with new defaults
      const allSettings = await tx.table("userSettings").toArray();
      for (const s of allSettings) {
        await tx.table("userSettings").update(s.id!, {
          archivedDays: s.archivedDays || null,
          cleanupDays: s.cleanupDays || null,
          layoutDensity: s.layoutDensity || "normal",
          warnThreshold: s.warnThreshold || 50,
          dangerThreshold: s.dangerThreshold || 30,
        } as any);
      }
    });

    // v30: 修复 v27/v28 中因索引被意外移除导致的 SchemaError
    // "KeyPath type on object store tasks is not indexed"
    this.version(30).stores({
      goals: "++id, projectId, type, status, priority, createdAt, updatedAt, isAiGenerated, warningLevel",
      plans: "++id, goalId, status, order, createdAt, updatedAt, predecessorPlanIds, isUnlocked, isAiGenerated",
      tasks: "++id, type, status, parentTaskId, startTime, projectId, goalId, planId, createdAt, [type+status], *tags, dueDate, isAiGenerated",
    }).upgrade(async () => {
      console.log("[LifeFlowDB v30] Ensuring all indexes are present (schema recovery)");
    });

    // v31: 四级拆解引擎迁移标记
    // 只增不改：新增 migrationMarkers 表记录迁移事件
    // 不删除或修改任何现有表/索引
    this.version(31).stores({
      migrationMarkers: "++id, key, executedAt",
    }).upgrade(async () => {
      console.log("[LifeFlowDB v31] Added migrationMarkers table for engine migration tracking");
    });
  }
}

export const db = new LifeFlowDB();

function getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}

// ─── Transaction ────────────────────────────────────────────

export async function executeTransaction<T>(
  stores: (Table | string)[],
  operation: () => Promise<T>,
  options: { maxRetries?: number; onRetry?: (attempt: number) => void } = {}
): Promise<T> {
  const { maxRetries = 3 } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction("rw", stores, operation);
    } catch (err) {
      lastError = err as Error;

      if (
        (err as Error).name === "QuotaExceededError" ||
        (err as Error).name === "VersionError" ||
        (err as Error).name === "AbortError"
      ) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = 100 * Math.pow(2, attempt - 1);
        options.onRetry?.(attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("TRANSACTION_FAILED");
}

export async function writeWithRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; context?: string } = {}
): Promise<T> {
  const { maxRetries = 3, context = "" } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;

      if (
        (err as Error).name === "QuotaExceededError" ||
        (err as Error).name === "VersionError"
      ) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = 100 * Math.pow(2, attempt - 1);
        console.warn(`[DB] ${context} 第${attempt}次失败，${delay}ms后重试...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("WRITE_FAILED");
}

// ─── Database Initialization ────────────────────────────────

export async function initializeDatabase(): Promise<{
  success: boolean;
  error?: string;
  recoverable?: boolean;
}> {
  try {
    await db.open();
    return { success: true };
  } catch (err) {
    const error = err as Error;

    if (error.name === "VersionError") {
      console.error("[DB] 数据库版本不匹配，可能需要清除数据");
      return {
        success: false,
        error: "数据库版本不匹配",
        recoverable: false,
      };
    }

    if (error.name === "QuotaExceededError") {
      return {
        success: false,
        error: "存储空间已满",
        recoverable: true,
      };
    }

    return {
      success: false,
      error: error.message || "未知错误",
      recoverable: true,
    };
  }
}

// ─── Health Records CRUD ────────────────────────────────────

export async function addHealthRecord(record: Omit<HealthRecord, "id" | "createdAt">): Promise<number> {
  return db.healthRecords.add({ ...record, createdAt: Date.now() });
}

export async function getHealthRecordsByDate(date: string): Promise<HealthRecord[]> {
  return db.healthRecords.where("date").equals(date).toArray();
}

export async function getDailyHealthSummary(date: string): Promise<Record<string, number | undefined>> {
  const records = await getHealthRecordsByDate(date);
  const summary: Record<string, number | undefined> = {};

  for (const record of records) {
    if (summary[record.metricType] === undefined) {
      summary[record.metricType] = record.value;
    } else if (record.metricType === 'water_intake') {
      summary[record.metricType] = (summary[record.metricType] || 0) + record.value;
    } else if (record.metricType === 'steps') {
      summary[record.metricType] = (summary[record.metricType] || 0) + record.value;
    }
  }

  return summary;
}

export async function calculateHealthScore(metrics: Record<string, number | undefined>): Promise<number> {
  let score = 0;
  let weight = 0;

  if (metrics.water_intake !== undefined) {
    const waterScore = Math.min((metrics.water_intake / 2000) * 25, 25);
    score += waterScore;
    weight += 25;
  }

  if (metrics.sleep_duration !== undefined) {
    const sleepScore = metrics.sleep_duration >= 7 && metrics.sleep_duration <= 9 ? 25 : Math.max(0, 25 - Math.abs(metrics.sleep_duration - 8) * 5);
    score += sleepScore;
    weight += 25;
  }

  if (metrics.heart_rate !== undefined) {
    const hrScore = metrics.heart_rate >= 60 && metrics.heart_rate <= 100 ? 20 : Math.max(0, 20 - Math.abs(metrics.heart_rate - 80) * 0.5);
    score += hrScore;
    weight += 20;
  }

  if (metrics.steps !== undefined) {
    const stepsScore = Math.min((metrics.steps / 10000) * 20, 20);
    score += stepsScore;
    weight += 20;
  }

  if (metrics.mood !== undefined) {
    const moodScore = (metrics.mood / 10) * 10;
    score += moodScore;
    weight += 10;
  }

  return weight > 0 ? Math.round((score / weight) * 100) : 0;
}

export async function getWeeklyHealthSummary(): Promise<Record<string, { avg: number; total: number; count: number }>> {
  const result: Record<string, { avg: number; total: number; count: number }> = {};
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = getLocalDateStr(date);
    const summary = await getDailyHealthSummary(dateStr);

    for (const [key, value] of Object.entries(summary)) {
      if (value !== undefined) {
        if (!result[key]) {
          result[key] = { avg: 0, total: 0, count: 0 };
        }
        result[key].total += value;
        result[key].count += 1;
        result[key].avg = result[key].total / result[key].count;
      }
    }
  }

  return result;
}

export async function bulkAddHealthRecords(records: Omit<HealthRecord, "id" | "createdAt">[]): Promise<void> {
  await db.healthRecords.bulkAdd(records.map(r => ({ ...r, createdAt: Date.now() })));
}

export async function deleteHealthRecord(id: number): Promise<void> {
  await db.healthRecords.delete(id);
}

export async function getAllHealthRecords(): Promise<HealthRecord[]> {
  return db.healthRecords.orderBy('timestamp').reverse().toArray();
}

export async function getHealthRecordsStats(): Promise<{ 
  totalRecords: number; 
  dateRange: { start: string; end: string } | null;
  metricCounts: Record<string, number>;
}> {
  const records = await db.healthRecords.toArray();
  
  if (records.length === 0) {
    return { totalRecords: 0, dateRange: null, metricCounts: {} };
  }
  
  const dates = records.map(r => r.date).sort();
  const metricCounts: Record<string, number> = {};
  
  for (const record of records) {
    metricCounts[record.metricType] = (metricCounts[record.metricType] || 0) + 1;
  }
  
  return {
    totalRecords: records.length,
    dateRange: { start: dates[0], end: dates[dates.length - 1] },
    metricCounts,
  };
}

export async function getHealthRecordsGroupedByDate(): Promise<Record<string, HealthRecord[]>> {
  const records = await db.healthRecords.orderBy('date').reverse().toArray();
  const grouped: Record<string, HealthRecord[]> = {};
  
  for (const record of records) {
    if (!grouped[record.date]) {
      grouped[record.date] = [];
    }
    grouped[record.date].push(record);
  }
  
  return grouped;
}

// ─── Workout Records CRUD ────────────────────────────────────

export async function addWorkoutRecord(record: Omit<WorkoutRecord, "id" | "createdAt">): Promise<number> {
  return db.workouts.add({ ...record, createdAt: Date.now() });
}

export async function getWorkoutsByDate(date: string): Promise<WorkoutRecord[]> {
  return db.workouts.where("date").equals(date).reverse().sortBy("startTime");
}

export async function getRecentWorkouts(limit: number = 10): Promise<WorkoutRecord[]> {
  return db.workouts.orderBy("startTime").reverse().limit(limit).toArray();
}

export async function deleteWorkoutRecord(id: number): Promise<void> {
  await db.workouts.delete(id);
}

// ─── Journal Entries CRUD ───────────────────────────────────

export async function addJournalEntry(entry: Omit<JournalEntry, "id" | "createdAt">): Promise<number> {
  return db.journalEntries.add({ ...entry, createdAt: Date.now() });
}

export async function getJournalEntriesByDate(date: string): Promise<JournalEntry[]> {
  return db.journalEntries.where("date").equals(date).reverse().sortBy("timestamp");
}

export async function getRecentJournalEntries(limit: number = 30): Promise<JournalEntry[]> {
  return db.journalEntries.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function deleteJournalEntry(id: number): Promise<void> {
  await db.journalEntries.delete(id);
}

// ─── Training Plans CRUD ────────────────────────────────────

export async function addTrainingPlan(plan: Omit<TrainingPlan, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.trainingPlans.add({ ...plan, createdAt: now, updatedAt: now });
}

export async function updateTrainingPlan(id: number, updates: Partial<TrainingPlan>): Promise<void> {
  await db.trainingPlans.update(id, { ...updates, updatedAt: Date.now() });
}

export async function getAllTrainingPlans(): Promise<TrainingPlan[]> {
  return db.trainingPlans.orderBy("createdAt").reverse().toArray();
}

export async function getTrainingPlanById(id: number): Promise<TrainingPlan | undefined> {
  return db.trainingPlans.get(id);
}

export async function deleteTrainingPlan(id: number): Promise<void> {
  await db.transaction("rw", [db.trainingPlans, db.trainingExercises], async () => {
    await db.trainingExercises.where("planId").equals(id).delete();
    await db.trainingPlans.delete(id);
  });
}

// ─── Training Exercises CRUD ────────────────────────────────

export async function addTrainingExercise(exercise: Omit<TrainingExercise, "id">): Promise<number> {
  return db.trainingExercises.add(exercise);
}

export async function getExercisesByPlan(planId: number): Promise<TrainingExercise[]> {
  return db.trainingExercises.where("planId").equals(planId).sortBy("order");
}

export async function deleteTrainingExercise(id: number): Promise<void> {
  await db.trainingExercises.delete(id);
}

// ─── Daily Metrics CRUD ─────────────────────────────────────

export async function addOrUpdateDailyMetrics(metrics: Omit<DailyMetrics, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const existing = await db.dailyMetrics.where("date").equals(metrics.date).first();
  
  if (existing) {
    await db.dailyMetrics.update(existing.id!, { ...metrics, updatedAt: Date.now() });
    return existing.id!;
  }
  
  const now = Date.now();
  return db.dailyMetrics.add({ ...metrics, createdAt: now, updatedAt: now });
}

export async function getDailyMetricsByDate(date: string): Promise<DailyMetrics | undefined> {
  return db.dailyMetrics.where("date").equals(date).first();
}

export async function getRecentDailyMetrics(days: number = 7): Promise<DailyMetrics[]> {
  const results: DailyMetrics[] = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = getLocalDateStr(date);
    const metrics = await getDailyMetricsByDate(dateStr);
    if (metrics) {
      results.push(metrics);
    }
  }
  
  return results;
}

// ==================== 自定义训练计划 CRUD ====================

export async function addCustomTrainingPlan(plan: Omit<CustomTrainingPlan, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.customTrainingPlans.add({ ...plan, createdAt: now, updatedAt: now });
}

export async function updateCustomTrainingPlan(id: number, updates: Partial<CustomTrainingPlan>): Promise<void> {
  await db.customTrainingPlans.update(id, { ...updates, updatedAt: Date.now() });
}

export async function getAllCustomTrainingPlans(): Promise<CustomTrainingPlan[]> {
  return db.customTrainingPlans.orderBy("createdAt").reverse().toArray();
}

export async function getCustomTrainingPlansByType(type: 'muscle_building' | 'fat_loss' | 'cardio'): Promise<CustomTrainingPlan[]> {
  const plans = await db.customTrainingPlans.where("type").equals(type).toArray();
  return plans.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCustomTrainingPlanById(id: number): Promise<CustomTrainingPlan | undefined> {
  return db.customTrainingPlans.get(id);
}

export async function deleteCustomTrainingPlan(id: number): Promise<void> {
  await db.customTrainingPlans.delete(id);
}

// ─── Exercise Library CRUD ────────────────────────────────────

export async function addExercise(exercise: Omit<Exercise, "id" | "createdAt">): Promise<number> {
  return db.exercises.add({ ...exercise, createdAt: Date.now() });
}

export async function getAllExercises(): Promise<Exercise[]> {
  return db.exercises.toArray();
}

export async function getExercisesByCategory(category: string): Promise<Exercise[]> {
  return db.exercises.where("category").equals(category).toArray();
}

export async function deleteExercise(id: number): Promise<void> {
  await db.exercises.delete(id);
}

export async function createTask(task: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.tasks.add({ ...task, createdAt: now, updatedAt: now });
}

export async function getTask(id: number): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteTask(id: number): Promise<void> {
  const task = await db.tasks.get(id);
  if (task) {
    await db.tasks.update(id, { status: "archived" });
    await db.trashStore.add({
      originalTable: "tasks",
      originalId: id,
      data: task as unknown as Record<string, unknown>,
      deletedAt: Date.now(),
    });
  }
}

export async function restoreTask(id: number): Promise<void> {
  await db.tasks.update(id, { status: "active" });
  await db.trashStore.delete(id);
}

export async function getTimeSegments(taskId: number): Promise<TimeSegment[]> {
  return db.timeSegments.where("taskId").equals(taskId).toArray();
}

export async function addTimeSegment(taskId: number, startTime: number, endTime: number): Promise<number> {
  return db.timeSegments.add({ taskId, startTime, endTime, createdAt: Date.now() });
}

export async function deleteTimeSegment(id: number): Promise<void> {
  await db.timeSegments.delete(id);
}

export async function getTasksByType(type: string): Promise<Task[]> {
  return db.tasks.where("type").equals(type).toArray();
}

export async function getTasksForInbox(): Promise<Task[]> {
  return db.tasks.where("status").equals("active").toArray();
}

export async function getTasksBySection(sectionId: number): Promise<Task[]> {
  return db.tasks.where("sectionId").equals(sectionId).toArray();
}

export async function getTasksByTimeRange(startTime: number, endTime: number): Promise<Task[]> {
  return db.tasks
    .where("startTime")
    .between(startTime, endTime)
    .toArray();
}

export async function getAllProjects(): Promise<LegacyProject[]> {
  return db.projects.toArray();
}

export async function getTimeSegmentsByDateRange(startTime: number, endTime: number): Promise<TimeSegment[]> {
  return db.timeSegments
    .where("startTime")
    .between(startTime, endTime)
    .toArray();
}

export async function createSection(name: string, boardId?: number, sectionData?: Partial<Omit<Section, "id" | "createdAt" | "name" | "boardId">>): Promise<number> {
  return db.plans.add({
    goalId: boardId ?? 0,
    name,
    weight: 1,
    status: "active" as const,
    progress: 0,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...sectionData,
  });
}

export async function updateSection(id: number, updates: Partial<Section>): Promise<void> {
  const planUpdates: Partial<{ name: string; weight: number; order: number }> = {};
  if (updates.name !== undefined) planUpdates.name = updates.name;
  if (updates.stageIndex !== undefined) planUpdates.order = updates.stageIndex;
  await db.plans.update(id, planUpdates);
}

export async function getAllProjectsV2(): Promise<ProjectV2[]> {
  return db.projectV2s.toArray();
}

export async function getBoardsByProject(projectId: number): Promise<Board[]> {
  const goals = await db.goals.where("projectId").equals(projectId).toArray();
  return goals.map(g => ({
    id: g.id,
    name: g.name,
    projectId: g.projectId,
    createdAt: g.createdAt,
  }));
}

export async function getSectionsByBoard(boardId: number): Promise<Section[]> {
  const plans = await db.plans.where("goalId").equals(boardId).toArray();
  return plans.map(p => ({
    id: p.id,
    name: p.name,
    boardId: p.goalId,
    stageIndex: p.order,
    createdAt: p.createdAt,
  }));
}

export async function getProjectV2(id: number): Promise<ProjectV2 | undefined> {
  return db.projectV2s.get(id);
}

export async function getBoard(id: number): Promise<Board | undefined> {
  const goal = await db.goals.get(id);
  if (!goal) return undefined;
  return {
    id: goal.id,
    name: goal.name,
    projectId: goal.projectId,
    createdAt: goal.createdAt,
  };
}

export async function getSection(id: number): Promise<Section | undefined> {
  const plan = await db.plans.get(id);
  if (!plan) return undefined;
  return {
    id: plan.id,
    name: plan.name,
    boardId: plan.goalId,
    stageIndex: plan.order,
    createdAt: plan.createdAt,
  };
}

export async function getPluginsForNavbar(): Promise<PluginMetadata[]> {
  return db.pluginsMeta.where("status").equals("active").toArray();
}

export async function getInboxItems(): Promise<CaptureItem[]> {
  return db.capture.toArray();
}

// 将捕捉记录转为任务
export async function captureToTask(
  captureId: number,
  options: {
    startTime?: number;
    endTime?: number;
    priority?: Task["priority"];
  }
): Promise<number> {
  const capture = await db.capture.get(captureId);
  if (!capture) throw new Error("Capture item not found");

  const today = new Date();
  const taskStart = options.startTime ?? new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const taskEnd = options.endTime ?? taskStart + 24 * 60 * 60 * 1000;

  const taskId = await createTask({
    title: capture.content,
    type: "daily",
    status: "active",
    priority: options.priority ?? "not-urgent-important",
    tags: capture.tags || [],
    startTime: taskStart,
    endTime: taskEnd,
  });

  // 从收件箱移除该条捕捉记录
  await db.capture.delete(captureId);

  return taskId;
}

export async function getEventsByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]> {
  return db.events
    .where("startTime")
    .between(startTime, endTime)
    .toArray();
}

export async function getFocusLogsByTimeRange(startTime: number, endTime: number): Promise<FocusLog[]> {
  return db.focusLogs
    .where("startTime")
    .between(startTime, endTime)
    .toArray();
}

export async function createEvent(event: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">): Promise<number> {
  return db.events.add({ ...event, createdAt: Date.now(), updatedAt: Date.now() });
}

export async function checkStorageSpace(): Promise<{ usage: number; limit: number; percentage: number; isCritical: boolean; isWarning: boolean; percentUsed: number }> {
  return {
    usage: 0,
    limit: 100 * 1024 * 1024,
    percentage: 0,
    isCritical: false,
    isWarning: false,
    percentUsed: 0,
  };
}

export async function getWeeklyTaskStats(): Promise<{ completed: number; active: number; total: number }> {
  const completed = await db.tasks.where("status").equals("done").count();
  const active = await db.tasks.where("status").equals("active").count();
  const total = await db.tasks.count();
  return { completed, active, total };
}

export async function getActiveSchedulableTasks(): Promise<Task[]> {
  return db.tasks.where("status").equals("active").toArray();
}

export async function getReviewRecords(): Promise<ReviewRecord[]> {
  return db.reviewRecords.toArray();
}

export async function createReviewRecord(record: Omit<ReviewRecord, "id" | "createdAt">): Promise<number> {
  return db.reviewRecords.add({ ...record, createdAt: Date.now() });
}

export async function getReviewRecordByKey(key: string): Promise<ReviewRecord | undefined> {
  return db.reviewRecords.where("reviewKey").equals(key).first();
}

export async function getReviewRecordByPeriod(
  periodType: string,
  periodStart: number,
  periodEnd: number
): Promise<ReviewRecord | undefined> {
  return db.reviewRecords
    .where("periodType")
    .equals(periodType)
    .and((r) => r.periodStart === periodStart && r.periodEnd === periodEnd)
    .first();
}

export async function createOrUpdateReviewRecord(
  record: Omit<ReviewRecord, "id" | "createdAt">
): Promise<number> {
  const now = Date.now();
  const existing = await db.reviewRecords
    .where("dateKey")
    .equals(record.dateKey)
    .first();

  if (existing && existing.id !== undefined) {
    await db.reviewRecords.update(existing.id, {
      ...record,
      updatedAt: now,
    });
    return existing.id;
  }

  return db.reviewRecords.add({
    ...record,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getReviewRecordsByRange(
  start: number,
  end: number
): Promise<ReviewRecord[]> {
  return db.reviewRecords
    .where("createdAt")
    .between(start, end)
    .toArray();
}

export async function getMonthlyTaskStats(year?: number, month?: number): Promise<{ completed: number; active: number; new: number }> {
  let tasks: Task[];
  
  if (year && month) {
    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();
    
    tasks = await db.tasks
      .where("createdAt")
      .between(startOfMonth, endOfMonth)
      .toArray();
  } else {
    tasks = await db.tasks.toArray();
  }
  
  const completed = tasks.filter(t => t.status === "done").length;
  const active = tasks.filter(t => t.status === "active").length;
  
  return { completed, active, new: tasks.length };
}

export async function getMonthlyHabitStats(year?: number, month?: number): Promise<{ completed: number; total: number; streak: number }> {
  let logs: HabitLog[];
  
  if (year && month) {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    logs = await db.habit_logs
      .where("date")
      .startsWith(monthStr)
      .toArray();
  } else {
    logs = await db.habit_logs.toArray();
  }
  
  const totalHabits = await db.tasks.where("type").equals("habit").count();
  
  return { 
    completed: logs.length, 
    total: totalHabits, 
    streak: 0 
  };
}

export async function getMonthlyFinanceStats(year?: number, month?: number): Promise<{ income: number; expense: number; balance: number }> {
  let records: FinRecord[];
  
  if (year && month) {
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    records = await db.finRecords
      .where("date")
      .startsWith(monthStr)
      .toArray();
  } else {
    records = await db.finRecords.toArray();
  }
  
  const income = records.filter(r => r.type === "income").reduce((sum, r) => sum + r.amount, 0);
  const expense = records.filter(r => r.type === "expense").reduce((sum, r) => sum + r.amount, 0);
  
  return { income, expense, balance: income - expense };
}

export async function initBuiltInPlugins(): Promise<void> {
}

export async function getAllPluginsMeta(): Promise<PluginMetadata[]> {
  return db.pluginsMeta.toArray();
}

export async function updatePluginMetaStatus(id: number, status: PluginMetadata["status"]): Promise<void> {
  await db.pluginsMeta.update(id, { status });
}

export async function updatePluginMetaShowInNavbar(id: number, showInNavbar: boolean): Promise<void> {
  await db.pluginsMeta.update(id, { showInNavbar });
}

export async function createProjectV2(
  name: string,
  color?: string
): Promise<number> {
  const projectId = await db.projectV2s.add({ 
    name, 
    color,
    createdAt: Date.now() 
  });
  
  // Auto-create a default Board and Section for the new project
  const boardId = await createBoard("默认", projectId);
  await createSection("默认", boardId);
  
  return projectId;
}

export async function updateProjectV2(id: number, updates: Partial<ProjectV2>): Promise<void> {
  await db.projectV2s.update(id, updates);
}

export async function deleteProjectToTrash(id: number): Promise<void> {
  await db.projectV2s.delete(id);
}

export async function createBoard(
  name: string,
  projectId?: number
): Promise<number> {
  return db.goals.add({
    projectId: projectId ?? 0,
    name,
    description: "",
    type: "task" as const,
    status: "active" as const,
    progress: 0,
    progressLocked: false,
    tags: [],
    weight: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updateBoard(id: number, updates: Partial<Board>): Promise<void> {
  const goalUpdates: Partial<{ name: string; description: string; tags: string[] }> = {};
  if (updates.name !== undefined) goalUpdates.name = updates.name;
  if (updates.stages !== undefined) goalUpdates.description = JSON.stringify(updates.stages);
  await db.goals.update(id, goalUpdates);
}

export async function deleteBoardToTrash(id: number): Promise<void> {
  await db.transaction("rw", [db.goals, db.plans, db.tasks], async (tx) => {
    const plans = await tx.table("plans").where("goalId").equals(id).toArray();
    for (const plan of plans) {
      await tx.table("tasks").where("planId").equals(plan.id!).delete();
    }
    await tx.table("plans").where("goalId").equals(id).delete();
    await tx.table("goals").delete(id);
  });
}

export async function deleteSectionToTrash(id: number): Promise<void> {
  await db.transaction("rw", [db.plans, db.tasks], async (tx) => {
    await tx.table("tasks").where("planId").equals(id).delete();
    await tx.table("plans").delete(id);
  });
}

export async function createGoal(goalData: Omit<Goal, "id" | "createdAt" | "updatedAt">): Promise<number> {
  return db.goals.add({
    ...goalData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updateGoal(id: number, updates: Partial<Goal>): Promise<void> {
  await db.goals.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteGoal(id: number, moveTasksToUnclassified: boolean = true): Promise<void> {
  await db.transaction("rw", [db.goals, db.plans, db.tasks], async (tx) => {
    const plans = await tx.table("plans").where("goalId").equals(id).toArray();
    for (const plan of plans) {
      if (moveTasksToUnclassified) {
        const planTasks = await tx.table("tasks").where("planId").equals(plan.id!).toArray();
        for (const task of planTasks) {
          await tx.table("tasks").update(task.id!, { planId: undefined, goalId: undefined });
        }
      } else {
        await tx.table("tasks").where("planId").equals(plan.id!).delete();
      }
    }
    await tx.table("plans").where("goalId").equals(id).delete();
    if (moveTasksToUnclassified) {
      const goalTasks = await tx.table("tasks").where("goalId").equals(id).toArray();
      for (const task of goalTasks) {
        await tx.table("tasks").update(task.id!, { goalId: undefined });
      }
    } else {
      await tx.table("tasks").where("goalId").equals(id).delete();
    }
    await tx.table("goals").delete(id);
  });
}

export async function getGoalsByProject(projectId: number): Promise<Goal[]> {
  return db.goals.where("projectId").equals(projectId).toArray();
}

export async function getGoal(id: number): Promise<Goal | undefined> {
  return db.goals.get(id);
}

export async function createPlan(planData: Omit<Plan, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const plans = await db.plans.where("goalId").equals(planData.goalId).sortBy("order");
  const maxOrder = plans.length > 0 ? plans[plans.length - 1].order : -1;
  return db.plans.add({
    ...planData,
    order: maxOrder + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updatePlan(id: number, updates: Partial<Plan>): Promise<void> {
  await db.plans.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deletePlan(id: number, moveTasksToUnclassified: boolean = true): Promise<void> {
  await db.transaction("rw", [db.plans, db.tasks], async (tx) => {
    if (moveTasksToUnclassified) {
      const plan = await tx.table("plans").get(id);
      if (plan) {
        const planTasks = await tx.table("tasks").where("planId").equals(id).toArray();
        for (const task of planTasks) {
          await tx.table("tasks").update(task.id!, { planId: undefined });
        }
      }
    } else {
      await tx.table("tasks").where("planId").equals(id).delete();
    }
    await tx.table("plans").delete(id);
  });
}

export async function getPlansByGoal(goalId: number): Promise<Plan[]> {
  return db.plans.where("goalId").equals(goalId).sortBy("order");
}

export async function getPlan(id: number): Promise<Plan | undefined> {
  return db.plans.get(id);
}

export async function getUnassignedTasks(): Promise<Task[]> {
  return db.tasks.filter(t => t.planId === undefined || t.planId === null).toArray();
}

export async function assignTasksToPlan(taskIds: number[], planId: number): Promise<void> {
  const plan = await db.plans.get(planId);
  if (!plan) return;
  
  await db.transaction("rw", [db.tasks], async (tx) => {
    for (const taskId of taskIds) {
      await tx.table("tasks").update(taskId, {
        planId,
        goalId: plan.goalId,
        updatedAt: Date.now(),
      });
    }
  });
}

export async function getAllGoals(): Promise<Goal[]> {
  return db.goals.toArray();
}

export async function getAllPlans(): Promise<Plan[]> {
  return db.plans.toArray();
}

export async function exportAllData(): Promise<string> {
  const tables = [
    "capture",
    "events",
    "focusLogs",
    "tasks",
    "habit_logs",
    "projects",
    "timeSegments",
    "trashStore",
    "projectV2s",
    "boards",
    "sections",
    "pluginsMeta",
    "agentMemory",
    "agentChats",
    "muscleGroups",
    "subMuscles",
    "presetExercises",
    "muscleRecords",
    "bodyMetricRecords",
    "sleepRecords",
    "nutritionRecords",
    "recoveryRecords",
    "enduranceRecords",
    "goals",
    "plans",
    "userSettings",
    "dailyWaterRecords",
    "dailySelfAssessments",
    "finRecords",
    "finAccounts",
    "finBudgets",
    "reviewRecords",
    "reminders",
    "reminderLogs",
    "healthRecords",
    "workouts",
    "journalEntries",
    "trainingPlans",
    "trainingExercises",
    "dailyMetrics",
    "dailyHealthRecords",
    "customTrainingPlans",
    "scheduleTemplates",
    "scheduleEvents",
    "daySchedules",
    "exercises",
    "goalTemplates",
    "customGoalTypes",
    "correlationReports",
  ];

  const data: Record<string, unknown[]> = {};

  for (const table of tables) {
    try {
      data[table] = await (db as any)[table].toArray();
    } catch (error) {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.warn(`Failed to export table ${table}:`, error);
      }
      data[table] = [];
    }
  }

  return JSON.stringify({
    version: 29,
    exportedAt: new Date().toISOString(),
    data,
  }, null, 2);
}

export async function importAllData(data: any): Promise<void> {
  // Handle wrapper format: { version, exportedAt, data } vs old plain data
  const version = data?.version;
  const parsedData = version != null ? data.data : data;

  const tables = [
    "capture",
    "events",
    "focusLogs",
    "tasks",
    "habit_logs",
    "projects",
    "timeSegments",
    "trashStore",
    "projectV2s",
    "boards",
    "sections",
    "pluginsMeta",
    "agentMemory",
    "agentChats",
    "muscleGroups",
    "subMuscles",
    "presetExercises",
    "muscleRecords",
    "bodyMetricRecords",
    "sleepRecords",
    "nutritionRecords",
    "recoveryRecords",
    "enduranceRecords",
    "goals",
    "plans",
    "userSettings",
    "dailyWaterRecords",
    "dailySelfAssessments",
    "finRecords",
    "finAccounts",
    "finBudgets",
    "reviewRecords",
    "reminders",
    "reminderLogs",
    "healthRecords",
    "workouts",
    "journalEntries",
    "trainingPlans",
    "trainingExercises",
    "dailyMetrics",
    "dailyHealthRecords",
    "customTrainingPlans",
    "scheduleTemplates",
    "scheduleEvents",
    "daySchedules",
    "exercises",
    "goalTemplates",
    "customGoalTypes",
    "correlationReports",
  ];

  await db.transaction("rw", tables.map(t => (db as any)[t]), async () => {
    // Clear all tables first to avoid duplicates
    for (const table of tables) {
      try {
        await (db as any)[table].clear();
      } catch (error) {
        if (typeof window !== "undefined" && window.location.hostname === "localhost") {
          console.warn(`Failed to clear table ${table}:`, error);
        }
      }
    }

    // Import data
    for (const table of tables) {
      if (parsedData[table] && Array.isArray(parsedData[table])) {
        const tableData = parsedData[table];
        for (const item of tableData) {
          try {
            await (db as any)[table].add(item);
          } catch (error) {
            if (typeof window !== "undefined" && window.location.hostname === "localhost") {
              console.warn(`Failed to import item to table ${table}:`, error);
            }
          }
        }
      }
    }
  });

  // Recalculate progress to trigger migration and calibration
  await recalculateAllProgress();
}

export async function getTrashItems(): Promise<TrashItem[]> {
  return db.trashStore.toArray();
}

export async function restoreFromTrash(id: number): Promise<void> {
  const item = await db.trashStore.get(id);
  if (item) {
    await db.trashStore.delete(id);
  }
}

export async function purgeFromTrash(id: number): Promise<void> {
  await db.trashStore.delete(id);
}

export async function autoCleanupTrash(days: number = 30): Promise<void> {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  await db.trashStore.where("deletedAt").below(cutoff).delete();
}

// ==================== 提醒相关函数 ====================

export async function getPendingReminders(): Promise<Reminder[]> {
  return db.reminders
    .where("status")
    .equals("pending")
    .toArray();
}

export async function updateReminderStatus(
  id: number,
  status: Reminder["status"],
  snoozeUntil?: number
): Promise<void> {
  await db.reminders.update(id, { status, snoozeUntil, updatedAt: Date.now() });
}

export async function addReminderLog(
  reminderId: number,
  action: ReminderLog["action"]
): Promise<number> {
  return db.reminderLogs.add({
    reminderId,
    action,
    timestamp: Date.now(),
  });
}

// ==================== 财务相关函数 ====================

export async function addFinRecord(
  record: Omit<FinRecord, "id" | "createdAt">
): Promise<number> {
  return db.finRecords.add({ ...record, createdAt: Date.now() });
}

export async function getFinRecordsByMonth(year: number, month: number, accountId?: number): Promise<FinRecord[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  let query = db.finRecords.where("date").between(startDate, endDate, true, false);
  
  if (accountId !== undefined) {
    query = query.filter(record => record.accountId === accountId);
  }
  
  return query.toArray();
}

export async function deleteFinRecord(id: number): Promise<void> {
  await db.finRecords.delete(id);
}

export async function updateFinRecord(id: number, changes: Partial<Omit<FinRecord, "id" | "createdAt">>): Promise<void> {
  await db.finRecords.update(id, changes as Record<string, unknown>);
}

export async function getFinAccounts(): Promise<FinAccount[]> {
  return db.finAccounts.toArray();
}

export async function createFinAccount(
  name: string,
  initialBalance: number
): Promise<number> {
  return db.finAccounts.add({ 
    name, 
    initialBalance,
    createdAt: Date.now() 
  });
}

export async function deleteFinAccount(id: number): Promise<void> {
  await db.finAccounts.delete(id);
}

// ==================== 焦点日志相关函数 ====================

export async function createFocusLog(
  eventId: number,
  startTime?: number,
  duration?: number
): Promise<number> {
  const log: Omit<FocusLog, "id" | "createdAt"> = {
    eventId,
    startTime: startTime || Date.now(),
    duration: duration || 0,
    interruptions: 0,
    completed: false,
  };
  return db.focusLogs.add({ ...log, createdAt: Date.now() });
}

export async function updateFocusLog(
  id: number,
  updates: Partial<FocusLog>
): Promise<void> {
  await db.focusLogs.update(id, updates);
}

export async function getPluginMeta(name: string): Promise<PluginMetadata | undefined> {
  return db.pluginsMeta.where("name").equals(name).first();
}

// ==================== 肌肉层级管理 CRUD ====================

// 大肌群 CRUD
export async function getAllMuscleGroups(): Promise<MuscleGroup[]> {
  return db.muscleGroups.orderBy("order").toArray();
}

export async function addMuscleGroup(group: Omit<MuscleGroup, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.muscleGroups.add({ ...group, createdAt: now, updatedAt: now });
}

export async function updateMuscleGroup(id: number, updates: Partial<MuscleGroup>): Promise<void> {
  await db.muscleGroups.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteMuscleGroup(id: number): Promise<void> {
  await db.transaction("rw", [db.muscleGroups, db.subMuscles, db.muscleRecords], async () => {
    // 删除所有相关的小肌肉
    await db.subMuscles.where("muscleGroupId").equals(id).delete();
    // 删除所有相关的训练记录
    const subMuscles = await db.subMuscles.where("muscleGroupId").equals(id).toArray();
    for (const sub of subMuscles) {
      await db.muscleRecords.where("subMuscleId").equals(sub.id!).delete();
    }
    // 删除大肌群
    await db.muscleGroups.delete(id);
  });
}

// 小肌肉 CRUD
export async function getSubMusclesByGroup(muscleGroupId: number): Promise<SubMuscle[]> {
  return db.subMuscles.where("muscleGroupId").equals(muscleGroupId).sortBy("order");
}

export async function getAllSubMuscles(): Promise<SubMuscle[]> {
  return db.subMuscles.orderBy("order").toArray();
}

export async function addSubMuscle(subMuscle: Omit<SubMuscle, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.subMuscles.add({ ...subMuscle, createdAt: now, updatedAt: now });
}

export async function updateSubMuscle(id: number, updates: Partial<SubMuscle>): Promise<void> {
  await db.subMuscles.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteSubMuscle(id: number): Promise<void> {
  await db.transaction("rw", [db.subMuscles, db.muscleRecords, db.presetExercises], async () => {
    // 删除所有相关的训练记录
    await db.muscleRecords.where("subMuscleId").equals(id).delete();
    // 删除所有相关的预设动作
    await db.presetExercises.where("subMuscleId").equals(id).delete();
    // 删除小肌肉
    await db.subMuscles.delete(id);
  });
}

// 预设动作 CRUD
export async function getPresetExercisesBySubMuscle(subMuscleId: number): Promise<PresetExercise[]> {
  return db.presetExercises.where("subMuscleId").equals(subMuscleId).toArray();
}

export async function getAllPresetExercises(): Promise<PresetExercise[]> {
  return db.presetExercises.toArray();
}

export async function addPresetExercise(exercise: Omit<PresetExercise, "id" | "createdAt">): Promise<number> {
  return db.presetExercises.add({ ...exercise, createdAt: Date.now() });
}

export async function deletePresetExercise(id: number): Promise<void> {
  await db.presetExercises.delete(id);
}

// 训练记录 CRUD
export async function addMuscleRecord(record: Omit<MuscleRecord, "id" | "createdAt">): Promise<number> {
  // 检查是否是个人最佳
  const existingRecords = await db.muscleRecords
    .where("exerciseName")
    .equals(record.exerciseName)
    .toArray();
  
  const isPersonalBest = existingRecords.every(r => r.weight < record.weight);
  
  return db.muscleRecords.add({ 
    ...record, 
    createdAt: Date.now(),
    isPersonalBest,
  });
}

export async function getMuscleRecordsByDate(date: string): Promise<MuscleRecord[]> {
  return db.muscleRecords.where("date").equals(date).reverse().sortBy("timestamp");
}

export async function getMuscleRecordsBySubMuscle(subMuscleId: number): Promise<MuscleRecord[]> {
  return db.muscleRecords.where("subMuscleId").equals(subMuscleId).reverse().sortBy("timestamp");
}

export async function getMuscleRecordsByExercise(exerciseName: string): Promise<MuscleRecord[]> {
  return db.muscleRecords.where("exerciseName").equals(exerciseName).reverse().sortBy("timestamp");
}

export async function getRecentMuscleRecords(limit: number = 30): Promise<MuscleRecord[]> {
  return db.muscleRecords.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getMuscleRecordsByDateRange(startDate: string, endDate: string): Promise<MuscleRecord[]> {
  return db.muscleRecords
    .where("date")
    .between(startDate, endDate)
    .reverse()
    .sortBy("timestamp");
}

export async function updateMuscleRecord(id: number, updates: Partial<MuscleRecord>): Promise<void> {
  await db.muscleRecords.update(id, updates);
}

export async function deleteMuscleRecord(id: number): Promise<void> {
  await db.muscleRecords.delete(id);
}

export async function getPersonalBest(exerciseName: string): Promise<MuscleRecord | undefined> {
  return db.muscleRecords
    .where("exerciseName")
    .equals(exerciseName)
    .filter(r => r.isPersonalBest === true)
    .first();
}

// ==================== 身体数据记录 CRUD ====================

export async function addBodyMetricRecord(record: Omit<BodyMetricRecord, "id" | "createdAt">): Promise<number> {
  // 检查是否是个人最佳
  const existingRecords = await db.bodyMetricRecords
    .where("type")
    .equals(record.type)
    .toArray();
  
  const isPersonalBest = existingRecords.every(r => {
    if (record.type === 'bloodPressure') {
      return r.value < record.value;
    }
    return r.value < record.value;
  });
  
  return db.bodyMetricRecords.add({ 
    ...record, 
    createdAt: Date.now(),
    isPersonalBest,
  });
}

export async function getBodyMetricRecordsByDate(date: string): Promise<BodyMetricRecord[]> {
  return db.bodyMetricRecords.where("date").equals(date).toArray();
}

export async function getBodyMetricRecordsByType(type: BodyMetricRecord['type']): Promise<BodyMetricRecord[]> {
  return db.bodyMetricRecords.where("type").equals(type).reverse().sortBy("timestamp");
}

export async function getRecentBodyMetricRecords(type: BodyMetricRecord['type'], limit: number = 30): Promise<BodyMetricRecord[]> {
  return db.bodyMetricRecords
    .where("type")
    .equals(type)
    .reverse()
    .sortBy("timestamp")
    .then(records => records.slice(0, limit));
}

export async function deleteBodyMetricRecord(id: number): Promise<void> {
  await db.bodyMetricRecords.delete(id);
}

// ==================== 睡眠记录 CRUD ====================

export async function addSleepRecord(record: Omit<SleepRecord, "id" | "createdAt">): Promise<number> {
  // 检查是否是最佳睡眠
  const existingRecords = await db.sleepRecords.toArray();
  const isPersonalBest = existingRecords.every(r => r.sleepDuration < record.sleepDuration);
  
  return db.sleepRecords.add({ 
    ...record, 
    createdAt: Date.now(),
    isPersonalBest,
  });
}

export async function getSleepRecordsByDate(date: string): Promise<SleepRecord[]> {
  return db.sleepRecords.where("date").equals(date).toArray();
}

export async function getRecentSleepRecords(limit: number = 30): Promise<SleepRecord[]> {
  return db.sleepRecords.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getSleepRecordsByDateRange(startDate: string, endDate: string): Promise<SleepRecord[]> {
  return db.sleepRecords
    .where("date")
    .between(startDate, endDate)
    .reverse()
    .sortBy("timestamp");
}

export async function updateSleepRecord(id: number, updates: Partial<SleepRecord>): Promise<void> {
  await db.sleepRecords.update(id, updates);
}

export async function deleteSleepRecord(id: number): Promise<void> {
  await db.sleepRecords.delete(id);
}

// ==================== 营养记录 CRUD ====================

export async function addNutritionRecord(record: Omit<NutritionRecord, "id" | "createdAt">): Promise<number> {
  return db.nutritionRecords.add({ ...record, createdAt: Date.now() });
}

export async function getNutritionRecordsByDate(date: string): Promise<NutritionRecord[]> {
  return db.nutritionRecords.where("date").equals(date).toArray();
}

export async function getRecentNutritionRecords(limit: number = 30): Promise<NutritionRecord[]> {
  return db.nutritionRecords.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getNutritionRecordsByDateRange(startDate: string, endDate: string): Promise<NutritionRecord[]> {
  return db.nutritionRecords
    .where("date")
    .between(startDate, endDate)
    .reverse()
    .sortBy("timestamp");
}

export async function updateNutritionRecord(id: number, updates: Partial<NutritionRecord>): Promise<void> {
  await db.nutritionRecords.update(id, updates);
}

export async function deleteNutritionRecord(id: number): Promise<void> {
  await db.nutritionRecords.delete(id);
}

// ==================== 恢复记录 CRUD ====================

export async function addRecoveryRecord(record: Omit<RecoveryRecord, "id" | "createdAt">): Promise<number> {
  return db.recoveryRecords.add({ ...record, createdAt: Date.now() });
}

export async function getRecoveryRecordsByDate(date: string): Promise<RecoveryRecord[]> {
  return db.recoveryRecords.where("date").equals(date).toArray();
}

export async function getRecentRecoveryRecords(limit: number = 30): Promise<RecoveryRecord[]> {
  return db.recoveryRecords.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getRecoveryRecordsByDateRange(startDate: string, endDate: string): Promise<RecoveryRecord[]> {
  return db.recoveryRecords
    .where("date")
    .between(startDate, endDate)
    .reverse()
    .sortBy("timestamp");
}

export async function updateRecoveryRecord(id: number, updates: Partial<RecoveryRecord>): Promise<void> {
  await db.recoveryRecords.update(id, updates);
}

export async function deleteRecoveryRecord(id: number): Promise<void> {
  await db.recoveryRecords.delete(id);
}

// ==================== 耐力测试记录 CRUD ====================

export async function addEnduranceRecord(record: Omit<EnduranceRecord, "id" | "createdAt">): Promise<number> {
  // 检查是否是个人最佳
  const existingRecords = await db.enduranceRecords
    .where("type")
    .equals(record.type)
    .toArray();
  
  const isPersonalBest = existingRecords.every(r => r.value < record.value);
  
  return db.enduranceRecords.add({ 
    ...record, 
    createdAt: Date.now(),
    isPersonalBest,
  });
}

export async function getEnduranceRecordsByDate(date: string): Promise<EnduranceRecord[]> {
  return db.enduranceRecords.where("date").equals(date).toArray();
}

export async function getEnduranceRecordsByType(type: EnduranceRecord['type']): Promise<EnduranceRecord[]> {
  return db.enduranceRecords.where("type").equals(type).reverse().sortBy("timestamp");
}

export async function getRecentEnduranceRecords(type: EnduranceRecord['type'], limit: number = 30): Promise<EnduranceRecord[]> {
  return db.enduranceRecords
    .where("type")
    .equals(type)
    .reverse()
    .sortBy("timestamp")
    .then(records => records.slice(0, limit));
}

export async function deleteEnduranceRecord(id: number): Promise<void> {
  await db.enduranceRecords.delete(id);
}

// ==================== 数据初始化 ====================

export async function initializeMuscleData(): Promise<void> {
  const existingGroups = await db.muscleGroups.count();
  
  // 如果已经有数据，检查是否有重复并清理
  if (existingGroups > 0) {
    // 检查是否有重复的肌肉群名称
    const groups = await db.muscleGroups.toArray();
    const seenNames = new Set<string>();
    const duplicates: number[] = [];
    
    for (const group of groups) {
      if (seenNames.has(group.name)) {
        duplicates.push(group.id!);
      } else {
        seenNames.add(group.name);
      }
    }
    
    // 删除重复的肌肉群
    if (duplicates.length > 0) {
      await db.muscleGroups.bulkDelete(duplicates);
      console.log(`Cleaned ${duplicates.length} duplicate muscle groups`);
    }
    
    return; // 已初始化
  }

  const { DEFAULT_MUSCLE_GROUPS, DEFAULT_SUB_MUSCLES, PRESET_EXERCISES } = await import("./types");
  
  await db.transaction("rw", [db.muscleGroups, db.subMuscles, db.presetExercises], async () => {
    // 添加大肌群
    const muscleGroupMap: Record<string, number> = {};
    for (const group of DEFAULT_MUSCLE_GROUPS) {
      const id = await addMuscleGroup(group);
      muscleGroupMap[group.name] = id;
    }
    
    // 添加小肌肉
    const subMuscleMap: Record<string, number> = {};
    for (const [groupName, subMuscles] of Object.entries(DEFAULT_SUB_MUSCLES)) {
      const groupId = muscleGroupMap[groupName];
      if (!groupId) continue;
      
      for (let i = 0; i < subMuscles.length; i++) {
        const subMuscleId = await addSubMuscle({
          muscleGroupId: groupId,
          name: subMuscles[i],
          order: i + 1,
        });
        subMuscleMap[`${groupName}:${subMuscles[i]}`] = subMuscleId;
      }
    }
    
    // 添加预设动作
    for (const exercise of PRESET_EXERCISES) {
      const subMuscleId = subMuscleMap[`${exercise.muscleGroup}:${exercise.subMuscle}`];
      if (!subMuscleId) continue;
      
      await addPresetExercise({
        name: exercise.name,
        subMuscleId,
        equipment: exercise.equipment,
        isCustom: false,
      });
    }
  });
  
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    console.log("[LifeFlowDB] Muscle data initialized");
  }
}

// ==================== 趋势计算 ====================

export async function calculateMuscleTrend(exerciseName: string, days: number = 7): Promise<{
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  recentRecords: MuscleRecord[];
}> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const recentRecords = await getMuscleRecordsByDateRange(startDateStr, endDateStr);
  const filteredRecords = recentRecords.filter(r => r.exerciseName === exerciseName);
  
  if (filteredRecords.length < 2) {
    return { direction: 'stable', changePercent: 0, recentRecords: filteredRecords };
  }
  
  const midpoint = Math.floor(filteredRecords.length / 2);
  const firstHalf = filteredRecords.slice(0, midpoint);
  const secondHalf = filteredRecords.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((sum, r) => sum + r.weight, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, r) => sum + r.weight, 0) / secondHalf.length;
  
  const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (changePercent > 5) direction = 'up';
  else if (changePercent < -5) direction = 'down';
  
  return { direction, changePercent, recentRecords: filteredRecords };
}

export async function calculateWeeklyProgress(): Promise<{
  totalWorkouts: number;
  muscleGroupsCovered: number;
  personalBests: number;
  totalVolume: number;
}> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const recentRecords = await getMuscleRecordsByDateRange(startDateStr, endDateStr);
  
  const uniqueMuscleGroups = new Set<number>();
  const personalBests = recentRecords.filter(r => r.isPersonalBest).length;
  
  let totalVolume = 0;
  for (const record of recentRecords) {
    totalVolume += record.weight * record.sets * record.reps;
  }
  
  // 获取所有小肌肉，然后获取大肌群
  const subMuscles = await db.subMuscles.toArray();
  const subMuscleIds = new Set(recentRecords.map(r => r.subMuscleId));
  
  for (const sub of subMuscles) {
    if (subMuscleIds.has(sub.id!)) {
      uniqueMuscleGroups.add(sub.muscleGroupId);
    }
  }
  
  return {
    totalWorkouts: recentRecords.length,
    muscleGroupsCovered: uniqueMuscleGroups.size,
    personalBests,
    totalVolume,
  };
}

// ==================== 每日健康记录 CRUD ====================

export async function addDailyHealthRecord(record: Omit<DailyHealthRecord, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.dailyHealthRecords.add({
    ...record,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateDailyHealthRecord(id: number, updates: Partial<DailyHealthRecord>): Promise<void> {
  await db.dailyHealthRecords.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function getDailyHealthRecordByDate(date: string): Promise<DailyHealthRecord | undefined> {
  return db.dailyHealthRecords.where("date").equals(date).first();
}

export async function getDailyHealthRecordsByDateRange(startDate: string, endDate: string): Promise<DailyHealthRecord[]> {
  return db.dailyHealthRecords
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getRecentDailyHealthRecords(limit: number = 30): Promise<DailyHealthRecord[]> {
  const allRecords = await db.dailyHealthRecords.orderBy("date").reverse().limit(limit).toArray();
  return allRecords;
}

export async function deleteDailyHealthRecord(id: number): Promise<void> {
  await db.dailyHealthRecords.delete(id);
}

// 获取指标的历史数据（用于趋势图表）
export async function getMetricHistory(
  metric: 'weight' | 'sleepDuration' | 'sleepScore' | 'restingHeartRate' | 
          'bloodOxygen' | 'hrv' | 'vo2Max' | 'sunlightTime' | 'bodyAge' |
          'stressLevel' | 'trainingDuration' | 'caloriesBurned',
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; value: number }>> {
  const records = await db.dailyHealthRecords
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();
  
  return records
    .map(record => ({
      date: record.date,
      value: record[metric] as number
    }))
    .filter(item => item.value !== undefined && item.value !== null);
}

// ==================== 日程模板 CRUD ====================

// 模板
export async function getAllTemplates(): Promise<ScheduleTemplate[]> {
  return db.scheduleTemplates.orderBy("createdAt").toArray();
}

export async function createTemplate(t: Omit<ScheduleTemplate, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.scheduleTemplates.add({ ...t, createdAt: now, updatedAt: now });
}

export async function updateTemplate(id: number, updates: Partial<ScheduleTemplate>): Promise<void> {
  await db.scheduleTemplates.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteTemplate(id: number): Promise<void> {
  await db.transaction("rw", [db.scheduleTemplates, db.scheduleEvents, db.daySchedules], async () => {
    await db.scheduleEvents.where("templateId").equals(id).delete();
    await db.daySchedules.where("templateId").equals(id).delete();
    await db.scheduleTemplates.delete(id);
  });
}

// 模板事件
export async function getEventsByTemplate(templateId: number): Promise<ScheduleEvent[]> {
  return db.scheduleEvents.where("templateId").equals(templateId).sortBy("order");
}

export async function createScheduleEvent(e: Omit<ScheduleEvent, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.scheduleEvents.add({ ...e, createdAt: now, updatedAt: now });
}

export async function updateScheduleEvent(id: number, updates: Partial<ScheduleEvent>): Promise<void> {
  await db.scheduleEvents.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteScheduleEvent(id: number): Promise<void> {
  await db.scheduleEvents.delete(id);
}

export async function deleteEventsByTemplate(templateId: number): Promise<void> {
  await db.scheduleEvents.where("templateId").equals(templateId).delete();
}

// 日程记录
export async function getDaySchedule(date: string): Promise<DaySchedule | undefined> {
  return db.daySchedules.where("date").equals(date).first();
}

export async function saveDaySchedule(ds: Omit<DaySchedule, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const now = Date.now();
  return db.daySchedules.add({ ...ds, createdAt: now, updatedAt: now });
}

export async function updateDaySchedule(id: number, updates: Partial<DaySchedule>): Promise<void> {
  await db.daySchedules.update(id, { ...updates, updatedAt: Date.now() });
}

// 查找某天匹配的模板
export async function findActiveTemplate(date: string): Promise<ScheduleTemplate | null> {
  const templates = await db.scheduleTemplates.toArray();
  for (const t of templates) {
    for (const range of t.dateRanges) {
      if (date >= range.from && date <= range.to) {
        return t;
      }
    }
  }
  return null;
}

// 生成当天日程（如果还没生成）
export async function generateDaySchedule(date: string): Promise<DaySchedule | null> {
  // 先检查是否已存在
  const existing = await getDaySchedule(date);
  if (existing) return existing;

  const template = await findActiveTemplate(date);
  if (!template) return null;

  const events = await getEventsByTemplate(template.id!);
  if (events.length === 0) {
    // Create empty schedule
    const id = await saveDaySchedule({
      date,
      templateId: template.id!,
      events: [],
    });
    return (await db.daySchedules.get(id)) ?? null;
  }

  const dayEvents: import("./types").DayScheduleEvent[] = events.map((e) => ({
    eventId: e.id!,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    note: e.note,
    completed: false,
  }));

  const id = await saveDaySchedule({
    date,
    templateId: template.id!,
    events: dayEvents,
  });

  return (await db.daySchedules.get(id)) ?? null;
}

const DEFAULT_TEMPLATE_EVENTS = [
  { title: "睡觉", startTime: "23:30", endTime: "07:00", note: "", order: 0 },
  { title: "睡觉", startTime: "12:30", endTime: "13:00", note: "", order: 1 },
  { title: "早饭", startTime: "07:30", endTime: "07:50", note: "", order: 2 },
  { title: "午饭", startTime: "11:40", endTime: "12:10", note: "", order: 3 },
  { title: "晚饭", startTime: "17:30", endTime: "18:00", note: "", order: 4 },
];

export async function ensureDefaultTemplate(): Promise<ScheduleTemplate | null> {
  const templates = await db.scheduleTemplates.toArray();
  if (templates.length > 0) return templates[0];

  const now = Date.now();
  const tId = await db.scheduleTemplates.add({
    name: "暑假计划",
    dateRanges: [{ from: "2025-01-01", to: "2099-12-31" }],
    createdAt: now,
    updatedAt: now,
  });

  for (const ev of DEFAULT_TEMPLATE_EVENTS) {
    await db.scheduleEvents.add({
      templateId: tId,
      ...ev,
      createdAt: now,
      updatedAt: now,
    });
  }

  return (await db.scheduleTemplates.get(tId)) ?? null;
}

export async function getAllDaySchedules(): Promise<DaySchedule[]> {
  return db.daySchedules.orderBy("date").reverse().toArray();
}

// ==================== 用户设置 ====================

export async function getUserSettings(): Promise<UserSettings> {
  const existing = await db.userSettings.toArray();
  if (existing.length > 0) return existing[0];
  // 返回默认值
  return {
    sleepTarget: 8,
    napTarget: 0.5,
    weight: 60,
    cupSizes: [200, 300, 500],
    createdAt: Date.now(),
  };
}

export async function saveUserSettings(settings: Partial<UserSettings>): Promise<void> {
  const existing = await db.userSettings.toArray();
  if (existing.length > 0) {
    await db.userSettings.update(existing[0].id!, { ...settings, createdAt: Date.now() });
  } else {
    await db.userSettings.add({
      sleepTarget: settings.sleepTarget ?? 8,
      napTarget: settings.napTarget ?? 0.5,
      weight: settings.weight ?? 60,
      cupSizes: settings.cupSizes ?? [200, 300, 500],
      avatarDataUrl: settings.avatarDataUrl,
      createdAt: Date.now(),
    });
  }
}

// ==================== 每日饮水 ====================

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayWaterRecord(): Promise<DailyWaterRecord | null> {
  const today = getTodayStr();
  const result = await db.dailyWaterRecords.where("date").equals(today).first();
  return result ?? null;
}

export async function addWaterIntake(ml: number, goalId?: number): Promise<DailyWaterRecord> {
  const today = getTodayStr();
  const existing = await db.dailyWaterRecords.where("date").equals(today).first();
  if (existing) {
    const updateData: Partial<DailyWaterRecord> = {
      entries: [...existing.entries, { ml, timestamp: Date.now() }],
      totalMl: existing.totalMl + ml,
    };
    if (goalId !== undefined) {
      updateData.goalId = goalId;
    }
    await db.dailyWaterRecords.update(existing.id!, updateData);
    return (await db.dailyWaterRecords.get(existing.id!))!;
  }
  const newRecord: Omit<DailyWaterRecord, "id"> = {
    date: today,
    entries: [{ ml, timestamp: Date.now() }],
    totalMl: ml,
    createdAt: Date.now(),
  };
  if (goalId !== undefined) {
    newRecord.goalId = goalId;
  }
  const id = await db.dailyWaterRecords.add(newRecord);
  return (await db.dailyWaterRecords.get(id))!;
}

export async function undoLastWaterIntake(): Promise<DailyWaterRecord> {
  const today = getTodayStr();
  const existing = await db.dailyWaterRecords.where("date").equals(today).first();
  if (!existing || existing.entries.length === 0) throw new Error("No entry to undo");
  const popped = [...existing.entries];
  const last = popped.pop()!;
  await db.dailyWaterRecords.update(existing.id!, {
    entries: popped,
    totalMl: Math.max(0, existing.totalMl - last.ml),
  });
  return (await db.dailyWaterRecords.get(existing.id!))!;
}

// ==================== 每日自我评分 ====================

export async function getTodaySelfAssessment(): Promise<DailySelfAssessment | null> {
  const today = getTodayStr();
  const result = await db.dailySelfAssessments.where("date").equals(today).first();
  return result ?? null;
}

export async function saveSelfAssessment(physicalScore: number, moodScore: number): Promise<void> {
  const today = getTodayStr();
  const existing = await db.dailySelfAssessments.where("date").equals(today).first();
  if (existing) {
    await db.dailySelfAssessments.update(existing.id!, {
      physicalScore,
      moodScore,
      createdAt: Date.now(),
    });
  } else {
    await db.dailySelfAssessments.add({
      date: today,
      physicalScore,
      moodScore,
      createdAt: Date.now(),
    });
  }
}
