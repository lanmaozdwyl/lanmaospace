import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {cleanSpace,cleanPost,memberId} from '../lib/space.mjs';
import {avatarDisplay,fallbackAvatarDisplay} from '../lib/avatar.mjs';
test('个人资料整理保留合法链接并去除空白',()=>{assert.deepEqual(cleanSpace({display_name:' member ',bio:' hello ',links:[{label:' Blog ',url:' https://example.invalid/ '}]}),{display_name:'member',bio:'hello',links:[{label:'Blog',url:'https://example.invalid/'}]});});
test('拒绝脚本地址、登录凭据、过多链接和超长资料',()=>{for(const url of ['javascript:alert(1)','data:text/html,x','https://name:password@example.invalid/'])assert.throws(()=>cleanSpace({display_name:'name',links:[{label:'x',url}]}));for(const v of [{display_name:''},{display_name:'x'.repeat(41)},{display_name:'x',bio:'x'.repeat(601)},{display_name:'x',links:Array(7).fill({label:'x',url:'https://example.invalid/'})}])assert.throws(()=>cleanSpace(v));});
test('动态长度和成员地址校验',()=>{assert.equal(cleanPost(' hello '),'hello');assert.throws(()=>cleanPost(' '));assert.throws(()=>cleanPost('x'.repeat(2001)));assert.equal(memberId('not-an-id'),null);assert.equal(memberId('00000000-0000-4000-8000-000000000001'),'00000000-0000-4000-8000-000000000001');});
class El{constructor(){this.hidden=false;this.value='';this.children=[];this.style={};this.textContent='';}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}querySelectorAll(){return [];} }
async function fixture(other=false){
 const id='00000000-0000-4000-8000-000000000001',target='00000000-0000-4000-8000-000000000002',elements=new Map(),calls=[];let auth;
 const get=id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id);};
 const client={auth:{getUser:async()=>({data:{user:{id}}}),onAuthStateChange:fn=>{auth=fn;}},rpc:async(name,args)=>({data:[{user_id:other?target:id,display_name:'<script>name</script>',bio:'<img onerror=alert(1)>',links:[],updated_at:'2026-11-03'}]}),from(table){let body;const q={select(){return q;},eq(){return q;},order(){return q;},range(){return q;},insert(v){body=v;return q;},update(v){body=v;return q;},then(resolve){calls.push({table,body});resolve({data:table==='space_posts'?[]:[{user_id:id}]});}};return q;}};
 const document={getElementById:get,createElement:()=>new El()};
 const ctx=vm.createContext({document,window:{addEventListener(){},confirm:()=>true,location:{replace(){}}},location:{search:other?'?user='+target:'',pathname:'/space',reload(){}},URLSearchParams,crypto,Date,Error,console,getSupabase:async()=>client,cleanSpace,cleanPost,memberId,avatarDisplay,fallbackAvatarDisplay,avatarPublicUrl(){return '';}});
 const source=readFileSync(new URL('../space.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInContext(source,ctx);for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));return{get,calls,auth,ctx};
}
test('自己的空间显示编辑表单，用户内容用纯文本输出',async()=>{const f=await fixture();assert.equal(f.get('space-app').hidden,false);assert.equal(f.get('space-editor').hidden,false);assert.equal(f.get('member-bio').textContent,'<img onerror=alert(1)>');assert.equal(f.get('link-editor').children.length,6);});
test('其他成员空间不显示写入入口，退出时移除内容',async()=>{const f=await fixture(true);assert.equal(f.get('space-editor').hidden,true);assert.equal(f.get('post-form').hidden,true);f.auth('SIGNED_OUT');assert.equal(f.get('space-app').hidden,true);assert.equal(f.get('space-app').children.length,0);});
