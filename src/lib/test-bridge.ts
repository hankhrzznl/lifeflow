"use client";

/**
 * 测试与调试入口 —— 把同步引擎挂到 window.__lf
 *
 * 为什么需要它：同步的正确性（离线不丢、脏数据不被覆盖、软删传播）
 * 必须在**真实的两端**上验证，不能靠"读代码觉得对"。
 * 自动化测试需要一个从页面里驱动同步的入口，而模块内部函数在打包后
 * 拿不到，所以显式开一个受控入口。
 *
 * ⚠ 只挂只读/同步相关的东西，不放业务写接口。
 *   生产上它也无害：外部拿不到 memory 适配器（那要主动 setAdapter）。
 */

import { MemoryAdapter, setAdapter, getAdapter } from "./sync-adapter";
import { syncOnce, readSyncState, pushTable, pullTable } from "./sync-engine";
import { db } from "./db";

export interface LfTestBridge {
  useMemoryAdapter: (userId?: string) => void;
  useRealAdapter: () => void;
  isConfigured: () => boolean;
  syncOnce: () => Promise<unknown>;
  pushTable: (t: string) => Promise<number>;
  pullTable: (t: string) => Promise<number>;
  state: () => Promise<unknown>;
  dumpRemote: (t: string) => unknown;
  setRemoteFailing: (v: boolean) => void;
  remoteStats: () => unknown;
  cursor: (key: string) => Promise<string | null>;
  rows: (t: string) => Promise<unknown[]>;
}

let memory: MemoryAdapter | null = null;

export function installTestBridge(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __lf?: LfTestBridge };
  if (w.__lf) return;

  w.__lf = {
    useMemoryAdapter(userId = "test-user") {
      memory = new MemoryAdapter(userId);
      setAdapter(memory);
    },
    useRealAdapter() {
      memory = null;
      setAdapter(null);
    },
    isConfigured: () => getAdapter().isConfigured(),
    syncOnce: () => syncOnce(),
    pushTable: (t) => pushTable(t as never),
    pullTable: (t) => pullTable(t as never),
    state: () => readSyncState(),
    dumpRemote: (t) => (memory ? memory.dump(t as never) : []),
    setRemoteFailing(v: boolean) {
      if (memory) memory.failing = v;
    },
    remoteStats: () => (memory ? memory.stats : null),
    async cursor(key: string) {
      const r = await db.syncMeta.get(key);
      return r ? r.value : null;
    },
    rows: (t) => db.table(t).toArray() as Promise<unknown[]>,
  };
}
