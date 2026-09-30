/**
 * 同步元数据 —— 每张可同步的表都有这三个字段
 *
 * 依据：docs/17-多设备同步方案-Supabase.md 的架构铁律
 *   1. Local-first 不变：UI **永远只读 Dexie**，不直接读 Supabase
 *   2. 离线可用不丢：这是产品卖点，不得因同步而破坏
 *   3. 同步层是新增，不是替换：不改业务语义，只加同步元数据字段
 *
 * ⚠ v7 与旧方案的差异（两处，都是刻意改的）
 *
 * 【差异一】表数：旧方案 20 张 → v7 **4 张**（rules / entries / proposals / toolViews）。
 *   因为 A1 说数据只有「一条流 + 规则」两种形状。表少 = 同步面小 = 出错面小。
 *
 * 【差异二】不用 outbox 队列，改**游标增量同步**。
 *   旧方案（§3.3）要求「数据写入」与「入队」在**同一事务**里原子完成，
 *   否则会出现「数据在本地、却没进队列」= 永远同步不出去。
 *   在 Dexie 里要满足这个原子性，就得把队列表塞进每一次业务事务、
 *   或者在钩子里再开事务（嵌套事务，极易出错）。
 *
 *   v7 的做法：**不排队，只记游标** ——
 *     push：上传所有 updatedAt > lastPushedAt 的行
 *     pull：拉取所有 updated_at > lastPulledAt 的行
 *   为什么这个替换是合理的：
 *     · 上传的是**行本身**，不是"动作"。所以「本地写成功但没记上」不会丢 ——
 *       这次没推，下次看 updatedAt 依然会推到。原子性问题根本不存在了。
 *     · 代价：改动过的行可能被重复推（幂等 upsert，无害）。
 *       v7 量级（一年约 3.5 万行）完全可接受。
 *     · 换来：无队列、无双写、无嵌套事务、无队列膨胀、无重试状态机。
 *
 *   诚实标注：这是**为 v7 的规模与实现风险做过权衡的取舍**，
 *   不是"照着文档抄"。若将来行数上到百万级、或需要吞吐优化，
 *   再换回队列方案（接口不变，只换引擎内部）。
 */
export interface Syncable {
  /** LWW 的比较依据。**不用手写** —— lib/write.ts 的 stamp() 会盖 */
  updatedAt?: number;
  /** 软删标记。**不物理删** —— 行还要上传，物理删了远端就永远收不到这次删除 */
  deletedAt?: number | null;
  /** 登录后写入；未登录为空串 = 纯本地模式（等于现状） */
  userId?: string;
}

/** 参与同步的表名 */
export const SYNC_TABLES = ["rules", "entries", "proposals", "toolViews"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** 游标表：记录每张表推/拉到哪个时间戳 */
export interface SyncMetaDoc {
  key: string;
  value: string;
}

export interface SyncState {
  /** 是否已配置后端（有凭据）；false 时整条链静默不跑 */
  configured: boolean;
  /** 是否已登录 */
  signedIn: boolean;
  /** user id（未登录为空串） */
  userId: string;
  /** 待推送条数（updatedAt > lastPushedAt） */
  pending: number;
  /** 最近一次成功同步的时刻 */
  lastSyncedAt: number | null;
  /** 上次错误 */
  lastError: string | null;
  /** 正在同步 */
  busy: boolean;
}

export const EMPTY_SYNC_STATE: SyncState = {
  configured: false,
  signedIn: false,
  userId: "",
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  busy: false,
};

/* ─────────────────────────────────────────────────────────────
   适配器接口 —— 让整条链路在**没有凭据**时也能实现与测通
   ------------------------------------------------------------
   同步的难点在本地（增量判定、冲突、软删、离线补传），不在网络调用。
   把网络那层抽成接口后：
     · 现在就能写完并用本地存根测通（tools/e2e-v2-sync.mjs）
     · 拿到 Supabase 凭据后只需实现 SupabaseAdapter，业务代码零改动
   ───────────────────────────────────────────────────────────── */
export interface RemoteRow {
  id: string;
  updated_at: number;
  deleted_at: number | null;
  payload: Record<string, unknown>;
}

export interface SyncAdapter {
  /** 后端是否已配置（有 URL + key） */
  isConfigured(): boolean;
  /** 当前登录的 user id；未登录返回 null */
  currentUserId(): Promise<string | null>;
  /** 批量 upsert；失败要抛错（调用方据此中止并保留游标） */
  push(table: SyncTable, rows: RemoteRow[]): Promise<void>;
  /** 拉取 updated_at > since 的行（含软删行） */
  pull(table: SyncTable, since: number): Promise<RemoteRow[]>;
  /** 订阅远端变更；返回取消订阅函数。可选（没有 Realtime 就不实现） */
  subscribe?(table: SyncTable, onChange: () => void): () => void;
  /** 登录（魔法链接：发信 / 或直接设会话） */
  signInWithEmail?(email: string): Promise<void>;
  signOut?(): Promise<void>;
}
