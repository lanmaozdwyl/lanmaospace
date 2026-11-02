-- Lanmao Space 用户头像：profiles 表 + avatars 公开存储桶 + 留言公开列表函数。
-- 在 Supabase 后台的 SQL Editor 里粘贴并运行一次即可；重复运行也不会报错。
-- 先运行 supabase/guestbook.sql（留言表必须先存在）。
--
-- 头像怎么存的：
-- 1. 预设头像只存 emoji + 渐变色两个字段，不占存储空间。
-- 2. 上传图存在 avatars 存储桶，路径固定为 <用户 id>/avatar，换图直接覆盖，
--    单张上限 2 MB，浏览器里先缩到 256px 再上传；存储桶是公开读的，
--    因为头像本来就要显示在留言旁，写权限只允许本人写自己文件夹。
-- 3. profiles 表只允许本人读写自己的行；留言旁的头像不直接查表，
--    而是走下面的 guestbook_public_list 函数：它只返回已通过审核的
--    留言和头像字段，不返回 user_id 和邮箱，guestbook.sql 里“前端
--    不读 user_id / email”的列权限保持不变。
-- 4. 上传的头像本身不经过留言审核：只要该用户有一条留言通过审核，
--    头像就会跟着显示；不合适的头像店主可在后台 Storage 里删除
--    对应文件，或在 profiles 表里删掉该行（页面会回退到默认 emoji）。
-- 5. 头像和备忘录附件共用 Supabase 免费版 1 GB 文件存储。

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  avatar_kind text not null default 'emoji' check (avatar_kind in ('emoji', 'upload')),
  avatar_emoji text,
  avatar_color text,
  avatar_path text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all privileges on table public.profiles from anon;
drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 公开读的头像存储桶：id 和 name 都叫 avatars。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 存储桶行级权限：所有人可读；只有本人可写自己文件夹（路径第一段 = 用户 id）下的文件。
drop policy if exists "avatars_storage_read" on storage.objects;
create policy "avatars_storage_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');
drop policy if exists "avatars_storage_owner_insert" on storage.objects;
create policy "avatars_storage_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "avatars_storage_owner_update" on storage.objects;
create policy "avatars_storage_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "avatars_storage_owner_delete" on storage.objects;
create policy "avatars_storage_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- 留言公开列表：只返回已通过审核的留言 + 头像字段，不暴露 user_id / 邮箱。
-- SECURITY DEFINER 绕过行级权限，因此函数内部必须自己限定 approved = true，
-- 且只返回上面列出的字段；不要在这里放宽成返回全部留言。
create or replace function public.guestbook_public_list()
returns table(id uuid, name text, message text, created_at timestamptz,
  avatar_kind text, avatar_emoji text, avatar_color text, avatar_path text)
language sql security definer set search_path = '' as $$
  select g.id, g.name, g.message, g.created_at,
         p.avatar_kind, p.avatar_emoji, p.avatar_color, p.avatar_path
  from public.guestbook_messages g
  left join public.profiles p on p.user_id = g.user_id
  where g.approved = true
  order by g.created_at desc, g.id desc
  limit 50;
$$;
revoke all on function public.guestbook_public_list() from public, anon;
grant execute on function public.guestbook_public_list() to anon, authenticated;
