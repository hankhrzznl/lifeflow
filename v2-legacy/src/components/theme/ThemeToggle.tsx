"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: "light" as const, icon: "☀️", label: "浅色" },
    { id: "dark" as const, icon: "🌙", label: "深色" },
    { id: "system" as const, icon: "💻", label: "系统" },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-lg p-1"
      style={{ backgroundColor: "var(--surface-desk-light)" }}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setTheme(opt.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors"
          style={{
            backgroundColor: theme === opt.id ? "var(--surface-fabric)" : "transparent",
            color: theme === opt.id ? "var(--brand-primary)" : "var(--text-secondary)",
            boxShadow: theme === opt.id ? "var(--shadow-subtle)" : "none",
          }}
        >
          <span>{opt.icon}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
