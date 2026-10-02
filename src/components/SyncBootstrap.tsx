"use client";

/**
 * 同步启动 —— 装钩子 + 起自动同步
 *
 * ⚠ 必须在客户端、且只跑一次。
 *   装钩子是"同步层不改业务代码"的关键：装上之后，
 *   任何 db.xxx.add / put / update 都会自动盖 updatedAt，业务代码一行不用改。
 *
 * 未配置凭据时（没有 NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY）：
 *   getAdapter() 返回 NullAdapter → isConfigured() = false → 整条链静默不跑，
 *   行为等于纯本地模式 = 现状。这就是决策 S4「未登录=纯本地」的落点。
 */

import { useEffect } from "react";
import { startAutoSync } from "@/lib/sync-engine";
import {
  consumeAuthRedirect,
  readSupabaseConfig,
  setAdapter,
  SupabaseAdapter,
  readStoredToken,
} from "@/lib/sync-adapter";
import { installTestBridge } from "@/lib/test-bridge";

export function SyncBootstrap() {
  useEffect(() => {

    installTestBridge();

    /* 先接魔法链接的回跳令牌（若本次加载带了 #access_token=…），
       再读配置 —— 顺序不能反，否则 adapter 拿不到刚落地的登录态 */
    consumeAuthRedirect();

    const cfg = readSupabaseConfig();
    if (cfg) {
      setAdapter(new SupabaseAdapter({ ...cfg, accessToken: readStoredToken() }));
      const stop = startAutoSync();
      return () => {
        stop();
      };
    }
    /* 没配置就不启动 —— 纯本地模式（决策 S4：未登录=纯本地，不强制） */
    return () => {};
  }, []);

  return null;
}
