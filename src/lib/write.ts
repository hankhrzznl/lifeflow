"use client";

/**
 * 写入层 —— **所有业务写操作都从这里走**
 *
 * 为什么要有这一层（这是踩过坑之后的决定）：
 *   最初我在 Dexie 的 creating/updating 钩子里自动盖 `updatedAt`，
 *   想做到"业务代码一行不改"。结果钩子把数据写坏了 ——
 *   同步 e2e 直接报 `Cannot create property 'updatedAt' on string 'p-exam'`，
 *   推上去的是垃圾、跨设备拉回来 0 行、userId 也没盖上。
 *
 *   教训：**同步元数据不该藏在框架钩子里**。钩子的入参语义（完整行 vs 修改集）
 *   不直观、出错时报错点离现场很远。改成显式写入后：
 *     · 每次写都看得见它盖了什么（可读）
 *     · 忘了盖会被测试抓到（可测）—— 见 tools/e2e-sync.mjs
 *
 * 这一层做的事：
 *   1. 盖 `updatedAt`（LWW 的比较依据）
 *   2. 新行盖 `deletedAt: null`
 *   3. 带上 `userId`（未登录为空串 = 纯本地，依据决策 S4）
 *   4. 写完广播 `lf:changed`（界面刷新）
 */

import { db } from "./db";
import { notifyChanged } from "./useData";
import type { SyncTable, Syncable } from "./sync-types";

/** 当前登录用户；未登录为空串（纯本地模式） */
let currentUserId = "";

export function setWriteUser(id: string): void {
  currentUserId = id;
}

export function getWriteUser(): string {
  return currentUserId;
}

/** 盖同步元数据（**唯一的盖法**，别在别处手写 Date.now()） */
function stamp(row: object, isNew: boolean): Record<string, unknown> {
  return {
    ...row,
    updatedAt: Date.now(),
    deletedAt: isNew ? null : ((row as { deletedAt?: number | null }).deletedAt ?? null),
    userId: currentUserId,
  };
}

/* ⚠ 关于类型：这四个函数的入参刻意**不按表做精确映射**。
   理由是写入层只关心同步元数据，不关心业务字段；做了精确映射反而会在
   这里复制一份各表的字段定义（改了 db.ts 忘改这里 = 静默出错）。
   精确性由 db.ts 的文档类型 + 各页面的调用点保证，测试负责兜底。
   约束成 `{ id: string }` 是为了挡住"忘了 id"这种最常见的写错。 */
/* ⚠ 用 object 而不是 Record<string, unknown>：interface 没有隐式索引签名，
   写 Record<string, unknown> 会让 RuleDoc / EntryDoc 全部不可赋值（踩过）。 */
type AnyRow = object;
type AnyPatch = object;

/* ── 新增 ─────────────────────────────────────────────── */
export async function insert(table: SyncTable, row: AnyRow): Promise<void> {
  await (db.table(table) as unknown as { add: (v: unknown) => Promise<unknown> }).add(
    stamp(row, true),
  );
  notifyChanged();
}

/** 批量新增（播种用；不逐条广播） */
export async function insertMany(table: SyncTable, rows: AnyRow[]): Promise<void> {
  const stamped = rows.map((r) => stamp(r, true));
  await (
    db.table(table) as unknown as { bulkAdd: (v: unknown[]) => Promise<unknown> }
  ).bulkAdd(stamped);
}

/* ── 修改 ─────────────────────────────────────────────── */
export async function patch(table: SyncTable, id: string, changes: AnyPatch): Promise<void> {
  await (
    db.table(table) as unknown as { update: (k: string, v: unknown) => Promise<number> }
  ).update(id, { ...changes, updatedAt: Date.now() });
  notifyChanged();
}

/** 批量修改（一次广播） */
export async function patchMany(
  table: SyncTable,
  list: Array<{ id: string; changes: AnyPatch }>,
): Promise<number> {
  const t = db.table(table) as unknown as {
    update: (k: string, v: unknown) => Promise<number>;
  };
  let n = 0;
  const now = Date.now();
  for (const { id, changes } of list) {
    n += await t.update(id, { ...changes, updatedAt: now });
  }
  notifyChanged();
  return n;
}

/* ── 删除 ─────────────────────────────────────────────── */
/**
 * 软删（决策 S3）。
 * **不物理删** —— 行还得上传，物理删了远端永远收不到这次删除。
 * 界面靠 useData.ts 的 live() 过滤 deletedAt。
 */
export async function softDelete(table: SyncTable, id: string): Promise<void> {
  const now = Date.now();
  await (
    db.table(table) as unknown as { update: (k: string, v: unknown) => Promise<number> }
  ).update(id, { deletedAt: now, updatedAt: now });
  notifyChanged();
}
