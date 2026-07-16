// ============================================================
// 定时提醒服务
// 纯客户端实现：setTimeout + localStorage 持久化 + 浏览器通知
// ============================================================

// ============================================================
// 类型
// ============================================================

export interface Reminder {
  id: string;
  type: 'task_due' | 'habit_checkin' | 'daily_review' | 'custom';
  title: string;
  message: string;
  scheduledTime: number; // timestamp ms
  repeat?: 'daily' | 'weekly' | 'none';
  enabled: boolean;
}

// ============================================================
// ReminderService
// ============================================================

export class ReminderService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly STORAGE_KEY = 'lf_reminders';

  /** 初始化：加载持久化提醒并重新调度 */
  init(): void {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return;

    let reminders: Reminder[];
    try { reminders = JSON.parse(stored); } catch { return; }

    const now = Date.now();
    for (const reminder of reminders) {
      if (!reminder.enabled) continue;

      // 已过期但有重复 → 计算下一次
      if (reminder.scheduledTime < now) {
        if (reminder.repeat === 'daily') {
          reminder.scheduledTime = this.getNextDailyTime(reminder.scheduledTime);
        } else if (reminder.repeat === 'weekly') {
          reminder.scheduledTime = this.getNextWeeklyTime(reminder.scheduledTime);
        } else {
          continue;
        }
      }

      this.scheduleReminder(reminder);
    }
  }

  /** 创建默认提醒（如果不存在） */
  createDefaults(): void {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try { if (JSON.parse(stored).length > 0) return; } catch {}
    }

    const now = new Date();
    const reviewTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);
    if (reviewTime.getTime() < now.getTime()) {
      reviewTime.setDate(reviewTime.getDate() + 1);
    }

    this.create({
      type: 'daily_review',
      title: '该复盘啦',
      message: '小织提醒你该写今天的编织日志了',
      scheduledTime: reviewTime.getTime(),
      repeat: 'daily',
      enabled: true,
    });
  }

  /** 创建提醒 */
  create(data: Omit<Reminder, 'id'>): Reminder {
    const id = crypto.randomUUID();
    const reminder: Reminder = { ...data, id };
    this.saveToStorage(reminder);
    this.scheduleReminder(reminder);
    return reminder;
  }

  /** 取消提醒 */
  cancel(id: string): void {
    this.clearTimer(id);
    this.removeFromStorage(id);
  }

  /** 获取所有提醒 */
  getAll(): Reminder[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(this.STORAGE_KEY);
    try { return stored ? JSON.parse(stored) : []; } catch { return []; }
  }

  /** 请求浏览器通知权限 */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  // ── 私有方法 ──

  private scheduleReminder(reminder: Reminder): void {
    this.clearTimer(reminder.id);

    const delay = reminder.scheduledTime - Date.now();
    if (delay <= 0) {
      this.trigger(reminder);
      return;
    }

    const timer = setTimeout(() => {
      this.trigger(reminder);
      if (reminder.repeat === 'daily') {
        reminder.scheduledTime = this.getNextDailyTime(reminder.scheduledTime);
        this.scheduleReminder(reminder);
      } else if (reminder.repeat === 'weekly') {
        reminder.scheduledTime = this.getNextWeeklyTime(reminder.scheduledTime);
        this.scheduleReminder(reminder);
      }
    }, delay);

    this.timers.set(reminder.id, timer);
  }

  private trigger(reminder: Reminder): void {
    // 浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(reminder.title, {
        body: reminder.message,
        icon: '/icon-192x192.png',
        tag: reminder.id,
      });
    }

    // 应用内 Toast（CustomEvent）
    window.dispatchEvent(new CustomEvent('lf-reminder', {
      detail: { title: reminder.title, message: reminder.message, id: reminder.id },
    }));

    console.log(`[Reminder] ${reminder.title}: ${reminder.message}`);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) { clearTimeout(timer); this.timers.delete(id); }
  }

  private saveToStorage(reminder: Reminder): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    let reminders: Reminder[] = stored ? JSON.parse(stored) : [];
    const idx = reminders.findIndex((r) => r.id === reminder.id);
    if (idx >= 0) reminders[idx] = reminder;
    else reminders.push(reminder);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reminders));
  }

  private removeFromStorage(id: string): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return;
    const reminders: Reminder[] = JSON.parse(stored);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reminders.filter((r) => r.id !== id)));
  }

  private getNextDailyTime(ts: number): number { return ts + 86400000; }
  private getNextWeeklyTime(ts: number): number { return ts + 604800000; }
}

export const reminderService = new ReminderService();
