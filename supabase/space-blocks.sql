-- 私人屏蔽偏好：只影响自己的成员空间浏览，不限制对方查看你。
-- 在 user-spaces.sql、space-community.sql 后执行；可重复执行，不删除现有内容。
-- 本文件是成员读取路径的最终版本：member_spaces、search_member_spaces、posts_member_read
-- 都在这里用 create or replace 补上屏蔽过滤，所以单独重跑 space-community.sql 之后必须再跑一遍本文件。
-- user_spaces 的直接 select 已收紧为只看自己（见 user-spaces.sql），不再需要本文件介入。
begin;
create table if not exists public.space_blocks(
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
alter table public.space_blocks enable row level security;
revoke all on public.space_blocks from public,anon,authenticated;
grant select on public.space_blocks to authenticated;
drop policy if exists space_blocks_private on public.space_blocks;
create policy space_blocks_private on public.space_blocks for select to authenticated using(blocker_id=auth.uid());
create or replace function public.set_space_block(p_member uuid,p_block boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception '请先登录' using errcode='42501';end if;
 if p_member is null or p_member=uid or p_block is null then raise exception '屏蔽目标不正确';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,2));
 if p_block then
  if exists(select 1 from public.space_blocks where blocker_id=uid and blocked_id=p_member) then return true;end if;
  if (select count(*) from public.space_blocks where blocker_id=uid)>=200 then raise exception '最多屏蔽 200 位成员，请先解除部分屏蔽';end if;
  if not exists(select 1 from auth.users where id=p_member) then raise exception '成员不存在';end if;
  insert into public.space_blocks(blocker_id,blocked_id) values(uid,p_member) on conflict do nothing;
 else delete from public.space_blocks where blocker_id=uid and blocked_id=p_member;
 end if;
 return true;
end; $$;
create or replace function public.my_space_blocks(p_offset integer default 0)
returns table(blocked_id uuid,display_name text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录' using errcode='42501';end if;
 return query select b.blocked_id,coalesce(s.display_name,'未设置昵称的成员'),b.created_at
 from public.space_blocks b left join public.user_spaces s on s.user_id=b.blocked_id
 where b.blocker_id=auth.uid() order by b.created_at desc,b.blocked_id limit 30 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;
drop policy if exists posts_member_read on public.space_posts;
create policy posts_member_read on public.space_posts for select to authenticated
 using(auth.uid() is not null and (user_id=auth.uid() or (not archived and not moderation_hidden
 and not exists(select 1 from public.space_blocks b where b.blocker_id=auth.uid() and b.blocked_id=space_posts.user_id))));
revoke all on function public.set_space_block(uuid,boolean),public.my_space_blocks(integer) from public,anon;
grant execute on function public.set_space_block(uuid,boolean),public.my_space_blocks(integer) to authenticated;

create or replace function public.member_spaces(p_id uuid default null,p_offset integer default 0)
returns table(user_id uuid,display_name text,bio text,links jsonb,updated_at timestamptz,avatar_kind text,avatar_emoji text,avatar_color text,avatar_path text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录' using errcode='42501';end if;
 return query select s.user_id,s.display_name,s.bio,s.links,s.updated_at,p.avatar_kind,p.avatar_emoji,p.avatar_color,p.avatar_path
 from public.user_spaces s left join public.profiles p on p.user_id=s.user_id
 where (p_id is null or s.user_id=p_id) and not exists(select 1 from public.space_blocks b where b.blocker_id=auth.uid() and b.blocked_id=s.user_id) order by s.updated_at desc,s.user_id limit 30 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;

create or replace function public.search_member_spaces(p_query text default '',p_offset integer default 0)
returns table(user_id uuid,display_name text,bio text,links jsonb,updated_at timestamptz,avatar_kind text,avatar_emoji text,avatar_color text,avatar_path text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录' using errcode='42501';end if;
 if char_length(p_query)>40 then raise exception '搜索昵称最多 40 字';end if;
 return query select s.user_id,s.display_name,s.bio,s.links,s.updated_at,p.avatar_kind,p.avatar_emoji,p.avatar_color,p.avatar_path
 from public.user_spaces s left join public.profiles p on p.user_id=s.user_id
 where strpos(lower(s.display_name),lower(coalesce(trim(p_query),'')))>0 and not exists(select 1 from public.space_blocks b where b.blocker_id=auth.uid() and b.blocked_id=s.user_id)
 order by s.updated_at desc,s.user_id limit 30 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;

commit;
