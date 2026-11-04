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

test('首页留言板：实时字数计数器（0/2000）与快捷打卡胶囊标签（Pills）', () => {
    const guestbookJs = readFileSync(new URL('../guestbook.js', import.meta.url), 'utf8');
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    // 1. HTML 节点规范与无障碍属性
    assert(indexHtml.includes('id="guestbookCharCount"'), '留言板必须包含字数计数器节点');
    assert(indexHtml.includes('guestbook-quick-tags'), '需包含快捷打卡问候语标签栏');
    assert(indexHtml.includes('class="quick-tag-pill"'), '需包含快捷问候胶囊按钮');
    assert(indexHtml.includes('maxlength="40"'), '昵称输入框需声明 maxlength 限制');
    assert(indexHtml.includes('maxlength="2000"'), '留言输入框需声明 maxlength 限制');

    // 2. CSS 样式规范
    assert(styleCss.includes('.guestbook-char-count'), '需定义字数计数器样式');
    assert(styleCss.includes('.guestbook-quick-tags'), '需定义快捷打卡胶囊容器样式');
    assert(styleCss.includes('.quick-tag-pill'), '需定义胶囊按钮微交互与悬浮动效');

    // 3. guestbook.js 逻辑绑定与重置响应
    assert(guestbookJs.includes('initGuestbookEnhancements'), '需定义留言板增强初始化函数');
    assert(guestbookJs.includes('updateCharCount'), '需包含动态字数更新与超限高亮逻辑');
    assert(guestbookJs.includes('form.reset()'), '成功提交后必须清空表单并重置字数计数器');
});
