"use client";

import { useState, useEffect } from "react";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getPluginMeta } from "@/lib/db";

export default function TimelinePluginPage() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    getPluginMeta("timeline").then((p) => setActive(p?.status === "active"));
  }, []);

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Clock className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">时间轴插件未启用</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">请在插件管理中启用此插件</p>
        <Link href="/plugins" className="text-indigo-600 text-sm font-medium">前往插件管理</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/plugins" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">生命时间轴</h1>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">时间轴可视化即将上线</p>
        </div>
      </div>
    </div>
  );
}
