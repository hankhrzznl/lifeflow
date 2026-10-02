/**
 * 同步适配器
 *
 * 三种实现：
 *   NullAdapter     未配置凭据 → 整条同步链静默不跑（等于纯本地模式 = 现状）
 *   MemoryAdapter   内存假后端 —— 给自动化测试用（tools/e2e-v2-sync.mjs）
 *   SupabaseAdapter 真后端 —— 需要 NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
 *
 * ⚠ SupabaseAdapter 现在**只依赖 fetch，不引入 @supabase/supabase-js**。
 *   理由：v7 的取舍是"依赖越少越稳"（PWA 离线优先）。
 *   Supabase 的 REST（PostgREST）就是普通 HTTPS + JSON，本项目只用
 *   「批量 upsert / 增量 select / 魔法链接登录」三件事，手写足够且更可控。
 *   等到需要 Realtime（WebSocket）时再决定是否引入 SDK。
 */

import type { RemoteRow, SyncAdapter, SyncTable } from "./sync-types";

/* ─────────────────────────────────────────────────────────────
   1. 未配置 —— 纯本地模式
   ───────────────────────────────────────────────────────────── */
export class NullAdapter implements SyncAdapter {
  isConfigured(): boolean {
    return false;
  }
  async currentUserId(): Promise<string | null> {
    return null;
  }
  async push(): Promise<void> {
    /* no-op */
  }
  async pull(): Promise<RemoteRow[]> {
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────
   2. 内存假后端 —— 自动化测试用
   ------------------------------------------------------------
   它必须**如实模拟真后端的语义**，否则测试等于白测：
     · upsert 按 (table, id) 覆盖
     · 拉取按 updated_at > since
     · 软删行照样被拉到（deleted_at 非空）
     · 可以注入失败（测离线补传）
   ───────────────────────────────────────────────────────────── */
export class MemoryAdapter implements SyncAdapter {
  private store = new Map<string, Map<string, RemoteRow>>();
  private uid: string | null = null;
  /** 注入故障：设为 true 后 push/pull 抛错，用于测"断网不丢" */
  public failing = false;
  /** 调用计数，便于断言"确实推了/拉了" */
  public stats = { pushes: 0, pulls: 0 };

  constructor(userId: string | null = "test-user") {
    this.uid = userId;
  }

  isConfigured(): boolean {
    return true;
  }
  async currentUserId(): Promise<string | null> {
    return this.uid;
  }
  setUser(id: string | null): void {
    this.uid = id;
  }

  private rows(table: SyncTable): Map<string, RemoteRow> {
    if (!this.store.has(table)) this.store.set(table, new Map());
    return this.store.get(table)!;
  }

  async push(table: SyncTable, rows: RemoteRow[]): Promise<void> {
    if (this.failing) throw new Error("memory-adapter: 注入的离线故障");
    this.stats.pushes++;
    const m = this.rows(table);
    for (const r of rows) m.set(r.id, r);
  }

  async pull(table: SyncTable, since: number): Promise<RemoteRow[]> {
    if (this.failing) throw new Error("memory-adapter: 注入的离线故障");
    this.stats.pulls++;
    return [...this.rows(table).values()].filter((r) => r.updated_at > since);
  }

  /** 测试辅助：直接看后端里有什么 */
  dump(table: SyncTable): RemoteRow[] {
    return [...this.rows(table).values()];
  }
}

/* ─────────────────────────────────────────────────────────────
   3. Supabase —— 走 PostgREST，不引 SDK
   ───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   表名映射 —— 本地驼峰 ↔ 远端下划线
   ------------------------------------------------------------
   ⚠ 这是接 Supabase 前最容易漏的一处：
     本地表名是 toolViews，而 supabase-schema.sql 建的是 tool_views。
     不映射的话，只有这一张表会 404，而且报错信息看起来像"网络问题"，
     排查成本高。放在这里集中处理。
   ───────────────────────────────────────────────────────────── */
const REMOTE_NAME: Record<SyncTable, string> = {
  rules: "rules",
  entries: "entries",
  proposals: "proposals",
  toolViews: "tool_views",
};

export function remoteName(table: SyncTable): string {
  return REMOTE_NAME[table];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /** 已经拿到的 access_token（魔法链接回跳后写入 localStorage） */
  accessToken?: string | null;
}

const TOKEN_KEY = "lf-sync-token";
const REFRESH_KEY = "lf-sync-refresh";

export function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function readStoredRefresh(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function storeToken(t: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    }
  } catch {
    /* 隐私模式下写不了，忽略 */
  }
}

/** 魔法链接回跳后接令牌：此时 URL hash 里有 #access_token=…&refresh_token=…。
 *  写入 localStorage 并把 hash 从地址栏清掉（replaceState，不留脏历史）。
 *  返回 true = 这次加载确实带了登录回跳。 */
export function consumeAuthRedirect(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  if (!h || !h.includes("access_token=")) return false;
  const p = new URLSearchParams(h.startsWith("#") ? h.slice(1) : h);
  const at = p.get("access_token");
  if (!at) return false;
  storeToken(at);
  const rt = p.get("refresh_token");
  try {
    if (rt) window.localStorage.setItem(REFRESH_KEY, rt);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* 隐私模式下写不了，忽略 */
  }
  try {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    /* 忽略 */
  }
  return true;
}

/** 解 JWT 的 exp（秒）。解析不了返回 null。 */
function jwtExp(t: string): number | null {
  try {
    const seg = t.split(".")[1];
    const j = JSON.parse(atob(seg.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof j.exp === "number" ? j.exp : null;
  } catch {
    return null;
  }
}

/** 从环境变量读配置；没有就返回 null（= 未配置，走 NullAdapter） */
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey, accessToken: readStoredToken() };
}

export class SupabaseAdapter implements SyncAdapter {
  constructor(private cfg: SupabaseConfig) {}

  isConfigured(): boolean {
    return true;
  }

  private headers(): Record<string, string> {
    /* 每次现读：刷新过的令牌能立刻用上，不等适配器重建 */
    const token = readStoredToken() ?? this.cfg.anonKey;
    return {
      apikey: this.cfg.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /** access_token 过期（默认 1 小时）就用 refresh_token 换新的。
   *  并发调用共享同一次刷新，避免同时打多枪。 */
  private refreshing: Promise<boolean> | null = null;

  private ensureFresh(): Promise<boolean> {
    const t = readStoredToken();
    if (!t) return Promise.resolve(false); // 未登录（走匿名 key，无需刷新）
    const exp = jwtExp(t);
    if (exp === null || exp * 1000 - Date.now() > 60_000) return Promise.resolve(true);
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const rt = readStoredRefresh();
        if (!rt) return false;
        const r = await fetch(`${this.cfg.url}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: this.cfg.anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!r.ok) return false;
        const j = (await r.json()) as { access_token?: string; refresh_token?: string };
        if (!j.access_token) return false;
        storeToken(j.access_token);
        try {
          if (j.refresh_token) window.localStorage.setItem(REFRESH_KEY, j.refresh_token);
        } catch {
          /* 忽略 */
        }
        return true;
      } catch {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** 当前用户：调 /auth/v1/user */
  async currentUserId(): Promise<string | null> {
    await this.ensureFresh();
    const token = readStoredToken();
    if (!token) return null;
    try {
      const r = await fetch(`${this.cfg.url}/auth/v1/user`, {
        headers: { apikey: this.cfg.anonKey, Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { id?: string };
      return j.id ?? null;
    } catch {
      return null;
    }
  }

  /** 批量 upsert（PostgREST：POST + Prefer: resolution=merge-duplicates） */
  async push(table: SyncTable, rows: RemoteRow[]): Promise<void> {
    await this.ensureFresh();
    if (!rows.length) return;
    const body = rows.map((r) => ({
      id: r.id,
      updated_at: new Date(r.updated_at).toISOString(),
      deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
      payload: r.payload,
      /* user_id 不传 —— 建表时它是 `default auth.uid()`，
         由 PostgREST 填。传了反而可能和 RLS 的 with check 打架。 */
    }));
    const r = await fetch(
      `${this.cfg.url}/rest/v1/${remoteName(table)}?on_conflict=user_id,id`,
      {
        method: "POST",
        headers: { ...this.headers(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) throw new Error(`push ${table} 失败 HTTP ${r.status}: ${await r.text()}`);
  }

  /** 增量拉取 */
  async pull(table: SyncTable, since: number): Promise<RemoteRow[]> {
    await this.ensureFresh();
    const iso = new Date(since).toISOString();
    const qs = `select=id,updated_at,deleted_at,payload&updated_at=gt.${encodeURIComponent(iso)}&order=updated_at.asc`;
    const r = await fetch(`${this.cfg.url}/rest/v1/${remoteName(table)}?${qs}`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`pull ${table} 失败 HTTP ${r.status}: ${await r.text()}`);
    const j = (await r.json()) as Array<{
      id: string;
      updated_at: string;
      deleted_at: string | null;
      payload: Record<string, unknown>;
    }>;
    return j.map((x) => ({
      id: x.id,
      updated_at: new Date(x.updated_at).getTime(),
      deleted_at: x.deleted_at ? new Date(x.deleted_at).getTime() : null,
      payload: x.payload ?? {},
    }));
  }

  /** 魔法链接：发信 */
  async signInWithEmail(email: string): Promise<void> {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    /* GoTrue 从请求 query 的 redirect_to 取回跳地址（按白名单校验），
       body 里的 email_redirect_to 一并带上做兼容；
       此前只写了 body 里嵌套的 options.email_redirect_to —— GoTrue 不认识，
       邮件链接一律退回 site_url（曾是 127.0.0.1:3210，导致"登录后黑屏"） */
    const qs = origin ? `?redirect_to=${encodeURIComponent(origin)}` : "";
    const r = await fetch(`${this.cfg.url}/auth/v1/otp${qs}`, {
      method: "POST",
      headers: { apikey: this.cfg.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        create_user: true,
        ...(origin ? { email_redirect_to: origin } : {}),
      }),
    });
    if (!r.ok) throw new Error(`发送登录邮件失败 HTTP ${r.status}: ${await r.text()}`);
  }

  async signOut(): Promise<void> {
    storeToken(null);
  }
}

/** 选一个适配器：有配置就用 Supabase，否则 NullAdapter（可被测试注入覆盖） */
let override: SyncAdapter | null = null;

export function setAdapter(a: SyncAdapter | null): void {
  override = a;
}

export function getAdapter(): SyncAdapter {
  if (override) return override;
  const cfg = readSupabaseConfig();
  if (!cfg) return new NullAdapter();
  return new SupabaseAdapter({ ...cfg, accessToken: readStoredToken() });
}
