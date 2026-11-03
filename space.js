import {getSupabase} from './lib/supabase-client.js';
import {avatarDisplay,avatarPublicUrl,fallbackAvatarDisplay} from './lib/avatar.mjs';
import {cleanSpace,cleanPost,memberId} from './lib/space.mjs';
const $=id=>document.getElementById(id);
let client,user,target,own,baseline=null,memberOffset=0,postOffset=0,busy=false,ended=false,dirty=false,profileDirty=false;
const linkInputs=[];
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function message(text){$('space-status').textContent=text;}
function assertSession(){if(ended)throw Error('会话已结束，请重新登录。');}
async function result(query){const {data,error}=await query;assertSession();if(error)throw error;return data;}
function lockControls(value){$('space-app').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=value);$('reload-space').disabled=value;}
async function task(fn){if(busy||ended)return;busy=true;lockControls(true);try{await fn();}catch(e){if(!ended)message(`操作失败：${e.message}`);}finally{busy=false;if(!ended){lockControls(false);$('posts-prev').disabled=postOffset===0;$('members-prev').disabled=memberOffset===0;}}}
function avatar(profile,name){const el=$('member-avatar'),display=avatarDisplay(profile)||fallbackAvatarDisplay(name);el.replaceChildren();if(display.type==='image'){const img=node('img');img.src=avatarPublicUrl(client,display.path);img.alt='';el.append(img);}else{el.style.background=display.color;el.textContent=display.emoji;}}
async function loadSpace(){
 const rows=await result(client.rpc('member_spaces',{p_id:target,p_offset:0}));
 const row=rows?.[0];baseline=row?.updated_at||null;
 $('member-name').textContent=row?.display_name||(own?'我的空间':'成员空间');$('member-bio').textContent=row?.bio||'';
 $('space-empty').hidden=!!row;avatar(row,row?.display_name||'');
 const links=$('member-links');links.replaceChildren();
 for(const item of row?.links||[]){try{const checked=cleanSpace({display_name:'校验',links:[item]}).links[0];const a=node('a',checked.label);a.href=checked.url;a.target='_blank';a.rel='noopener noreferrer';const li=node('li');li.append(a);links.append(li);}catch{}}
 $('member-permalink').href=`space.html?user=${target}`;
 if(own){$('space-name').value=row?.display_name||'';$('space-bio').value=row?.bio||'';linkInputs.forEach((fields,i)=>{fields.label.value=row?.links?.[i]?.label||'';fields.url.value=row?.links?.[i]?.url||'';});}
}
async function loadMembers(){
 const rows=await result(client.rpc('member_spaces',{p_offset:memberOffset}));const list=$('member-list');list.replaceChildren();
 for(const item of rows||[]){const a=node('a',item.display_name);a.href=`space.html?user=${item.user_id}`;list.append(a);}
 if(!rows?.length)list.append(node('p','暂时没有更多已完善主页的成员。'));
 $('members-prev').hidden=memberOffset===0;$('members-next').hidden=(rows?.length||0)<30;
}
async function loadPosts(){
 const archived=own&&$('show-archived').checked;
 const rows=await result(client.from('space_posts').select('id,user_id,body,archived,created_at').eq('user_id',target).eq('archived',archived).order('created_at',{ascending:false}).order('id',{ascending:false}).range(postOffset,postOffset+19));
 const list=$('post-list');list.replaceChildren();
 for(const item of rows||[]){
  const article=node('article');article.className='space-post';const time=node('time',new Date(item.created_at).toLocaleString('zh-CN'));time.dateTime=item.created_at;const text=node('p',item.body);text.className='space-text';article.append(time,text);
  if(own){const button=node('button',item.archived?'恢复公开':'隐藏动态');button.type='button';button.onclick=()=>task(async()=>{
   const changed=await result(client.from('space_posts').update({archived:!item.archived}).eq('id',item.id).eq('user_id',user.id).eq('archived',item.archived).select('id'));
   if(!changed?.length)throw Error('动态状态已变化，请刷新后重试。');await loadPosts();message('动态状态已保存。');
  });article.append(button);}
  list.append(article);
 }
 if(!rows?.length)list.append(node('p',archived?'没有已隐藏的动态。':'还没有动态。'));
 $('posts-prev').hidden=postOffset===0;$('posts-next').hidden=(rows?.length||0)<20;
}
function makeLinkEditor(){for(let i=0;i<6;i++){const row=node('div');row.className='space-link-row';const label=node('input'),url=node('input');label.maxLength=40;label.placeholder=`链接 ${i+1} 名称`;label.setAttribute('aria-label',label.placeholder);url.type='url';url.maxLength=1000;url.placeholder='https://';url.setAttribute('aria-label',`链接 ${i+1} 网址`);linkInputs.push({label,url});row.append(label,url);$('link-editor').append(row);}}
$('space-form').oninput=()=>{profileDirty=true;dirty=true;};$('post-body').oninput=()=>{dirty=profileDirty||!!$('post-body').value.trim();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
$('space-form').onsubmit=e=>{e.preventDefault();task(async()=>{
 const links=linkInputs.filter(f=>f.label.value.trim()||f.url.value.trim()).map(f=>({label:f.label.value,url:f.url.value}));
 const values=cleanSpace({display_name:$('space-name').value,bio:$('space-bio').value,links});
 const changed=baseline?await result(client.from('user_spaces').update(values).eq('user_id',user.id).eq('updated_at',baseline).select('user_id')):await result(client.from('user_spaces').insert({user_id:user.id,...values}).select('user_id'));
 if(!changed?.length)throw Error('主页已在其他页面更新，请先复制保留当前编辑，再刷新。');
 await loadSpace();profileDirty=false;dirty=!!$('post-body').value.trim();await loadMembers();message('主页已保存，登录成员现在可以看到。');
});};
// 每次未确认的新发布复用同一编号；响应丢失后重试不会重复创建。
let postAttempt=null;
$('post-form').onsubmit=e=>{e.preventDefault();task(async()=>{
 const body=cleanPost($('post-body').value);
 if(postAttempt&&postAttempt.body!==body)throw Error('上次发布尚未确认。请保留新草稿，刷新动态列表检查后再发布。');
 postAttempt??={id:crypto.randomUUID(),body};
 const existing=await result(client.from('space_posts').select('id').eq('id',postAttempt.id).eq('user_id',user.id));
 if(!existing?.length){const {error}=await client.from('space_posts').insert({id:postAttempt.id,user_id:user.id,body});assertSession();if(error){const confirmed=await result(client.from('space_posts').select('id').eq('id',postAttempt.id).eq('user_id',user.id));if(!confirmed?.length)throw error;}}
 postAttempt=null;$('post-body').value='';dirty=profileDirty;postOffset=0;$('show-archived').checked=false;await loadPosts();message('动态已发布，登录成员可见。');
 // 简介表单可能仍有未保存修改，保守保留离开提醒。
});};
$('show-archived').onchange=()=>{postOffset=0;task(loadPosts);};
$('posts-prev').onclick=()=>{postOffset=Math.max(0,postOffset-20);task(loadPosts);};$('posts-next').onclick=()=>{postOffset+=20;task(loadPosts);};
$('members-prev').onclick=()=>{memberOffset=Math.max(0,memberOffset-30);task(loadMembers);};$('members-next').onclick=()=>{memberOffset+=30;task(loadMembers);};
$('reload-space').onclick=()=>{if(!dirty||window.confirm('刷新会清除当前未保存内容，是否继续？'))window.location.reload();};
async function init(){try{
 client=await getSupabase();const {data,error}=await client.auth.getUser();if(error||!data.user){window.location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.search));return;}
 user=data.user;client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){ended=true;dirty=false;$('space-app').replaceChildren();$('space-app').hidden=true;message('已退出登录。');}});
 const raw=new URLSearchParams(location.search).get('user');if(raw&&!memberId(raw))throw Error('个人主页地址不正确。');target=raw||user.id;own=target===user.id;
 makeLinkEditor();$('space-editor').hidden=!own;$('post-form').hidden=!own;$('archive-control').hidden=!own;
 await loadSpace();await loadPosts();await loadMembers();assertSession();$('space-app').hidden=false;message(own?'欢迎来到你的个人空间。填写昵称并保存后，会出现在成员列表。':'正在查看成员主页。');
}catch(e){if(!ended)message(`个人空间暂不可用：${e.message}。首次启用需店主执行 user-spaces.sql，可执行后刷新本页。`);}}
init();
