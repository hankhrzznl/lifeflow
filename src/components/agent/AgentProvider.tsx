"use client";

import { useEffect, useState, useCallback, createContext, useContext, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  ChatStateContext,
  AgentMessage,
  SuggestionCardData,
} from "@/lib/agent-state";
import {
  createInitialContext,
  transitionState,
} from "@/lib/agent-state";
import {
  localParseCapture,
  localSuggestPlan,
  localGetTodayStats,
} from "@/lib/agent-core";
import {
  loadChatHistory,
  saveChatSession,
  clearChatHistory,
  getActiveChatSession,
  createEmptySession,
} from "@/lib/agent-db";
import { db, createEvent } from "@/lib/db";
import { assistantBrain } from "@/lib/brains/assistant";
import type { ParsedIntent } from "@/lib/brains/assistant";
import { plannerBrain } from "@/lib/brains/planner";
import { reviewerBrain } from "@/lib/brains/reviewer";
import { getLLMConfig, callLLM } from "@/lib/brains/downgrade";
import { AgentChat } from "./AgentChat";

interface AgentContextType {
  open: boolean;
  state: ChatStateContext;
  messages: AgentMessage[];
  toggleOpen: () => void;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (text: string) => void;
  sendAndNavigate: (text: string) => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

const SESSION_ID = "default-agent-session";

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const WELCOME_MESSAGE = `你好！我是 LifeFlow 全局助手。

我可以帮你操作所有模块，直接说话就行：

**目标** — "帮我创建一个跑步目标，每周3次"
**记账** — "午餐花了30块" / "这周餐饮花了多少"
**饮水** — "喝了200ml水" / "今天喝了多少水"
**睡眠** — "昨晚11点睡的"
**健身** — "卧推3组10次40kg"
**提醒** — "提醒我每天9点喝水"
**日程** — "明天下午3点到5点开会"
**复盘** — "帮我复盘这周"
**专注** — "开始25分钟专注"

所有数据本地处理，不上传云端。试试看吧！`;

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [stateCtx, setStateCtx] = useState<ChatStateContext>(createInitialContext);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const messagesRef = useRef<AgentMessage[]>([]);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const processingRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActionRef = useRef<{ action: string; sourceLogId?: string; sourceModule?: string; scheduleTaskId?: string } | null>(null);

  // Keep ref in sync so persistSession can read latest messages from async handlers
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const isHiddenPage =
    pathname === "/focus" || pathname.startsWith("/settings");
  const isAssistantPage = pathname === "/assistant";

  useEffect(() => {
    if (isHiddenPage && open) {
      setOpen(false);
    }
  }, [pathname, isHiddenPage, open]);

  useEffect(() => {
    const init = async () => {
      const session = await getActiveChatSession();
      if (session && session.messages.length > 0) {
        // Check for active (unfinished) multi-turn conversation
        if ((session as any).status === "active" && (session as any).context?.intent) {
          const ctx = (session as any).context;
          const resumePrompt = `上次我们还在聊"${ctx.intent}"的事情，要继续吗？`;
          setMessages([
            ...session.messages.map((m) => ({
              id: generateId(),
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              isError: m.isError,
            })),
            {
              id: generateId(),
              role: "assistant",
              content: resumePrompt,
              timestamp: Date.now(),
            },
          ]);
        } else {
          setMessages(session.messages.map((m) => ({
            id: generateId(),
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            isError: m.isError,
          })));
        }
      } else {
        const welcome: AgentMessage = {
          id: generateId(),
          role: "assistant",
          content: WELCOME_MESSAGE,
          timestamp: Date.now(),
        };
        setMessages([welcome]);
      }
    };
    init();
  }, []);

  // Ref-based handleSubmit for global event listener (avoids stale closure)
  const handleSubmitRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());
  useEffect(() => {
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
    }
    if (stateCtx.currentState === "done") {
      doneTimerRef.current = setTimeout(() => {
        setStateCtx((prev) => ({ ...prev, currentState: "idle", previousState: "done" }));
      }, 2000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [stateCtx.currentState]);

  const persistSession = useCallback(async (msgs: AgentMessage[], status?: string, context?: any) => {
    const session = (await loadChatHistory(SESSION_ID)) || createEmptySession(SESSION_ID);
    session.messages = msgs.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      toolCall: m.toolCall ? JSON.stringify(m.toolCall) : undefined,
      isError: m.isError,
    }));
    session.updatedAt = Date.now();
    (session as any).status = status || "completed";
    if (context) (session as any).context = context;
    await saveChatSession(session);
  }, []);

  const addAssistantMessage = useCallback(
    (content: string, suggestions?: SuggestionCardData[], isError?: boolean) => {
      const msg: AgentMessage = {
        id: generateId(),
        role: "assistant",
        content,
        timestamp: Date.now(),
        suggestions,
        isError,
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    []
  );

  // ── Intent Handlers ──────────────────────────────────────

  const handleAddTransaction = useCallback(async (intent: ParsedIntent) => {
    const { amount, category, date } = intent.params as any;
    if (!amount) {
      addAssistantMessage(`请告诉我金额，比如「午餐花了30块」。`);
      return;
    }
    try {
      // Dynamically import accounting DB
      const { accountingDB } = await import("@/lib/db/accounting.db");
      const defaultLedger = await accountingDB.ledgers.orderBy("sortOrder").first();
      if (!defaultLedger) {
        addAssistantMessage("请先在记账模块中创建一个账本。");
        return;
      }
      const defaultAccount = await accountingDB.accounts
        .where("ledgerId").equals(defaultLedger.id).first();
      if (!defaultAccount) {
        addAssistantMessage("请先在记账模块中创建一个账户。");
        return;
      }
      const isIncome = intent.rawText.includes("收入") || intent.rawText.includes("赚了") || intent.rawText.includes("进账");
      const defaultCategory = isIncome
        ? (await accountingDB.categories.where({ type: "income" as any }).first())
        : (await accountingDB.categories.where({ type: "expense" as any }).first());

      const catName = category
        ? (await accountingDB.categories.where("name").equals(category as string).first())?.id
        : defaultCategory?.id;

      await accountingDB.transactions.add({
        id: crypto.randomUUID(),
        ledgerId: defaultLedger.id,
        accountId: defaultAccount.id,
        categoryId: catName || "",
        type: isIncome ? "income" : "expense",
        amount: amount as number,
        date: (date as string) || new Date().toISOString().slice(0, 10),
        note: "",
        createdAt: Date.now(),
      } as any);

      const catLabel = category || (isIncome ? "收入" : "支出");
      addAssistantMessage(`已记录：${isIncome ? "+" : "-"}¥${amount} ${catLabel}${date ? ` (${date})` : ""}`);
    } catch (err) {
      addAssistantMessage(`记账失败：${err instanceof Error ? err.message : "请重试"}`, undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryFinance = useCallback(async (intent: ParsedIntent) => {
    try {
      const { dateRange, category } = intent.params as any;
      const range = dateRange || { start: new Date().toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) };
      const { accountingDB } = await import("@/lib/db/accounting.db");

      const txns = await accountingDB.transactions
        .where("date")
        .between(range.start as string, range.end as string, true, true)
        .toArray();

      const totalIncome = txns.filter((t: any) => t.type === "income")
        .reduce((s: number, t: any) => s + t.amount, 0);
      const totalExpense = txns.filter((t: any) => t.type === "expense")
        .reduce((s: number, t: any) => s + t.amount, 0);

      let msg = `${range.start} 至 ${range.end}：`;
      msg += `\n收入 ¥${totalIncome.toFixed(2)} · 支出 ¥${totalExpense.toFixed(2)} · 结余 ¥${(totalIncome - totalExpense).toFixed(2)}`;
      msg += `\n共 ${txns.length} 笔记录`;

      if (category) {
        const catTxns = txns.filter((t: any) => {
          return accountingDB.categories.get(t.categoryId).then((c: any) => c?.name === category);
        });
        const catTotal = catTxns.reduce((s: number, t: any) => s + t.amount, 0);
        msg += `\n${category}：¥${catTotal.toFixed(2)}`;
      }

      addAssistantMessage(msg);
    } catch (err) {
      addAssistantMessage(`查询失败：${err instanceof Error ? err.message : "请重试"}`, undefined, true);
    }
  }, [addAssistantMessage]);

  const handleRecordWater = useCallback(async (intent: ParsedIntent) => {
    const { volume } = intent.params as any;
    const ml = volume || 200;
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const today = new Date().toISOString().slice(0, 10);
      const existing = await healthDB.waterLogs.where("date").equals(today).first();
      if (existing) {
        await healthDB.waterLogs.update(existing.id!, {
          amount: (existing.amount || 0) + ml,
          timestamp: Date.now(),
        });
      } else {
        await healthDB.waterLogs.add({
          id: crypto.randomUUID(),
          date: today,
          amount: ml,
          timestamp: Date.now(),
        } as any);
      }
      addAssistantMessage(`已记录饮水 ${ml}ml`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `喝水 ${ml}ml`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'water', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_water', sourceLogId: today, sourceModule: 'water', scheduleTaskId: newTaskId };
    } catch (err) {
      addAssistantMessage(`记录饮水失败`, undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryWater = useCallback(async () => {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const today = new Date().toISOString().slice(0, 10);
      const record = await healthDB.waterLogs.where("date").equals(today).first();
      const total = record?.amount || 0;
      const goal = (await healthDB.waterGoals.toArray())[0]?.dailyTarget || 2000;
      addAssistantMessage(`今日饮水：${total}ml / ${goal}ml (${Math.round(total / goal * 100)}%)`);
    } catch {
      addAssistantMessage("查询饮水记录失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleRecordSleep = useCallback(async (intent: ParsedIntent) => {
    const { time, date } = intent.params as any;
    const sleepTime = time || "23:00";
    const sleepDate = date || new Date().toISOString().slice(0, 10);
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      await healthDB.sleepLogs.put({
        id: sleepDate,
        date: sleepDate,
        actualTime: sleepTime,
        createdAt: Date.now(),
      } as any);
      addAssistantMessage(`已记录入睡时间：${sleepDate} ${sleepTime}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `睡觉 ${sleepTime}`,
        type: 'single', date: sleepDate, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'sleep', sourceLogId: sleepDate,
      });
      lastActionRef.current = { action: 'record_sleep', sourceLogId: sleepDate, sourceModule: 'sleep', scheduleTaskId: newTaskId };
    } catch {
      addAssistantMessage("记录睡眠失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQuerySleep = useCallback(async () => {
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const logs = await healthDB.sleepLogs.orderBy("date").reverse().limit(7).toArray();
      if (logs.length === 0) {
        addAssistantMessage(`暂无睡眠记录。说「昨晚11点睡的」来记录吧。`);
        return;
      }
      const times = logs.map((l: any) => l.actualTime || l.targetTime || "?");
      addAssistantMessage(`最近 ${logs.length} 天入睡时间：\n${times.join(" → ")}`);
    } catch {
      addAssistantMessage("查询睡眠记录失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleRecordWorkout = useCallback(async (intent: ParsedIntent) => {
    const { exerciseName, sets, reps, weight, rpe } = intent.params as any;
    if (!exerciseName) {
      addAssistantMessage(`请告诉我做了什么动作，比如「卧推3组10次40kg」。`);
      return;
    }
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const today = new Date().toISOString().slice(0, 10);
      const sessionId = `ws-${today}-${Date.now()}`;
      await healthDB.workoutSessions.add({
        id: sessionId,
        date: today,
        exercises: [{
          name: exerciseName,
          sets: sets || 1,
          reps: reps || 10,
          weight: weight || 0,
          rpe: rpe || 7,
          isPR: false,
        }],
        notes: "",
        createdAt: Date.now(),
      } as any);
      const detailStr = [sets && `${sets}组`, reps && `${reps}次`, weight && `${weight}kg`].filter(Boolean).join("×");
      addAssistantMessage(`已记录训练：${exerciseName} ${detailStr}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `${exerciseName} ${sets}组${reps}次`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'fitness', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_workout', sourceLogId: today, sourceModule: 'fitness', scheduleTaskId: newTaskId };
    } catch {
      addAssistantMessage("记录训练失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleRecordStretch = useCallback(async (intent: ParsedIntent) => {
    const { exerciseName, sets, reps, postureIssue } = intent.params as any;
    if (!exerciseName) {
      addAssistantMessage(`请告诉拉伸动作名称，比如「猫式拉伸3组15次，改善驼背」。`);
      return;
    }
    try {
      const { healthDB } = await import("@/lib/db/health.db");
      const today = new Date().toISOString().slice(0, 10);
      await healthDB.stretchLogs.add({
        exerciseName: exerciseName as string,
        sets: (sets as number) || 1,
        reps: (reps as number) || 15,
        postureIssue: postureIssue as string | undefined,
        date: today,
        createdAt: Date.now(),
      } as any);
      const detail = [`${sets || 1}组`, `${reps || 15}次`, postureIssue ? `改善${postureIssue}` : ""].filter(Boolean).join(" · ");
      addAssistantMessage(`已记录拉伸：${exerciseName} ${detail}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `拉伸 ${exerciseName}`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'stretch', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_stretch', sourceLogId: today, sourceModule: 'stretch', scheduleTaskId: newTaskId };
    } catch {
      addAssistantMessage("记录拉伸失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleRecordMedication = useCallback(async (intent: ParsedIntent) => {
    const medicationName = (intent.params as any).medicationName;
    const name = medicationName || "药";
    const time = (intent.params as any).time || new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const today = new Date().toISOString().slice(0, 10);
    addAssistantMessage(`已记录用药：${name} @ ${time}`);
    try {
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `吃药 ${medicationName || ''}`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'medication', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_medication', sourceLogId: today, sourceModule: 'medication', scheduleTaskId: newTaskId };
    } catch { /* schedule task optional */ }
  }, [addAssistantMessage]);

  const handleRecordHabit = useCallback(async (intent: ParsedIntent) => {
    const habitName = (intent.params as any).habitName;
    const name = habitName || intent.rawText.replace(/打卡|习惯打卡|完成了/g, "").trim();
    if (!name) {
      addAssistantMessage("请告诉我完成了什么习惯，比如「冥想打卡」。");
      return;
    }
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const today = new Date().toISOString().slice(0, 10);
      const existing = await lifeDB.habits.where("name").equals(name).first();
      if (existing) {
        const days = existing.days || {};
        days[today] = true;
        await lifeDB.habits.update(existing.id!, { days, streak: (existing.streak || 0) + 1 });
      } else {
        const id = crypto.randomUUID();
        await lifeDB.habits.add({
          id, name, icon: "CheckSquare", color: "#10B981",
          days: { [today]: true }, streak: 1, createdAt: Date.now(),
        } as any);
      }
      addAssistantMessage(`已打卡：${name}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `打卡 ${name}`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'habit', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_habit', sourceLogId: today, sourceModule: 'habit', scheduleTaskId: newTaskId };
    } catch {
      addAssistantMessage("打卡失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryHabit = useCallback(async () => {
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const habits = await lifeDB.habits.toArray();
      if (habits.length === 0) {
        addAssistantMessage("还没有习惯记录。说「冥想打卡」来记录吧！");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const lines = habits.map((h: any) => {
        const done = h.days?.[today];
        return `• ${h.name} — ${done ? "✅ 今日已打卡" : `连续 ${h.streak || 0} 天`}`;
      });
      addAssistantMessage(`习惯记录：\n${lines.join("\n")}`);
    } catch {
      addAssistantMessage("查询习惯失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleCreateCountdown = useCallback(async (intent: ParsedIntent) => {
    const name = (intent.params as any).countdownName || "倒数日";
    const date = (intent.params as any).countdownDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      await lifeDB.countdowns.add({
        id: crypto.randomUUID(), name,
        date, icon: "CalendarRange", type: "once",
        createdAt: Date.now(),
      } as any);
      addAssistantMessage(`已创建倒数日：「${name}」(${date})`);
    } catch {
      addAssistantMessage("创建倒数日失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryCountdown = useCallback(async () => {
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const items = await lifeDB.countdowns.toArray();
      if (items.length === 0) {
        addAssistantMessage("还没有倒数日。"); return;
      }
      const now = new Date();
      const lines = items.map((c: any) => {
        const d = new Date(c.date);
        const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
        return `• ${c.name} — ${diff > 0 ? `${diff} 天后` : diff === 0 ? "就是今天！" : `${Math.abs(diff)} 天前`}`;
      });
      addAssistantMessage(`倒数日：\n${lines.join("\n")}`);
    } catch {
      addAssistantMessage("查询倒数日失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryNote = useCallback(async () => {
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const notes = await lifeDB.notes.orderBy("createdAt").reverse().limit(5).toArray();
      if (notes.length === 0) { addAssistantMessage("还没有备忘录。"); return; }
      const lines = notes.map((n: any) => `• ${n.title || n.content?.slice(0, 30)}`);
      addAssistantMessage(`最近备忘录：\n${lines.join("\n")}`);
    } catch {
      addAssistantMessage("查询备忘录失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryProject = useCallback(async () => {
    try {
      const { efficiencyDB } = await import("@/lib/db/efficiency.db");
      const projects = await efficiencyDB.projects.toArray();
      if (projects.length === 0) { addAssistantMessage("还没有项目。"); return; }
      const lines = projects.map((p: any) => `• ${p.name}`);
      addAssistantMessage(`项目列表：\n${lines.join("\n")}`);
    } catch {
      addAssistantMessage("查询项目失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleCreateProject = useCallback(async (intent: ParsedIntent) => {
    const name = (intent.params as any).projectName || intent.rawText.replace(/创建项目|新建项目|添加项目/g, "").trim();
    if (!name) { addAssistantMessage("请告诉我项目名称。"); return; }
    try {
      const { efficiencyDB } = await import("@/lib/db/efficiency.db");
      await efficiencyDB.projects.add({
        id: crypto.randomUUID(), name, color: "#6366F1", icon: "FolderKanban",
        description: "", sortOrder: Date.now(), createdAt: Date.now(),
      } as any);
      addAssistantMessage(`已创建项目：「${name}」`);
    } catch {
      addAssistantMessage("创建项目失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleCreateGoal = useCallback(async (intent: ParsedIntent) => {
    const { goalTitle, period, frequencyCount, deadline } = intent.params as any;
    if (!goalTitle) {
      addAssistantMessage(`请告诉我目标的名字，比如「帮我创建一个跑步目标」。`);
      return;
    }
    const title = goalTitle as string;
    const freqStr = period === "daily" ? "每天" : period === "weekly" ? `每周${frequencyCount || 1}次` : period === "monthly" ? `每月${frequencyCount || 1}次` : "";
    const deadlineStr = deadline || "未设置";

    addAssistantMessage(
      `好的，我来确认一下：\n\n📌 目标：${title}\n🔄 频率：${freqStr || "待确认"}\n⏰ 截止：${deadlineStr}\n\n请回复：\n• 是「长期目标」还是「短期目标」？\n• 截止日期是什么？（如"一个月内"）`,
      undefined
    );
    // Mark session as active for multi-turn
    const allMsgs: AgentMessage[] = [...messages, { id: generateId(), role: "user" as const, content: intent.rawText, timestamp: Date.now() }];
     persistSession(allMsgs, "active", { intent: "create_goal", stage: "confirm_type", params: intent.params });
  }, [addAssistantMessage, messages, persistSession]);

  // Handle multi-turn goal creation continuation
  const handleGoalMultiTurn = useCallback(async (text: string) => {
    const activeSession = await getActiveChatSession();
    if (!activeSession || (activeSession as any).status !== "active") return false;
    const ctx = (activeSession as any).context;
    if (!ctx || ctx.intent !== "create_goal") return false;

    const params = ctx.params || {};
    const stage = ctx.stage || "confirm_type";

    if (stage === "confirm_type") {
      // User is responding with type/deadline details
      const goalType = text.includes("长期") || text.includes("长线") ? "longterm" : "shortterm";
      let deadlineDate = params.deadline || "";
      
      // Try to parse deadline from this response
      const monthMatch = text.match(/(\d+)\s*个?月/);
      const weekMatch = text.match(/(\d+)\s*周/);
      const dayMatch = text.match(/(\d+)\s*天/);
      
      const today = new Date();
      if (monthMatch) {
        today.setMonth(today.getMonth() + parseInt(monthMatch[1]));
        deadlineDate = today.toISOString().slice(0, 10);
      } else if (weekMatch) {
        today.setDate(today.getDate() + parseInt(weekMatch[1]) * 7);
        deadlineDate = today.toISOString().slice(0, 10);
      } else if (dayMatch) {
        today.setDate(today.getDate() + parseInt(dayMatch[1]));
        deadlineDate = today.toISOString().slice(0, 10);
      } else {
        // Default: 1 month
        today.setMonth(today.getMonth() + 1);
        deadlineDate = today.toISOString().slice(0, 10);
      }

      const title = params.goalTitle || "新目标";
      const freqStr = params.period === "daily" ? "每天" : params.period === "weekly" ? `每周${params.frequencyCount || 1}次` : "";
      
      addAssistantMessage(
        `确认信息：\n\n📌 目标：${title}\n📋 类型：${goalType === "longterm" ? "长期" : "短期"}\n🔄 频率：${freqStr || "自由安排"}\n⏰ 截止：${deadlineDate}\n\n需要我自动拆解并排入日程吗？（回复「好的」或「需要」）`,
        undefined
      );
      
      const allMsgs2: AgentMessage[] = [...messages, { id: generateId(), role: "user" as const, content: text, timestamp: Date.now() }];
      await persistSession(allMsgs2, "active", {
        intent: "create_goal",
        stage: "confirm_breakdown",
        params: { ...params, goalType, deadline: deadlineDate },
      });
      return true;
    }

    if (stage === "confirm_breakdown") {
      // User confirmed or declined breakdown
      const shouldBreakdown = text.includes("好") || text.includes("可以") || text.includes("需要") || text.includes("拆");
      const { goalTitle, goalType, deadline: dl, period, frequencyCount } = params;

      try {
        const { efficiencyDB } = await import("@/lib/db/efficiency.db");
        const goalId = await efficiencyDB.goals.add({
          id: crypto.randomUUID(),
          title: goalTitle || "新目标",
          deadline: dl || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          progress: 0,
          status: "active" as any,
          createdAt: Date.now(),
        } as any);

        let tasksCreated = 0;
        if (shouldBreakdown) {
          const strategy = plannerBrain.analyze(goalTitle || "新目标");
          const tasks = plannerBrain.generateTasks(strategy, goalId, new Date().toISOString().slice(0, 10));
          for (const task of tasks) {
            await efficiencyDB.scheduleTasks.add({
              ...task,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            } as any);
          }
          tasksCreated = tasks.length;
        }

        const freqStr = period === "daily" ? "每天" : period === "weekly" ? `每周${frequencyCount || 1}次` : "";
        const breakdownMsg = shouldBreakdown
          ? `\n\n已自动拆解为 ${tasksCreated} 个任务并排入日程。去日程页面查看吧！`
          : "";

        addAssistantMessage(
          `已创建目标「${goalTitle}」${freqStr ? `（${freqStr}）` : ""}${breakdownMsg}`,
        );

        const allMsgs3: AgentMessage[] = [...messages, { id: generateId(), role: "user" as const, content: text, timestamp: Date.now() }];
        await persistSession(allMsgs3, "completed");
        return true;
      } catch (err) {
        addAssistantMessage(`创建目标失败：${err instanceof Error ? err.message : "请重试"}`, undefined, true);
        return true;
      }
    }

    return false;
  }, [addAssistantMessage, messages, persistSession]);

  const handleQueryGoal = useCallback(async () => {
    try {
      const { efficiencyDB } = await import("@/lib/db/efficiency.db");
      const goals = await efficiencyDB.goals.where("status").equals("active").toArray();
      if (goals.length === 0) {
        addAssistantMessage("当前没有进行中的目标。说「帮我创建一个目标」来开始吧！");
        return;
      }
      const lines = goals.map((g: any) => {
        const progressBar = "█".repeat(Math.round(g.progress / 10)) + "░".repeat(10 - Math.round(g.progress / 10));
        return `• ${g.title} — ${progressBar} ${g.progress}%`;
      });
      addAssistantMessage(`当前 ${goals.length} 个进行中的目标：\n\n${lines.join("\n")}`);
    } catch {
      addAssistantMessage("查询目标失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleUpdateGoal = useCallback(async (intent: ParsedIntent) => {
    const rawText = intent.rawText;
    try {
      const { efficiencyDB } = await import("@/lib/db/efficiency.db");
      const goals = await efficiencyDB.goals.where("status").equals("active").toArray();
      
      if (goals.length === 0) {
        addAssistantMessage("当前没有进行中的目标。");
        return;
      }

      // Find matching goal by title keyword
      let matchedGoal: any = null;
      for (const g of goals) {
        if (rawText.includes(g.title) || g.title.includes(rawText.replace(/更新目标|修改目标|调整目标/g, "").trim())) {
          matchedGoal = g;
          break;
        }
      }

      if (!matchedGoal) {
        addAssistantMessage(`请告诉我具体是哪个目标？当前进行中的：${goals.map((g: any) => g.title).join("、")}`);
        return;
      }

      if (rawText.includes("完成") || rawText.includes("做完")) {
        await efficiencyDB.goals.update(matchedGoal.id, { status: "completed", completedAt: Date.now() } as any);
        addAssistantMessage(`已将目标「${matchedGoal.title}」标记为已完成！🎉`);
      } else if (rawText.includes("删除") || rawText.includes("删掉") || rawText.includes("移除")) {
        await efficiencyDB.goals.delete(matchedGoal.id);
        addAssistantMessage(`已删除目标「${matchedGoal.title}」。`);
      } else if (rawText.includes("暂停")) {
        await efficiencyDB.goals.update(matchedGoal.id, { status: "paused" } as any);
        addAssistantMessage(`已将目标「${matchedGoal.title}」暂停。`);
      } else {
        addAssistantMessage(`你想对「${matchedGoal.title}」做什么修改？（完成/删除/暂停/修改标题等）`);
      }
    } catch {
      addAssistantMessage("更新目标失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleCreateReminder = useCallback(async (intent: ParsedIntent) => {
    const { reminderType, time, reminderRecurrence } = intent.params as any;
    try {
      const triggerTime = time || "09:00";
      const msg = intent.rawText.replace(/提醒我|记得|别忘了|别忘|帮我提醒/g, "").trim();

      // Calculate actual trigger time from the parsed time string
      const now = new Date();
      if (time) {
        const [h, m] = (time as string).split(":").map(Number);
        now.setHours(h, m, 0, 0);
        if (now.getTime() < Date.now()) now.setDate(now.getDate() + 1); // Tomorrow if time passed
      }

      await db.reminders.add({
        taskId: 0,
        type: reminderType === "water" ? "habit" : reminderType === "sleep" ? "event" : (reminderType || "custom") as any,
        triggerTime: now.getTime(),
        message: msg || `${reminderType} 提醒`,
        status: "pending" as any,
        moduleType: reminderType || "task",
        recurrenceRule: reminderRecurrence || "once",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);

      // Cross-module linking
      if (reminderType === "water") {
        localStorage.setItem("water_reminder_enabled", "true");
        localStorage.setItem("water_reminder_interval", "60");
      } else if (reminderType === "sleep") {
        localStorage.setItem("sleep_reminder_enabled", "true");
      } else if (reminderType === "medication") {
        localStorage.setItem("medication_reminder_enabled", "true");
      }

      const freqLabel = reminderRecurrence === "daily" ? "（每天）" : reminderRecurrence === "weekly" ? "（每周）" : "";
      addAssistantMessage(`已设置提醒：${msg}${freqLabel}${time ? ` @ ${time}` : ""}`);
    } catch (err) {
      addAssistantMessage(`设置提醒失败`, undefined, true);
    }
  }, [addAssistantMessage]);

  const handleQueryReview = useCallback(async () => {
    addAssistantMessage("正在生成本周复盘...");
    try {
      const review = await reviewerBrain.generateReview("weekly");
      const msg = review.overviewText + "\n\n" + review.summaries
        .filter(s => Object.keys(s.stats).length > 0)
        .map(s => {
          const lines = Object.entries(s.stats).map(([k, v]) => `  ${k}: ${v}`);
          return `**${s.label}**\n${lines.join("\n")}`;
        })
        .join("\n\n");
      addAssistantMessage(msg, [{
        id: `review-nav-${Date.now()}`,
        title: "查看可视化复盘",
        proposedStartTime: Date.now(),
        proposedEndTime: Date.now() + 1,
        tags: ["review"],
        confidence: 1,
      }]);
    } catch {
      addAssistantMessage("复盘生成失败，请重试", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleStartFocus = useCallback(async (intent: ParsedIntent) => {
    const minutes = (intent.params as any).focusMinutes || 25;
    addAssistantMessage(`准备开始 ${minutes} 分钟专注。正在进入专注模式...`);
    try {
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const today = new Date().toISOString().slice(0, 10);
      const newTaskId = await addScheduleTask({
        title: `专注 ${minutes}分钟`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'focus', sourceLogId: today,
      });
      lastActionRef.current = { action: 'start_focus', sourceLogId: today, sourceModule: 'focus', scheduleTaskId: newTaskId };
    } catch { /* schedule task optional */ }
    setTimeout(() => router.push("/focus"), 500);
  }, [addAssistantMessage, router]);

  const handleCreateNote = useCallback(async (intent: ParsedIntent) => {
    const content = (intent.params as any).noteContent || intent.rawText;
    const noteTitle = content.slice(0, 30);
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      await lifeDB.notes.add({
        id: crypto.randomUUID(),
        title: noteTitle,
        content: content,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
      } as any);
      addAssistantMessage(`已记录备忘录：${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const today = new Date().toISOString().slice(0, 10);
      const newTaskId = await addScheduleTask({
        title: `备忘录 ${noteTitle}`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: '', category: 'habit' as any,
        sourceModule: 'notes', sourceLogId: today,
      });
      lastActionRef.current = { action: 'create_note', sourceLogId: today, sourceModule: 'notes', scheduleTaskId: newTaskId };
    } catch {
      addAssistantMessage("记录备忘录失败", undefined, true);
    }
  }, [addAssistantMessage]);

  const handleRecordDiet = useCallback(async (intent: ParsedIntent) => {
    const { name, mealType } = intent.params as any;
    if (!name) { addAssistantMessage("请告诉我吃了什么"); return; }
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const today = new Date().toISOString().slice(0, 10);
      await lifeDB.dietLogs.add({ name, mealType: mealType || 'snack', date: today, createdAt: Date.now() } as any);
      addAssistantMessage(`已记录饮食：${name}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `${mealType === 'breakfast' ? '早餐' : mealType === 'lunch' ? '午餐' : mealType === 'dinner' ? '晚餐' : '饮食'}：${name}`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: mealType || '', category: 'habit' as any,
        sourceModule: 'diet', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_diet', sourceLogId: today, sourceModule: 'diet', scheduleTaskId: newTaskId };
    } catch { addAssistantMessage("记录饮食失败", undefined, true); }
  }, [addAssistantMessage]);

  const handleRecordWellness = useCallback(async (intent: ParsedIntent) => {
    const { name, type } = intent.params as any;
    if (!name) { addAssistantMessage("请告诉我做了什么养生动作"); return; }
    try {
      const { lifeDB } = await import("@/lib/db/life.db");
      const today = new Date().toISOString().slice(0, 10);
      await lifeDB.wellnessLogs.add({ name, type: type || 'gongfa', date: today, createdAt: Date.now() } as any);
      addAssistantMessage(`已记录养生：${name}`);
      const { addScheduleTask } = await import("@/lib/db/efficiency.db");
      const newTaskId = await addScheduleTask({
        title: `${type === 'tigang' ? '提肛' : '功法'}：${name}`,
        type: 'single', date: today, goalId: null,
        quadrant: 'q2', isCompleted: true, plannedTime: 0, actualTime: 1,
        isImportant: false, note: type || '', category: 'habit' as any,
        sourceModule: 'wellness', sourceLogId: today,
      });
      lastActionRef.current = { action: 'record_wellness', sourceLogId: today, sourceModule: 'wellness', scheduleTaskId: newTaskId };
    } catch { addAssistantMessage("记录养生失败", undefined, true); }
  }, [addAssistantMessage]);

  const handleUndo = useCallback(async () => {
    const action = lastActionRef.current;
    if (!action) { addAssistantMessage("没有可撤回的操作"); return; }
    try {
      if (action.scheduleTaskId) {
        const { deleteScheduleTask } = await import("@/lib/db/efficiency.db");
        try { await deleteScheduleTask(action.scheduleTaskId); } catch {}
      }
      if (action.sourceModule === 'water' && action.sourceLogId) {
        const { healthDB } = await import("@/lib/db/health.db");
        await healthDB.waterLogs.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'sleep' && action.sourceLogId) {
        const { healthDB } = await import("@/lib/db/health.db");
        await healthDB.sleepLogs.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'fitness' && action.sourceLogId) {
        const { healthDB } = await import("@/lib/db/health.db");
        await healthDB.workoutSessions.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'stretch' && action.sourceLogId) {
        const { healthDB } = await import("@/lib/db/health.db");
        await healthDB.stretchLogs.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'diet' && action.sourceLogId) {
        const { lifeDB } = await import("@/lib/db/life.db");
        await lifeDB.dietLogs.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'wellness' && action.sourceLogId) {
        const { lifeDB } = await import("@/lib/db/life.db");
        await lifeDB.wellnessLogs.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'medication' && action.sourceLogId) {
        // Medication has no separate DB table; schedule task already deleted above
      } else if (action.sourceModule === 'habit' && action.sourceLogId) {
        const { lifeDB } = await import("@/lib/db/life.db");
        const habits = await lifeDB.habits.toArray();
        for (const h of habits) {
          if (h.days?.[action.sourceLogId]) {
            delete h.days[action.sourceLogId];
            h.streak = Math.max(0, (h.streak || 1) - 1);
            await lifeDB.habits.update(h.id!, { days: h.days, streak: h.streak });
          }
        }
      } else if (action.sourceModule === 'notes' && action.sourceLogId) {
        const { lifeDB } = await import("@/lib/db/life.db");
        await lifeDB.notes.where("date").equals(action.sourceLogId).delete();
      } else if (action.sourceModule === 'focus' && action.sourceLogId) {
        // Focus has no separate DB table; schedule task already deleted above
      }
      lastActionRef.current = null;
      addAssistantMessage("已撤回上次操作");
    } catch { addAssistantMessage("撤回失败", undefined, true); }
  }, [addAssistantMessage]);

  // ── Intent Dispatcher (shared between local engine and LLM fallback) ──

  const runIntent = useCallback(async (intent: ParsedIntent) => {
    switch (intent.action) {
      case "create_goal": await handleCreateGoal(intent); break;
      case "query_goal": await handleQueryGoal(); break;
      case "update_goal": await handleUpdateGoal(intent); break;
      case "add_transaction": await handleAddTransaction(intent); break;
      case "query_finance": await handleQueryFinance(intent); break;
      case "record_water": await handleRecordWater(intent); break;
      case "query_water": await handleQueryWater(); break;
      case "record_sleep": await handleRecordSleep(intent); break;
      case "query_sleep": await handleQuerySleep(); break;
      case "record_workout": await handleRecordWorkout(intent); break;
      case "record_stretch": await handleRecordStretch(intent); break;
      case "create_reminder": await handleCreateReminder(intent); break;
      case "query_review": await handleQueryReview(); break;
      case "navigate_review": setTimeout(() => router.push("/more/review"), 300); break;
      case "record_medication": await handleRecordMedication(intent); break;
      case "record_habit": await handleRecordHabit(intent); break;
      case "query_habit": await handleQueryHabit(); break;
      case "create_countdown": await handleCreateCountdown(intent); break;
      case "query_countdown": await handleQueryCountdown(); break;
      case "query_note": await handleQueryNote(); break;
      case "create_project": await handleCreateProject(intent); break;
      case "query_project": await handleQueryProject(); break;
      case "start_focus": await handleStartFocus(intent); break;
      case "create_note": await handleCreateNote(intent); break;
      case "record_diet": await handleRecordDiet(intent); break;
      case "record_wellness": await handleRecordWellness(intent); break;
      case "undo": await handleUndo(); break;
      case "query_reminder": {
        const pending = await (await import("@/lib/db")).getPendingReminders();
        if (pending.length === 0) { addAssistantMessage("当前没有待处理的提醒。"); }
        else { addAssistantMessage(`你有 ${pending.length} 条待处理提醒`); }
        break;
      }
      case "query_schedule": case "query_courses": case "query_routines": {
        const route = intent.action === "query_courses" ? "/more/schedule/courses"
          : intent.action === "query_routines" ? "/more/schedule/routines" : "/efficiency/schedule";
        setTimeout(() => router.push(route), 300);
        break;
      }
      default:
        addAssistantMessage(`我理解你想执行 ${intent.action}，但该功能还在开发中。\n\n${assistantBrain.getHelpMessage()}`);
    }
  }, [handleCreateGoal, handleQueryGoal, handleUpdateGoal, handleAddTransaction, handleQueryFinance, handleRecordWater, handleQueryWater, handleRecordSleep, handleQuerySleep, handleRecordWorkout, handleRecordStretch, handleCreateReminder, handleQueryReview, handleRecordMedication, handleRecordHabit, handleQueryHabit, handleCreateCountdown, handleQueryCountdown, handleQueryNote, handleCreateProject, handleQueryProject, handleStartFocus, handleCreateNote, handleRecordDiet, handleRecordWellness, handleUndo, addAssistantMessage, router]);

  // ── Main Submit Handler ──────────────────────────────────

  const handleSubmit = useCallback(
    async (text: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const userMsg: AgentMessage = {
        id: generateId(), role: "user", content: text, timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setStateCtx((prev) => transitionState(prev, "sending", { currentMessageId: userMsg.id }));

      // Check for active multi-turn goal creation first
      const multiTurnHandled = await handleGoalMultiTurn(text);
      if (multiTurnHandled) {
        setStateCtx((prev) => transitionState(prev, "done"));
        processingRef.current = false;
        return;
      }

      // Parse intent using the new AssistantBrain
      const intent = assistantBrain.parseIntent(text);

      // If confidence is low, try old parse_capture for schedule
      if (intent.action === "unknown" || intent.confidence < 0.3) {
        if (/点|到|下午|上午|明天|后天|晚上|早上/.test(text)) {
          setStateCtx((prev) => transitionState(prev, "tool_calling"));
          const parsed = localParseCapture(text);
          if (parsed.confidence >= 0.4) {
            const suggestions: SuggestionCardData[] = [{
              id: `sugg-${Date.now()}`, title: parsed.title,
              proposedStartTime: parsed.startTime || Date.now(),
              proposedEndTime: parsed.endTime || Date.now() + 3600000,
              tags: parsed.tags, confidence: parsed.confidence,
            }];
            setStateCtx((prev) => transitionState(prev, "confirming", { suggestions }));
            addAssistantMessage(`已为你解析日程：\n\n**${parsed.title}**\n${parsed.startTime ? new Date(parsed.startTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "?"} - ${parsed.endTime ? new Date(parsed.endTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "?"}`, suggestions);
            processingRef.current = false; return;
          }
        }
        if (/规划|安排|排程|计划|帮我/.test(text) && !/目标|提醒|复盘/.test(text)) {
          setStateCtx((prev) => transitionState(prev, "tool_calling"));
          const result = await localSuggestPlan();
          if (result.suggestions.length > 0) {
            setStateCtx((prev) => transitionState(prev, "confirming", { suggestions: result.suggestions }));
            addAssistantMessage(result.message, result.suggestions);
          } else { addAssistantMessage(result.message); setStateCtx((prev) => transitionState(prev, "done")); }
          processingRef.current = false; return;
        }
        if (/统计|专注了|进度|多久/.test(text)) {
          setStateCtx((prev) => transitionState(prev, "tool_calling"));
          const stats = await localGetTodayStats();
          addAssistantMessage(stats.message);
          setStateCtx((prev) => transitionState(prev, "done"));
          processingRef.current = false; return;
        }
        // Fully unknown — try LLM fallback first
        const llmConfig = getLLMConfig();
        if (llmConfig) {
          addAssistantMessage("正在尝试 AI 理解你的意图...");
          try {
            const llmResult = await callLLM(text, llmConfig);
            if (llmResult && llmResult.action !== "unknown" && llmResult.confidence > 0.5) {
              setMessages((prev) => prev.slice(0, -1)); // Remove "trying" placeholder
              setStateCtx((prev) => transitionState(prev, "tool_calling"));
              const llmIntent: ParsedIntent = { action: llmResult.action as any, params: llmResult.params as any, confidence: llmResult.confidence, rawText: text };
              await runIntent(llmIntent);
              setStateCtx((prev) => transitionState(prev, "done"));
              await persistSession(messagesRef.current);
              processingRef.current = false; return;
            }
          } catch { /* fall through */ }
        }
        // Final fallback
        const helpMsg = addAssistantMessage(assistantBrain.getHelpMessage());
        setStateCtx((prev) => transitionState(prev, "done"));
        processingRef.current = false;
        await persistSession(messagesRef.current);
        return;
      }

      setStateCtx((prev) => transitionState(prev, "tool_calling"));
      try {
        await runIntent(intent);
        setStateCtx((prev) => transitionState(prev, "done"));
        // Persist using ref (includes async assistant responses added by addAssistantMessage)
        await persistSession(messagesRef.current);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "处理失败，请重试";
        addAssistantMessage(errorMsg, undefined, true);
        setStateCtx((prev) => transitionState(prev, "error_tool", { lastError: err instanceof Error ? err : new Error(errorMsg) }));
      }
      processingRef.current = false;
    },
    [messages, addAssistantMessage, persistSession, handleGoalMultiTurn, runIntent, router]
  );

  // Sync handleSubmit ref and listen for global messages
  handleSubmitRef.current = handleSubmit;
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (text && typeof text === "string") handleSubmitRef.current(text);
    };
    window.addEventListener("lifeflow:sendMessage", handler);
    return () => window.removeEventListener("lifeflow:sendMessage", handler);
  }, []);

  const handleAcceptSuggestion = useCallback(
    async (suggestion: SuggestionCardData) => {
      // Handle review navigation
      if (suggestion.tags.includes("review")) {
        router.push("/more/review");
        return;
      }
      // Legacy: accept schedule suggestion
      setStateCtx((prev) => transitionState(prev, "executing"));
      try {
        await db.transaction("rw", db.events, db.capture, async () => {
          await createEvent({
            title: suggestion.title,
            startTime: suggestion.proposedStartTime,
            endTime: suggestion.proposedEndTime,
            tags: suggestion.tags,
            planned: true,
            focusSessions: [],
          });
          if (suggestion.captureId) {
            await db.capture.update(suggestion.captureId, { status: "planned" });
          }
        });
        const msg = addAssistantMessage(`已将"${suggestion.title}"添加到规划！`);
        setStateCtx((prev) => transitionState(prev, "done"));
        await persistSession([...messages, {
          id: generateId(), role: "user", content: `采纳建议: ${suggestion.title}`, timestamp: Date.now(),
        }, msg]);
      } catch (err) {
        addAssistantMessage("保存失败", undefined, true);
        setStateCtx((prev) => transitionState(prev, "error_tool", { lastError: err instanceof Error ? err : new Error("保存失败") }));
      }
    },
    [messages, addAssistantMessage, persistSession, router]
  );

  const handleModifySuggestion = useCallback(
    async (suggestion: SuggestionCardData, newTitle: string) => {
      if (suggestion.tags.includes("review")) {
        router.push("/more/review");
        return;
      }
      setStateCtx((prev) => transitionState(prev, "executing"));
      try {
        await db.transaction("rw", db.events, db.capture, async () => {
          await createEvent({
            title: newTitle, startTime: suggestion.proposedStartTime,
            endTime: suggestion.proposedEndTime, tags: suggestion.tags, planned: true, focusSessions: [],
          });
          if (suggestion.captureId) await db.capture.update(suggestion.captureId, { status: "planned" });
        });
        const msg = addAssistantMessage(`已将"${newTitle}"添加到规划！`);
        setStateCtx((prev) => transitionState(prev, "done"));
        await persistSession([...messages, {
          id: generateId(), role: "user", content: `修改并采纳: ${newTitle}`, timestamp: Date.now(),
        }, msg]);
      } catch {
        addAssistantMessage("保存失败", undefined, true);
      }
    },
    [messages, addAssistantMessage, persistSession, router]
  );

  const handleRejectSuggestion = useCallback(async (suggestion: SuggestionCardData) => {
    const msg = addAssistantMessage("好的，如有需要随时告诉我。");
    setStateCtx((prev) => transitionState(prev, "done"));
    await persistSession([...messages, {
      id: generateId(), role: "user", content: `拒绝建议: ${suggestion.title}`, timestamp: Date.now(),
    }, msg]);
  }, [messages, addAssistantMessage, persistSession]);

  const handleClearHistory = useCallback(async () => {
    await clearChatHistory(SESSION_ID);
    const welcome: AgentMessage = {
      id: generateId(), role: "assistant", content: WELCOME_MESSAGE, timestamp: Date.now(),
    };
    setMessages([welcome]);
    setStateCtx(createInitialContext());
  }, []);

  const handleRetry = useCallback(() => {
    if (messages.length >= 2) {
      const lastUserMsg = messages.slice().reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setMessages((prev) => prev.filter((m) => !m.isError));
        setStateCtx(createInitialContext());
        handleSubmit(lastUserMsg.content);
      }
    }
  }, [messages, handleSubmit]);

  const value: AgentContextType = {
    open, state: stateCtx, messages,
    toggleOpen: () => setOpen((v) => !v),
    openChat: () => setOpen(true),
    closeChat: () => setOpen(false),
    sendMessage: handleSubmit,
    sendAndNavigate: (text: string) => {
      handleSubmit(text);
      router.push("/assistant");
    },
  };

  return (
    <AgentContext.Provider value={value}>
      {children}

      {/* Floating Action Button — quick access on all main pages */}
      {!isHiddenPage && !isAssistantPage && !open && (
        <button
          onClick={() => router.push("/assistant")}
          className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform select-none"
          style={{ background: "var(--lifeflow-primary)", boxShadow: "0 4px 24px rgba(37, 99, 235, 0.35)" }}
          aria-label="打开助手"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L9.7 8.5L3 9.7L8.3 14.7L7 21L12 17.5L17 21L15.7 14.7L21 9.7L14.3 8.5L12 2Z" fill="white" />
          </svg>
        </button>
      )}

      {!isHiddenPage && !isAssistantPage && open && (
        <AgentChat
          open={open}
          onClose={() => setOpen(false)}
          messages={messages}
          state={stateCtx.currentState}
          onSubmit={handleSubmit}
          onAcceptSuggestion={handleAcceptSuggestion}
          onModifySuggestion={handleModifySuggestion}
          onRejectSuggestion={handleRejectSuggestion}
          onClearHistory={handleClearHistory}
          onRetry={handleRetry}
          hasHistory={messages.length > 1}
        />
      )}
    </AgentContext.Provider>
  );
}
