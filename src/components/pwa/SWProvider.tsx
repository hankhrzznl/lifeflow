"use client";

import { useEffect, useCallback, useState, useRef, createContext, useContext, type ReactNode } from "react";

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
  const swRef = useRef<{
    reg: ServiceWorkerRegistration | null;
    worker: ServiceWorker | null;
    stateChangeHandler: (() => void) | null;
  }>({ reg: null, worker: null, stateChangeHandler: null });

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

    const handleUpdateFound = () => {
      const newWorker = swRef.current.reg?.installing;
      if (!newWorker) return;

      swRef.current.worker = newWorker;

      const handleStateChange = () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setWaitingWorker(newWorker);
          setIsUpdateAvailable(true);
        }
      };

      swRef.current.stateChangeHandler = handleStateChange;
      newWorker.addEventListener("statechange", handleStateChange);
    };

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        swRef.current.reg = registration;

        registration.addEventListener("updatefound", handleUpdateFound);

        if (registration.waiting) {
          swRef.current.worker = registration.waiting;
          setWaitingWorker(registration.waiting);
          setIsUpdateAvailable(true);
        }
      } catch (err) {
        console.error("[SWProvider] Service Worker 注册失败:", err);
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
      if (swRef.current.reg) {
        swRef.current.reg.removeEventListener("updatefound", handleUpdateFound);
      }
      if (swRef.current.worker && swRef.current.stateChangeHandler) {
        swRef.current.worker.removeEventListener("statechange", swRef.current.stateChangeHandler);
      }
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
