"use client";

import { useEffect } from "react";
import { showToast } from "@/components/ui/Toast";

export default function OfflineDetector() {
  useEffect(() => {
    const handleOffline = () => {
      showToast({
        message: "网络已断开，部分功能可能不可用",
        type: "warning",
        duration: 4000,
      });
    };

    const handleOnline = () => {
      showToast({
        message: "网络已恢复",
        type: "success",
        duration: 2000,
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
