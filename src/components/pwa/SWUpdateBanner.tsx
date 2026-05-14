"use client";

import { useEffect } from "react";
import { useSW } from "./SWProvider";
import { showToast } from "@/components/ui/Toast";

export default function SWUpdateBanner() {
  const { isUpdateAvailable, applyUpdate } = useSW();

  useEffect(() => {
    if (isUpdateAvailable) {
      showToast({
        message: "有新版本可用",
        type: "info",
        duration: 0,
        undoAction: applyUpdate,
      });
    }
  }, [isUpdateAvailable, applyUpdate]);

  return null;
}
