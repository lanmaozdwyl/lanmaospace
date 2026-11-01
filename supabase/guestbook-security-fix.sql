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
