import {exportOwnSpace,readSpaceUsage} from './lib/space-export.mjs';
import {getSupabase} from './lib/supabase-client.js';
import {avatarDisplay,avatarPublicUrl,fallbackAvatarDisplay} from './lib/avatar.mjs';
import {cleanSpace,cleanPost,memberId} from './lib/space.mjs';
import {applyFormat,renderMarkdown} from './lib/space-md.mjs';
const $=id=>document.getElementById(id);
let client,user,target,own,baseline=null,memberOffset=0,postOffset=0,busy=false,ended=false,dirty=false,profileDirty=false;
const linkInputs=[];
let editPost=null,editDirty=false,reportOffset=0,editOpener=null;
let targetBlocked=false,blockOffset=0;
function updateTextareaCounter(textareaId, counterId, max = 2000) {
 const textarea = $(textareaId), badge = $(counterId);
 if (!textarea || !badge) return;
 const len = textarea.value.length;
 badge.textContent = `${len} / ${max}`;
 const nearThreshold = Math.floor(max * 0.95);
 if (badge.classList?.toggle) {
  badge.classList.toggle('near-limit', len >= nearThreshold && len <= max);
  badge.classList.toggle('over-limit', len > max);
 } else {
  let cls = (badge.className || '').replace(/\b(near-limit|over-limit)\b/g, '').trim();
  if (len >= nearThreshold && len <= max) cls += ' near-limit';
  else if (len > max) cls += ' over-limit';
  badge.className = cls.trim();
 }
}

let profileBaseline = null;
function getSpaceProfileSnapshot() {
 return {
  name: $('space-name')?.value || '',
  bio: $('space-bio')?.value || '',
  links: linkInputs.map(f => ({ label: f.label.value, url: f.url.value }))
 };
}

function checkProfileDirty() {
 if (!own) return false;
 if (!profileBaseline) {
  profileDirty = false;
 } else {
  const cur = getSpaceProfileSnapshot();
  const nameChanged = cur.name !== profileBaseline.name;
  const bioChanged = cur.bio !== profileBaseline.bio;
  const linksChanged = JSON.stringify(cur.links) !== JSON.stringify(profileBaseline.links);
  profileDirty = nameChanged || bioChanged || linksChanged;
 }
 const badge = $('space-dirty-badge');
 if (badge) badge.hidden = !profileDirty;
 updateDirty();
 return profileDirty;
}

function updateDirty(){dirty=profileDirty||editDirty||!!$('post-body').value.trim();}
function updatePostEditingState(){
 const list=$('post-list');if(!list)return;
 for(const card of list.children||[]){
  const isCurrent=!!(editPost&&card.dataset?.postId===editPost.id);
  if(card.classList?.toggle)card.classList.toggle('space-post-editing',isCurrent);
  else if(card.className){
   if(isCurrent&&!card.className.includes('space-post-editing'))card.className=(card.className+' space-post-editing').trim();
   else if(!isCurrent&&card.className.includes('space-post-editing'))card.className=card.className.replace(/\bspace-post-editing\b/g,'').trim();
  }
 }
}
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function message(text){$('space-status').textContent=text;}
function assertSession(){if(ended)throw Error('会话已结束，请重新登录。');}
async function result(query){const {data,error}=await query;assertSession();if(error)throw error;return data;}
function lockControls(value){$('space-app').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=value);$('reload-space').disabled=value;}
async function task(fn){if(busy||ended)return;busy=true;lockControls(true);try{await fn();}catch(e){if(!ended)message(`操作失败：${e.message}`);}finally{busy=false;if(!ended){lockControls(false);$('posts-prev').disabled=postOffset===0;$('members-prev').disabled=memberOffset===0;}}}
function avatar(profile,name){const el=$('member-avatar'),display=avatarDisplay(profile)||fallbackAvatarDisplay(name);el.replaceChildren();if(display.type==='image'){const img=node('img');img.src=avatarPublicUrl(client,display.path);img.alt='';el.append(img);}else{el.style.background=display.color;el.textContent=display.emoji;}}
function renderBlockState(){
 $('member-profile-card').hidden=targetBlocked;$('posts-panel').hidden=targetBlocked;
 $('toggle-member-block').textContent=targetBlocked?'解除屏蔽':'屏蔽此成员';$('member-block-status').textContent=targetBlocked?'你已屏蔽此成员，主页和动态已隐藏。':'';
 if(targetBlocked){$('member-name').textContent='';$('member-bio').textContent='';$('member-links').replaceChildren();$('post-list').replaceChildren();$('member-avatar').replaceChildren();}
}
async function loadBlockState(){
 if(own){targetBlocked=false;renderBlockState();return;}
 const rows=await result(client.from('space_blocks').select('blocked_id').eq('blocker_id',user.id).eq('blocked_id',target));targetBlocked=!!rows?.length;renderBlockState();
}
async function changeBlock(member,blocked){await result(client.rpc('set_space_block',{p_member:member,p_block:blocked}));}
async function loadBlocks(){
 if(!own)return;const rows=await result(client.rpc('my_space_blocks',{p_offset:blockOffset}));const list=$('blocked-list');list.replaceChildren();
 for(const item of rows||[]){const row=node('div');row.className='space-post';row.append(node('p',item.display_name));const button=node('button','解除屏蔽');button.type='button';button.onclick=()=>task(async()=>{await changeBlock(item.blocked_id,false);await loadBlocks();await loadMembers();message('已解除屏蔽。');});row.append(button);list.append(row);}
 $('blocked-list-status').textContent=rows?.length?`第 ${blockOffset/30+1} 页，${rows.length} 位成员。`:'当前没有更多屏蔽记录。';$('blocks-prev').hidden=blockOffset===0;$('blocks-next').hidden=(rows?.length||0)<30;
}
$('toggle-member-block').onclick=()=>{if(!own&&window.confirm(targetBlocked?'确认解除屏蔽，恢复查看此成员？':'确认屏蔽此成员？只影响你的浏览，不限制对方查看你。'))task(async()=>{const value=!targetBlocked;await changeBlock(target,value);targetBlocked=value;renderBlockState();if(!targetBlocked){await loadSpace();await loadPosts();}await loadMembers();message(value?'已屏蔽此成员。':'已解除屏蔽。');});};
$('blocks-refresh').onclick=()=>task(loadBlocks);$('blocks-prev').onclick=()=>{blockOffset=Math.max(0,blockOffset-30);task(loadBlocks);};$('blocks-next').onclick=()=>{blockOffset+=30;task(loadBlocks);};
async function loadSpace(){
 const rows=await result(client.rpc('member_spaces',{p_id:target,p_offset:0}));
 const row=rows?.[0];baseline=row?.updated_at||null;
 if(own&&row){try{localStorage.setItem('lanmao_space_cached_profile_'+user.id,JSON.stringify(row));}catch(_){}}
 $('member-name').textContent=row?.display_name||(own?'我的空间':'成员空间');$('member-bio').textContent=row?.bio||'';
 $('space-empty').hidden=!!row;avatar(row,row?.display_name||'');
 const links=$('member-links');links.replaceChildren();
 for(const item of row?.links||[]){try{const checked=cleanSpace({display_name:'校验',links:[item]}).links[0];const a=node('a',checked.label);a.href=checked.url;a.target='_blank';a.rel='noopener noreferrer';const li=node('li');li.append(a);links.append(li);}catch{}}
 $('member-permalink').href=`space.html?user=${target}`;
 if(own){
  $('space-name').value=row?.display_name||'';
  $('space-bio').value=row?.bio||'';
  linkInputs.forEach((fields,i)=>{fields.label.value=row?.links?.[i]?.label||'';fields.url.value=row?.links?.[i]?.url||'';});
  updateTextareaCounter('space-bio','space-bio-count',600);
  profileBaseline=getSpaceProfileSnapshot();
  checkProfileDirty();
 }
}
async function loadUsage(){
 if(!own||ended)return;
 try{const usage=await readSpaceUsage(client,user.id,assertSession);$('space-usage').textContent=`已使用 ${usage.used} / ${usage.limit} 条动态，还可保存 ${usage.remaining} 条（包括隐藏记录）。`;$('space-capacity').max=usage.limit;$('space-capacity').value=Math.min(usage.used,usage.limit);$('space-capacity').hidden=false;$('space-capacity-note').textContent=usage.remaining===0?'已达到容量上限。导出不会删除动态或释放容量；如需调整容量请联系店主。':usage.remaining<=50?'接近容量上限，建议先导出保存自己的内容。':'导出只生成文件，不会删除云端内容或释放容量。';}
 catch(e){if(!ended){$('space-usage').textContent='用量读取失败：'+e.message;$('space-capacity').hidden=true;$('space-capacity-note').textContent='可以点击“刷新用量”重试。';}}
}
async function downloadSpace(){
 if(!own)return;let writable=null;
 try{
  if(window.showSaveFilePicker){try{const handle=await window.showSaveFilePicker({suggestedName:`lanmao-space-${new Date().toISOString().slice(0,10)}.json`,types:[{description:'个人空间 JSON',accept:{'application/json':['.json']}}]});assertSession();writable=await handle.createWritable();}catch(e){if(e.name==='AbortError'){$('space-export-status').textContent='已取消导出。';return;}throw e;}}
  $('space-export-status').textContent='正在读取云端内容并检查一致性…';
  const data=await exportOwnSpace(client,user.id,assertSession),text=JSON.stringify(data,null,2);assertSession();
  if(writable){await writable.write(text);assertSession();await writable.close();writable=null;assertSession();$('space-export-status').textContent=`已写入所选文件：${data.posts.length} 条动态。请妥善保存。`;}
  else{const blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);try{const a=node('a');a.href=url;a.download=`lanmao-space-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){URL.revokeObjectURL(url);throw e;}$('space-export-status').textContent=`已发起下载（${data.posts.length} 条动态），请在浏览器中确认文件已保存。`;}
 }catch(e){if(writable)await writable.abort().catch(()=>{});if(!ended)$('space-export-status').textContent='导出失败：'+e.message;throw e;}
}
$('export-space').onclick=()=>task(downloadSpace);$('refresh-space-usage').onclick=()=>task(loadUsage);
async function loadMembers(){
 const rows=await result(client.rpc('search_member_spaces',{p_query:$('member-search').value.trim(),p_offset:memberOffset}));const list=$('member-list');list.replaceChildren();
 for(const item of rows||[]){const a=node('a',item.display_name);a.href=`space.html?user=${item.user_id}`;list.append(a);}
 if(!rows?.length)list.append(node('p','没有匹配的成员，试试其他昵称。'));
 $('member-search-status').textContent=`第 ${memberOffset/30+1} 页，显示 ${rows?.length||0} 位成员。`;
 $('members-prev').hidden=memberOffset===0;$('members-next').hidden=(rows?.length||0)<30;
}
async function loadPosts(){
 if(targetBlocked)return;
 const archived=own&&$('show-archived').checked;
 const rows=await result(client.from('space_posts').select('id,user_id,body,archived,created_at,updated_at,edited_at,moderation_hidden').eq('user_id',target).eq('archived',archived).order('created_at',{ascending:false}).order('id',{ascending:false}).range(postOffset,postOffset+19));
 const list=$('post-list');list.replaceChildren();
 for(const item of rows||[]){
  const article=node('article');article.className='space-post';article.dataset={postId:item.id};article.setAttribute('data-post-id',item.id);
  if(editPost&&editPost.id===item.id){if(article.classList?.add)article.classList.add('space-post-editing');else article.className+=' space-post-editing';}
  const time=node('time',new Date(item.created_at).toLocaleString('zh-CN'));time.dateTime=item.created_at;const text=node('div');text.className='space-text md-rendered';text.replaceChildren(...renderMarkdown(document,item.body));article.append(time,text);if(item.edited_at)article.append(node('p','已编辑 · '+new Date(item.edited_at).toLocaleString('zh-CN')));if(item.moderation_hidden)article.append(node('p','这条动态已被店主隐藏，其他成员不可见。'));
  if(own){const editButton=node('button','编辑动态');editButton.type='button';editButton.onclick=()=>{
   if(editDirty&&!window.confirm('切换编辑会放弃当前动态草稿，是否继续？'))return;
   mdEdit?.reset();editOpener=editButton;editPost={...item};editDirty=false;updateDirty();$('edit-post-form').hidden=false;$('edit-post-body').value=item.body;updateTextareaCounter('edit-post-body','edit-post-body-count');$('edit-post-status').textContent='保存会检查云端版本；冲突时保留你的草稿。';
   updatePostEditingState();
   $('edit-post-form').scrollIntoView?.({behavior:'smooth',block:'nearest'});
   $('edit-post-body').focus();
  };article.append(editButton);}
  else {const reportButton=node('button','举报');reportButton.type='button';const form=node('form');form.hidden=true;const reason=node('textarea');reason.maxLength=500;reason.required=true;reason.setAttribute('aria-label','举报原因');const send=node('button','提交举报');send.type='submit';const cancel=node('button','取消');cancel.type='button';cancel.onclick=()=>{form.hidden=true;};form.append(reason,send,cancel);reportButton.onclick=()=>{form.hidden=!form.hidden;if(!form.hidden)reason.focus();};form.onsubmit=e=>{e.preventDefault();task(async()=>{const why=reason.value.trim();if(!why||[...why].length>500)throw Error('举报原因请填写 1–500 字。');const sent=await result(client.rpc('report_space_post',{p_post:item.id,p_reason:why}));form.hidden=true;message(sent?'举报已提交，店主审核后处理；不会自动隐藏内容。':'你已经举报过这条动态。');});};article.append(reportButton,form);}
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
$('space-form').oninput=()=>{updateTextareaCounter('space-bio','space-bio-count',600);checkProfileDirty();};$('post-body').oninput=()=>{updateTextareaCounter('post-body','post-body-count');updateDirty();};
$('edit-post-body').oninput=()=>{updateTextareaCounter('edit-post-body','edit-post-body-count');editDirty=!!editPost&&$('edit-post-body').value!==editPost.body;updateDirty();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
if(typeof document.addEventListener==='function'){
 document.addEventListener('click',e=>{
  const a=e.target?.closest?e.target.closest('a[href], button[data-signout]'):null;
  if(!a)return;
  if(dirty){
   if(!window.confirm('当前主页或动态修改尚未保存，确定要离开吗？未保存的内容将会丢失。')){
    e.preventDefault();
    e.stopPropagation();
   }
  }
 },true);
}
$('space-form').onsubmit=e=>{e.preventDefault();task(async()=>{
 const links=linkInputs.filter(f=>f.label.value.trim()||f.url.value.trim()).map(f=>({label:f.label.value,url:f.url.value}));
 const values=cleanSpace({display_name:$('space-name').value,bio:$('space-bio').value,links});
 const changed=baseline?await result(client.from('user_spaces').update(values).eq('user_id',user.id).eq('updated_at',baseline).select('user_id')):await result(client.from('user_spaces').insert({user_id:user.id,...values}).select('user_id'));
 if(!changed?.length)throw Error('主页已在其他页面更新，请先复制保留当前编辑，再刷新。');
 await loadSpace();profileBaseline=getSpaceProfileSnapshot();checkProfileDirty();await loadMembers();message('主页已保存，登录成员现在可以看到。');
});};
// 每次未确认的新发布复用同一编号；响应丢失后重试不会重复创建。
let postAttempt=null;
$('post-form').onsubmit=e=>{e.preventDefault();task(async()=>{
 const body=cleanPost($('post-body').value);
 if(postAttempt&&postAttempt.body!==body)throw Error('上次发布尚未确认。请保留新草稿，刷新动态列表检查后再发布。');
 postAttempt??={id:crypto.randomUUID(),body};
 const existing=await result(client.from('space_posts').select('id').eq('id',postAttempt.id).eq('user_id',user.id));
 if(!existing?.length){const {error}=await client.from('space_posts').insert({id:postAttempt.id,user_id:user.id,body});assertSession();if(error){const confirmed=await result(client.from('space_posts').select('id').eq('id',postAttempt.id).eq('user_id',user.id));if(!confirmed?.length)throw error;}}
 postAttempt=null;$('post-body').value='';updateTextareaCounter('post-body','post-body-count');mdPost?.reset();updateDirty();postOffset=0;$('show-archived').checked=false;await loadPosts();await loadUsage();message('动态已发布，登录成员可见。');
 // 简介表单可能仍有未保存修改，保守保留离开提醒。
});};
$('edit-post-form').onsubmit=e=>{e.preventDefault();task(async()=>{
 if(!editPost)return;const body=cleanPost($('edit-post-body').value);if(body===editPost.body){message('内容没有变化。');return;}
 const changed=await result(client.from('space_posts').update({body}).eq('id',editPost.id).eq('user_id',user.id).eq('updated_at',editPost.updated_at).select('id'));
 if(!changed?.length){$('edit-post-status').textContent='云端动态已被修改，未覆盖。请复制保留草稿，刷新列表后重新编辑。';throw Error('编辑冲突：草稿已保留。');}
 editPost=null;editDirty=false;updateDirty();$('edit-post-body').value='';mdEdit?.reset();updateTextareaCounter('edit-post-body','edit-post-body-count');$('edit-post-form').hidden=true;await loadPosts();message('动态修改已保存。');
 if(editOpener&&typeof editOpener.focus==='function'){editOpener.focus();editOpener=null;}
});};
$('edit-post-cancel').onclick=()=>{
 if(editDirty&&!window.confirm('放弃当前动态的未保存修改？'))return;
 editPost=null;editDirty=false;updateDirty();$('edit-post-body').value='';mdEdit?.reset();updateTextareaCounter('edit-post-body','edit-post-body-count');$('edit-post-form').hidden=true;
 updatePostEditingState();
 if(editOpener&&typeof editOpener.focus==='function'){editOpener.focus();editOpener=null;}
};
$('member-search-form').onsubmit=e=>{e.preventDefault();memberOffset=0;task(loadMembers);};
$('member-search-clear').onclick=()=>{$('member-search').value='';memberOffset=0;task(loadMembers);};
async function loadReports(){
 const rows=await result(client.rpc('owner_space_reports',{p_status:$('reports-status').value||'pending',p_offset:reportOffset}));const list=$('report-list');list.replaceChildren();
 for(const item of rows||[]){const row=node('article');row.className='space-post';row.append(node('h3',item.author),node('p','举报原因：'+item.reason));const body=node('p',item.body);body.className='space-text';row.append(body);
  for(const [label,hide] of item.moderation_hidden?[['恢复成员可见',false]]:[['隐藏动态',true],['忽略举报',false]]){const button=node('button',label);button.type='button';button.onclick=()=>{if(!window.confirm('确认'+label+'？'))return;task(async()=>{const done=await result(client.rpc('owner_moderate_space_post',{p_report:item.id,p_hide:hide}));if(!done)throw Error('举报记录已变化，请刷新。');await loadReports();await loadPosts();message('处理结果已保存。');});};row.append(button);}list.append(row);
 }
 $('reports-message').textContent=rows?.length?`第 ${reportOffset/30+1} 页，${rows.length} 条举报。`:'当前没有举报。';$('reports-prev').hidden=reportOffset===0;$('reports-next').hidden=(rows?.length||0)<30;
}
$('reports-refresh').onclick=()=>task(loadReports);$('reports-status').onchange=()=>{reportOffset=0;task(loadReports);};$('reports-prev').onclick=()=>{reportOffset=Math.max(0,reportOffset-30);task(loadReports);};$('reports-next').onclick=()=>{reportOffset+=30;task(loadReports);};
$('show-archived').onchange=()=>{postOffset=0;task(loadPosts);};
$('posts-prev').onclick=()=>{postOffset=Math.max(0,postOffset-20);task(loadPosts);};$('posts-next').onclick=()=>{postOffset+=20;task(loadPosts);};
$('members-prev').onclick=()=>{memberOffset=Math.max(0,memberOffset-30);task(loadMembers);};$('members-next').onclick=()=>{memberOffset+=30;task(loadMembers);};
$('reload-space').onclick=()=>{if(!dirty||window.confirm('刷新会清除当前未保存内容，是否继续？'))window.location.reload();};
async function init(){try{
 client=await getSupabase();
 let currentUser=null;
 if(typeof client?.auth?.getSession==='function'){
  try{const {data:s}=await client.auth.getSession();if(s?.session?.user)currentUser=s.session.user;}catch(_){}
 }
 if(!currentUser){
  const {data,error}=await client.auth.getUser();
  if(error||!data.user){window.location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.search));return;}
  currentUser=data.user;
 }
 user=currentUser;
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){ended=true;dirty=false;$('space-app').replaceChildren();$('space-app').hidden=true;message('已退出登录。');}});
 const raw=new URLSearchParams(location.search).get('user');if(raw&&!memberId(raw))throw Error('个人主页地址不正确。');target=raw||user.id;own=target===user.id;
 const isOwner=window.LANMAO_MEMO_CONFIG?.ownerUid===user.id;$('reports-panel').hidden=!isOwner;
 makeLinkEditor();$('member-block-control').hidden=own;$('blocks-panel').hidden=!own;$('space-data-panel').hidden=!own;$('space-editor').hidden=!own;$('post-form').hidden=!own;$('archive-control').hidden=!own;

 if(own){
  try{
   const cached=localStorage.getItem('lanmao_space_cached_profile_'+user.id);
   if(cached){
    const row=JSON.parse(cached);
    if(row&&row.display_name){
     $('member-name').textContent=row.display_name;
     $('member-bio').textContent=row.bio||'';
     avatar(row,row.display_name);
     $('space-app').hidden=false;
    }
   }
  }catch(_){}
 }

 await loadBlockState();
 if(!targetBlocked){
  await Promise.all([loadSpace(),loadPosts()]);
 }
 assertSession();
 $('space-app').hidden=false;
 updateTextareaCounter('post-body','post-body-count');updateTextareaCounter('edit-post-body','edit-post-body-count');
 message(own?'欢迎来到你的个人空间。填写昵称并保存后，会出现在成员列表。':'正在查看成员主页。');
 if(!targetBlocked){
  await Promise.all([loadMembers(),loadUsage(),loadBlocks(),isOwner?loadReports():Promise.resolve()]);
 }
}catch(e){if(!ended)message(`个人空间暂不可用：${e.message}。需店主执行 user-spaces.sql、space-community.sql 和 space-blocks.sql，可执行后刷新本页。`);}}
// Markdown 排版工具栏与安全预览：只改文本框内容，预览用 DOM 节点构建，不解析任何 HTML 字符串。
function setupMarkdown(areaId,barId,previewId){
 const area=$(areaId),bar=$(barId),preview=$(previewId);
 if(!area||!bar||!preview)return null;
 let previewing=false;
 const tools=node('div');tools.className='md-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','文字格式');
 const formatButtons=[];
 for(const [kind,label,title] of [['bold','B','粗体 **'],['italic','I','斜体 *'],['quote','❝','引用 >'],['code','</>','行内代码 `'],['list','•','无序列表 -']]){
  const button=node('button',label);button.type='button';button.className='md-btn';button.title=title;button.setAttribute('aria-label',title);button.dataset.md=kind;
  button.onclick=()=>{
   if(previewing||area.disabled)return;
   const next=applyFormat(area.value,area.selectionStart,area.selectionEnd,kind);
   if(!next){message('内容已达到 2000 字上限，无法再插入格式符号。');return;}
   area.value=next.value;area.focus();
   if(typeof area.setSelectionRange==='function')area.setSelectionRange(next.start,next.end);
   if(typeof area.oninput==='function')area.oninput();
  };
  formatButtons.push(button);tools.append(button);
 }
 const tabs=node('div');tabs.className='md-tabs';
 const editTab=node('button','编辑'),previewTab=node('button','预览');
 for(const tab of [editTab,previewTab]){tab.type='button';tab.className='md-tab';tabs.append(tab);}
 function show(on,focus){
  previewing=on;area.hidden=on;preview.hidden=!on;
  formatButtons.forEach(b=>{b.disabled=on;});
  editTab.setAttribute('aria-pressed',String(!on));previewTab.setAttribute('aria-pressed',String(on));
  if(on){
   const text=area.value;
   preview.replaceChildren(...(text.trim()?renderMarkdown(document,text):[node('p','（还没有内容，切回“编辑”输入后再预览。）')]));
  }else if(focus&&typeof area.focus==='function')area.focus();
 }
 editTab.onclick=()=>show(false,true);previewTab.onclick=()=>show(true,false);
 bar.replaceChildren(tools,tabs);show(false,false);
 return {reset(){if(previewing)show(false,false);}};
}
const mdPost=setupMarkdown('post-body','post-md-bar','post-preview'),mdEdit=setupMarkdown('edit-post-body','edit-md-bar','edit-preview');
init();
