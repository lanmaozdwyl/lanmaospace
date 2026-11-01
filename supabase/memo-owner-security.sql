-- 店主权限收紧：执行前确认 UID 属于自己的店主账号。可重复执行，不删已有数据。
-- 此脚本只限制备忘录表和 memo-files 存储桶，不影响访客登录、商店或留言。
begin;
do $$ begin
  if not exists (select 1 from auth.users where id = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid) then
    raise exception '店主 UID 不存在；事务已停止，请核对 UID';
  end if;
end $$;

alter table public.memo_vault enable row level security;
revoke all privileges on public.memo_vault from anon;
drop policy if exists memo_owner_boundary on public.memo_vault;
create policy memo_owner_boundary on public.memo_vault
  as restrictive for all to public
  using (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and user_id = auth.uid())
  with check (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and user_id = auth.uid());

alter table public.memos enable row level security;
revoke all privileges on public.memos from anon;
drop policy if exists memo_owner_boundary on public.memos;
create policy memo_owner_boundary on public.memos
  as restrictive for all to public
  using (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and user_id = auth.uid())
  with check (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and user_id = auth.uid());

alter table public.memo_files enable row level security;
revoke all privileges on public.memo_files from anon;
drop policy if exists memo_owner_boundary on public.memo_files;
create policy memo_owner_boundary on public.memo_files
  as restrictive for all to public
  using (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and user_id = auth.uid())
  with check (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and user_id = auth.uid() and exists (select 1 from public.memos n where n.id = note_id and n.user_id = auth.uid()));

drop policy if exists memo_storage_owner_boundary on storage.objects;
create policy memo_storage_owner_boundary on storage.objects
  as restrictive for all to public
  using (bucket_id <> 'memo-files' or
    (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and (storage.foldername(name))[1] = auth.uid()::text))
  with check (bucket_id <> 'memo-files' or
    (auth.uid() = '664f60db-71ad-49b8-9229-744f16b1d19a'::uuid and (storage.foldername(name))[1] = auth.uid()::text));
-- AES-GCM 在原文件末尾增加 16 字节认证标签，允许正好 20 MB 的原文件。
update storage.buckets set file_size_limit = 20971536, public = false where id = 'memo-files';
commit;
