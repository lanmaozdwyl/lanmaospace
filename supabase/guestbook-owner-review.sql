-- 店主站内审核：在 SQL Editor 全文执行。幂等，不修改现有留言。
-- SECURITY DEFINER 函数在数据库内核对店主 UID；不放开邮箱列或普通用户 UPDATE 权限。
begin;
create or replace function public.owner_guestbook_list(p_approved boolean default false,p_offset integer default 0)
returns table(id uuid,name text,message text,created_at timestamptz,approved boolean)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is distinct from '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid then
   raise exception '仅店主可审核留言' using errcode='42501';
 end if;
 return query select g.id,g.name,g.message,g.created_at,g.approved
 from public.guestbook_messages g where g.approved=p_approved
 order by g.created_at desc,g.id desc limit 50 offset greatest(0,least(coalesce(p_offset,0),100000));
end; $$;
create or replace function public.owner_guestbook_review(p_id uuid,p_approved boolean,p_expected boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
 if auth.uid() is distinct from '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid then
   raise exception '仅店主可审核留言' using errcode='42501';
 end if;
 if p_approved is null or p_expected is null then raise exception '缺少审核状态'; end if;
 update public.guestbook_messages set approved=p_approved where id=p_id and approved=p_expected;
 get diagnostics changed = row_count;
 return changed=1;
end; $$;
revoke all on function public.owner_guestbook_list(boolean,integer) from public,anon;
revoke all on function public.owner_guestbook_review(uuid,boolean,boolean) from public,anon;
grant execute on function public.owner_guestbook_list(boolean,integer) to authenticated;
grant execute on function public.owner_guestbook_review(uuid,boolean,boolean) to authenticated;
commit;
