import { getPendingReminders, updateReminderStatus, addReminderLog, getTask } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";
import type { Reminder, Task } from "@/lib/types";

interface ReminderWithTask extends Reminder {
  task?: Task;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if ("Notification" in window) {
    return Notification.requestPermission();
  }
  return "denied";
}

export async function hasNotificationPermission(): Promise<boolean> {
  if ("Notification" in window) {
    return Notification.permission === "granted";
  }
  return false;
}

export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      ...options,
      icon: "/favicon.ico",
    });
  }
}

export async function checkAndShowReminders(): Promise<void> {
  try {
    const pending = await getPendingReminders();
    if (pending.length === 0) return;

    const withTasks = await Promise.all(
      pending.map(async (r) => {
        const task = await getTask(r.taskId);
        return { ...r, task };
      })
    );

    for (const reminder of withTasks) {
      if (await hasNotificationPermission()) {
        await showNotification(reminder.message, {
          body: reminder.task?.title || "点击查看详情",
          tag: `reminder-${reminder.id}`,
        });
      }

      showToast({
        message: reminder.message,
        type: "info",
        duration: 5000,
      });

      await addReminderLog(reminder.id!, "shown");
    }
  } catch (err) {
    console.error("Failed to check reminders:", err);
  }
}

export async function dismissReminder(reminderId: number): Promise<void> {
  await updateReminderStatus(reminderId, "dismissed");
  await addReminderLog(reminderId, "dismissed");
}

export async function completeReminder(reminderId: number): Promise<void> {
  await updateReminderStatus(reminderId, "completed");
  await addReminderLog(reminderId, "completed");
}

export async function snoozeReminder(reminderId: number, minutes: number): Promise<void> {
  const snoozeUntil = Date.now() + minutes * 60 * 1000;
  await updateReminderStatus(reminderId, "snoozed", snoozeUntil);
  await addReminderLog(reminderId, "snoozed");
}

export function scheduleReminderCheck(intervalMinutes: number = 5): () => void {
  const interval = setInterval(checkAndShowReminders, intervalMinutes * 60 * 1000);
  return () => clearInterval(interval);
}
