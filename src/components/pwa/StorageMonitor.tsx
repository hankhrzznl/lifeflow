"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { checkStorageSpace } from "@/lib/db";
import { showToast } from "@/components/ui/Toast";

export default function StorageMonitor() {
  const warnedCritical = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const result = await checkStorageSpace();
      if (!result) return;

      if (result.isCritical && !warnedCritical.current) {
        warnedCritical.current = true;
        showToast({
          message: "存储空间快满了，清理一下旧数据？",
          type: "error",
          duration: 0,
          action: {
            label: "前往回收站",
            onClick: () => router.push("/trash"),
          },
        });
      } else if (result.isWarning && !result.isCritical) {
        showToast({
          message: `存储空间用了 ${Math.round(result.percentUsed)}%，建议清理一下`,
          type: "warning",
          duration: 8000,
          action: {
            label: "前往回收站",
            onClick: () => router.push("/trash"),
          },
        });
      }
    };

    check();
    const timer = setInterval(check, 60000);

    return () => clearInterval(timer);
  }, [router]);

  return null;
}
