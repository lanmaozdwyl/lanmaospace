import {getSupabase} from './lib/supabase-client.js';
import {MODES,freshFocus,readFocus,reconcileFocus,changeFocus} from './lib/focus.mjs';
const $=id=>document.getElementById(id);
let state=freshFocus(Date.now()),key=null,ended=false,working=false,audio=null,timer=null,lastSignal=null;
const status=$('focus-storage-status');
function notify(text){if(status)status.textContent=text;}
function sound(){
 if(!state.sound)return;
 try{if(audio?.state==='running'){const t=audio.currentTime;for(const [f,delay] of [[587.33,0],[880,.2]]){const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.12,t+delay);g.gain.exponentialRampToValueAtTime(.001,t+delay+.7);o.connect(g);g.connect(audio.destination);o.start(t+delay);o.stop(t+delay+.7);}}}catch{}
 try{navigator.vibrate?.([200,100,200]);}catch{}
}
function unlockAudio(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
function text(id,value){if($(id))$(id).textContent=value;}
function paint(allowStart=false){
 const sec=state.remainingSeconds,str=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
 for(const id of ['pomodoro-timer','pomodoro-mini-time','focus-main-timer'])text(id,str);
 const label=state.isRunning?'暂停':sec>0&&sec<MODES[state.mode]?'继续':'开始';
 text('pomodoro-start',label);text('focus-start-label',label);text('focus-start-icon',state.isRunning?'⏸':'▶');
 const msg=state.isRunning?(state.mode==='focus'?'深度专注中':'正在休息'):sec===0?'本轮已完成':sec<MODES[state.mode]?'已暂停':'准备开始';
 text('pomodoro-status',msg);text('focus-main-status',msg);text('focus-sound-icon',state.sound?'🔔':'🔕');
 $('focus-sound-toggle')?.setAttribute('aria-pressed',String(state.sound));
 $('focus-sound-toggle')?.setAttribute('aria-label',state.sound?'关闭提示音':'开启提示音');
 for(const [id,value,unit] of [['focus-completed-count',state.completedCount,'个番茄'],['focus-total-minutes',state.totalMinutes,'分钟']]){const el=$(id);if(el){const small=document.createElement('small');small.textContent=unit;el.replaceChildren(document.createTextNode(value+' '),small);}}
 for(const btn of document.querySelectorAll('.pomodoro-mode-btn,.focus-mode-btn')){const active=Number(btn.dataset.time)===MODES[state.mode];btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));}
 const circle=$('focus-progress-circle');if(circle){circle.style.strokeDashoffset=String(653.45*(1-sec/MODES[state.mode]));circle.style.stroke=state.mode==='focus'?'#0071e3':state.mode==='short-break'?'#34c759':'#af52de';}
 const signal=state.isRunning+':'+state.mode;if(signal!==lastSignal){lastSignal=signal;window.dispatchEvent(new CustomEvent('lanmao-focus-state',{detail:{running:state.isRunning,mode:state.mode,allowStart}}));}
 document.title=state.isRunning?'('+str+') 蓝昴空间 · 专注中':'Lanmao Space | 蓝昴空间';
}
function load(){try{return readFocus(localStorage.getItem(key),Date.now());}catch{notify('浏览器禁止保存；本次计时仅保留在当前页面。');return state;}}
function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{notify('保存失败；离开页面后可能丢失本次计时。');}}
async function mutate(action){
 if(!key||ended||working)return;working=true;
 const work=()=>{if(ended)return;const previous=load();const result=changeFocus(previous,action,Date.now());state=result.state;persist();paint(action==='toggle');if(result.completed)sound();};
 try{if(navigator.locks)await navigator.locks.request(key,work);else work();}finally{working=false;}
}
function pulse(){if(!key||ended)return;const result=reconcileFocus(state,Date.now());if(result.completed||state.date!==result.state.date)mutate('tick');else{state=result.state;paint();}}
for(const id of ['pomodoro-start','focus-main-start'])$(id)?.addEventListener('click',()=>{unlockAudio();mutate('toggle');});
for(const id of ['pomodoro-reset','focus-main-reset'])$(id)?.addEventListener('click',()=>mutate('reset'));
$('focus-sound-toggle')?.addEventListener('click',()=>{unlockAudio();mutate('sound');});
for(const btn of document.querySelectorAll('.pomodoro-mode-btn,.focus-mode-btn'))btn.addEventListener('click',()=>mutate(Object.keys(MODES).find(k=>MODES[k]===Number(btn.dataset.time))));
function panel(open){if($('pomodoro-panel'))$('pomodoro-panel').hidden=!open;$('pomodoro-toggle')?.setAttribute('aria-expanded',String(open));}
$('pomodoro-toggle')?.addEventListener('click',()=>panel($('pomodoro-panel').hidden));$('pomodoro-close')?.addEventListener('click',()=>panel(false));
window.addEventListener('storage',e=>{if(key&&e.key===key){state=reconcileFocus(load(),Date.now()).state;paint();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&key){state=load();pulse();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')panel(false);});
async function init(){try{
 const client=await getSupabase(),{data,error}=await client.auth.getSession();if(error||!data.session)return;
 const uid=data.session.user.id;key='lanmao_focus_v3_'+uid;state=reconcileFocus(load(),Date.now()).state;persist();
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==uid)){ended=true;clearInterval(timer);state=freshFocus(Date.now());paint();panel(false);audio?.close().catch(()=>{});}});
 notify('仅保存于此账号的当前浏览器；手机 App 与其他设备分别计时。锁屏提示受系统限制。');
 paint();timer=setInterval(pulse,1000);
}catch{notify('专注钟暂不可用，请联网并登录后重试。');}}
paint();init();
