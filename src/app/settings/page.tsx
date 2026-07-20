"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Moon, Download, Trash2, Info, MessageSquare } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { DataExport, DataImport } from "@/components/settings/DataTransfer";

export default function SettingsPage() {
  return (
    <div className="min-h-screen max-w-[430px] mx-auto px-4 pt-14 pb-[100px]" style={{ background: "var(--lifeflow-background)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/more" className="w-9 h-9 rounded-full border flex items-center justify-center" style={{ borderColor: "var(--lifeflow-border)", background: "var(--color-surface-card)" }}>
          <ChevronRight className="w-5 h-5 rotate-180" style={{ color: "var(--color-text-secondary)" }} />
        </Link>
        <h1 className="text-title-nav" style={{ color: "var(--color-text-primary)" }}>设置</h1>
      </div>

      {/* 外观 */}
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-disabled)" }}>外观</h2>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
              <span className="text-[17px]" style={{ color: "var(--color-text-primary)" }}>深色模式</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* 数据 */}
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-disabled)" }}>数据</h2>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
              <span className="text-[17px]" style={{ color: "var(--color-text-primary)" }}>导出数据</span>
            </div>
            <DataExport />
          </div>
          <div className="mx-5" style={{ borderTop: "0.5px solid var(--lifeflow-border)" }} />
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
              <span className="text-[17px]" style={{ color: "var(--color-text-primary)" }}>清除数据</span>
            </div>
            <DataImport />
          </div>
        </div>
      </div>

      {/* 关于 */}
      <div className="mb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-disabled)" }}>关于</h2>
        <div className="rounded-[20px] overflow-hidden" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
              <span className="text-[17px]" style={{ color: "var(--color-text-primary)" }}>版本</span>
            </div>
            <span className="text-[17px]" style={{ color: "var(--color-text-secondary)" }}>v2.6</span>
          </div>
          <div className="mx-5" style={{ borderTop: "0.5px solid var(--lifeflow-border)" }} />
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5" style={{ color: "var(--color-text-secondary)" }} />
              <span className="text-[17px]" style={{ color: "var(--color-text-primary)" }}>反馈</span>
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: "var(--color-text-disabled)" }} />
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="mt-8 rounded-[20px] py-4 text-center" style={{ background: "var(--color-surface-card)", boxShadow: "var(--shadow-card)" }}>
        <span className="text-[17px] font-medium" style={{ color: "var(--state-error)" }}>退出登录</span>
      </div>
    </div>
  );
}
