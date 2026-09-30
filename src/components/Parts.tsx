"use client";

/**
 * 通用展示件 —— 指标、点阵、一条流、同步状态点
 * 指标一律从 lib/metrics.ts 取（单点计算），组件内不做任何算术
 */

import { useEffect, useState } from "react";
import type { EntryDoc } from "@/lib/db";
import type { RuleMetrics } from "@/lib/metrics";
import { EVT_SYNC, readSyncState } from "@/lib/sync-engine";
import { EMPTY_SYNC_STATE, type SyncState } from "@/lib/sync-types";

/** 订阅同步状态 */
export function useSyncState(): SyncState {
  const [s, setS] = useState<SyncState>(EMPTY_SYNC_STATE);
  useEffect(() => {
    let alive = true;
    const run = () => {
      void readSyncState().then((v) => {
        if (alive) setS(v);
      });
    };
    run();
    window.addEventListener(EVT_SYNC, run);
    const t = window.setInterval(run, 4000);
    return () => {
      alive = false;
      window.removeEventListener(EVT_SYNC, run);
      window.clearInterval(t);
    };
  }, []);
  return s;
}

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

/* ── 同步状态点 ──────────────────────────────────────────
   三态，**不用 emoji**，用小圆点 + 颜色（沿用 state-dot 的语义）：
     灰 = 纯本地（未接同步）· 蓝 = 有改动待推 · 绿 = 已同步
   依据 docs/17 §五：同步状态要看得见，但不能成为噪音。
   ──────────────────────────────────────────────────────── */
export function SyncDot({ label }: { label?: string }) {
  const s = useSyncState();

  let tone: "off" | "pending" | "ok" = "off";
  if (s.configured && s.signedIn) tone = s.pending > 0 ? "pending" : "ok";

  const text =
    label ??
    (tone === "off"
      ? "仅本机"
      : s.busy
        ? "同步中"
        : tone === "pending"
          ? `待同步 ${s.pending}`
          : "已同步");

  return (
    <span className={`sync${tone !== "off" ? ` sync--${tone}` : ""}`} title={s.lastError ?? undefined}>
      <i className="sync__dot" />
      {text}
    </span>
  );
}
