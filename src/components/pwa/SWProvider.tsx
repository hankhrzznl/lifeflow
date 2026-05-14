"use client";

import { useEffect, useCallback, useState, createContext, useContext, type ReactNode } from "react";

interface SWContextValue {
  isUpdateAvailable: boolean;
  applyUpdate: () => void;
}

const SWContext = createContext<SWContextValue>({
  isUpdateAvailable: false,
  applyUpdate: () => {},
});

export const useSW = () => useContext(SWContext);

export default function SWProvider({ children }: { children: ReactNode }) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      waitingWorker.addEventListener("statechange", () => {
        if (waitingWorker.state === "activated") {
          window.location.reload();
        }
      });
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setIsUpdateAvailable(true);
            }
          });
        });

        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setIsUpdateAvailable(true);
        }
      } catch {
        // SW registration failed silently - app still works online
      }
    };

    registerSW();

    let wasOnline = navigator.onLine;

    const handleOnline = () => {
      if (!wasOnline) {
        wasOnline = true;
      }
    };

    const handleOffline = () => {
      wasOnline = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <SWContext.Provider value={{ isUpdateAvailable, applyUpdate }}>
      {children}
    </SWContext.Provider>
  );
}
