import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
class El {
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.style={};this.listeners={};this.value='false';this.disabled=false;}
 append(...items){this.children.push(...items);}replaceChildren(){this.children=[];}after(item){this.afterItem=item;}remove(){this.removed=true;}
 addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(){}querySelectorAll(){return this.children.flatMap(x=>[x,...x.querySelectorAll()]).filter(x=>['button','select'].includes(x.tag));}
}
async function fixture(uid='owner',waitList=false){
 const host=new El('host'),calls=[];let auth,resolveList;
 const client={auth:{getUser:async()=>({data:{user:{id:uid}}}),onAuthStateChange:fn=>{auth=fn;}},rpc:async(name,args)=>{
  calls.push({name,args});if(name==='owner_guestbook_review')return {data:true};
  const result={data:[{id:'n1',name:'<script>fixture</script>',message:'<img onerror=alert(1)>',approved:false,created_at:'2026-01-01'}]};
  if(waitList)return new Promise(resolve=>{resolveList=()=>resolve(result);});return result;
 }};
 const source=readFileSync(new URL('../guestbook-admin.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/m,'');
 const ctx=vm.createContext({document:{getElementById:()=>host,createElement:tag=>new El(tag),dispatchEvent(){}},window:{LANMAO_MEMO_CONFIG:{ownerUid:'owner'},confirm:()=>true},getSupabase:async()=>client,console,setTimeout,Date,Event});
 await vm.runInContext(`(async()=>{${source}\n})()`,ctx);await new Promise(resolve=>setImmediate(resolve));
 return {host,calls,signout:()=>auth('SIGNED_OUT'),resolve:()=>resolveList?.()};
}
test('访客不创建审核面板，也不请求审核 RPC',async()=>{const f=await fixture('guest');assert.equal(f.host.afterItem,undefined);assert.equal(f.calls.length,0);});
test('店主读取待审核列表，用户内容以纯文本显示并支持审核',async()=>{
 const f=await fixture();const panel=f.host.afterItem;assert(panel);assert.equal(f.calls[0].args.p_approved,false);
 const list=panel.children[4];assert.equal(list.children[0].children[1].textContent,'<img onerror=alert(1)>');
 await list.children[0].children[2].listeners.click();assert.equal(f.calls[1].name,'owner_guestbook_review');assert.equal(f.calls[1].args.p_expected,false);assert.equal(f.calls[1].args.p_approved,true);
});
test('退出登录移除审核内容，忽略尚未返回的列表',async()=>{const f=await fixture('owner',true);const panel=f.host.afterItem;f.signout();f.resolve();await new Promise(resolve=>setImmediate(resolve));assert(panel.removed);assert.equal(panel.children[4].children.length,0);});
