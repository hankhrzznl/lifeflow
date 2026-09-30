"use client";

/**
 * 数据 hook —— 界面永远只读 Dexie（定稿 §7：Local-first 不变）
 *
 * ⚠ 写入后必须广播 `lf:changed`，否则界面不刷新。
 *   所有写操作都要走 `notifyChanged()`（见下），不要直接改完就完事。
 */

import { useEffect, useState } from "react";
import { db, type EntryDoc, type ProposalDoc, type RuleDoc, type ToolViewDoc } from "./db";
import { ensureSeed } from "./seed";

export interface Ready {
  rules: RuleDoc[];
  entries: EntryDoc[];
  proposals: ProposalDoc[];
  toolViews: ToolViewDoc[];
  /** 还没被处理的提议 */
  openProposals: ProposalDoc[];
}

export type DataState = { status: "loading" } | { status: "ready"; data: Ready };

const EVT = "lf:changed";

/** 任何写入之后调用它，界面会自动重读 */
export function notifyChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

async function readAll(): Promise<Ready> {
  await ensureSeed();
  const [rules, entries, proposals, toolViews] = await Promise.all([
    db.rules.toArray(),
    db.entries.toArray(),
    db.proposals.toArray(),
    db.toolViews.toArray(),
  ]);
  rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  proposals.sort((a, b) => a.at.localeCompare(b.at));
  toolViews.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    rules,
    entries,
    proposals,
    toolViews,
    openProposals: proposals.filter((p) => !p.resolved),
  };
}

export function useData(): DataState {
  const [state, setState] = useState<DataState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    const run = () => {
      void readAll().then((d) => {
        if (alive) setState({ status: "ready", data: d });
      });
    };
    run();
    window.addEventListener(EVT, run);
    return () => {
      alive = false;
      window.removeEventListener(EVT, run);
    };
  }, []);

  return state;
}
