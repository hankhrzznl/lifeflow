import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomTabBar from "@/components/navigation/BottomTabBar";
import { ToastContainer } from "@/components/ui/Toast";
import FAB from "@/components/ui/FAB";
import ClientProviders from "@/components/ClientProviders";
import SWProvider from "@/components/pwa/SWProvider";
import SWUpdateBanner from "@/components/pwa/SWUpdateBanner";
import StorageMonitor from "@/components/pwa/StorageMonitor";
import OfflineDetector from "@/components/pwa/OfflineDetector";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import UpgradeNotification from "@/components/UpgradeNotification";
import DataValidator from "@/components/DataValidator";

export const metadata: Metadata = {
  title: "LifeFlow",
  description: "捕捉 · 规划 · 专注 · 回顾",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--background)]">
        <ClientProviders>
          <SWProvider>
            <GlobalErrorBoundary>
            <main className="flex-1 pb-16 overflow-auto min-h-screen">
              {children}
            </main>
            <BottomTabBar />
            <FAB />
            <ToastContainer />
            <SWUpdateBanner />
            <StorageMonitor />
            <OfflineDetector />
            <UpgradeNotification />
            <DataValidator />
            </GlobalErrorBoundary>
          </SWProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
