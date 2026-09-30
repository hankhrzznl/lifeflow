import type { Metadata, Viewport } from "next";
import "@/styles/tokens.css";
import "@/styles/app.css";
import { Tabbar, RailNav } from "@/components/Tabbar";
import { PwaRegister } from "@/components/PwaRegister";
import { SyncBootstrap } from "@/components/SyncBootstrap";

export const metadata: Metadata = {
  title: "LifeFlow · 一份记录，三种姿态",
  description: "此刻 / 刚过去 / 往后 —— 同一份记录的三个窗口。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LifeFlow",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF6F0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <div className="shell__body">
            {/* 桌面/平板：左侧竖导航（手机隐藏，由底栏接管）*/}
            <div className="shell__rail">
              <RailNav />
            </div>
            {/* 内容列 —— 每个页面自己声明右栏内容（平板/桌面显示）*/}
            {children}
          </div>
        </div>
        <Tabbar />
        <PwaRegister />
        {/* 同步启动器：没配置凭据时什么都不做（纯本地模式）*/}
        <SyncBootstrap />
      </body>
    </html>
  );
}
