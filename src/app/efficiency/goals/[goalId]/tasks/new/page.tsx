"use client";

import { useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { addScheduleTask } from "@/lib/db/efficiency.db";
import { showToast } from "@/components/ui/Toast";
import { CreateTaskSheet } from "@/components/efficiency/CreateTaskSheet";
import type { ScheduleTask } from "@/lib/db/efficiency.db";

// ============================================================
// 目标下创建任务页面
// ============================================================
export default function GoalTaskNewPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  const handleBack = useCallback(() => {
    router.push(`/efficiency/goals/${goalId}`);
  }, [router, goalId]);

  const handleSubmit = useCallback(async (task: Omit<ScheduleTask, "id" | "createdAt">) => {
    await addScheduleTask({ ...task, goalId });
    showToast({ type: "success", message: "任务已保存" });
    router.push(`/efficiency/goals/${goalId}`);
  }, [goalId, router]);

  return (
    <CreateTaskSheet
      open={true}
      goalId={goalId}
      inline
      onBack={handleBack}
      onClose={handleBack}
      onSubmit={handleSubmit}
    />
  );
}
