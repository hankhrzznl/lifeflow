"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DensitySetting, FontSizeSetting, AnimationSetting } from "@/components/settings/PersonalizationSettings";
import { DataExport, DataImport } from "@/components/settings/DataTransfer";
import { usePWA } from "@/components/PWAProvider";
import { useState } from "react";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-fabric p-4 space-y-4"
      style={{ backgroundColor: "var(--surface-fabric)", boxShadow: "var(--shadow-knit)" }}
    >
      <h3 className="text-lg" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function PWASettingsBlock() {
  const { isInstalled, isOffline, isInstallable, installPrompt, hasUpdate, updateApp } = usePWA();
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = async () => {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    }
  };

  const handleInstall = async () => { if (installPrompt) await installPrompt.prompt(); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-1">
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          网络：{isOffline ? "离线" : "在线"}
        </span>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isOffline ? "var(--warning)" : "var(--success)" }} />
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          桌面安装：{isInstalled ? "已安装" : "未安装"}
        </span>
        {isInstalled && <span className="text-xs" style={{ color: "var(--success)" }}>✓</span>}
      </div>
      {isInstallable && !isInstalled && (
        <button onClick={handleInstall} className="w-full px-4 py-2.5 rounded-md text-sm transition-colors"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--text-inverse)" }}>安装到桌面</button>
      )}
      {hasUpdate && (
        <button onClick={updateApp} className="w-full px-4 py-2.5 rounded-md text-sm transition-colors"
          style={{ backgroundColor: "var(--warning)", color: "var(--text-inverse)" }}>更新到最新版本</button>
      )}
      <button onClick={handleClearCache} className="w-full px-4 py-2.5 rounded-md text-sm border transition-colors"
        style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
        {cacheCleared ? "已清理" : "清除缓存"}
      </button>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>不会丢失数据</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: "var(--surface-desk)", color: "var(--text-primary)" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
          设置
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          个性化你的工作台
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        <SettingsSection title="外观">
          <ThemeToggle />
          <DensitySetting />
          <FontSizeSetting />
          <AnimationSetting />
        </SettingsSection>

        <SettingsSection title="应用管理">
          <PWASettingsBlock />
        </SettingsSection>

        <SettingsSection title="数据">
          <DataExport />
          <DataImport />
        </SettingsSection>

        <SettingsSection title="关于">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <p>LifeFlow v2.2</p>
            <p className="mt-1">织光者的工作台 — 用编织的视角管理生活</p>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
