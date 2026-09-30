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
import type { Syncable } from "./sync-types";

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

/** 过滤软删的行 —— 界面这一层必须自己挡，否则删掉的东西还会显示 */
function live<T extends Syncable>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

async function readAll(): Promise<Ready> {
  await ensureSeed();
  const [rulesRaw, entriesRaw, proposalsRaw, toolViewsRaw] = await Promise.all([
    db.rules.toArray(),
    db.entries.toArray(),
    db.proposals.toArray(),
    db.toolViews.toArray(),
  ]);
  /* ⚠ 同步之后"删除"是软删（行还得上传；物理删了远端永远收不到这次删除），
     所以界面这一层必须过滤 deletedAt，否则删掉的东西会继续显示。 */
  const rules = live(rulesRaw);
  const entries = live(entriesRaw);
  const proposals = live(proposalsRaw);
  const toolViews = live(toolViewsRaw);

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
