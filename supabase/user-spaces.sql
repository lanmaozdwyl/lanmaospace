-- 成员个人空间：登录用户互相可见；仅本人写入。先执行 avatars.sql。
begin;
create or replace function public.valid_space_links(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(v) <> 'array' or jsonb_array_length(v)>6 then return false; end if;
 for item in select value from jsonb_array_elements(v) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'label') is distinct from 'string'
     or jsonb_typeof(item->'url') is distinct from 'string'
     or char_length(trim(item->>'label')) not between 1 and 40
     or char_length(item->>'url')>1000
     or (item->>'url') !~ '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' then return false; end if;
 end loop;
 return true;
end; $$;
create table if not exists public.user_spaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 1 and 40),
 bio text not null default '' check(char_length(bio)<=600),
 links jsonb not null default '[]'::jsonb check(public.valid_space_links(links)),
 updated_at timestamptz not null default now()
);
create table if not exists public.space_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 archived boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists space_posts_member_time on public.space_posts(user_id,created_at desc,id desc);
create or replace function public.space_updated_at() returns trigger
language plpgsql set search_path='' as $$ begin new.updated_at=clock_timestamp();return new;end; $$;
drop trigger if exists user_spaces_updated_at on public.user_spaces;
create trigger user_spaces_updated_at before update on public.user_spaces for each row execute function public.space_updated_at();
alter table public.user_spaces enable row level security;
alter table public.space_posts enable row level security;
revoke all on public.user_spaces,public.space_posts from public,anon,authenticated;
grant select on public.user_spaces,public.space_posts to authenticated;
grant insert(user_id,display_name,bio,links),update(display_name,bio,links) on public.user_spaces to authenticated;
grant insert(id,user_id,body),update(archived) on public.space_posts to authenticated;
drop policy if exists spaces_member_read on public.user_spaces;
-- 直接 select 只能看到自己这一行；跨成员读取一律走下面 security definer 的
-- member_spaces / search_member_spaces，由它们负责屏蔽过滤。
-- 之前的 using(auth.uid() is not null) 让任何登录用户都能绕过屏蔽，
-- 用 user_id 直接拉取被屏蔽成员的 display_name、bio 和 links。
create policy spaces_member_read on public.user_spaces for select to authenticated using(user_id=auth.uid());
drop policy if exists spaces_owner_insert on public.user_spaces;
create policy spaces_owner_insert on public.user_spaces for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists spaces_owner_update on public.user_spaces;
create policy spaces_owner_update on public.user_spaces for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists posts_member_read on public.space_posts;
create policy posts_member_read on public.space_posts for select to authenticated using(auth.uid() is not null and (not archived or user_id=auth.uid()));
drop policy if exists posts_owner_insert on public.space_posts;
create policy posts_owner_insert on public.space_posts for insert to authenticated with check(auth.uid()=user_id and not archived);
drop policy if exists posts_owner_update on public.space_posts;
create policy posts_owner_update on public.space_posts for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create or replace function public.member_spaces(p_id uuid default null,p_offset integer default 0)
returns table(user_id uuid,display_name text,bio text,links jsonb,updated_at timestamptz,avatar_kind text,avatar_emoji text,avatar_color text,avatar_path text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录' using errcode='42501';end if;
 return query select s.user_id,s.display_name,s.bio,s.links,s.updated_at,p.avatar_kind,p.avatar_emoji,p.avatar_color,p.avatar_path
 from public.user_spaces s left join public.profiles p on p.user_id=s.user_id
 where p_id is null or s.user_id=p_id order by s.updated_at desc,s.user_id limit 30 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;
revoke all on function public.member_spaces(uuid,integer) from public,anon;
grant execute on function public.member_spaces(uuid,integer) to authenticated;
commit;
