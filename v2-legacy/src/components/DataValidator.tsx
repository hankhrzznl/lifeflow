"use client";

import { useEffect } from "react";
import { validateDataConsistency } from "@/lib/linkage";

const LAST_VALIDATE_KEY = "lifeflow_last_validate";

export default function DataValidator() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        const lastCheck = localStorage.getItem(LAST_VALIDATE_KEY);
        const now = Date.now();
        const fourHours = 4 * 60 * 60 * 1000;

        if (lastCheck && now - Number(lastCheck) < fourHours) {
          return;
        }

        const result = await validateDataConsistency();
        localStorage.setItem(LAST_VALIDATE_KEY, String(now));

        if (result.issues.length > 0) {
          if (typeof window !== "undefined" && window.location.hostname === "localhost") {
            console.info("[DataValidator] 自动修复问题:", result.issues);
          }
        }
      } catch {
        // 静默失败，不影响主流程
      }
    };

    timer = setTimeout(() => {
      check();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
