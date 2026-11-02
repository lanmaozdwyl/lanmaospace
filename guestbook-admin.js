// 店主审核入口只展示公开字段；真正的授权检查在数据库 RPC 内。
import {getSupabase} from './lib/supabase-client.js';
const host=document.getElementById('messagesList');
let client, panel, list, status, filter, previous, next, offset=0, epoch=0, busy=false;
const ownerId=()=>window.LANMAO_MEMO_CONFIG?.ownerUid;
function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;}
function clear(){epoch++;panel?.remove();panel=null;}
async function load(){
 if(!panel||busy)return;
 const version=epoch;busy=true;status.textContent='正在读取留言…';
 panel.querySelectorAll('button,select').forEach(el=>el.disabled=true);
 try {
  const {data,error}=await client.rpc('owner_guestbook_list',{p_approved:filter.value==='true',p_offset:offset});
  if(error)throw error;
  if(version!==epoch)return;
  list.replaceChildren();
  for(const item of data||[]){
   const row=document.createElement('article'),title=document.createElement('strong'),body=document.createElement('p');
   row.className='message-item';row.style.display='block';title.textContent=`${item.name} · ${new Date(item.created_at).toLocaleString('zh-CN')}`;body.textContent=item.message;body.style.whiteSpace='pre-wrap';
   const action=button(item.approved?'撤回公开':'审核通过并公开',async()=>{
    if(busy||!window.confirm(item.approved?'撤回后访客将看不到这条留言，确定吗？':'确认将这条留言公开给访客？'))return;
    busy=true;action.disabled=true;
    try {
     const {data:changed,error}=await client.rpc('owner_guestbook_review',{p_id:item.id,p_approved:!item.approved,p_expected:item.approved});
     if(error)throw error;
     if(version!==epoch)return;
     status.textContent=changed?'审核状态已保存。':'留言状态已变化，请刷新后重试。';
     document.dispatchEvent(new Event('guestbook-reviewed'));
    } catch(error){if(version===epoch)status.textContent=`保存失败：${error.message}`;}
    finally {busy=false;if(version===epoch){action.disabled=false;if(status.textContent==='审核状态已保存。')await load();}}
   });
   row.append(title,body,action);list.append(row);
  }
  status.textContent=data?.length?`第 ${offset/50+1} 页，共显示 ${data.length} 条。`:'当前分类没有更多留言。';
  next.disabled=(data?.length||0)<50;
 } catch(error){if(version===epoch)status.textContent=`读取失败：${error.message}。首次使用请店主执行 guestbook-owner-review.sql。`;}
 finally{busy=false;if(version===epoch){panel.querySelectorAll('button,select').forEach(el=>{if(el!==next)el.disabled=false;});previous.disabled=offset===0;}}
}
async function identify(){
 const version=++epoch;
 const {data,error}=await client.auth.getUser();
 if(version!==epoch)return;
 clear();busy=false;
 if(error||!ownerId()||data.user?.id!==ownerId())return;
 panel=document.createElement('section');panel.className='owner-review';
 const heading=document.createElement('h3');heading.textContent='留言审核 · 仅店主';
 filter=document.createElement('select');filter.setAttribute('aria-label','留言审核状态');
 for(const [value,text] of [['false','待审核'],['true','已公开']]){const option=document.createElement('option');option.value=value;option.textContent=text;filter.append(option);}
 filter.onchange=()=>{offset=0;load();};
 status=document.createElement('p');status.setAttribute('role','status');list=document.createElement('div');
 previous=button('上一页',()=>{offset=Math.max(0,offset-50);load();});next=button('下一页',()=>{offset+=50;load();});
 panel.append(heading,filter,button('刷新',load),status,list,previous,next);host.after(panel);offset=0;load();
}
if(host){
 try{client=await getSupabase();client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')clear();else if(event==='SIGNED_IN')setTimeout(()=>identify(),0);});await identify();}
 catch(error){console.error('审核入口加载失败',error);}
}
