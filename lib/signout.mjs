// 普通退出仅作用于当前会话；全设备退出由账号安全页单独提供。
export function bindSignOut(client,document,{navigate,onFailure}) {
 let pending=false;
 document.addEventListener('click',async event=>{
  const button=event.target?.closest?.('[data-signout]');
  if(!button)return;
  event.preventDefault();if(pending)return;
  pending=true;button.disabled=true;
  try {
   const result=await client.auth.signOut({scope:'local'});
   if(result?.error)throw result.error;
   navigate('/login.html');
  }catch{
   onFailure('退出登录未成功，请检查网络后重试。本次尚未确认退出。');
  }finally{pending=false;button.disabled=false;}
 });
}
