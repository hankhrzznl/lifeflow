"use client";

/**
 * PWA 注册 —— 定稿 §6
 *   iPad 必须「加到主屏」：未加主屏会撞 Safari 的 7 天清存储，
 *   加了主屏的 web app 域名豁免 ITP（WebKit bug 209501 评论 3）
 *   所以这里除了注册 SW，还会在 iPad 上给出"加到主屏"的引导
 */

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // 注册 service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 注册失败不影响使用 */
      });
    }

    // iPad / iOS 未加主屏 → 提示（这是防丢的必要动作，不是可选项）
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIOS && !standalone) {
      const seen = localStorage.getItem("lf-homehint-seen");
      if (!seen) setShowHint(true);
    }
  }, []);

  if (!showHint) return null;

  return (
    <div
      role="dialog"
      aria-label="加到主屏提示"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(88px + env(safe-area-inset-bottom, 0px))",
        zIndex: 60,
        maxWidth: 430,
        margin: "0 auto",
      }}
    >
      <div className="card" style={{ borderColor: "var(--border-strong)" }}>
        <div className="row--between">
          <span className="t-bold">请把 LifeFlow 加到主屏</span>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              localStorage.setItem("lf-homehint-seen", "1");
              setShowHint(false);
            }}
          >
            知道了
          </button>
        </div>
        <p className="t-cap t-mut" style={{ marginTop: 6 }}>
          iPad 上未加到主屏的网页，Safari 会在 7 天不活跃后清掉本地数据。
          加到主屏后即被豁免（点「分享」→「添加到主屏幕」）。
        </p>
      </div>
    </div>
  );
}
