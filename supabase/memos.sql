-- Lanmao Space 备忘录：Supabase 建表与行级权限（RLS）。
-- 在 Supabase 后台的 SQL Editor 里粘贴并运行一次即可；重复运行也不会报错。
-- 只用 anon / publishable key 访问前端时，RLS 是唯一防线：不要关掉 RLS，
-- 也不要给这两张表加“所有人可读/可写”的策略。
--
-- 表里只存密文。salt 不是密钥，可以明文保存，它只用来给口令派生密钥；
-- check_* 是用备忘录口令加密的固定校验串，用来判断口令对不对，
-- 解不开就说明口令错了，而不是“没有备忘录”。

create table if not exists public.memo_vault (
  user_id uuid primary key references auth.users (id) on delete cascade,
  salt text not null,
  check_ciphertext text not null,
  check_iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memo_vault enable row level security;
drop policy if exists "memo_vault_owner" on public.memo_vault;
create policy "memo_vault_owner" on public.memo_vault
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memos enable row level security;
drop policy if exists "memos_owner" on public.memos;
create policy "memos_owner" on public.memos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists memos_user_updated_idx
  on public.memos (user_id, updated_at desc);
