"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import MascotIllustration from "@/components/ui/MascotIllustration";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "var(--surface-fabric)" }}>
      <div className="mb-6">
        <MascotIllustration state="confused" size={96} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <WifiOff className="w-5 h-5" style={{ color: "var(--brand-secondary)" }} />
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>网络离线</h1>
      </div>
      <p className="text-center mb-8 max-w-xs" style={{ color: "var(--text-secondary)" }}>
        小织找不到网络了，但已缓存的数据仍可查看。请检查网络连接后重试。
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/today" className="px-6 py-3 rounded-md text-center font-medium transition-colors" style={{ backgroundColor: "var(--brand-secondary)", color: "var(--text-inverse)" }}>
          查看今日任务（离线可用）
        </Link>
        <Link href="/goals" className="px-6 py-3 rounded-md text-center border transition-colors" style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--surface-fabric)" }}>
          查看目标列表
        </Link>
      </div>
      <button onClick={() => window.location.reload()} className="mt-4 text-sm underline" style={{ color: "var(--brand-secondary)" }}>
        重新加载
      </button>
    </div>
  );
}
