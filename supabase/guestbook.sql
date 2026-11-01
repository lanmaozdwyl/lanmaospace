-- Lanmao Space 留言板：建 guestbook_messages 表 + 行级权限（RLS）。
-- 在 Supabase 后台的 SQL Editor 里粘贴并运行一次即可；重复运行也不会报错。
--
-- 审核流程（没有单独的审核界面，店主在后台操作）：
-- 1. 访客登录后提交留言，approved 默认 false，页面上看不到。
-- 2. 店主在 Supabase 后台 Database → Tables → guestbook_messages 里
--    查看全部留言（后台操作不受 RLS 限制，能看到未审核的），把
--    要公开的那条的 approved 改成 true，保存后刷新网站就能看到。
--    不想公开的就留在 false，或直接删掉那行。
-- 3. 邮箱是选填的联系方式，只存数据库、只给店主在后台看，
--    数据库列权限禁止访客读取 email / user_id，前端只查公开字段。
-- 4. 不要给这张表加“所有人可写/可改 approved”的策略，否则访客
--    可以自己把留言改成通过审核。普通登录用户只能插入自己的留言，
--    只能读到 approved = true 的留言。

create table if not exists public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text,
  message text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.guestbook_messages enable row level security;
drop policy if exists "guestbook_read_approved" on public.guestbook_messages;
create policy "guestbook_read_approved" on public.guestbook_messages
  for select
  using (approved = true);
drop policy if exists "guestbook_insert_own" on public.guestbook_messages;
create policy "guestbook_insert_own" on public.guestbook_messages
  for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

create index if not exists guestbook_approved_created_idx
  on public.guestbook_messages (approved, created_at desc);

-- 新安装也应用同一权限修复。
-- 留言板权限修复：在 Supabase SQL Editor 中整份执行，可重复运行。
-- 不删除或修改已有留言；店主仍可在后台审核、查看邮箱。
begin;

alter table public.guestbook_messages enable row level security;
alter table public.guestbook_messages alter column approved set default false;

-- 清除表级和旧列级授权，再只开放前端需要的列。
revoke all privileges on table public.guestbook_messages from public, anon, authenticated;
revoke all privileges (id, user_id, name, email, message, approved, created_at)
  on table public.guestbook_messages from public, anon, authenticated;
grant select (id, name, message, created_at, approved)
  on table public.guestbook_messages to anon, authenticated;
grant insert (user_id, name, email, message)
  on table public.guestbook_messages to authenticated;

drop policy if exists guestbook_read_approved on public.guestbook_messages;
create policy guestbook_read_approved on public.guestbook_messages
  for select to anon, authenticated using (approved = true);
-- 限制性策略防止其他宽松策略意外放开未审核留言。
drop policy if exists guestbook_read_boundary on public.guestbook_messages;
create policy guestbook_read_boundary on public.guestbook_messages
  as restrictive for select to anon, authenticated using (approved = true);

drop policy if exists guestbook_insert_own on public.guestbook_messages;
create policy guestbook_insert_own on public.guestbook_messages
  for insert to authenticated
  with check (auth.uid() = user_id and approved = false);
drop policy if exists guestbook_insert_boundary on public.guestbook_messages;
create policy guestbook_insert_boundary on public.guestbook_messages
  as restrictive for insert to authenticated
  with check (auth.uid() = user_id and approved = false);

commit;
