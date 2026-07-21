"use client";

import { useState } from "react";
import { Moon, Download, Trash2, Info, MessageSquare, ChevronRight } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { DataExport, DataImport } from "@/components/settings/DataTransfer";

// ─── iOS Toggle Switch ────────────────────────────────────────
function ToggleSwitch({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="relative shrink-0 rounded-full cursor-pointer border-none outline-none"
      style={{
        width: 51, height: 31,
        background: checked ? "var(--lifeflow-primary)" : "var(--lifeflow-border)",
        transition: "background 0.2s",
      }}>
      <div className="absolute rounded-full bg-white"
        style={{
          width: 27, height: 27, top: 2,
          left: checked ? 22 : 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "left 0.2s",
        }} />
    </button>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const toggleDark = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <div className="min-h-screen max-w-[430px] mx-auto pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header - 居中"设置"标题 */}
      <div className="flex items-center justify-center h-[44px] px-4 pt-3 relative">
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>设置</h1>
      </div>

      {/* 外观 */}
      <div className="px-4 pt-6 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>外观</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Moon className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>深色模式</span>
            </div>
            <ToggleSwitch checked={isDark} onChange={toggleDark} label="深色模式" />
          </div>
        </div>
      </div>

      {/* 数据 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>数据</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Download className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>导出数据</span>
            </div>
            <DataExport />
          </div>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Trash2 className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>清除数据</span>
            </div>
            <DataImport />
          </div>
        </div>
      </div>

      {/* 关于 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[13px] font-medium px-5 pt-4 pb-2" style={{ color: "var(--color-text-secondary)" }}>关于</p>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Info className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>版本</span>
            </div>
            <span className="text-[17px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>v2.6</span>
          </div>
          <div className="h-px" style={{ background: "var(--lifeflow-border)", marginLeft: "52px" }} />
          <div className="flex items-center justify-between w-full px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <MessageSquare className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-primary)" }} />
              <span className="text-[17px] truncate" style={{ color: "var(--color-text-primary)" }}>反馈</span>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "var(--color-text-disabled)" }} />
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="px-4 pt-8">
        <button type="button"
          className="w-full h-12 text-center text-[17px] font-medium rounded-[20px]"
          style={{ background: "var(--color-surface-card)", color: "var(--color-expense)", boxShadow: "var(--shadow-card)" }}>
          退出登录
        </button>
      </div>
    </div>
  );
}
