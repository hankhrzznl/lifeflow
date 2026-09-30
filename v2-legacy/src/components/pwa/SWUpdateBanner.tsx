"use client";

import { useEffect } from "react";
import { useSW } from "./SWProvider";
import { showToast } from "@/components/ui/Toast";

export default function SWUpdateBanner() {
  const { isUpdateAvailable, applyUpdate } = useSW();

  useEffect(() => {
    if (isUpdateAvailable) {
      showToast({
        message: "有新版本，点我更新",
        type: "info",
        duration: 0,
        undoAction: applyUpdate,
      });
    }
  }, [isUpdateAvailable, applyUpdate]);

  return null;
}
