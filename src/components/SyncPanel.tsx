"use client";

/**
 * 同步面板（放在「往后」页）—— 决策 S4 的落点
 *
 * 依据 docs/17 §五（UI 改动最小化）：
 *   未登录 = 纯本地模式，**不强制登录**，不打扰；
 *   登录后才出现同步相关的界面。
 *
 * 三种状态：
 *   ① 未配置后端（没有环境变量）→ 只说明"仅本机"，不出现登录入口
 *   ② 已配置未登录 → 邮箱魔法链接登录
 *   ③ 已登录 → 状态 + 立即同步 + 退出
 */

import { useState } from "react";
import { SyncDot, useSyncState } from "@/components/Parts";
import { getAdapter, storeToken } from "@/lib/sync-adapter";
import { syncOnce } from "@/lib/sync-engine";

function when(ts: number | null): string {
  if (!ts) return "还没同步过";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SyncPanel() {
  const s = useSyncState();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ① 没配置后端 —— 不提"登录"，避免让人以为必须注册 */
  if (!s.configured) {
    return (
      <div className="card">
        <div className="row--between">
          <span className="t-bold t-sm">多设备同步</span>
          <SyncDot />
        </div>
        <p className="t-cap t-mut" style={{ marginTop: 6 }}>
          现在是<b>仅本机</b>：数据只在这台设备的浏览器里，换设备看不到。
        </p>
        <div className="note" style={{ marginTop: 10 }}>
          要让手机 / iPad / 电脑共用一份数据，需要一个后端。
          接法见仓库根目录的 <b>同步说明.md</b>（约 3 分钟）。
        </div>
      </div>
    );
  }

  async function sendLink() {
    const e = email.trim();
    if (!e) {
      setMsg("先填邮箱");
      return;
    }
    setBusy(true);
    try {
      const a = getAdapter();
      if (!a.signInWithEmail) throw new Error("这个后端不支持邮箱登录");
      await a.signInWithEmail(e);
      setMsg(`登录链接已发到 ${e} —— 在**同一台设备**上点开那个链接即可`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function doSync() {
    setBusy(true);
    const r = await syncOnce();
    setBusy(false);
    setMsg(
      r.ok
        ? `同步完成 · 上传 ${r.pushed} · 拉回 ${r.pulled}`
        : `失败：${r.error ?? "未知原因"}`,
    );
  }

  async function signOut() {
    setBusy(true);
    storeToken(null);
    await getAdapter().signOut?.();
    setBusy(false);
    setMsg("已退出。数据仍在本机，不受影响。");
  }

  return (
    <div className="card">
      <div className="row--between">
        <span className="t-bold t-sm">多设备同步</span>
        <SyncDot />
      </div>

      {msg ? (
        <div className="note" style={{ marginTop: 8 }} role="status">
          {msg}
        </div>
      ) : null}

      {/* ③ 已登录 */}
      {s.signedIn ? (
        <>
          <div className="list" style={{ marginTop: 6 }}>
            <div className="list__row row--between">
              <span className="t-sm t-mut">上次同步</span>
              <span className="t-cap t-num">{when(s.lastSyncedAt)}</span>
            </div>
            <div className="list__row row--between">
              <span className="t-sm t-mut">待上传</span>
              <span className="t-cap t-num">{s.pending} 条</span>
            </div>
          </div>
          {s.lastError ? (
            <div className="note note--warn" style={{ marginTop: 8 }}>
              上次出错：{s.lastError}
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn--sm btn--primary" disabled={busy} onClick={doSync}>
              {busy ? "同步中…" : "立即同步"}
            </button>
            <button className="btn btn--sm btn--ghost" disabled={busy} onClick={signOut}>
              退出
            </button>
          </div>
          <p className="t-cap t-faint" style={{ marginTop: 8 }}>
            退出后数据仍在本机，同步关掉就退回纯本地。
          </p>
        </>
      ) : (
        /* ② 已配置未登录 */
        <>
          <p className="t-cap t-mut" style={{ marginTop: 6 }}>
            用邮箱登录后，手机 / iPad / 电脑共用同一份数据。
            <b>不登录也照常能用</b> —— 只是仅本机。
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input grow"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="你的邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendLink();
              }}
              aria-label="邮箱"
            />
            <button className="btn btn--sm btn--primary" disabled={busy} onClick={sendLink}>
              发登录链接
            </button>
          </div>
          <p className="t-cap t-faint" style={{ marginTop: 8 }}>
            没有密码 —— 点邮件里的链接就登录了。
          </p>
        </>
      )}
    </div>
  );
}
