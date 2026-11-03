-- 成员空间增强：动态编辑、成员搜索、举报管理与服务端发布限制。
-- 先执行 user-spaces.sql。全文可重复运行，不删除内容。
begin;
alter table public.space_posts add column if not exists updated_at timestamptz not null default now();
alter table public.space_posts add column if not exists edited_at timestamptz;
alter table public.space_posts add column if not exists moderation_hidden boolean not null default false;
grant update(body) on public.space_posts to authenticated;
drop policy if exists posts_member_read on public.space_posts;
create policy posts_member_read on public.space_posts for select to authenticated
 using(auth.uid() is not null and (user_id=auth.uid() or (not archived and not moderation_hidden)));
create or replace function public.space_post_limits() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if tg_op='INSERT' then
  if (select count(*) from public.space_posts where user_id=new.user_id)>=500 then raise exception '每个账号最多保存 500 条动态（含隐藏动态）';end if;
  if (select count(*) from public.space_posts where user_id=new.user_id and created_at>=current_date)>=30 then raise exception '每天最多发布 30 条动态';end if;
  if exists(select 1 from public.space_posts where user_id=new.user_id and created_at>clock_timestamp()-interval '20 seconds') then raise exception '发布太快，请间隔 20 秒再试';end if;
  new.created_at=clock_timestamp();new.edited_at=null;
 elsif new.body is distinct from old.body then
  if old.updated_at>clock_timestamp()-interval '5 seconds' then raise exception '编辑太快，请间隔 5 秒再试';end if;
  new.edited_at=clock_timestamp();
 end if;
 new.updated_at=clock_timestamp();return new;
end; $$;
drop trigger if exists space_post_limits on public.space_posts;
create trigger space_post_limits before insert or update on public.space_posts for each row execute function public.space_post_limits();
create or replace function public.search_member_spaces(p_query text default '',p_offset integer default 0)
returns table(user_id uuid,display_name text,bio text,links jsonb,updated_at timestamptz,avatar_kind text,avatar_emoji text,avatar_color text,avatar_path text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录' using errcode='42501';end if;
 if char_length(p_query)>40 then raise exception '搜索昵称最多 40 字';end if;
 return query select s.user_id,s.display_name,s.bio,s.links,s.updated_at,p.avatar_kind,p.avatar_emoji,p.avatar_color,p.avatar_path
 from public.user_spaces s left join public.profiles p on p.user_id=s.user_id
 where strpos(lower(s.display_name),lower(coalesce(trim(p_query),'')))>0
 order by s.updated_at desc,s.user_id limit 30 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;
create table if not exists public.space_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.space_posts(id) on delete cascade,
 reason text not null check(char_length(trim(reason)) between 1 and 500),
 status text not null default 'pending' check(status in ('pending','resolved')),
 resolution text check(resolution in ('hidden','dismissed')),created_at timestamptz not null default now(),
 unique(reporter_id,post_id)
);
create index if not exists space_reports_status_time on public.space_reports(status,created_at desc);
alter table public.space_reports enable row level security;
revoke all on public.space_reports from public,anon,authenticated;
create or replace function public.report_space_post(p_post uuid,p_reason text) returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();inserted integer;
begin
 if uid is null then raise exception '请先登录' using errcode='42501';end if;
 if char_length(trim(p_reason)) not between 1 and 500 then raise exception '举报原因请填写 1–500 字';end if;
 if not exists(select 1 from public.space_posts where id=p_post and user_id<>uid and not archived and not moderation_hidden) then raise exception '此动态无法举报' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,1));
 if exists(select 1 from public.space_reports where reporter_id=uid and post_id=p_post) then return false;end if;
 if (select count(*) from public.space_reports where reporter_id=uid and created_at>=current_date)>=5 then raise exception '每天最多举报 5 条动态';end if;
 insert into public.space_reports(reporter_id,post_id,reason) values(uid,p_post,trim(p_reason));get diagnostics inserted=row_count;return inserted=1;
end; $$;
create or replace function public.owner_space_reports(p_status text default 'pending',p_offset integer default 0)
returns table(id uuid,post_id uuid,reason text,body text,author text,moderation_hidden boolean,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is distinct from '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid then raise exception '仅店主可处理举报' using errcode='42501';end if;
 return query select r.id,r.post_id,r.reason,p.body,coalesce(s.display_name,'未设置昵称'),p.moderation_hidden,r.created_at
 from public.space_reports r join public.space_posts p on p.id=r.post_id left join public.user_spaces s on s.user_id=p.user_id
 where r.status=p_status order by r.created_at desc,r.id limit 30 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;
create or replace function public.owner_moderate_space_post(p_report uuid,p_hide boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare post uuid;
begin
 if auth.uid() is distinct from '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid then raise exception '仅店主可处理举报' using errcode='42501';end if;
 if p_hide is null then raise exception '缺少处理状态';end if;
 select post_id into post from public.space_reports where id=p_report for update;
 if post is null then return false;end if;
 update public.space_posts set moderation_hidden=p_hide where id=post;
 update public.space_reports set status='resolved',resolution=case when p_hide then 'hidden' else 'dismissed' end where id=p_report;
 return true;
end; $$;
revoke all on function public.search_member_spaces(text,integer),public.report_space_post(uuid,text),public.owner_space_reports(text,integer),public.owner_moderate_space_post(uuid,boolean) from public,anon;
grant execute on function public.search_member_spaces(text,integer),public.report_space_post(uuid,text),public.owner_space_reports(text,integer),public.owner_moderate_space_post(uuid,boolean) to authenticated;
commit;
