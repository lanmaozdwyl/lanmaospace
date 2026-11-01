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
  raise notice 'PASS: column permissions and RLS enabled; still test submission and approval with a visitor account';
end $$;
