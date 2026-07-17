"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Zap, Wallet, Heart, Palette, Database, Download, Upload, Info, ChevronRight, Moon, Sun, Monitor } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DensitySetting, FontSizeSetting, AnimationSetting } from "@/components/settings/PersonalizationSettings";
import { DataExport, DataImport } from "@/components/settings/DataTransfer";
import { usePWA } from "@/components/PWAProvider";

function SectionCard({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon className="w-4 h-4 text-gray-500" />}
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}

function StationNavItem({ label, path, icon: Icon, color, bg }: { label: string; path: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }) {
  return (
    <Link href={path}>
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <span className="flex-1 text-sm font-medium text-gray-700">{label}</span>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </Link>
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-gray-50">
        <span className="text-sm text-gray-700">网络状态</span>
        <span className={`text-xs font-medium ${isOffline ? "text-sys-orange" : "text-sys-green"}`}>
          {isOffline ? "离线" : "在线"}
        </span>
      </div>
      <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-gray-50">
        <span className="text-sm text-gray-700">桌面安装</span>
        <span className="text-xs font-medium text-gray-500">{isInstalled ? "已安装 ✓" : "未安装"}</span>
      </div>
      {isInstallable && !isInstalled && (
        <button
          onClick={() => installPrompt?.prompt()}
          className="w-full py-2.5 rounded-xl bg-sys-blue text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          安装到桌面
        </button>
      )}
      {hasUpdate && (
        <button
          onClick={updateApp}
          className="w-full py-2.5 rounded-xl bg-sys-orange text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          更新到最新版本
        </button>
      )}
      <button
        onClick={handleClearCache}
        className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        {cacheCleared ? "已清理 ✓" : "清除缓存"}
      </button>
      <p className="text-xs text-gray-400 text-center">不会丢失数据</p>
    </div>
  );
}

export default function GlobalSettingsPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">设置</h1>
          <p className="text-sm text-gray-500 mt-0.5">个性化你的工作台</p>
        </div>

        <div className="space-y-4">
          {/* Station Management */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SectionCard title="子站管理" icon={Palette}>
              <div className="space-y-2">
                <StationNavItem
                  label="效率 (Efficiency)"
                  path="/efficiency/settings"
                  icon={Zap}
                  color="text-sys-indigo"
                  bg="bg-indigo-50"
                />
                <StationNavItem
                  label="记账 (Accounting)"
                  path="/accounting/settings"
                  icon={Wallet}
                  color="text-sys-green"
                  bg="bg-green-50"
                />
                <StationNavItem
                  label="健康 (Health)"
                  path="/health/settings"
                  icon={Heart}
                  color="text-sys-orange"
                  bg="bg-orange-50"
                />
              </div>
            </SectionCard>
          </motion.div>

          {/* Appearance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <SectionCard title="外观" icon={Palette}>
              <ThemeToggle />
              <div className="mt-3">
                <DensitySetting />
              </div>
              <div className="mt-3">
                <FontSizeSetting />
              </div>
              <div className="mt-3">
                <AnimationSetting />
              </div>
            </SectionCard>
          </motion.div>

          {/* PWA Management */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <SectionCard title="应用管理" icon={Settings}>
              <PWASettingsBlock />
            </SectionCard>
          </motion.div>

          {/* Data */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <SectionCard title="数据" icon={Database}>
              <DataExport />
              <div className="mt-2">
                <DataImport />
              </div>
            </SectionCard>
          </motion.div>

          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
          >
            <SectionCard title="关于" icon={Info}>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-semibold text-gray-900">LifeFlow v2.2</p>
                <p>用系统思维管理人生</p>
                <p className="text-xs text-gray-400 mt-2">捕捉 · 规划 · 专注 · 回顾</p>
              </div>
            </SectionCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
