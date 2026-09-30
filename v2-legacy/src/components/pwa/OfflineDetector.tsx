"use client";

import { useEffect } from "react";
import { showToast } from "@/components/ui/Toast";

export default function OfflineDetector() {
  useEffect(() => {
    const handleOffline = () => {
      showToast({
        message: "网络断开了，部分功能暂时不可用",
        type: "warning",
        duration: 4000,
      });
    };

    const handleOnline = () => {
      showToast({
        message: "网络恢复了",
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
