"use client";

import { useState } from "react";
import OverviewHeader from "@/components/layout/OverviewHeader";
import QuickCaptureBar from "@/components/layout/QuickCaptureBar";
import CaptureInbox from "@/components/layout/CaptureInbox";
import TodayTab from "@/app/planner/TodayTab";
import TodayTimeline from "@/components/schedule/TodayTimeline";

export default function TodayPage() {
  const [inboxExpanded, setInboxExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-5xl px-5 pt-8 pb-24 md:px-8 md:pt-10">
        <OverviewHeader />

        {/* 快速捕捉 */}
        <div className="mb-6">
          <QuickCaptureBar
            inboxExpanded={inboxExpanded}
            onToggleInbox={() => setInboxExpanded((v) => !v)}
          />
          <CaptureInbox visible={inboxExpanded} />
        </div>

        {/* 今日任务 */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">今日任务</h2>
          <TodayTab />
        </div>

        {/* 今日日程时间线 */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">时间线</h2>
          <TodayTimeline />
        </div>
      </div>
    </div>
  );
}
