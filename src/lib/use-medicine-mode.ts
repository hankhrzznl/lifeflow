"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getMedicines } from "@/lib/db/health.db";
import { getUserSettings } from "@/lib/db";

/**
 * T18-6 吃药维修模式：条件激活，平时全站隐藏。
 * 激活条件（任一满足即浮现）：
 *  1. healthDB.medicines 存在 active 药品（有用药计划）
 *  2. settings.medicineEnabled 手动开启
 */
export function useMedicineMode(): { active: boolean; loading: boolean } {
  const medicines = useLiveQuery(() => getMedicines(), [], []);
  const settings = useLiveQuery(() => getUserSettings(), [], null);

  const hasActiveMed = (medicines ?? []).some(m => m.active);
  const manuallyEnabled = settings?.medicineEnabled === true;

  return {
    active: hasActiveMed || manuallyEnabled,
    loading: medicines === undefined,
  };
}
