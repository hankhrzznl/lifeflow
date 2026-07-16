"use client";

import { useState } from "react";

// ============================================================
// 类型
// ============================================================

type Density = "compact" | "comfortable" | "spacious";
type FontSize = "small" | "medium" | "large";

// ============================================================
// 布局密度
// ============================================================

export function DensitySetting() {
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem("lf-density") as Density) || "comfortable";
  });

  const options: Array<{ id: Density; label: string; desc: string }> = [
    { id: "compact", label: "紧凑", desc: "显示更多内容" },
    { id: "comfortable", label: "舒适", desc: "平衡显示" },
    { id: "spacious", label: "宽松", desc: "更大的间距" },
  ];

  const handleChange = (id: Density) => {
    setDensity(id);
    localStorage.setItem("lf-density", id);
    document.documentElement.setAttribute("data-density", id);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-base" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        布局密度
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleChange(opt.id)}
            className="p-3 rounded-lg border text-left transition-all"
            style={{
              borderColor: density === opt.id ? "var(--brand-primary)" : "var(--border)",
              backgroundColor: density === opt.id ? "var(--brand-primary-light)" : "var(--surface-fabric)",
            }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {opt.label}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {opt.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 字体大小
// ============================================================

export function FontSizeSetting() {
  const [size, setSize] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "medium";
    return (localStorage.getItem("lf-font-size") as FontSize) || "medium";
  });

  const sizes: Record<FontSize, string> = { small: "14px", medium: "16px", large: "18px" };

  const handleChange = (s: FontSize) => {
    setSize(s);
    localStorage.setItem("lf-font-size", s);
    document.documentElement.style.fontSize = sizes[s];
  };

  return (
    <div className="space-y-2">
      <h4 className="text-base" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        字体大小
      </h4>
      <div className="flex gap-2">
        {([{ id: "small" as const, label: "小" }, { id: "medium" as const, label: "中" }, { id: "large" as const, label: "大" }]).map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleChange(opt.id)}
            className="flex-1 py-3 rounded-lg border text-center transition-all"
            style={{
              borderColor: size === opt.id ? "var(--brand-primary)" : "var(--border)",
              backgroundColor: size === opt.id ? "var(--brand-primary-light)" : "var(--surface-fabric)",
            }}
          >
            <span className="font-bold" style={{
              fontSize: opt.id === "small" ? "14px" : opt.id === "large" ? "20px" : "16px",
              color: "var(--text-primary)",
            }}>Aa</span>
            <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{opt.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 动画开关
// ============================================================

export function AnimationSetting() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("lf-animations") !== "false";
  });

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("lf-animations", String(next));
    document.documentElement.setAttribute("data-animations", String(next));
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-base" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
          动画效果
        </h4>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>关闭可提升性能</p>
      </div>
      <button
        onClick={handleToggle}
        className="w-12 h-6 rounded-full transition-colors relative"
        style={{ backgroundColor: enabled ? "var(--brand-primary)" : "var(--knit-grid)" }}
      >
        <div
          className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform"
          style={{ transform: enabled ? "translateX(26px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
