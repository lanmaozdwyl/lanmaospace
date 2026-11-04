import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {cleanSpace,cleanPost,memberId} from '../lib/space.mjs';
import {applyFormat,renderMarkdown} from '../lib/space-md.mjs';
import {exportOwnSpace,readSpaceUsage} from '../lib/space-export.mjs';
import {avatarDisplay,fallbackAvatarDisplay} from '../lib/avatar.mjs';
test('个人资料整理保留合法链接并去除空白',()=>{assert.deepEqual(cleanSpace({display_name:' member ',bio:' hello ',links:[{label:' Blog ',url:' https://example.invalid/ '}]}),{display_name:'member',bio:'hello',links:[{label:'Blog',url:'https://example.invalid/'}]});});
test('拒绝脚本地址、登录凭据、过多链接和超长资料',()=>{for(const url of ['javascript:alert(1)','data:text/html,x','https://name:password@example.invalid/'])assert.throws(()=>cleanSpace({display_name:'name',links:[{label:'x',url}]}));for(const v of [{display_name:''},{display_name:'x'.repeat(41)},{display_name:'x',bio:'x'.repeat(601)},{display_name:'x',links:Array(7).fill({label:'x',url:'https://example.invalid/'})}])assert.throws(()=>cleanSpace(v));});
test('动态长度和成员地址校验',()=>{assert.equal(cleanPost(' hello '),'hello');assert.throws(()=>cleanPost(' '));assert.throws(()=>cleanPost('x'.repeat(2001)));assert.equal(memberId('not-an-id'),null);assert.equal(memberId('00000000-0000-4000-8000-000000000001'),'00000000-0000-4000-8000-000000000001');});
class El{
 constructor(){this.hidden=false;this.value='';this.children=[];this.style={};this.textContent='';this.className='';this.dataset={};this.attrs={};this.scrolled=false;this.focused=false;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=String(v);}click(){this.clicked=true;}remove(){this.removed=true;}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}querySelectorAll(){return [];}
 get classList(){
  return{
   add:(...classes)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));classes.forEach(c=>set.add(c));this.className=[...set].join(' ');},
   remove:(...classes)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));classes.forEach(c=>set.delete(c));this.className=[...set].join(' ');},
   toggle:(c,force)=>{const has=this.className.split(/\s+/).includes(c);const want=force!==undefined?!!force:!has;if(want)this.classList.add(c);else this.classList.remove(c);return want;},
   contains:c=>this.className.split(/\s+/).includes(c)
  };
 }
}
async function fixture(other=false,options={}){
 const id='00000000-0000-4000-8000-000000000001',target='00000000-0000-4000-8000-000000000002',elements=new Map(),calls=[],downloads=[];let auth;
 const get=id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id);};
 const client={auth:{getUser:async()=>({data:{user:{id}}}),onAuthStateChange:fn=>{auth=fn;}},rpc:async(name,args)=>{calls.push({rpc:name,args});if(name==='my_space_blocks')return {data:options.blockList||[]};return {data:[{user_id:other?target:id,display_name:'<script>name</script>',bio:'<img onerror=alert(1)>',links:[],updated_at:'2026-11-03'}]};},from(table){let body,filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(){return q;},maybeSingle(){return q;},insert(v){body=v;return q;},update(v){body=v;return q;},then(resolve){calls.push({table,body,filters});resolve({count:options.count??0,data:table==='space_blocks'?(options.blocked?[{blocked_id:target}]:[]):table==='space_posts'?(body?(options.conflict?[]:[{id:'post1'}]):(options.posts||[])):(table==='profiles'?null:{user_id:id,display_name:'stored name',bio:'',links:[],updated_at:'v1'})});}};return q;}};
 const document={body:new El(),getElementById:get,createElement:tag=>{const e=new El();e.tag=tag;return e;}};
 const ctx=vm.createContext({document,window:{addEventListener(){},confirm:()=>true,location:{replace(){}}},location:{search:other?'?user='+target:'',pathname:'/space',reload(){}},Blob,URL:{createObjectURL(blob){downloads.push(blob);return 'blob:fixture';},revokeObjectURL(){}},setTimeout(fn){fn();},URLSearchParams,crypto,Date,Error,console,getSupabase:async()=>client,cleanSpace,cleanPost,memberId,applyFormat,renderMarkdown,avatarDisplay,fallbackAvatarDisplay,exportOwnSpace,readSpaceUsage,avatarPublicUrl(){return '';}});
 const source=readFileSync(new URL('../space.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInContext(source,ctx);for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));return{get,calls,auth,ctx,downloads};
}
test('自己的空间显示编辑表单，用户内容用纯文本输出',async()=>{const f=await fixture();assert.equal(f.get('space-app').hidden,false);assert.equal(f.get('space-editor').hidden,false);assert.equal(f.get('member-bio').textContent,'<img onerror=alert(1)>');assert.equal(f.get('link-editor').children.length,6);});
test('其他成员空间不显示写入入口，退出时移除内容',async()=>{const f=await fixture(true);assert.equal(f.get('space-editor').hidden,true);assert.equal(f.get('post-form').hidden,true);f.auth('SIGNED_OUT');assert.equal(f.get('space-app').hidden,true);assert.equal(f.get('space-app').children.length,0);});

const postFixture={id:'post1',body:'original',created_at:'2026-11-03',updated_at:'version1',archived:false};
test('成员搜索将昵称作为独立 RPC 参数且从第一页查找',async()=>{const f=await fixture();f.get('member-search').value='Alice';f.get('member-search-form').onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert(f.calls.some(c=>c.rpc==='search_member_spaces'&&c.args.p_query==='Alice'&&c.args.p_offset===0));});
test('动态编辑保存携带版本条件并显示成功结果',async()=>{const f=await fixture(false,{posts:[postFixture]});const article=f.get('post-list').children[0];article.children.find(x=>x.textContent==='编辑动态').onclick();f.get('edit-post-body').value='changed';f.get('edit-post-body').oninput();f.get('edit-post-form').onsubmit({preventDefault(){}});for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));const update=f.calls.find(c=>c.body?.body==='changed');assert(update);assert(update.filters.some(([k,v])=>k==='updated_at'&&v==='version1'));assert.equal(f.get('edit-post-form').hidden,true);});
test('编辑冲突不关闭表单也不清除草稿',async()=>{const f=await fixture(false,{posts:[postFixture],conflict:true});f.get('post-list').children[0].children.find(x=>x.textContent==='编辑动态').onclick();f.get('edit-post-body').value='keep this draft';f.get('edit-post-body').oninput();f.get('edit-post-form').onsubmit({preventDefault(){}});for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));assert.equal(f.get('edit-post-form').hidden,false);assert.equal(f.get('edit-post-body').value,'keep this draft');assert.match(f.get('edit-post-status').textContent,/未覆盖/);});

test('容量只在自己的空间显示，并准确提示已满',async()=>{const own=await fixture(false,{count:500});assert.equal(own.get('space-data-panel').hidden,false);assert.match(own.get('space-usage').textContent,/500 \/ 500/);assert.match(own.get('space-capacity-note').textContent,/不会删除动态或释放容量/);const other=await fixture(true);assert.equal(other.get('space-data-panel').hidden,true);});

test('取消文件选择不发起导出查询',async()=>{const f=await fixture();const before=f.calls.length;f.ctx.window.showSaveFilePicker=async()=>{const e=new Error('cancel');e.name='AbortError';throw e;};await f.get('export-space').onclick();assert.equal(f.calls.length,before);assert.match(f.get('space-export-status').textContent,/已取消/);});
test('直接写盘在关闭成功后才显示已写入',async()=>{const f=await fixture(false,{posts:[postFixture]});let saved='',closed=false;f.ctx.window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async text=>{saved=text;},close:async()=>{closed=true;},abort:async()=>{}})});await f.get('export-space').onclick();assert(closed);assert.equal(JSON.parse(saved).posts.length,1);assert.match(f.get('space-export-status').textContent,/已写入所选文件/);});
test('普通下载只提示发起下载，不声称文件已经保存',async()=>{const f=await fixture(false,{posts:[{...postFixture,archived:true}]});await f.get('export-space').onclick();assert.equal(f.downloads.length,1);const saved=JSON.parse(await f.downloads[0].text());assert.equal(saved.posts[0].archived,true);assert.match(f.get('space-export-status').textContent,/已发起下载/);assert.doesNotMatch(f.get('space-export-status').textContent,/已写入/);});

test('已屏蔽成员不读取主页和动态，展示解除屏蔽入口',async()=>{const f=await fixture(true,{blocked:true,posts:[postFixture]});assert.equal(f.get('member-profile-card').hidden,true);assert.equal(f.get('posts-panel').hidden,true);assert.equal(f.get('toggle-member-block').textContent,'解除屏蔽');assert(!f.calls.some(c=>c.rpc==='member_spaces'));assert(!f.calls.some(c=>c.table==='space_posts'));});
test('屏蔽请求只针对当前目标并在成功后隐藏内容',async()=>{const f=await fixture(true,{posts:[postFixture]});f.get('toggle-member-block').onclick();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));const request=f.calls.find(c=>c.rpc==='set_space_block');assert.equal(request.args.p_member,'00000000-0000-4000-8000-000000000002');assert.equal(request.args.p_block,true);assert.equal(f.get('member-profile-card').hidden,true);assert.equal(f.get('post-list').children.length,0);});
test('解除屏蔽重新读取目标主页及动态',async()=>{const f=await fixture(true,{blocked:true,posts:[postFixture]});f.get('toggle-member-block').onclick();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));assert(f.calls.some(c=>c.rpc==='set_space_block'&&c.args.p_block===false));assert.equal(f.get('member-profile-card').hidden,false);assert(f.calls.some(c=>c.rpc==='member_spaces'));assert(f.get('post-list').children.length>0);});
test('屏蔽名单只在本人空间显示',async()=>{const own=await fixture();assert.equal(own.get('blocks-panel').hidden,false);const other=await fixture(true);assert.equal(other.get('blocks-panel').hidden,true);assert(!other.calls.some(c=>c.rpc==='my_space_blocks'));});
test('个人空间支持首屏主页与动态并发加载及快照秒开',async()=>{const source=readFileSync(new URL('../space.js',import.meta.url),'utf8');assert(source.includes('Promise.all([loadSpace(),loadPosts()])'),'核心主页与动态必须并行加载');assert(source.includes('lanmao_space_cached_profile_'),'必须支持本地快照以实现首屏秒开');});

test('动态编辑支持平滑滚动定位、卡片原位高亮锚定与焦点恢复', async () => {
    const f = await fixture(false, {posts: [postFixture]});
    const article = f.get('post-list').children[0];
    const editBtn = article.children.find(x => x.textContent === '编辑动态');
    assert(editBtn);

    // 1. 点击“编辑动态”：表单展开并滚动定位，当前卡片添加 space-post-editing 高亮
    editBtn.onclick();
    assert.equal(f.get('edit-post-form').hidden, false);
    assert.equal(f.get('edit-post-form').scrolled, true);
    assert.equal(article.classList.contains('space-post-editing'), true);
    assert.equal(f.get('edit-post-body').focused, true);

    // 2. 点击“取消编辑”：表单隐藏，卡片高亮清除，原编辑按钮恢复焦点
    f.get('edit-post-cancel').onclick();
    assert.equal(f.get('edit-post-form').hidden, true);
    assert.equal(article.classList.contains('space-post-editing'), false);
    assert.equal(editBtn.focused, true);
});

test('成员空间动态发布与编辑：实时字数统计徽章 (0/2000) 与临界安全告警', async () => {
    const html = readFileSync(new URL('../space.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../space.css', import.meta.url), 'utf8');

    // 1. 结构与样式完整性验证
    assert(html.includes('id="post-body-count"'), '需包含发布新动态字数指示器');
    assert(html.includes('id="edit-post-body-count"'), '需包含编辑动态字数指示器');
    assert(html.includes('class="space-form-header"'), '需包含表单头弹性排版容器');
    assert(html.includes('class="space-counter-badge"'), '需包含字数统计微徽章');
    assert(css.includes('.space-counter-badge'), 'CSS 需定义字数徽章样式');
    assert(css.includes('.space-counter-badge.near-limit'), 'CSS 需定义临界橙色告警样式');
    assert(css.includes('.space-counter-badge.over-limit'), 'CSS 需定义超限红色警示样式');

    // 2. 发布动态表单实时计数与临界状态测试
    const f = await fixture(false, { posts: [postFixture] });
    assert.equal(f.get('post-body-count').textContent, '0 / 2000');

    // 输入 20 字
    f.get('post-body').value = '今天读完了《科学革命的结构》，很有启发！';
    f.get('post-body').oninput();
    assert.equal(f.get('post-body-count').textContent, '20 / 2000');
    assert.equal(f.get('post-body-count').classList.contains('near-limit'), false);
    assert.equal(f.get('post-body-count').classList.contains('over-limit'), false);

    // 临界告警 (≥1900 字)
    f.get('post-body').value = 'x'.repeat(1920);
    f.get('post-body').oninput();
    assert.equal(f.get('post-body-count').textContent, '1920 / 2000');
    assert.equal(f.get('post-body-count').classList.contains('near-limit'), true);
    assert.equal(f.get('post-body-count').classList.contains('over-limit'), false);

    // 超限告警 (>2000 字)
    f.get('post-body').value = 'x'.repeat(2005);
    f.get('post-body').oninput();
    assert.equal(f.get('post-body-count').textContent, '2005 / 2000');
    assert.equal(f.get('post-body-count').classList.contains('near-limit'), false);
    assert.equal(f.get('post-body-count').classList.contains('over-limit'), true);

    // 3. 编辑动态表单初始化与计数同步
    const article = f.get('post-list').children[0];
    const editBtn = article.children.find(x => x.textContent === '编辑动态');
    editBtn.onclick();
    // postFixture.body 是 'original'，长度为 8
    assert.equal(f.get('edit-post-body-count').textContent, '8 / 2000');

    // 动态修改
    f.get('edit-post-body').value = '新的动态正文内容修改测试';
    f.get('edit-post-body').oninput();
    assert.equal(f.get('edit-post-body-count').textContent, '12 / 2000');

    // 取消编辑后重置归零
    f.get('edit-post-cancel').onclick();
    assert.equal(f.get('edit-post-body-count').textContent, '0 / 2000');
});

// ---- Markdown 排版工具栏与安全预览 ----
const mdDoc={createElement:tag=>{const e=new El();e.tag=tag;return e;}};
const mdRender=text=>renderMarkdown(mdDoc,text);
const tagsOf=nodes=>nodes.map(n=>n.tag);
test('格式化：选中文本两端包裹符号并保持选区在原文上',()=>{assert.deepEqual(applyFormat('hello world',0,5,'bold'),{value:'**hello** world',start:2,end:7});assert.deepEqual(applyFormat('abcd',3,1,'bold'),{value:'a**bc**d',start:3,end:5});});
test('格式化：未选中时插入示例占位并选中占位文字',()=>{assert.deepEqual(applyFormat('ab',1,1,'italic'),{value:'a*斜体文字*b',start:2,end:6});assert.deepEqual(applyFormat('x',1,1,'code'),{value:'x`代码`',start:2,end:4});assert.deepEqual(applyFormat('',0,0,'list'),{value:'- 列表项',start:2,end:5});});
test('格式化：引用与列表按行处理，并可再次点击取消',()=>{assert.deepEqual(applyFormat('a\nb',0,3,'quote'),{value:'> a\n> b',start:0,end:7});assert.deepEqual(applyFormat('> a\n> b',0,7,'quote'),{value:'a\nb',start:0,end:3});assert.deepEqual(applyFormat('one\ntwo',5,5,'list'),{value:'one\n- two',start:4,end:9});assert.deepEqual(applyFormat('\nabc',0,0,'list'),{value:'- 列表项\nabc',start:2,end:5});});
test('格式化：空值、越界选区、未知格式与超长输入稳健处理',()=>{assert.deepEqual(applyFormat(null,undefined,undefined,'bold'),{value:'**粗体文字**',start:2,end:6});assert.equal(applyFormat('abc',0,1,'nope'),null);assert.equal(applyFormat('x'.repeat(1999),1999,1999,'bold'),null);assert.deepEqual(applyFormat('abc',-5,99,'bold'),{value:'**abc**',start:2,end:5});});
test('渲染：空内容返回空列表，特殊字符只作为文本',()=>{assert.deepEqual(mdRender(''),[]);assert.deepEqual(mdRender(null),[]);assert.deepEqual(mdRender('  \n\n '),[]);const p=mdRender('<img src=x onerror=alert(1)> **b** `<b>`')[0];assert.deepEqual(p.children.map(c=>c.tag),['span','strong','span','code']);assert.equal(p.children[0].textContent,'<img src=x onerror=alert(1)> ');assert.equal(p.children[3].textContent,'<b>');});
test('渲染：引用、无序列表、段落与换行',()=>{const nodes=mdRender('> q\n\n- a\n- b\nplain\nline');assert.deepEqual(tagsOf(nodes),['blockquote','ul','p']);assert.equal(nodes[1].children.length,2);assert.deepEqual(nodes[2].children.map(c=>c.tag),['span','br','span']);assert.equal(nodes[0].children[0].tag,'p');});
test('渲染：未闭合的符号原样显示',()=>{const p=mdRender('a * b ** c `d')[0];assert.deepEqual(p.children.map(c=>c.tag),['span']);assert.equal(p.children[0].textContent,'a * b ** c `d');});
test('工具栏：点击粗体包裹选中文字并保持选区',async()=>{const f=await fixture();const area=f.get('post-body');area.value='hello';area.selectionStart=0;area.selectionEnd=5;area.setSelectionRange=(a,b)=>{area.sel=[a,b];};const bold=f.get('post-md-bar').children[0].children[0];assert.equal(bold.dataset.md,'bold');bold.onclick();assert.equal(area.value,'**hello**');assert.deepEqual(area.sel,[2,7]);assert.equal(area.focused,true);});
test('工具栏：没有选区信息时追加占位格式且不抛错',async()=>{const f=await fixture();const area=f.get('post-body');area.value='abc';f.get('post-md-bar').children[0].children[0].onclick();assert.equal(area.value,'abc**粗体文字**');});
test('预览：切换后用安全 DOM 渲染，空内容给出提示，切回编辑恢复',async()=>{const f=await fixture();const area=f.get('post-body'),preview=f.get('post-preview'),bar=f.get('post-md-bar');const [editTab,previewTab]=bar.children[1].children;const formatButtons=bar.children[0].children;area.value='**hi** <script>x</script>';previewTab.onclick();assert.equal(preview.hidden,false);assert.equal(area.hidden,true);assert.equal(previewTab.attrs['aria-pressed'],'true');assert(formatButtons.every(b=>b.disabled));assert.deepEqual(preview.children[0].children.map(c=>c.tag),['strong','span']);assert.equal(preview.children[0].children[1].textContent,' <script>x</script>');formatButtons[0].onclick();assert.equal(area.value,'**hi** <script>x</script>');area.value='';previewTab.onclick();assert.match(preview.children[0].textContent,/还没有内容/);editTab.onclick();assert.equal(area.hidden,false);assert.equal(preview.hidden,true);assert(formatButtons.every(b=>!b.disabled));});
test('发布成功后预览复位为编辑状态',async()=>{const f=await fixture();const area=f.get('post-body'),preview=f.get('post-preview');area.value='hello';f.get('post-md-bar').children[1].children[1].onclick();assert.equal(area.hidden,true);f.get('post-form').onsubmit({preventDefault(){}});for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));assert.equal(area.value,'');assert.equal(area.hidden,false);assert.equal(preview.hidden,true);});
test('已发布动态按 Markdown 安全渲染，脚本字符只作文本',async()=>{const f=await fixture(false,{posts:[{...postFixture,body:'**b** <script>x</script>'}]});const text=f.get('post-list').children[0].children[1];assert(text.className.includes('md-rendered'));const para=text.children[0];assert.equal(para.tag,'p');assert.deepEqual(para.children.map(c=>c.tag),['strong','span']);assert.equal(para.children[1].textContent,' <script>x</script>');});
test('Markdown 辅助代码不使用 innerHTML、eval 或内联脚本',()=>{for(const file of ['../lib/space-md.mjs','../space.js']){const src=readFileSync(new URL(file,import.meta.url),'utf8');assert.doesNotMatch(src,/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new\s+Function|document\.write/);}const html=readFileSync(new URL('../space.html',import.meta.url),'utf8');assert.doesNotMatch(html,/<script(?![^>]*\bsrc=)[^>]*>/i);assert.match(html,/id=.post-md-bar./);assert.match(html,/id=.edit-preview./);});

test('成员空间与账号安全页深色模式全量自适应：卡片、导航、输入控件与成员列表', () => {
    const css = readFileSync(new URL('../space.css', import.meta.url), 'utf8');
    assert(css.includes('body[data-theme="dark"]'), '需定义手动深色模式 body 基础主题');
    assert(css.includes('body[data-theme="dark"] .space-nav'), '需适配深色模式导航背景');
    assert(css.includes('body[data-theme="dark"] .space-card'), '需适配深色模式空间卡片暗底');
    assert(css.includes('body[data-theme="dark"] .space-card input'), '需适配深色模式输入框暗色背景与边框');
    assert(css.includes('body[data-theme="dark"] .space-shell button'), '需适配深色模式按钮色系');
    assert(css.includes('body[data-theme="dark"] .member-grid a'), '需适配深色模式成员列表卡片');
    assert(css.includes('@media (prefers-color-scheme: dark)'), '需适配系统级深色模式偏好');
    assert(css.includes('body:not([data-theme="light"]) .space-card'), '需配置系统深色模式保底选择器');
});

test('成员空间主页编辑：简介 0/600 实时字数统计、未保存修改指示微徽章与离页守卫', async () => {
    const html = readFileSync(new URL('../space.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../space.css', import.meta.url), 'utf8');
    const js = readFileSync(new URL('../space.js', import.meta.url), 'utf8');

    // 1. 结构与样式完整性验证
    assert(html.includes('id="space-bio-count"'), '需包含简介字数计数器指示器');
    assert(html.includes('id="space-dirty-badge"'), '需包含主页未保存修改指示微徽章');
    assert(html.includes('class="space-dirty-badge"'), '需定义未保存修改徽章样式类');
    assert(css.includes('.space-dirty-badge'), 'CSS 需定义空间脏状态徽章视觉规范');
    assert(js.includes('checkProfileDirty'), '需包含主页修改基准对比与脏状态检测');
    assert(js.includes('profileBaseline'), '需包含主页基准快照逻辑');

    // 2. 行为验证：初始化、修改、脏徽章显示与恢复干净状态
    const f = await fixture(false);
    assert.equal(f.get('space-dirty-badge').hidden, true);

    // 修改简介
    f.get('space-bio').value = '这是全新的个人空间简介，用于深度学习与学术研究交流。';
    f.get('space-form').oninput();
    assert.equal(f.get('space-bio-count').textContent, '26 / 600');
    assert.equal(f.get('space-dirty-badge').hidden, false);

    // 临界告警 (≥570 字)
    f.get('space-bio').value = 'y'.repeat(580);
    f.get('space-form').oninput();
    assert.equal(f.get('space-bio-count').textContent, '580 / 600');
    assert.equal(f.get('space-bio-count').classList.contains('near-limit'), true);

    // 恢复为与基准一致的内容，脏徽章应自动隐藏
    f.get('space-bio').value = '<img onerror=alert(1)>';
    f.get('space-form').oninput();
    assert.equal(f.get('space-dirty-badge').hidden, true);
});
