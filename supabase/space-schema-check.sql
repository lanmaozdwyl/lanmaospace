-- 空间迁移体检：在 Supabase 后台 SQL Editor 里整段粘贴运行。只读，不建对象、不改数据、不读留言内容。
-- 用途：确认 user-spaces.sql / space-community.sql / space-blocks.sql 真的在当前项目库里生效了，
-- 而不是只存在于仓库里。跑完应该只看到一行 notice + 两张清单；任何 FAIL 都是没跑或跑了一半。
-- 期望结果：一条 notice，计数 策略 25 / public 函数 13，屏蔽关系出现在 5 处
-- （member_spaces、search_member_spaces、my_space_blocks、set_space_block、posts_member_read 读策略）。
-- 线上计数允许比这个大：Supabase 自带的表和策略也算在内；判定只看上面这些命名对象，不看总数。
-- 这段体检自己的正确性由 tests/permissions.test.mjs 末尾兜住：干净库必须过，
-- 把 posts_member_read 退回旧版必须报错——不然它只是个装饰。
do $$
declare
  r text;
  -- 一律用 array_append 而不是 `arr || '文本'`：右边是裸字面量时类型未知，
  -- PostgreSQL 会选中 array||array 那个重载、把整串当数组字面量解析，直接 "malformed array literal"。
  missing text[] := '{}';
  leaky text[] := '{}';
  definer_gap text;
begin
  -- 1) 三张表必须存在，且 RLS 打开、没有 role 能绕过 RLS。
  foreach r in array array['user_spaces', 'space_posts', 'space_blocks'] loop
    if to_regclass('public.' || r) is null then
      missing := array_append(missing, r);
    else
      if not (select relrowsecurity from pg_class where oid = ('public.' || r)::regclass) then
        leaky := array_append(leaky, r || ' RLS 未开启');
      end if;
      if exists (select 1 from pg_class where oid = ('public.' || r)::regclass and relforcerowsecurity = false
                   and exists (select 1 from pg_roles where rolbypassrls and rolname in ('anon','authenticated'))) then
        leaky := array_append(leaky, r || ' 被 bypassrls 角色绕过');
      end if;
    end if;
  end loop;

  -- 2) 屏蔽关系必须是私有表：只能被"屏蔽的发起方"读到，且没有任何对外策略。
  if to_regclass('public.space_blocks') is not null then
    if not exists (select 1 from pg_policy p where p.polrelid = 'public.space_blocks'::regclass
                     and p.polname = 'space_blocks_private') then
      leaky := array_append(leaky, 'space_blocks 缺少 space_blocks_private 策略');
    elsif not (select pg_get_expr(p.polqual, p.polrelid) from pg_policy p
               where p.polrelid = 'public.space_blocks'::regclass and p.polname = 'space_blocks_private')
            ~ 'blocker_id' then
      leaky := array_append(leaky, 'space_blocks_private 没有按 blocker_id 限定');
    end if;
    if has_table_privilege('anon', 'public.space_blocks', 'SELECT') then
      leaky := array_append(leaky, 'anon 对 space_blocks 有表级 SELECT');
    end if;
  end if;

  -- 3) 跨成员读写的四个入口必须真的联到 space_blocks，否则屏蔽只是"写了但没用"。
  foreach r in array array['member_spaces', 'search_member_spaces', 'set_space_block', 'my_space_blocks'] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = r) then
      missing := array_append(missing, r);
    else
      if not (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = r) ~ 'space_blocks' then
        leaky := array_append(leaky, r || ' 未引用 space_blocks，屏蔽对它无效');
      end if;
    end if;
  end loop;
  if exists (select 1 from pg_policy p where p.polrelid = 'public.space_posts'::regclass
               and p.polname = 'posts_member_read'
               and pg_get_expr(p.polqual, p.polrelid) ~ 'space_blocks') is false then
    leaky := array_append(leaky, 'posts_member_read 里没有 space_blocks 条件（旧版 user-spaces.sql）');
  end if;

  -- 4) 所有 security definer 函数必须固定 search_path，否则可被同名临时对象劫持。
  select string_agg(p.proname, ', ') into definer_gap
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%');
  if coalesce(definer_gap, '') <> '' then
    leaky := array_append(leaky, 'security definer 未固定 search_path: ' || definer_gap);
  end if;

  if cardinality(missing) > 0 then
    raise exception 'FAIL: 库里缺少这些对象（迁移没跑或跑错顺序）: %', array_to_string(missing, ', ');
  end if;
  if cardinality(leaky) > 0 then
    raise exception 'FAIL: %', array_to_string(leaky, ' | ');
  end if;

  raise notice 'PASS 空间权限：表 %，public 策略 %，public 函数 %',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'),
    (select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','storage')),
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public');
end $$;

-- 清单：拿下面两张表和上面本地预演的输出一行行比对，不一致就是线上少了迁移或多了旧策略。
select c.relname as "表", p.polname as "策略", p.polcmd as "命令",
       coalesce(pg_get_expr(p.polqual, p.polrelid), '(always)') as "using",
       coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '-')   as "with"
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
order by c.relname, p.polname;

select p.proname as "函数", p.prosecdef as "definer",
       coalesce(array_to_string(p.proconfig, ','), '') as "config",
       position('space_blocks' in p.prosrc) > 0        as "引用屏蔽表"
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
