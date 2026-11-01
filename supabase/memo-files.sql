-- Lanmao Space 备忘录附件：建 memo_files 元数据表 + memo-files 私有存储桶。
-- 在 Supabase 后台的 SQL Editor 里粘贴并运行一次即可；重复运行也不会报错。
-- 先运行 supabase/memos.sql（memos 表必须先存在，memo_files 引用它）。
--
-- 附件怎么存的：
-- 1. 文件在浏览器里用备忘录口令派生的密钥 AES-GCM 加密后，才上传到
--    memo-files 存储桶；存储桶里只有密文，文件名也不用原名。
-- 2. 文件在存储桶里的路径是 <用户 id>/<随机 uuid>.bin，原文件名加密后
--    只存在 memo_files 表里，解密要在浏览器里用备忘录口令。
-- 3. 存储桶是私有的（public = false），行级权限只允许本人读写自己
--    文件夹下的文件。访客账号没有备忘录口令，也没有原文件路径，
--    拿不到店主的附件。
-- 4. 单个文件上限 20 MB（Supabase 免费版全局上限是 50 MB，代码里
--    再收紧到 20 MB，避免浏览器加密大文件太慢；想放宽到 50 MB
--    改 memo.js 里的 MAX_FILE_BYTES 和这里的 file_size_limit）。
--    文件存储总量是 Supabase 免费版的 1 GB，删备忘录/删附件时
--    代码会同时删存储桶里的密文，不会一直占着额度。

create table if not exists public.memo_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.memos (id) on delete cascade,
  file_path text not null unique,
  name_ciphertext text not null,
  name_iv text not null,
  file_iv text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

alter table public.memo_files enable row level security;
drop policy if exists "memo_files_owner" on public.memo_files;
create policy "memo_files_owner" on public.memo_files
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists memo_files_user_note_idx
  on public.memo_files (user_id, note_id);

-- 私有存储桶：id 和 name 都叫 memo-files。
-- 20 MB 原文件加上 AES-GCM 的 16 字节认证标签，重跑建桶脚本也保留正确上限。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memo-files', 'memo-files', false, 20971536, null)
on conflict (id) do update
  set public = false,
      file_size_limit = 20971536,
      allowed_mime_types = null;

-- 存储桶行级权限：只允许本人操作自己文件夹（路径第一段 = 用户 id）下的文件。
drop policy if exists "memo_files_storage_owner" on storage.objects;
create policy "memo_files_storage_owner" on storage.objects
  for all
  using (bucket_id = 'memo-files' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'memo-files' and auth.uid()::text = (storage.foldername(name))[1]);
