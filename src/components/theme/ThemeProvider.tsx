"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ============================================================
// 类型
// ============================================================

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

// ============================================================
// CSS 变量切换（Apple System UI）
// ============================================================

function applyDarkTokens() {
  const root = document.documentElement;
  root.style.setProperty("--bg-primary", "#000000");
  root.style.setProperty("--bg-secondary", "#1C1C1E");
  root.style.setProperty("--text-primary", "#FFFFFF");
  root.style.setProperty("--text-secondary", "#EBEBF5");
  root.style.setProperty("--text-tertiary", "#8E8E93");
  root.style.setProperty("--text-inverse", "#000000");
  root.style.setProperty("--card-bg", "#1C1C1E");
  root.style.setProperty("--card-border", "#38383A");
  root.style.setProperty("--border", "#38383A");
  root.style.setProperty("--border-light", "#2C2C2E");
  root.style.setProperty("--background", "#000000");
  root.style.setProperty("--foreground", "#FFFFFF");
  root.classList.add("dark");
  root.classList.remove("light");
}

function applyLightTokens() {
  const root = document.documentElement;
  root.style.setProperty("--bg-primary", "#FFFFFF");
  root.style.setProperty("--bg-secondary", "#F5F5F7");
  root.style.setProperty("--text-primary", "#000000");
  root.style.setProperty("--text-secondary", "#3C3C43");
  root.style.setProperty("--text-tertiary", "#8E8E93");
  root.style.setProperty("--text-inverse", "#FFFFFF");
  root.style.setProperty("--card-bg", "#FFFFFF");
  root.style.setProperty("--card-border", "#E5E5EA");
  root.style.setProperty("--border", "#E5E5EA");
  root.style.setProperty("--border-light", "#F2F2F7");
  root.style.setProperty("--background", "#F5F5F7");
  root.style.setProperty("--foreground", "#000000");
  root.classList.add("light");
  root.classList.remove("dark");
}

// ============================================================
// Provider
// ============================================================

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("lf-theme") as Theme) || "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const resolve = () => {
      if (theme === "system") {
        setResolvedTheme(
          window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        );
      } else {
        setResolvedTheme(theme);
      }
    };
    resolve();

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (theme === "system") {
        setResolvedTheme(mql.matches ? "dark" : "light");
      }
    };
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [theme]);

  useEffect(() => {
    if (resolvedTheme === "dark") applyDarkTokens();
    else applyLightTokens();
  }, [resolvedTheme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("lf-theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
