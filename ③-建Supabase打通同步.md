# ③ · 建 Supabase 后端，打通三设备共用一份数据

> 来源：LifeFlow v7 待办清单 ｜ 生成 2026-10-01
> **直接整段复制下面的代码块发给执行的智能体即可。**
> 项目标识与实测证据见：`待办三处-执行提示词.md` 的「共用事实」一节（如执行者需要更多上下文请一并附上）。


```
【任务】为 LifeFlow v7 建 Supabase 后端，并把凭据配好，使三台设备（手机/iPad/电脑）
        共用同一份数据。

【背景 · 为什么必须做】
现在数据全在**各设备的浏览器本地**（IndexedDB）。无论用哪个地址打开：
  手机 / iPad / 电脑 各自一份数据，互相看不见。
产品的核心需求是「一份数据」，所以这一步不做，多设备就不成立。

【好消息：代码已经全部写完并测通了】
仓库里已有完整同步层，**不需要你写业务代码**：
  src/lib/sync-types.ts     同步元数据 + 适配器接口（含三处设计取舍的理由）
  src/lib/sync-adapter.ts   NullAdapter / MemoryAdapter / SupabaseAdapter
  src/lib/sync-engine.ts    push / pull / LWW / 脏数据保护 / 自动同步
  src/lib/write.ts          所有业务写操作收口（盖 updatedAt/deletedAt/userId）
  src/components/SyncPanel.tsx  用户界面（邮箱魔法链接登录）
  supabase-schema.sql       建表 + RLS + 索引 + 自检查询
  同步说明.md                完整说明

已通过的自动化验证（tools/e2e-sync.mjs，17 项全过）：
  ✅ 业务写入自动盖 updatedAt / userId
  ✅ 清空本地 → 一次同步把整库 786 行拉回来（跨设备主链）
  ✅ 本地未推的改动不被拉取覆盖（最容易丢数据的地方）
  ✅ 断网时报失败（不假装成功）→ 恢复后补传成功
  ✅ 软删传到远端（deleted_at 非空）且界面看不到

所以你要做的只有三件：建表、拿凭据、配环境变量。

【步骤 1 · 建 Supabase 项目】
- 打开 https://supabase.com → New project（免费档足够）
- 区域选 Northeast Asia (Tokyo) 或 Southeast Asia (Singapore)，延迟低
- 记下数据库密码（本项目用不到，但会要求设）

【步骤 2 · 跑建表脚本】
- Supabase 后台 → SQL Editor → New query
- 把仓库根目录的 `supabase-schema.sql` **整段**粘贴进去 → Run
- 脚本会建 4 张表：rules / entries / proposals / tool_views
  （⚠ 是 4 张，不是旧文档里的 20 张 —— v7 的架构收敛了，理由见 sync-types.ts）
- 每张表都开了 RLS，并建了 (user_id, updated_at) 索引

⚠⚠ 自检（这一步不能省，漏开 RLS = 那张表全网可读写）
脚本最后有一段自检查询，跑完必须看到 **4 行、rls_enabled 全为 true**：

  entries    | true
  proposals  | true
  rules      | true
  tool_views | true

如果哪一行是 false，执行：
  alter table public.<表名> enable row level security;

【步骤 3 · 拿两个值】
Supabase 后台 → Settings → API：
  Project URL       形如 https://xxxxx.supabase.co
  anon public key   形如 eyJhbGciOi...（很长）

（anon key 是**设计上可以公开**的，安全边界在 RLS。把它当敏感信息没必要，
 但也不要发到公开渠道。）

【步骤 4 · 配到两处】

A) 本地：在工程根目录建 `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

B) Vercel：项目 lifeflow → Settings → Environment Variables
   加同名的两个变量，Environment 勾 **Production + Preview + Development**
   加完后 **Redeploy 一次**（环境变量改动不会自动生效到已构建的部署）

   （有令牌可用 API（PowerShell 写法；cmd/bash 请写成一行）：
    curl.exe -X POST "https://api.vercel.com/v10/projects/lifeflow/env?teamId=<TEAM_ID>&slug=lifeflow" `
      -H "Authorization: Bearer <VERCEL_TOKEN>" -H "Content-Type: application/json" `
      -d '{\"key\":\"NEXT_PUBLIC_SUPABASE_URL\",\"value\":\"<URL>\",\"type\":\"plain\",\"target\":[\"production\",\"preview\",\"development\"]}'
    另一个变量同理。
    ⚠ 加完环境变量**必须重新部署一次**，否则不生效：
    curl.exe -X POST "https://api.vercel.com/v13/deployments?teamId=<TEAM_ID>&forceNew=1" `
      -H "Authorization: Bearer <VERCEL_TOKEN>" -H "Content-Type: application/json" `
      -d '{\"name\":\"lifeflow\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repo\":\"hankhrzznl/lifeflow\",\"ref\":\"main\"}}'
    ）

【步骤 5 · 验收（必须自己跑，用输出证明）】
1. 本地起服务：npm run build && npm run start -- --hostname 0.0.0.0 --port 3210
2. 打开 http://127.0.0.1:3210/future —— 「多设备同步」卡里应出现**邮箱输入框**
   （未配置时只显示「仅本机」，没有输入框 —— 出现了就说明凭据生效了）
3. 用两个不同的浏览器 profile（或一个正常窗口 + 一个隐私窗口）打开同一地址
4. 两个窗口都用同一邮箱登录（点邮件里的魔法链接）
5. 在窗口 A 点「记一笔」记一条；等窗口 B 自动同步（或点「立即同步」）
   → **窗口 B 必须看到同一条**
6. 回到 Supabase 后台 → Table Editor → entries 表
   → 必须能看到你刚记的那一行，且 `user_id` 非空

【范围与红线】
- 不要改任何业务代码；配置凭据 + 建表就够了
- 不要动 GitHub 仓库
- 不要把 service_role key 放前端（只用 anon key；service_role 会绕过 RLS）
- 不要为了"跑通"而关掉 RLS

【如果 5 没通，按这个顺序查（都是踩过的坑）】
1. 表名映射：本地表名 toolViews（驼峰）↔ 远端 tool_views（下划线）。
   代码里由 src/lib/sync-adapter.ts 的 remoteName() 处理；若你改过 SQL 表名，要同步改那里。
2. RLS 是否 4 张全开（漏一张会只在那张表上报错）
3. RLS 策略条件是否为 auth.uid() = user_id（不是 user_id = user_id 之类）
4. Vercel 上加完环境变量后**有没有 Redeploy**
5. 浏览器控制台看同步报错；同步状态点会显示「待同步 N」或错误原因
```
