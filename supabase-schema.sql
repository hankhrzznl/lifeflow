-- ============================================================
-- LifeFlow v7 · Supabase 建表 + RLS + 索引
-- 依据：docs/17-多设备同步方案-Supabase.md（架构原则照搬，表数按 v7 收敛）
--
-- ⚠ v7 只需 4 张表。旧方案写的是 20 张（domains/habits/daily_records/…），
--   那是 lifeflow-app 的 schema。v7 的 A1 公理说数据只有「一条流 + 规则」
--   两种形状，所以 20 张收敛成 4 张。表少 = 同步面小 = 出错面小。
--
-- 在 Supabase 后台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. 前置：确认 pgcrypto（Supabase 默认已开）
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 1. 四张表
--    统一结构：远端不解析业务字段，业务字段整包放 payload(jsonb)。
--    为什么这么设计：v7 的 schema 还会演进（比如加字段），
--    如果远端跟着建列，每次都要写迁移。放 jsonb 则前端改字段不用动后端。
--    代价：不能在 SQL 里按业务字段建索引/查询 —— 本项目不需要（都在本地查）。
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rules (
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id          text        not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  payload     jsonb       not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.entries (
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id          text        not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  payload     jsonb       not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.proposals (
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id          text        not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  payload     jsonb       not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.tool_views (
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id          text        not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  payload     jsonb       not null default '{}'::jsonb,
  primary key (user_id, id)
);

-- ⚠ 本地表名是 toolViews（驼峰），PostgREST 表名用小写下划线。
--   前端 SupabaseAdapter 已按这个映射发请求。若你改了这里，那边也要改。

-- ─────────────────────────────────────────────────────────────
-- 2. 增量拉取用的索引（pull 全靠它）
-- ─────────────────────────────────────────────────────────────
create index if not exists rules_updated_idx      on public.rules      (user_id, updated_at);
create index if not exists entries_updated_idx    on public.entries    (user_id, updated_at);
create index if not exists proposals_updated_idx  on public.proposals  (user_id, updated_at);
create index if not exists tool_views_updated_idx on public.tool_views (user_id, updated_at);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS —— **必须逐张开**（决策：未开 RLS 的表 = 任何人可读写 = 严重事故）
-- ─────────────────────────────────────────────────────────────
alter table public.rules      enable row level security;
alter table public.entries    enable row level security;
alter table public.proposals  enable row level security;
alter table public.tool_views enable row level security;

drop policy if exists "own rows" on public.rules;
create policy "own rows" on public.rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on public.entries;
create policy "own rows" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on public.proposals;
create policy "own rows" on public.proposals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own rows" on public.tool_views;
create policy "own rows" on public.tool_views
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. 自检 —— 跑完必须看到 4 行且 rls_enabled 全为 true
--    （漏开一张 = 那张表全网可读写）
-- ─────────────────────────────────────────────────────────────
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('rules','entries','proposals','tool_views')
order by tablename;

-- 期望结果：
--   entries    | true
--   proposals  | true
--   rules      | true
--   tool_views | true

-- ─────────────────────────────────────────────────────────────
-- 5. Realtime（可选）
--    v7 目前只用「启动 + 每 5 分钟 + 网络恢复」轮询拉取，
--    不依赖 Realtime。想让另一台设备改完立刻出现，再开这个：
-- ─────────────────────────────────────────────────────────────
-- alter publication supabase_realtime add table public.rules;
-- alter publication supabase_realtime add table public.entries;
-- alter publication supabase_realtime add table public.proposals;
-- alter publication supabase_realtime add table public.tool_views;
