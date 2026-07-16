/**
 * 在场感知 —— 实时陪伴用户
 * 番茄钟提醒 / 长时间未操作轻推 / 下午低谷提醒
 */

export interface PresenceReminder {
  type: "break" | "idle" | "afternoon_slump" | "encouragement";
  message: string;
  priority: "low" | "medium" | "high";
}

export class PresenceEngine {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastActivity = Date.now();
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(reminder: PresenceReminder) => void> = [];

  start(): void {
    const events = ["click", "touchstart", "keydown", "scroll"];
    const handler = () => { this.lastActivity = Date.now(); };
    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    this.idleTimer = setInterval(() => this.checkIdle(), 60000);
    this.scheduleAfternoonCheck();
  }

  stop(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    if (this.idleTimer) clearInterval(this.idleTimer);
  }

  onTaskStart(_taskTitle: string): void {
    const timer = setTimeout(() => {
      this.notify({ type: "break", message: "你已经连续工作25分钟了，休息2分钟吧~喝杯水，眺望一下远方。", priority: "low" });
    }, 25 * 60 * 1000);
    this.timers.set("pomodoro", timer);
  }

  onTaskComplete(streakCount: number): void {
    const t = this.timers.get("pomodoro");
    if (t) clearTimeout(t);
    if (streakCount > 0 && streakCount % 5 === 0) {
      this.notify({ type: "encouragement", message: `连续完成${streakCount}个任务了！保持这个势头！`, priority: "low" });
    }
  }

  onReminder(listener: (reminder: PresenceReminder) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  private checkIdle(): void {
    const idleMinutes = (Date.now() - this.lastActivity) / 60000;
    if (idleMinutes > 30) {
      this.notify({ type: "idle", message: "还在吗？今天的任务还在等你哦~哪怕完成一件小事也是进步。", priority: "medium" });
    }
  }

  private scheduleAfternoonCheck(): void {
    const now = new Date();
    const target = new Date();
    target.setHours(15, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    setTimeout(() => {
      this.notify({ type: "afternoon_slump", message: "下午3点是效率低谷期，来杯咖啡或做5分钟拉伸，再做一件简单的事找回状态。", priority: "low" });
      setInterval(() => {
        this.notify({ type: "afternoon_slump", message: "下午容易犯困，来杯咖啡，再做一件简单的事吧！", priority: "low" });
      }, 86400000);
    }, ms);
  }

  private notify(reminder: PresenceReminder): void {
    this.listeners.forEach((l) => { try { l(reminder); } catch { /* ignore */ } });
  }
}

export const presenceEngine = new PresenceEngine();
