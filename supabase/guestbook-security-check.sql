-- 修复后执行：只检查权限，不读取留言或邮箱、不修改数据。
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_column_privilege(r, 'public.guestbook_messages', 'email', 'SELECT')
      or has_column_privilege(r, 'public.guestbook_messages', 'user_id', 'SELECT') then
      raise exception 'FAIL: % can read private columns', r;
    end if;
    if not has_column_privilege(r, 'public.guestbook_messages', 'message', 'SELECT') then
      raise exception 'FAIL: % cannot read public messages', r;
    end if;
    if has_column_privilege(r, 'public.guestbook_messages', 'approved', 'INSERT')
      or has_any_column_privilege(r, 'public.guestbook_messages', 'UPDATE')
      or has_table_privilege(r, 'public.guestbook_messages', 'DELETE') then
      raise exception 'FAIL: % has unexpected write permissions', r;
    end if;
  end loop;
  if has_any_column_privilege('anon', 'public.guestbook_messages', 'INSERT') then
    raise exception 'FAIL: anonymous insert allowed';
  end if;
  if not has_column_privilege('authenticated', 'public.guestbook_messages', 'email', 'INSERT') then
    raise exception 'FAIL: normal submission blocked';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.guestbook_messages'::regclass) then
    raise exception 'FAIL: RLS disabled';
  end if;

  -- 点赞部分单独一段：guestbook-likes.sql 还没跑时只提示，不报 FAIL。
  -- 这张表的一行就是"谁赞了哪条"，所以跑齐之后必须是谁都直连读不到，
  -- 计数和"我是否赞过"只能从 security definer 函数出来。
  if to_regclass('public.guestbook_likes') is null then
    raise notice 'SKIP: 还没运行 guestbook-likes.sql，点赞相关的检查跳过';
  else
    if not (select relrowsecurity from pg_class where oid = 'public.guestbook_likes'::regclass) then
      raise exception 'FAIL: guestbook_likes RLS disabled';
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'guestbook_likes') then
      raise exception 'FAIL: guestbook_likes 上有策略，点赞记录可能被直接读出来';
    end if;
    foreach r in array array['anon', 'authenticated'] loop
      if has_table_privilege(r, 'public.guestbook_likes', 'SELECT')
        or has_table_privilege(r, 'public.guestbook_likes', 'INSERT')
        or has_table_privilege(r, 'public.guestbook_likes', 'DELETE') then
        raise exception 'FAIL: % can touch guestbook_likes directly', r;
      end if;
      if not has_function_privilege(r, 'public.guestbook_like_state()', 'EXECUTE') then
        raise exception 'FAIL: % cannot read like counts', r;
      end if;
    end loop;
    if has_function_privilege('anon', 'public.guestbook_set_like(uuid, boolean)', 'EXECUTE') then
      raise exception 'FAIL: anonymous visitor can call guestbook_set_like';
    end if;
    if not has_function_privilege('authenticated', 'public.guestbook_set_like(uuid, boolean)', 'EXECUTE') then
      raise exception 'FAIL: signed-in visitor cannot like';
    end if;
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('guestbook_like_state', 'guestbook_set_like')
        and (p.prosecdef = false
             or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
    ) then
      raise exception 'FAIL: 点赞函数缺 security definer 或没钉住 search_path';
    end if;
    raise notice 'PASS: 点赞表不可直连，计数只经 security definer 函数暴露';
  end if;

  raise notice 'PASS: column permissions and RLS enabled; still test submission and approval with a visitor account';
end $$;
