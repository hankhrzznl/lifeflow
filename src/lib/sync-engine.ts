"use client";

/**
 * 同步引擎 —— 推 / 拉 / 冲突 / 离线补传
 *
 * 设计要点（对应 docs/17 第四节，但按 v7 的取舍调整，理由见 sync-types.ts）：
 *
 *   push：把所有 updatedAt > lastPushedAt 的行上传（幂等 upsert）
 *   pull：拉 updated_at > lastPulledAt 的行，逐行做 LWW 合并
 *
 * ⚠ 最要命的一条：**拉取不能覆盖本地还没推上去的改动**。
 *   否则「刚记的一笔」会在下次 pull 时被云端旧版本盖掉 —— 数据就这么丢了。
 *   判据：本地行 updatedAt > lastPushedAt ⟹ 它是"脏"的 ⟹ 不参与 pull 覆盖，
 *   留给下一轮 push。这条比 LWW 本身更重要。
 *
 * 冲突策略：LWW（updated_at 大者赢）—— 决策 S2。
 *   个人工具、单人多设备，冲突概率极低；静默处理，不打扰用户。
 */

import { db } from "./db";
import { getAdapter } from "./sync-adapter";
import {
  EMPTY_SYNC_STATE,
  SYNC_TABLES,
  type RemoteRow,
  type SyncState,
  type SyncTable,
  type Syncable,
} from "./sync-types";
import { notifyChanged } from "./useData";
import { getWriteUser, setWriteUser } from "./write";

export const EVT_SYNC = "lf:sync";

export function notifySyncChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT_SYNC));
}

/* ─────────────────────────────────────────────────────────────
   当前用户
   ⚠ 这里**不装 Dexie 钩子**。
     最初想用钩子自动盖 updatedAt 做到"业务零改动"，结果钩子把数据写坏了
     （e2e 报 `Cannot create property 'updatedAt' on string 'p-exam'`）。
     现在改由 lib/write.ts 显式盖 —— 可读、可测。理由写在那边的文件头上。
   ───────────────────────────────────────────────────────────── */
export function setSyncUser(id: string): void {
  setWriteUser(id);
}

export function currentSyncUser(): string {
  return getWriteUser();
}

/* ─────────────────────────────────────────────────────────────
   游标读写
   ───────────────────────────────────────────────────────────── */
const K_PUSHED = (t: SyncTable) => `pushed:${t}`;
const K_PULLED = (t: SyncTable) => `pulled:${t}`;
const K_LAST = "lastSyncedAt";

async function getCursor(key: string): Promise<number> {
  const r = await db.syncMeta.get(key);
  return r ? Number(r.value) : 0;
}
async function setCursor(key: string, v: number): Promise<void> {
  await db.syncMeta.put({ key, value: String(v) });
}

/* ─────────────────────────────────────────────────────────────
   行 ↔ 远端格式
   ───────────────────────────────────────────────────────────── */
function toRemote(row: Record<string, unknown> & { id: string; updatedAt?: number; deletedAt?: number | null }): RemoteRow {
  /* payload 里放业务字段，把同步字段摘出去 —— 远端有独立的列存它们 */
  const { updatedAt, deletedAt, userId, ...rest } = row as Record<string, unknown> & Syncable;
  void userId;
  return {
    id: row.id,
    updated_at: updatedAt ?? Date.now(),
    deleted_at: deletedAt ?? null,
    payload: rest,
  };
}

/* ─────────────────────────────────────────────────────────────
   推送
   ───────────────────────────────────────────────────────────── */
export async function pushTable(table: SyncTable, batch = 200): Promise<number> {
  const adapter = getAdapter();
  if (!adapter.isConfigured()) return 0;
  const since = await getCursor(K_PUSHED(table));

  const all = (await db.table(table).toArray()) as Array<
    Record<string, unknown> & { id: string; updatedAt?: number }
  >;
  const dirty = all
    .filter((r) => (r.updatedAt ?? 0) > since)
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));

  if (!dirty.length) return 0;

  let pushed = 0;
  let maxTs = since;
  for (let i = 0; i < dirty.length; i += batch) {
    const slice = dirty.slice(i, i + batch);
    await adapter.push(table, slice.map((r) => toRemote(r)));
    pushed += slice.length;
    /* ⚠ 游标只在**成功之后**前进。失败时抛错 → 调用方保留游标 → 下次重推。
       这就是"离线不丢"的机制：不需要队列，因为上传的是行本身。 */
    maxTs = Math.max(maxTs, ...slice.map((r) => r.updatedAt ?? 0));
    await setCursor(K_PUSHED(table), maxTs);
  }
  return pushed;
}

/* ─────────────────────────────────────────────────────────────
   拉取 + LWW 合并
   ───────────────────────────────────────────────────────────── */
export async function pullTable(table: SyncTable): Promise<number> {
  const adapter = getAdapter();
  if (!adapter.isConfigured()) return 0;

  const pulledAt = await getCursor(K_PULLED(table));
  const pushedAt = await getCursor(K_PUSHED(table));
  const incoming = await adapter.pull(table, pulledAt);
  if (!incoming.length) return 0;

  const tableRef = db.table(table) as unknown as {
    get: (k: string) => Promise<(Record<string, unknown> & Syncable) | undefined>;
    put: (v: Record<string, unknown>) => Promise<unknown>;
  };

  let applied = 0;
  let maxTs = pulledAt;

  for (const r of incoming) {
    const local = await tableRef.get(r.id);
    const localTs = local?.updatedAt ?? 0;

    /* ① 本地更脏（还没推上去）→ 跳过，留给下一轮 push。
          这条守住"刚记的一笔不会被云端旧版本盖掉"。 */
    if (localTs > pushedAt && localTs >= r.updated_at) {
      maxTs = Math.max(maxTs, r.updated_at);
      continue;
    }

    /* ② LWW：时间戳大的赢 */
    if (local && localTs > r.updated_at) {
      maxTs = Math.max(maxTs, r.updated_at);
      continue;
    }

    await tableRef.put({
      ...r.payload,
      id: r.id,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      userId: getWriteUser(),
    });
    applied++;
    maxTs = Math.max(maxTs, r.updated_at);
  }

  await setCursor(K_PULLED(table), maxTs);
  return applied;
}

/* ─────────────────────────────────────────────────────────────
   一轮完整同步
   ───────────────────────────────────────────────────────────── */
export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error: string | null;
}

export async function syncOnce(): Promise<SyncResult> {
  const adapter = getAdapter();
  if (!adapter.isConfigured()) {
    return { ok: false, pushed: 0, pulled: 0, error: "未配置同步后端" };
  }

  let pushed = 0;
  let pulled = 0;
  try {
    /* 先推后拉：先把本地的推上去，再拉云端的，避免拉回来的又被本地旧值盖回去 */
    for (const t of SYNC_TABLES) pushed += await pushTable(t);
    for (const t of SYNC_TABLES) pulled += await pullTable(t);

    await db.syncMeta.put({ key: K_LAST, value: String(Date.now()) });
    notifySyncChanged();
    if (pulled > 0) notifyChanged(); // 拉到了新数据 → 界面刷新
    return { ok: true, pushed, pulled, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.syncMeta.put({ key: "lastError", value: msg });
    notifySyncChanged();
    return { ok: false, pushed, pulled, error: msg };
  }
}

/* ─────────────────────────────────────────────────────────────
   状态查询（给界面用）
   ───────────────────────────────────────────────────────────── */
export async function readSyncState(): Promise<SyncState> {
  const adapter = getAdapter();
  if (!adapter.isConfigured()) return { ...EMPTY_SYNC_STATE };

  const fromAdapter = await adapter.currentUserId();
  /* ⚠ 把适配器的身份同步到写入层 —— 否则新写入的行 userId 是空串，
     推到 Supabase 时 RLS（auth.uid() = user_id）会拒收。这是踩过的坑。 */
  if (fromAdapter && fromAdapter !== getWriteUser()) setWriteUser(fromAdapter);

  const userId = getWriteUser() || fromAdapter || "";
  let pending = 0;
  for (const t of SYNC_TABLES) {
    const since = await getCursor(K_PUSHED(t));
    const rows = (await db.table(t).toArray()) as Array<{ updatedAt?: number }>;
    pending += rows.filter((r) => (r.updatedAt ?? 0) > since).length;
  }
  const last = await db.syncMeta.get(K_LAST);
  const err = await db.syncMeta.get("lastError");

  return {
    configured: true,
    signedIn: !!userId,
    userId,
    pending,
    lastSyncedAt: last ? Number(last.value) : null,
    lastError: err?.value ?? null,
    busy: false,
  };
}

/* ─────────────────────────────────────────────────────────────
   自动同步的触发时机（依据 docs/17 §4.4）
     启动 / 登录成功 → 全量对齐
     网络恢复（online 事件）→ 补传
     定时兜底：每 5 分钟一次（防 Realtime 掉线）
   ───────────────────────────────────────────────────────────── */
let started = false;

export function startAutoSync(intervalMs = 5 * 60 * 1000): () => void {
  if (started) return () => {};
  started = true;

  void syncOnce();

  const onOnline = () => void syncOnce();
  window.addEventListener("online", onOnline);
  const timer = window.setInterval(() => void syncOnce(), intervalMs);

  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
    started = false;
  };
}
