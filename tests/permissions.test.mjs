import {fileURLToPath} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const root=fileURLToPath(new URL('../',import.meta.url));
const owner='664f60db-71ad-49b8-9229-744f16b1d19a',guest='00000000-0000-4000-8000-000000000002';
let checks=0;
async function allowed(sql,params=[]){const result=await db.query(sql,params);checks++;return result;}
async function denied(sql,params=[]){await assert.rejects(db.query(sql,params));checks++;}
async function as(role,uid){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec(`set role ${role}`);}
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant all on storage.objects to anon,authenticated;
 create policy other_bucket on storage.objects for all to authenticated using(bucket_id='other') with check(bucket_id='other');`);
 await db.query('insert into auth.users values ($1),($2)',[owner,guest]);
 for(const f of ['memos.sql','memo-files.sql','guestbook.sql'])await db.exec(readFileSync(root+'/supabase/'+f,'utf8'));
 await db.exec('grant all on public.memo_vault,public.memos,public.memo_files to anon,authenticated;');
 const migration=readFileSync(root+'/supabase/memo-owner-security.sql','utf8');
 await db.exec(migration);await db.exec(migration);checks++;
 await as('authenticated',owner);
 await allowed('insert into public.memo_vault(user_id,salt,check_ciphertext,check_iv) values($1,$2,$3,$4)',[owner,'salt','encrypted','iv']);
 const note=(await allowed('insert into public.memos(user_id,ciphertext,iv) values($1,$2,$3) returning id',[owner,'old','iv'])).rows[0].id;
 await allowed('insert into storage.objects(bucket_id,name) values($1,$2)',['memo-files',owner+'/fixture.bin']);
 await allowed('insert into public.memo_files(user_id,note_id,file_path,name_ciphertext,name_iv,file_iv,size_bytes) values($1,$2,$3,$4,$5,$6,1)',[owner,note,owner+'/fixture.bin','name','iv','iv']);
 const updated=await allowed('update public.memos set ciphertext=$1 where id=$2 and ciphertext=$3 returning id',['new',note,'old']);assert.equal(updated.rows.length,1);
 const stale=await allowed('update public.memos set ciphertext=$1 where id=$2 and ciphertext=$3 returning id',['overwrite',note,'old']);assert.equal(stale.rows.length,0);
 await as('authenticated',guest);
 for(const table of ['memo_vault','memos','memo_files'])assert.equal((await allowed(`select * from public.${table}`)).rows.length,0);
 await denied('insert into public.memos(user_id,ciphertext,iv) values($1,$2,$3)',[guest,'x','iv']);
 await denied('insert into public.memo_vault(user_id,salt,check_ciphertext,check_iv) values($1,$2,$3,$4)',[guest,'s','c','iv']);
 await denied('insert into public.memo_files(user_id,note_id,file_path,name_ciphertext,name_iv,file_iv,size_bytes) values($1,$2,$3,$4,$5,$6,1)',[guest,note,guest+'/file.bin','x','iv','iv']);
 await denied('insert into storage.objects(bucket_id,name) values($1,$2)',['memo-files',guest+'/file.bin']);
 assert.equal((await allowed("select * from storage.objects where bucket_id='memo-files'")).rows.length,0);
 await allowed('insert into storage.objects(bucket_id,name) values($1,$2)',['other','unchanged']);
 await allowed('insert into public.guestbook_messages(user_id,name,email,message) values($1,$2,$3,$4)',[guest,'fixture','test@example.invalid','test']);
 await denied('insert into public.guestbook_messages(user_id,name,message,approved) values($1,$2,$3,true)',[guest,'fixture','bypass']);
 await denied('select email from public.guestbook_messages');
 assert.equal((await allowed('select id,name,message,created_at from public.guestbook_messages where approved=true')).rows.length,0);
 await db.exec('reset role;update public.guestbook_messages set approved=true;');
 await as('authenticated',guest);
 assert.equal((await allowed('select id,name,message,created_at from public.guestbook_messages where approved=true')).rows.length,1);
 await denied('select email from public.guestbook_messages where approved=true');
 await as('anon','');await denied('select * from public.memos');
 await db.exec('reset role');
 assert.equal((await db.query("select file_size_limit from storage.buckets where id='memo-files'")).rows[0].file_size_limit,20971536);checks++;
 const reviewSQL=readFileSync(root+'/supabase/guestbook-owner-review.sql','utf8');
 await db.exec(reviewSQL);await db.exec(reviewSQL);checks++;
 await as('authenticated',guest);
 await denied('select * from public.owner_guestbook_list(false,0)');
 const fakeId='00000000-0000-4000-8000-000000000003';
 await denied('select public.owner_guestbook_review($1,true,false)',[fakeId]);
 await denied('update public.guestbook_messages set approved=true');
 await as('anon','');await denied('select * from public.owner_guestbook_list(false,0)');
 await denied('select public.owner_guestbook_review($1,true,false)',[fakeId]);
 await as('authenticated',owner);
 const listed=(await allowed('select * from public.owner_guestbook_list(true,0)')).rows;
 assert.equal(listed.length,1);assert(!Object.hasOwn(listed[0],'email'));
 const messageId=listed[0].id;
 assert.equal((await allowed('select public.owner_guestbook_review($1,false,true) as changed',[messageId])).rows[0].changed,true);
 assert.equal((await allowed('select public.owner_guestbook_review($1,true,true) as changed',[messageId])).rows[0].changed,false);
 assert.equal((await allowed('select * from public.owner_guestbook_list(false,0)')).rows.length,1);
 await as('authenticated',guest);
 assert.equal((await allowed('select id from public.guestbook_messages')).rows.length,0);
 await denied('select email from public.guestbook_messages');
 await as('authenticated',owner);
 await allowed('select public.owner_guestbook_review($1,true,false)',[messageId]);
 await as('anon','');assert.equal((await allowed('select id from public.guestbook_messages')).rows.length,1);

 // 模拟 Supabase public schema 对 authenticated 的默认表授权；RLS 仍须隔离行。
 await db.exec('reset role;alter default privileges in schema public grant all on tables to authenticated;');
 const avatarsSQL=readFileSync(root+'/supabase/avatars.sql','utf8');
 await db.exec(avatarsSQL);await db.exec(avatarsSQL);checks++;
 await as('authenticated',owner);
 await allowed('insert into public.profiles(user_id,avatar_kind,avatar_emoji,avatar_color) values($1,$2,$3,$4)',[owner,'emoji','🐱','purple']);
 await as('authenticated',guest);
 await allowed('insert into public.profiles(user_id,avatar_kind,avatar_path) values($1,$2,$3)',[guest,'upload',guest+'/avatar']);
 const ownProfiles=(await allowed('select user_id from public.profiles')).rows;
 assert.deepEqual(ownProfiles.map(p=>p.user_id),[guest]);
 await denied('insert into public.profiles(user_id,avatar_kind) values($1,$2)',[owner,'emoji']);
 assert.equal((await allowed('update public.profiles set avatar_emoji=$1 where user_id=$2 returning user_id',['x',owner])).rows.length,0);
 assert.equal((await allowed('delete from public.profiles where user_id=$1 returning user_id',[owner])).rows.length,0);
 await allowed('insert into storage.objects(bucket_id,name) values($1,$2)',['avatars',guest+'/avatar']);
 await denied('insert into storage.objects(bucket_id,name) values($1,$2)',['avatars',owner+'/intruder']);
 await denied('update storage.objects set name=$1 where bucket_id=$2 and name=$3',[owner+'/avatar','avatars',guest+'/avatar']);
 await allowed('insert into public.guestbook_messages(user_id,name,message) values($1,$2,$3)',[guest,'pending fixture','unapproved']);
 await as('authenticated',owner);
 assert.deepEqual((await allowed('select user_id from public.profiles')).rows.map(p=>p.user_id),[owner]);
 assert.equal((await allowed("delete from storage.objects where bucket_id='avatars' returning name")).rows.length,0);
 await as('anon','');
 await denied('select * from public.profiles');
 await denied('insert into storage.objects(bucket_id,name) values($1,$2)',['avatars','anon/avatar']);
 assert.equal((await allowed("select name from storage.objects where bucket_id='avatars'")).rows.length,1);
 const publicRows=(await allowed('select * from public.guestbook_public_list()')).rows;
 assert.equal(publicRows.length,1);assert.equal(publicRows[0].avatar_kind,'upload');
 assert(!Object.hasOwn(publicRows[0],'user_id'));assert(!Object.hasOwn(publicRows[0],'email'));
 await db.exec('reset role');
 const avatarBucket=(await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars'")).rows[0];
 assert.equal(avatarBucket.public,true);assert.equal(avatarBucket.file_size_limit,2097152);assert(!avatarBucket.allowed_mime_types.includes('text/html'));checks++;

 // 留言板点赞：一行就是一条"谁赞了哪条"，所以表必须谁都读不到，
 // 计数与"我是否赞过"只能从 security definer 函数出来。
 // 顺带把 guestbook-security-check.sql 的通过/失败两个分支都跑一遍。
 const likesSQL=readFileSync(root+'/supabase/guestbook-likes.sql','utf8');
 await db.exec(likesSQL);await db.exec(likesSQL);checks++;
 const liked=(await allowed('select id from public.guestbook_messages where approved=true limit 1')).rows[0].id;
 const unapproved=(await allowed('select id from public.guestbook_messages where approved=false limit 1')).rows[0].id;
 await as('anon','');await denied('select * from public.guestbook_likes');
 await denied('select * from public.guestbook_set_like($1,true)',[liked]);
 const anonLike=(await allowed('select * from public.guestbook_like_state()')).rows;
 assert.equal(anonLike.length,1);assert.equal(anonLike[0].like_count,0);assert.equal(anonLike[0].liked_by_me,false);
 await as('authenticated',guest);
 await denied('select * from public.guestbook_likes');
 assert.equal((await allowed('select * from public.guestbook_set_like($1,true)',[liked])).rows[0].like_count,1);
 // 连点不刷票：主键 + on conflict do nothing，重复调用拿到同一个计数。
 assert.equal((await allowed('select * from public.guestbook_set_like($1,true)',[liked])).rows[0].like_count,1);
 // 未审核与不存在的留言回同一句话，否则这个接口能拿来探测后台有哪些留言。
 await assert.rejects(db.query('select * from public.guestbook_set_like($1,true)',[unapproved]),/暂时不接受点赞/);checks++;
 await assert.rejects(db.query('select * from public.guestbook_set_like($1,true)',['00000000-0000-4000-8000-0000000000ad']),/暂时不接受点赞/);checks++;
 // 别人那一票改不掉：店主取消只删得掉自己的行。
 await as('authenticated',owner);
 assert.equal((await allowed('select * from public.guestbook_set_like($1,false)',[liked])).rows[0].like_count,1);
 const ownerLike=(await allowed('select * from public.guestbook_like_state()')).rows[0];
 assert.equal(ownerLike.like_count,1);assert.equal(ownerLike.liked_by_me,false);
 assert.equal((await allowed('select * from public.guestbook_set_like($1,true)',[liked])).rows[0].like_count,2);
 await as('authenticated',guest);
 const guestLike=(await allowed('select * from public.guestbook_like_state()')).rows[0];
 assert.equal(guestLike.like_count,2);assert.equal(guestLike.liked_by_me,true);
 assert.equal((await allowed('select * from public.guestbook_set_like($1,false)',[liked])).rows[0].like_count,1);
 await db.exec('reset role');
 // 删留言时点赞跟着走（on delete cascade），后台清垃圾不留孤票。
 await allowed('delete from public.guestbook_messages where approved=false');
 assert.equal((await allowed('select count(*)::int as n from public.guestbook_likes')).rows[0].n,1);
 await allowed('delete from public.guestbook_messages where id=$1',[liked]);
 assert.equal((await allowed('select count(*)::int as n from public.guestbook_likes')).rows[0].n,0);
 const likeCheck=readFileSync(root+'/supabase/guestbook-security-check.sql','utf8');
 await db.exec(likeCheck);checks++;
 await db.exec('grant select on public.guestbook_likes to authenticated');
 await assert.rejects(db.exec(likeCheck),/guestbook_likes/,'体检没抓到"点赞表能直连"');checks++;
 await db.exec('revoke select on public.guestbook_likes from authenticated');await db.exec(likeCheck);checks++;

 const spacesSQL=readFileSync(root+'/supabase/user-spaces.sql','utf8');
 await db.exec(spacesSQL);await db.exec(spacesSQL);checks++;
 await as('anon','');
 await denied('select * from public.user_spaces');await denied('select * from public.space_posts');
 await denied('select * from public.member_spaces(null,0)');
 await as('authenticated',owner);
 await allowed('insert into public.user_spaces(user_id,display_name,bio,links) values($1,$2,$3,$4)',[owner,'owner space','intro',JSON.stringify([{label:'site',url:'https://example.invalid/'}])]);
 const stamp=(await allowed('select updated_at from public.user_spaces where user_id=$1',[owner])).rows[0].updated_at;
 await as('authenticated',guest);
 await allowed('insert into public.user_spaces(user_id,display_name) values($1,$2)',[guest,'guest space']);
 assert.equal((await allowed('select * from public.member_spaces(null,0)')).rows.length,2);
 // 跨成员主页只能走 member_spaces RPC：直接 select 只返回自己这一行，
 // 否则任何登录用户都能绕过屏蔽读到别人的昵称、简介和外链。
 assert.equal((await allowed('select user_id from public.user_spaces')).rows.length,1);
 assert.equal((await allowed('select user_id from public.user_spaces where user_id=$1',[owner])).rows.length,0);
 assert.equal((await allowed('select * from public.member_spaces($1,0)',[owner])).rows[0].display_name,'owner space');
 assert.equal((await allowed('update public.user_spaces set bio=$1 where user_id=$2 returning user_id',['attack',owner])).rows.length,0);
 await denied('insert into public.user_spaces(user_id,display_name) values($1,$2)',[owner,'attack']);
 await denied('update public.user_spaces set user_id=$1',[owner]);
 await denied('delete from public.user_spaces');
 const post=(await allowed('insert into public.space_posts(user_id,body) values($1,$2) returning id',[guest,'member update'])).rows[0].id;
 await denied('insert into public.space_posts(user_id,body) values($1,$2)',[owner,'forged']);
 await denied('insert into public.space_posts(user_id,body,archived) values($1,$2,true)',[guest,'hidden insert']);
 await denied('insert into public.space_posts(user_id,body) values($1,$2)',[guest,' ']);
 await as('authenticated',owner);
 assert.equal((await allowed('select id from public.space_posts where id=$1',[post])).rows.length,1);
 assert.equal((await allowed('update public.space_posts set archived=true where id=$1 returning id',[post])).rows.length,0);
 await allowed('update public.user_spaces set bio=$1 where user_id=$2 and updated_at=$3 returning user_id',['updated',owner,stamp]);
 assert.equal((await allowed('update public.user_spaces set bio=$1 where user_id=$2 and updated_at=$3 returning user_id',['stale',owner,stamp])).rows.length,0);
 await as('authenticated',guest);
 await allowed('update public.space_posts set archived=true where id=$1',[post]);
 assert.equal((await allowed('select id from public.space_posts where id=$1',[post])).rows.length,1);
 for(const url of ['javascript:alert(1)','https://name:secret@example.invalid','https://example.invalid/ bad'])await denied('update public.user_spaces set links=$1 where user_id=$2',[JSON.stringify([{label:'bad',url}]),guest]);
 await as('authenticated',owner);assert.equal((await allowed('select id from public.space_posts where id=$1',[post])).rows.length,0);
 await as('authenticated',guest);await allowed('update public.space_posts set archived=false where id=$1',[post]);
 await as('authenticated',owner);assert.equal((await allowed('select id from public.space_posts where id=$1',[post])).rows.length,1);
 await denied('delete from public.space_posts');
 await as('authenticated','');await denied('select * from public.member_spaces(null,0)');

 await db.exec('reset role');const community=readFileSync(root+'/supabase/space-community.sql','utf8');await db.exec(community);await db.exec(community);checks++;
 await db.exec("alter table public.space_posts disable trigger space_post_limits;update public.space_posts set updated_at=now()-interval '1 minute',created_at=now()-interval '1 minute';alter table public.space_posts enable trigger space_post_limits;");
 await as('authenticated',guest);
 assert.equal((await allowed('select * from public.search_member_spaces($1,0)',['OWNER'])).rows.length,1);
 assert.equal((await allowed('select * from public.search_member_spaces($1,0)',['%'])).rows.length,0);
 const version=(await allowed('select updated_at from public.space_posts where id=$1',[post])).rows[0].updated_at;
 const edit=await allowed('update public.space_posts set body=$1 where id=$2 and updated_at=$3 returning id,edited_at',['edited body',post,version]);assert.equal(edit.rows.length,1);assert(edit.rows[0].edited_at);
 assert.equal((await allowed('update public.space_posts set body=$1 where id=$2 and updated_at=$3 returning id',['stale edit',post,version])).rows.length,0);
 await denied('update public.space_posts set body=$1 where id=$2',['too fast edit',post]);
 await as('authenticated',owner);
 assert.equal((await allowed('update public.space_posts set body=$1 where id=$2 returning id',['attack',post])).rows.length,0);
 const publicPost=(await allowed('insert into public.space_posts(user_id,body) values($1,$2) returning id',[owner,'report fixture'])).rows[0].id;
 await denied('select public.report_space_post($1,$2)',[publicPost,'self report']);
 await as('authenticated',guest);
 assert.equal((await allowed('select public.report_space_post($1,$2) as sent',[publicPost,'test reason'])).rows[0].sent,true);
 assert.equal((await allowed('select public.report_space_post($1,$2) as sent',[publicPost,'retry reason'])).rows[0].sent,false);
 await denied('select * from public.space_reports');await denied('select * from public.owner_space_reports()');
 await denied('select public.owner_moderate_space_post($1,true)',[publicPost]);
 await as('authenticated',owner);
 const reports=(await allowed('select * from public.owner_space_reports()')).rows;assert.equal(reports.length,1);assert(!Object.hasOwn(reports[0],'reporter_id'));assert(!Object.hasOwn(reports[0],'email'));
 await allowed('select public.owner_moderate_space_post($1,true)',[reports[0].id]);
 await denied('update public.space_posts set moderation_hidden=false where id=$1',[publicPost]);
 await as('authenticated',guest);assert.equal((await allowed('select id from public.space_posts where id=$1',[publicPost])).rows.length,0);
 await denied('select public.report_space_post($1,$2)',[publicPost,'hidden report']);
 await as('authenticated',owner);await allowed('select public.owner_moderate_space_post($1,false)',[reports[0].id]);
 await as('authenticated',guest);assert.equal((await allowed('select id from public.space_posts where id=$1',[publicPost])).rows.length,1);
 await allowed('insert into public.space_posts(user_id,body) values($1,$2)',[guest,'rate fixture']);
 await denied('insert into public.space_posts(user_id,body) values($1,$2)',[guest,'rate denied']);
 await db.exec('reset role;alter table public.space_posts disable trigger space_post_limits;');
 await db.query("insert into public.space_posts(user_id,body,created_at) select $1,'daily fixture',now()-interval '1 minute' from generate_series(1,30)",[guest]);
 await db.exec('alter table public.space_posts enable trigger space_post_limits;');
 await as('authenticated',guest);await denied('insert into public.space_posts(user_id,body) values($1,$2)',[guest,'daily denied']);
 await db.exec('reset role;alter table public.space_posts disable trigger space_post_limits;');
 await db.query("insert into public.space_posts(user_id,body,created_at) select $1,'quota fixture',now()-interval '2 days' from generate_series(1,500)",[guest]);
 await db.exec('alter table public.space_posts enable trigger space_post_limits;');
 await as('authenticated',guest);await denied('insert into public.space_posts(user_id,body) values($1,$2)',[guest,'quota denied']);
 await as('anon','');await denied('select * from public.search_member_spaces()');await denied('select public.report_space_post($1,$2)',[publicPost,'anon']);await denied('select * from public.owner_space_reports()');

 await db.exec('reset role');const blocksSQL=readFileSync(root+'/supabase/space-blocks.sql','utf8');await db.exec(blocksSQL);await db.exec(blocksSQL);checks++;
 await as('authenticated',guest);
 await allowed('select public.set_space_block($1,true)',[owner]);
 await allowed('select public.set_space_block($1,true)',[owner]);
 assert.equal((await allowed('select * from public.my_space_blocks(0)')).rows.length,1);
 assert.equal((await allowed('select * from public.member_spaces($1,0)',[owner])).rows.length,0);
 assert.equal((await allowed('select * from public.search_member_spaces($1,0)',['owner'])).rows.length,0);
 assert.equal((await allowed('select id from public.space_posts where user_id=$1',[owner])).rows.length,0);
 assert.equal((await allowed('select * from public.member_spaces($1,0)',[guest])).rows.length,1);
 assert((await allowed('select id from public.space_posts where user_id=$1',[guest])).rows.length>0);
 await denied('select public.set_space_block($1,true)',[guest]);
 await denied('insert into public.space_blocks(blocker_id,blocked_id) values($1,$2)',[owner,guest]);
 await denied('delete from public.space_blocks');
 await as('authenticated',owner);
 assert.equal((await allowed('select * from public.space_blocks')).rows.length,0);
 assert.equal((await allowed('select * from public.my_space_blocks(0)')).rows.length,0);
 assert.equal((await allowed('select * from public.member_spaces($1,0)',[guest])).rows.length,1);
 await as('authenticated',guest);await allowed('select public.set_space_block($1,false)',[owner]);
 await allowed('select public.set_space_block($1,false)',[owner]);
 assert.equal((await allowed('select * from public.member_spaces($1,0)',[owner])).rows.length,1);
 assert((await allowed('select id from public.space_posts where user_id=$1',[owner])).rows.length>0);
 assert.equal((await allowed('select * from public.my_space_blocks(0)')).rows.length,0);
 await as('anon','');await denied('select * from public.space_blocks');await denied('select * from public.my_space_blocks(0)');await denied('select public.set_space_block($1,true)',[owner]);

 // space-schema-check.sql 是"线上到底跑没跑过迁移"唯一的自查手段，只会在人肉贴进 Dashboard 时才执行，
 // 所以它自己必须在这里被测：先证明完整迁移后它通过，再把读策略退回旧版证明它会报错。
 // 只测通过分支的话，把体检写废（比如漏了一个检查）没人会发现。
 await db.exec('reset role');
 const checkSQL=readFileSync(root+'/supabase/space-schema-check.sql','utf8');
 // 只取第一段 do $$ ... $$;：后面两条 select 是给人看的清单，多语句走 prepared 会报"multiple commands"。
 const checkBlock=checkSQL.slice(0,checkSQL.indexOf('end $$;')+'end $$;'.length);
 await db.exec(checkBlock);checks++;
 await db.exec("drop policy posts_member_read on public.space_posts;create policy posts_member_read on public.space_posts for select to authenticated using (auth.uid() is not null and (user_id = auth.uid() or (not archived and not moderation_hidden)));");
 await assert.rejects(db.exec(checkBlock),/posts_member_read/,'体检没抓到"屏蔽没接进读策略"');checks++;
 await db.exec(readFileSync(root+'/supabase/space-blocks.sql','utf8'));
 await db.exec(checkBlock);checks++;

 console.log(`PASS ${checks} PostgreSQL checks: owner CRUD, visitor isolation, storage isolation, CAS conflict, guestbook moderation/privacy, avatar row/storage isolation, idempotent migration, schema self-check`);
} finally {await db.close();}
