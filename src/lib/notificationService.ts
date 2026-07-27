/**
 * Simple Web Notification service using the native Notification API.
 * No Service Worker push — just browser-level desktop notifications.
 */

let permissionGranted = false;

/**
 * Request browser notification permission.
 * Returns true if permission is granted (either newly or already).
 */
export async function requestPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("[Notification] 浏览器不支持 Notification API");
    return false;
  }

  if (Notification.permission === "granted") {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission === "denied") {
    console.warn("[Notification] 通知权限已被拒绝");
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    permissionGranted = result === "granted";
    return permissionGranted;
  } catch (e) {
    console.error("[Notification] 请求权限失败:", e);
    return false;
  }
}

/**
 * Send a browser notification if permission is granted.
 * @param title  - Notification title
 * @param body   - Notification body text
 * @param tag    - Optional tag to prevent duplicate notifications
 */
export function sendNotification(title: string, body: string, tag?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, { body, tag, icon: "/icon-192.png" });
  } catch (e) {
    console.error("[Notification] 发送通知失败:", e);
  }
}

/**
 * Check if permission is already granted (sync check).
 */
export function isPermissionGranted(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}
