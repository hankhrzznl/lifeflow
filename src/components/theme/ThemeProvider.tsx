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
// CSS 变量切换
// ============================================================

function applyDarkTokens() {
  const root = document.documentElement;
  root.style.setProperty("--surface-desk", "#2D2520");
  root.style.setProperty("--surface-desk-light", "#3D342E");
  root.style.setProperty("--surface-fabric", "#3A322C");
  root.style.setProperty("--surface-fabric-hover", "#453D36");
  root.style.setProperty("--brand-primary-light", "rgba(232,141,103,0.15)");
  root.style.setProperty("--brand-secondary", "#A89080");
  root.style.setProperty("--text-primary", "#F5F0E8");
  root.style.setProperty("--text-secondary", "#C4B5A5");
  root.style.setProperty("--text-tertiary", "#8B7D6B");
  root.style.setProperty("--text-inverse", "#3D342E");
  root.style.setProperty("--card-bg", "#3A322C");
  root.style.setProperty("--card-border", "#5A4E44");
  root.style.setProperty("--border", "#5A4E44");
  root.style.setProperty("--border-light", "#4A423C");
  root.style.setProperty("--knit-bg", "#4A423C");
  root.style.setProperty("--knit-grid", "#5A524C");
  root.style.setProperty("--background", "#2D2520");
  root.style.setProperty("--foreground", "#F5F0E8");
  root.classList.add("dark");
  root.classList.remove("light");
}

function applyLightTokens() {
  const root = document.documentElement;
  root.style.setProperty("--surface-desk", "#D4C5B5");
  root.style.setProperty("--surface-desk-light", "#E8DDD4");
  root.style.setProperty("--surface-fabric", "#F5F0E8");
  root.style.setProperty("--surface-fabric-hover", "#EDE7DB");
  root.style.setProperty("--brand-primary-light", "#FDE8E0");
  root.style.setProperty("--brand-secondary", "#8B6F5E");
  root.style.setProperty("--text-primary", "#3D342E");
  root.style.setProperty("--text-secondary", "#6B5E54");
  root.style.setProperty("--text-tertiary", "#A39E99");
  root.style.setProperty("--text-inverse", "#FAF6F0");
  root.style.setProperty("--card-bg", "#F5F0E8");
  root.style.setProperty("--card-border", "#E8DDD4");
  root.style.setProperty("--border", "#D4C5B5");
  root.style.setProperty("--border-light", "#E8DDD4");
  root.style.setProperty("--knit-bg", "#E8DDD4");
  root.style.setProperty("--knit-grid", "#C4B5A5");
  root.style.setProperty("--background", "#D4C5B5");
  root.style.setProperty("--foreground", "#3D342E");
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
