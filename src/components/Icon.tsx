/**
 * 图标 —— 极简内联 SVG（stroke 1.8，统一线性）
 * 定稿不引入图标库：依赖越少，离线越稳
 */

export interface IconProps {
  name: IconName;
  size?: number;
}

export type IconName =
  | "now"
  | "past"
  | "future"
  | "tools"
  | "plus"
  | "check"
  | "link"
  | "close";

const P: Record<IconName, string> = {
  now: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  past: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  future: "M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5",
  tools: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6",
  plus: "M12 5v14M5 12h14",
  check: "M20 6 9 17l-5-5",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  close: "M18 6 6 18M6 6l12 12",
};

export function Icon({ name, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={P[name]} />
    </svg>
  );
}
