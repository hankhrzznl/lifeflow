"use client";

import { useEffect, useState, type ReactNode } from "react";

// ============================================================
// 类型
// ============================================================

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  hasUpdate: boolean;
  updateApp: () => void;
}

// ============================================================
// usePWA Hook
// ============================================================

export function usePWA(): PWAState {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // 检查是否已安装
    if (typeof window !== "undefined") {
      if (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true) {
        setIsInstalled(true);
      }
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setIsInstallable(true);
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    // SW 更新检测
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setHasUpdate(true);
              }
            });
          }
        });

        const checkInterval = setInterval(() => { registration.update(); }, 30 * 60 * 1000);
        return () => clearInterval(checkInterval);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const updateApp = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      });
    }
  };

  return { isInstallable, isInstalled, isOffline, installPrompt, hasUpdate, updateApp };
}

// ============================================================
// InstallPrompt 组件
// ============================================================

export function InstallPrompt() {
  const { isInstallable, isInstalled, installPrompt } = usePWA();
  const [visible, setVisible] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (!isInstallable || isInstalled) { setVisible(false); return; }
    const dismissed = localStorage.getItem("lifeflow_install_dismissed");
    const shownCount = parseInt(localStorage.getItem("lifeflow_install_shown_count") || "0", 10);
    if (dismissed || shownCount >= 3) return;

    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem("lifeflow_install_shown_count", String(shownCount + 1));
    }, 2000);
    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setJustInstalled(true);
      setTimeout(() => setVisible(false), 2000);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("lifeflow_install_dismissed", "true");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 transition-all">
      <div className="rounded-fabric p-4 shadow-modal" style={{ backgroundColor: "var(--surface-fabric)", border: "1px solid var(--border)" }}>
        {justInstalled ? (
          <div className="flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <span className="text-lg">✅</span>
            <div>
              <p className="font-medium">安装成功！</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>LifeFlow已添加到您的桌面</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--surface-desk-light)" }}>
                <span className="text-2xl">🧶</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>安装 LifeFlow</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>添加到桌面，随时打开，离线也能用</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDismiss} className="flex-1 px-4 py-2 text-sm rounded-md transition-colors"
                style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-desk-light)" }}>暂不</button>
              <button onClick={handleInstall} className="flex-1 px-4 py-2 text-sm rounded-md transition-colors flex items-center justify-center gap-1.5"
                style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)" }}>安装</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// UpdatePrompt 组件
// ============================================================

export function UpdatePrompt() {
  const { hasUpdate, updateApp } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] text-white px-4 py-3" style={{ backgroundColor: "var(--brand-secondary)" }}>
      <div className="max-w-screen-lg mx-auto flex items-center justify-between">
        <span className="text-sm">LifeFlow有新版本可用</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg hover:bg-white/10">✕</button>
          <button onClick={updateApp} className="px-4 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--text-inverse)", color: "var(--brand-secondary)" }}>立即更新</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PWAProvider
// ============================================================

export function PWAProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
