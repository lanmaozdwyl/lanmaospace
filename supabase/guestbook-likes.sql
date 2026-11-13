-- Lanmao Space 留言板点赞：guestbook_likes 表 + 两个 security definer 函数。
-- 在 Supabase 后台 SQL Editor 里整份粘贴运行；可重复执行，不会报错，也不会动已有留言。
-- 顺序：先 guestbook.sql（建表与审核边界），再 avatars.sql（含 guestbook_public_list），
-- 最后这一份。缺任何一份时前端会自动退回"不显示点赞按钮"，不会白屏。
--
-- 为什么不直接开放这张表：
--   一行 (message_id, user_id) 就是"谁赞了哪条"。如果给访客 select 权限，等于把
--   留言者的社交行为整本摊开，也和 guestbook_messages 里禁止读取 user_id / email
--   的既有边界自相矛盾。所以这里只让函数读：RLS 开启但不写任何策略，
--   非表主（anon / authenticated）直接查表一律拿到 0 行。
--
--   计数与"我是否赞过"由 guestbook_like_state() 汇总返回；点赞动作由
--   guestbook_set_like() 完成，函数内部只按 auth.uid() 增删自己那一行，
--   任何人无法替别人点赞或撤赞。
--
-- 两个函数都带 set search_path = ''，和其余安全函数一致；否则调用者可以用临时对象
-- 劫持函数里没写全限定的名字。这条约束由 tests/permissions.test.mjs 与
-- supabase/guestbook-security-check.sql 双重守住。

create table if not exists public.guestbook_likes (
  message_id uuid not null references public.guestbook_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.guestbook_likes enable row level security;
-- 不建任何 policy：访客与登录用户都不能直连这张表，读写全部走下面的函数。
revoke all privileges on table public.guestbook_likes from public, anon, authenticated;

create index if not exists guestbook_likes_message_idx
  on public.guestbook_likes (message_id);

-- 列表用：返回最近 50 条已通过审核留言的点赞数与"我是否赞过"。
-- 排序和 limit 与 guestbook_public_list 完全对齐，前端按 id 合并。
-- 匿名访问时 auth.uid() 为 NULL，liked_by_me 统一给 false，计数照常可见。
create or replace function public.guestbook_like_state()
returns table (id uuid, like_count bigint, liked_by_me boolean)
language sql security definer set search_path = '' as $$
  select g.id,
         count(l.user_id),
         coalesce(bool_or(l.user_id = auth.uid()), false)
  from (
    select m.id
    from public.guestbook_messages m
    where m.approved = true
    order by m.created_at desc, m.id desc
    limit 50
  ) g
  left join public.guestbook_likes l on l.message_id = g.id
  group by g.id
  order by 2 desc;
$$;

-- 点赞/取消点赞：只允许操作 auth.uid() 自己的那一行。
-- 返回新的计数与当前状态，前端直接就地更新，不用重刷整个列表。
-- 留言不存在与未通过审核回同一句话，免得用这个接口探测后台有哪些留言。
create or replace function public.guestbook_set_like(p_message_id uuid, p_liked boolean)
returns table (like_count bigint, liked_by_me boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_visible boolean;
  v_count bigint;
begin
  if auth.uid() is null then
    raise exception '登录后才能点赞' using errcode = '42501';
  end if;

  select approved into v_visible
  from public.guestbook_messages
  where id = p_message_id;

  if v_visible is distinct from true then
    raise exception '这条留言暂时不接受点赞';
  end if;

  if p_liked then
    insert into public.guestbook_likes (message_id, user_id)
      values (p_message_id, auth.uid())
      on conflict (message_id, user_id) do nothing;
  else
    delete from public.guestbook_likes
      where message_id = p_message_id and user_id = auth.uid();
  end if;

  select count(*) into v_count
  from public.guestbook_likes
  where message_id = p_message_id;

  return query select v_count, p_liked;
end $$;

revoke all on function public.guestbook_like_state() from public, anon;
revoke all on function public.guestbook_set_like(uuid, boolean) from public, anon, authenticated;
grant execute on function public.guestbook_like_state() to anon, authenticated;
-- 匿名访客不能点赞：按钮点了也是跳登录，不给这条接口开权限。
grant execute on function public.guestbook_set_like(uuid, boolean) to authenticated;
