"use client";

/**
 * 交付物壳 —— 四格底栏（定稿 §8.2）
 *   此刻 / 刚过去 / 往后 / 工具
 *
 * 三档布局（定稿 §6）：
 *   手机   → 底栏（固定）
 *   平板   → 左侧竖导航 + 双栏
 *   电脑   → 左侧竖导航 + 三栏
 * 底栏在 ≥768px 隐藏，由 railnav 接管（同一份链接，两种呈现）
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName; hint: string }[] = [
  { href: "/", label: "此刻", icon: "now", hint: "今天做什么" },
  { href: "/past", label: "刚过去", icon: "past", hint: "这段怎么样" },
  { href: "/future", label: "往后", icon: "future", hint: "按什么标准" },
  { href: "/tools", label: "工具", icon: "tools", hint: "记账 / 备忘 / 倒数日" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/log";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function RailNav() {
  const pathname = usePathname();
  return (
    <nav className="railnav" aria-label="主导航">
      <div className="railnav__label">三个姿态</div>
      {TABS.slice(0, 3).map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="railnav__item"
          aria-current={isActive(pathname, t.href) ? "page" : undefined}
        >
          <Icon name={t.icon} size={16} />
          <span className="grow">{t.label}</span>
          <span className="t-cap t-faint">{t.hint}</span>
        </Link>
      ))}
      <div className="railnav__label">另一类</div>
      {TABS.slice(3).map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="railnav__item"
          aria-current={isActive(pathname, t.href) ? "page" : undefined}
        >
          <Icon name={t.icon} size={16} />
          <span className="grow">{t.label}</span>
          <span className="t-cap t-faint">{t.hint}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Tabbar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="主导航">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="tabbar__item"
          aria-current={isActive(pathname, t.href) ? "page" : undefined}
        >
          <Icon name={t.icon} size={20} />
          <span>{t.label}</span>
          <span className="tabbar__dot" />
        </Link>
      ))}
    </nav>
  );
}
