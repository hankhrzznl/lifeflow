"use client";

/**
 * 通用展示件 —— 指标、点阵、一条流
 * 指标一律从 lib/metrics.ts 取（单点计算），组件内不做任何算术
 */

import type { EntryDoc } from "@/lib/db";
import type { RuleMetrics } from "@/lib/metrics";

/* ── 一条流 ────────────────────────────────────────────── */
export function EntryRow({ e }: { e: EntryDoc }) {
  const time = e.at.slice(11, 16);
  const sign = e.sign === "out" ? "−" : e.sign === "in" ? "+" : "";
  const val =
    e.value != null ? `${sign}${e.value}${e.unit ? ` ${e.unit}` : ""}` : "";
  return (
    <div className="list__row">
      <div className="entry">
        <span className="entry__time">{time}</span>
        <span className="entry__text">{e.text}</span>
        {val ? <span className="entry__val">{val}</span> : null}
        {e.tags?.length ? <span className="tag">{e.tags[0]}</span> : null}
      </div>
    </div>
  );
}

/* ── 达标点阵（近 N 天）────────────────────────────────── */
export function DotStrip({
  days,
  className,
}: {
  /** true=达标 false=未达标 null=今天之后（不画） */
  days: (boolean | null)[];
  className?: string;
}) {
  return (
    <div className={`dots ${className ?? ""}`}>
      {days.map((d, i) => (
        <span
          key={i}
          className={`dots__d${d === true ? " dots__d--met" : ""}${
            i === days.length - 1 ? " dots__d--today" : ""
          }`}
        />
      ))}
    </div>
  );
}

export function rate(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/* ── 状态签 ─────────────────────────────────────────────── */
export function StateTag({ m }: { m: RuleMetrics }) {
  if (m.rule.state === "paused") return <span className="tag tag--paused">暂停</span>;
  if (m.rule.state === "archived") return <span className="tag">归档</span>;
  if (m.verdict === "solid") return <span className="tag tag--solid">稳了</span>;
  if (m.verdict === "stale") return <span className="tag tag--paused">没动</span>;
  return <span className="tag tag--grow">在养</span>;
}

/* ── 同步状态点（定稿：不靠 emoji，用小圆点）───────────── */
export function SyncDot({ label = "已同步" }: { label?: string }) {
  return (
    <span className="sync">
      <i className="sync__dot" />
      {label}
    </span>
  );
}
