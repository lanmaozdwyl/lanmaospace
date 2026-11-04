import {getSupabase} from './lib/supabase-client.js';
import {currentAccount,sendAccountReset,signOutEverywhere} from './lib/account-security.mjs';

const $=id=>document.getElementById(id);
let client,user,busy=false,ended=false,resetAt=0,cooldownTimer=null,emailMasked=true;
const COOLDOWN_KEY_PREFIX='lanmao_account_reset_cooldown_';

function maskEmail(email){
 if(!email||typeof email!=='string')return '';
 const atIdx=email.indexOf('@');
 if(atIdx<=0)return email;
 const name=email.slice(0,atIdx),domain=email.slice(atIdx);
 if(name.length<=2)return name[0]+'***'+domain;
 return name.slice(0,2)+'***'+name.slice(-1)+domain;
}

function updateEmailDisplay(){
 const rawEmail=user?.email||'未绑定邮箱';
 const emailEl=$('account-email');
 const previewEl=$('account-reset-email-preview');
 const iconEl=$('account-mask-icon');
 const toggleBtn=$('account-toggle-mask');
 const display=(emailMasked&&rawEmail.includes('@'))?maskEmail(rawEmail):rawEmail;
 if(emailEl)emailEl.textContent=display;
 if(previewEl)previewEl.textContent=display;
 if(iconEl)iconEl.textContent=emailMasked?'👁️':'🙈';
 if(toggleBtn){
  const label=emailMasked?'显示完整邮箱':'隐藏邮箱';
  toggleBtn.setAttribute('aria-label',label);
  toggleBtn.setAttribute('title',label);
 }
}

function getCooldownKey(uid){
 return COOLDOWN_KEY_PREFIX+(uid||(user&&user.id)||'guest');
}

function stopCooldown(resetText=true){
 if(cooldownTimer){
  clearInterval(cooldownTimer);
  cooldownTimer=null;
 }
 try{
  if(user?.id)localStorage.removeItem(getCooldownKey(user.id));
 }catch{}
 const btn=$('account-reset-password');
 if(btn&&resetText){
  btn.textContent='发送修改密码邮件';
  if(!busy&&!ended)btn.disabled=false;
 }
}

function startCooldown(remainingSec,totalExpireMs){
 stopCooldown(false);
 const expireMs=totalExpireMs||(Date.now()+remainingSec*1000);
 try{
  if(user?.id)localStorage.setItem(getCooldownKey(user.id),String(expireMs));
 }catch{}
 const btn=$('account-reset-password');
 function tick(){
  if(ended){
   stopCooldown(false);
   return;
  }
  const now=Date.now();
  const left=Math.max(0,Math.ceil((expireMs-now)/1000));
  if(left<=0){
   stopCooldown(true);
  }else{
   if(btn){
    btn.textContent=left+' 秒后可重新发送';
    btn.disabled=true;
   }
  }
 }
 tick();
 cooldownTimer=setInterval(tick,1000);
}

function restoreCooldown(){
 if(!user?.id)return;
 try{
  const saved=localStorage.getItem(getCooldownKey(user.id));
  if(saved){
   const expireMs=Number(saved);
   const left=Math.max(0,Math.ceil((expireMs-Date.now())/1000));
   if(left>0&&left<=60){
    resetAt=expireMs-60000;
    startCooldown(left,expireMs);
   }else{
    localStorage.removeItem(getCooldownKey(user.id));
   }
  }
 }catch{}
}

function controls(disabled){
 const isCooldown=Boolean(cooldownTimer);
 if($('account-reset-password'))$('account-reset-password').disabled=disabled||isCooldown;
 if($('account-signout-all'))$('account-signout-all').disabled=disabled;
}

$('account-reset-password').onclick=async()=>{
 if(busy||ended||cooldownTimer)return;
 const elapsed=Date.now()-resetAt;
 if(elapsed<60000){
  const left=Math.ceil((60000-elapsed)/1000);
  startCooldown(left);
  $('account-reset-status').textContent='请间隔一分钟再尝试发送。';
  return;
 }
 busy=true;controls(true);$('account-reset-status').textContent='正在请求发送…';
 try{
  await sendAccountReset(client,user.id,location.origin);
  if(!ended){
   resetAt=Date.now();
   startCooldown(60);
   $('account-reset-status').textContent='重置邮件已请求发送，请查看注册邮箱；不要分享邮件中的链接。';
  }
 }catch{
  if(!ended)$('account-reset-status').textContent='未能发送，请检查登录状态或稍后重试。';
 }finally{
  busy=false;
  if(!ended)controls(false);
 }
};

$('account-signout-all').onclick=async()=>{
 if(busy||ended||!window.confirm('确认让所有设备重新登录？本设备也会退出。'))return;
 busy=true;controls(true);
 if($('account-signout-status'))$('account-signout-status').textContent='正在安全退出所有设备，请稍候…';
 try{
  await currentAccount(client,user.id);
  await signOutEverywhere(client);
  ended=true;
  stopCooldown(false);
  window.location.replace('/login.html');
 }catch{
  if(!ended)$('account-signout-status').textContent='退出请求失败，请重试；不能确认其他设备已退出。';
 }finally{
  busy=false;
  if(!ended)controls(false);
 }
};

if($('account-toggle-mask')){
 $('account-toggle-mask').onclick=()=>{
  emailMasked=!emailMasked;
  updateEmailDisplay();
 };
}

window.addEventListener('pagehide',()=>stopCooldown(false));

async function init(){
 try{
  client=await getSupabase();
  user=await currentAccount(client);
  client.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'||session?.user?.id&&session.user.id!==user.id){
    ended=true;
    stopCooldown(false);
    $('account-actions').replaceChildren();
    $('account-actions').hidden=true;
    $('account-status').textContent='登录身份已变化，请重新登录。';
   }
  });
  $('account-actions').hidden=false;
  $('account-status').textContent='已确认当前登录身份。';
  if($('account-user-id')&&user?.id){
   $('account-user-id').textContent=`UID: ${user.id.slice(0,8)}…`;
  }
  updateEmailDisplay();
  restoreCooldown();
 }catch{
  $('account-status').textContent='请先登录后再管理账号安全。';
  window.location.replace('/login.html?next=%2Faccount');
 }
}

init();
