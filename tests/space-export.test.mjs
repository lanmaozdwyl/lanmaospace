import test from 'node:test';
import assert from 'node:assert/strict';
import {exportOwnSpace,readSpaceUsage} from '../lib/space-export.mjs';
function fixture(options={}){
 let cycle=0;const calls=[];
 const rows=Array.from({length:options.length??135},(_,i)=>({id:String(i).padStart(4,'0'),user_id:'self',body:'body '+i,archived:i%2===0,moderation_hidden:i%3===0,created_at:'date',updated_at:'v1',edited_at:null}));
 const client={auth:{getUser:async()=>({data:{user:{id:options.user||'self'}}})},from(table){let start=0,end=99,head=false,fields,filter;
 const q={select(f,o){fields=f;head=!!o?.head;return q;},eq(k,v){filter=[k,v];return q;},order(){return q;},range(a,b){start=a;end=b;return q;},maybeSingle(){return q;},then(resolve){
  calls.push({table,start,end,head,fields,filter});
  if(head)return resolve({count:options.noCount?null:(options.length??135),error:options.countError?Error('offline'):null});
  if(table==='user_spaces'){cycle++;return resolve({data:options.noProfile?null:{display_name:'name',bio:'intro',links:[],updated_at:'v1'}});}
  if(table==='profiles')return resolve({data:options.noProfile?null:{avatar_kind:'emoji',avatar_emoji:'🐱',avatar_color:'purple',avatar_path:null}});
  if(options.error&&start===100)return resolve({error:Error('offline')});
  const page=rows.slice(start,end+1).map(p=>({...p}));if(options.changed&&cycle>1&&page[0])page[0].body='changed in another tab';
  resolve({data:page});
 }};return q;}};return{client,calls};
}
test('分页导出完整动态，包含本人隐藏内容和头像设置',async()=>{const f=fixture();const out=await exportOwnSpace(f.client,'self');assert.equal(out.posts.length,135);assert(out.posts.some(p=>p.archived&&p.moderation_hidden));assert.equal(out.avatar.avatar_emoji,'🐱');assert.equal(out.format,'lanmao-space-export');assert(!JSON.stringify(out).includes('anonKey'));assert(f.calls.every(c=>c.filter?.[0]==='user_id'&&c.filter[1]==='self'));assert.equal(f.calls.filter(c=>c.table==='space_posts'&&c.start===100).length,2);});
test('禁止导出当前账号以外的空间且不发起表读取',async()=>{const f=fixture({user:'other'});await assert.rejects(exportOwnSpace(f.client,'self'),/只能导出/);assert.equal(f.calls.length,0);});
test('第二次读取发生变化时拒绝生成不一致文件',async()=>{const f=fixture({changed:true});await assert.rejects(exportOwnSpace(f.client,'self'),/内容发生变化/);});
test('中途请求失败时拒绝返回残缺导出',async()=>{const f=fixture({error:true});await assert.rejects(exportOwnSpace(f.client,'self'),/offline/);});
test('退出登录时中止读取',async()=>{const f=fixture();let checks=0;await assert.rejects(exportOwnSpace(f.client,'self',()=>{if(++checks>2)throw Error('signed out');}),/signed out/);});
test('新账号无主页、无动态时仍可导出空结构',async()=>{const f=fixture({noProfile:true,length:0});const out=await exportOwnSpace(f.client,'self');assert.equal(out.profile,null);assert.equal(out.avatar,null);assert.deepEqual(out.posts,[]);});
test('容量使用准确计数，零容量和超限均不产生负剩余',async()=>{for(const n of [0,499,500,501]){const f=fixture({length:n});const usage=await readSpaceUsage(f.client,'self');assert.equal(usage.used,n);assert.equal(usage.remaining,Math.max(0,500-n));assert.equal(f.calls[0].head,true);}});
test('计数缺失或失败时不能冒充零用量',async()=>{for(const options of [{noCount:true},{countError:true}]){const f=fixture(options);await assert.rejects(readSpaceUsage(f.client,'self'));}});
