"use client";

import { useState, useCallback, useMemo } from "react";
import { addManualItem } from "@/lib/db/daylog.db";
import { showToast } from "@/components/ui/Toast";

// ============================================================
// 共享的 Item 创建逻辑
// 首页、目标详情页复用同一套表单状态和提交逻辑
// ============================================================

export interface ItemCreateForm {
  title: string;
  plannedStart: string;
  plannedEnd: string;
  note: string;
  color: string;
  projectId?: string;
  taskId?: string;
}

export function useItemCreate(defaults?: Partial<ItemCreateForm>) {
  const [form, setForm] = useState<ItemCreateForm>({
    title: "",
    plannedStart: "09:00",
    plannedEnd: "09:30",
    note: "",
    color: "#6366F1",
    projectId: defaults?.projectId,
    taskId: defaults?.taskId,
    ...defaults,
  });
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback(<K extends keyof ItemCreateForm>(key: K, value: ItemCreateForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setForm({
      title: "",
      plannedStart: "09:00",
      plannedEnd: "09:30",
      note: "",
      color: "#6366F1",
      projectId: defaults?.projectId,
      taskId: defaults?.taskId,
    });
  }, [defaults?.projectId, defaults?.taskId]);

  const submit = useCallback(async (date: string) => {
    if (!form.title.trim()) {
      showToast({ type: "warning", message: "标题还没填" });
      return false;
    }
    setSubmitting(true);
    try {
      await addManualItem({
        date,
        plannedStart: form.plannedStart,
        plannedEnd: form.plannedEnd,
        title: form.title.trim(),
        note: form.note || undefined,
        color: form.color,
        projectId: form.projectId,
      } as any);  // taskId 在 Item 上已存在但 addManualItem 参数不含，后续可加
      showToast({ type: "success", message: "已添加" });
      reset();
      return true;
    } catch {
      showToast({ type: "error", message: "没有添加成功，再试一次？" });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [form, reset]);

  return { form, setField, submitting, submit, reset };
}

export const PRESET_COLORS = ["#6366F1", "#FF9500", "#34C759", "#FF3B30", "#007AFF", "#5856D6", "#AF52DE", "#00C7BE"];
