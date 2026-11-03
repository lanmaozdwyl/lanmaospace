import {getSupabase} from './lib/supabase-client.js';
import {currentAccount,sendAccountReset,signOutEverywhere} from './lib/account-security.mjs';
const $=id=>document.getElementById(id);let client,user,busy=false,ended=false,resetAt=0;
function controls(disabled){$('account-reset-password').disabled=disabled;$('account-signout-all').disabled=disabled;}
$('account-reset-password').onclick=async()=>{
 if(busy||ended)return;if(Date.now()-resetAt<60000){$('account-reset-status').textContent='请间隔一分钟再尝试发送。';return;}
 busy=true;controls(true);$('account-reset-status').textContent='正在请求发送…';
 try{await sendAccountReset(client,user.id,location.origin);if(!ended){resetAt=Date.now();$('account-reset-status').textContent='重置邮件已请求发送，请查看注册邮箱；不要分享邮件中的链接。';}}
 catch{if(!ended)$('account-reset-status').textContent='未能发送，请检查登录状态或稍后重试。';}
 finally{busy=false;if(!ended)controls(false);}
};
$('account-signout-all').onclick=async()=>{
 if(busy||ended||!window.confirm('确认让所有设备重新登录？本设备也会退出。'))return;
 busy=true;controls(true);
 try{await currentAccount(client,user.id);await signOutEverywhere(client);ended=true;window.location.replace('/login.html');}
 catch{if(!ended)$('account-signout-status').textContent='退出请求失败，请重试；不能确认其他设备已退出。';}
 finally{busy=false;if(!ended)controls(false);}
};
async function init(){try{client=await getSupabase();user=await currentAccount(client);client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||session?.user?.id&&session.user.id!==user.id){ended=true;$('account-actions').replaceChildren();$('account-actions').hidden=true;$('account-status').textContent='登录身份已变化，请重新登录。';}});$('account-actions').hidden=false;$('account-status').textContent='已确认当前登录身份。';}catch{$('account-status').textContent='请先登录后再管理账号安全。';window.location.replace('/login.html?next=%2Faccount');}}
init();
