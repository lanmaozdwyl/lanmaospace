import {getSupabase} from './lib/supabase-client.js';
import {MODES,freshFocus,readFocus,reconcileFocus,changeFocus} from './lib/focus.mjs';
const $=id=>document.getElementById(id);
const originalTitle=typeof document!=='undefined'?document.title:'';
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
function syncAmbientButton(){
 let enabled=true;
 try{
  const saved=localStorage.getItem('lanmao_ambient_sync_v1');
  if(saved!==null)enabled=(saved==='true');
 }catch{}
 const chk=$('ambient-pomodoro-sync');
 if(chk&&typeof chk.checked==='boolean')enabled=chk.checked;
 const btn=$('focus-ambient-toggle');
 if(btn){
  btn.setAttribute('aria-pressed',String(enabled));
  btn.setAttribute('title',enabled?'伴读声音联动开关：开 (专注自动播放/休息静音)':'伴读声音联动开关：关');
  btn.classList.toggle('off',!enabled);
 }
 const pBtn=$('pomodoro-ambient-toggle');
 if(pBtn){
  pBtn.setAttribute('aria-pressed',String(enabled));
  pBtn.textContent=enabled?'🎧 伴读联动: 开':'🎧 伴读联动: 关';
  pBtn.classList.toggle('off',!enabled);
 }
}
function toggleAmbientSync(){
 let enabled=true;
 try{
  const saved=localStorage.getItem('lanmao_ambient_sync_v1');
  if(saved!==null)enabled=(saved==='true');
 }catch{}
 const chk=$('ambient-pomodoro-sync');
 if(chk&&typeof chk.checked==='boolean')enabled=chk.checked;
 enabled=!enabled;
 try{localStorage.setItem('lanmao_ambient_sync_v1',String(enabled));}catch{}
 if(chk)chk.checked=enabled;
 syncAmbientButton();
 window.dispatchEvent(new CustomEvent('lanmao-ambient-sync-changed',{detail:{enabled}}));
}
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
 syncAmbientButton();
 const circle=$('focus-progress-circle');if(circle){circle.style.strokeDashoffset=String(653.45*(1-sec/MODES[state.mode]));circle.style.stroke=state.mode==='focus'?'#0071e3':state.mode==='short-break'?'#34c759':'#af52de';}
 const signal=state.isRunning+':'+state.mode;if(signal!==lastSignal){lastSignal=signal;window.dispatchEvent(new CustomEvent('lanmao-focus-state',{detail:{running:state.isRunning,mode:state.mode,allowStart}}));}
 document.title=state.isRunning?'('+str+') 蓝昴空间 · 专注中':(originalTitle||'Lanmao Space | 蓝昴空间');

 function updateNextActionPills(){
  const mainWrap=$('focus-next-action-wrap');
  const miniWrap=$('pomodoro-next-wrap');
  const mainText=$('focus-next-pill-text');
  const mainIcon=$('focus-next-pill-icon');
  const miniBtn=$('pomodoro-next-btn');
  const isFinished=sec===0&&!state.isRunning;

  if(!isFinished){
   if(mainWrap)mainWrap.hidden=true;
   if(miniWrap)miniWrap.hidden=true;
  }else{
   let nextMode,icon,labelMain,labelMini;
   if(state.mode==='focus'){
    const isLong=state.completedCount>0&&state.completedCount%4===0;
    nextMode=isLong?'long-break':'short-break';
    icon=isLong?'🌿':'☕';
    labelMain=isLong?'太棒了！已达成 4 个番茄，开始 15 分钟长休 ↗':'太棒了！专注达成，开始 5 分钟小憩 ↗';
    labelMini=isLong?'🌿 开始 15m 长休 ↗':'☕ 开始 5m 小憩 ↗';
   }else{
    nextMode='focus';
    icon='🍅';
    labelMain='小憩结束，精力充沛！开启新一轮深度专注 ↗';
    labelMini='🍅 开始 25m 专注 ↗';
   }
   if(mainWrap&&mainText){
    mainWrap.hidden=false;
    mainText.textContent=labelMain;
    if(mainIcon)mainIcon.textContent=icon;
    $('focus-next-pill-btn')?.setAttribute('data-target-mode',nextMode);
   }
   if(miniWrap&&miniBtn){
    miniWrap.hidden=false;
    miniBtn.textContent=labelMini;
    miniBtn.setAttribute('data-target-mode',nextMode);
   }
  }
 }
 updateNextActionPills();
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
$('focus-ambient-toggle')?.addEventListener('click',()=>{unlockAudio();toggleAmbientSync();});
$('pomodoro-ambient-toggle')?.addEventListener('click',()=>{unlockAudio();toggleAmbientSync();});
for(const btn of document.querySelectorAll('.pomodoro-mode-btn,.focus-mode-btn'))btn.addEventListener('click',()=>mutate(Object.keys(MODES).find(k=>MODES[k]===Number(btn.dataset.time))));
async function advanceToNextPhase(targetMode){
 unlockAudio();
 const mode=targetMode||(state.mode==='focus'?(state.completedCount>0&&state.completedCount%4===0?'long-break':'short-break'):'focus');
 await mutate(mode);
 await mutate('toggle');
}
$('focus-next-pill-btn')?.addEventListener('click',e=>{
 const mode=e.currentTarget?.getAttribute('data-target-mode');
 advanceToNextPhase(mode);
});
$('pomodoro-next-btn')?.addEventListener('click',e=>{
 const mode=e.currentTarget?.getAttribute('data-target-mode');
 advanceToNextPhase(mode);
});
function panel(open){if($('pomodoro-panel'))$('pomodoro-panel').hidden=!open;$('pomodoro-toggle')?.setAttribute('aria-expanded',String(open));}
$('pomodoro-toggle')?.addEventListener('click',()=>panel($('pomodoro-panel').hidden));$('pomodoro-close')?.addEventListener('click',()=>panel(false));

let zenOpener=null;
function setZenMode(active){
 const isZen=document.body?.classList.contains('focus-zen-active');
 if(active===isZen)return;
 if(active){
  zenOpener=document.activeElement;
  document.body?.classList.add('focus-zen-active');
  $('focus-zen-toggle')?.setAttribute('aria-pressed','true');
  $('focus-zen-close')?.focus();
 }else{
  document.body?.classList.remove('focus-zen-active');
  $('focus-zen-toggle')?.setAttribute('aria-pressed','false');
  if(zenOpener&&typeof zenOpener.focus==='function')zenOpener.focus();
  else $('focus-zen-toggle')?.focus();
 }
}
function toggleZenMode(){setZenMode(!document.body?.classList.contains('focus-zen-active'));}
$('focus-zen-toggle')?.addEventListener('click',toggleZenMode);
$('focus-zen-close')?.addEventListener('click',()=>setZenMode(false));

function isInputActive(target){
 if(!target)return false;
 const tag=target.tagName?target.tagName.toUpperCase():'';
 return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||Boolean(target.isContentEditable);
}

window.addEventListener('storage',e=>{if(key&&e.key===key){state=reconcileFocus(load(),Date.now()).state;paint();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&key){state=load();pulse();}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if(document.body?.classList.contains('focus-zen-active')){setZenMode(false);e.preventDefault();return;}
  panel(false);
  return;
 }
 if(isInputActive(e.target)||e.metaKey||e.ctrlKey||e.altKey)return;
 const k=e.key?e.key.toLowerCase():'';
 if(e.code==='Space'||e.key===' '){
  e.preventDefault();
  if(state.remainingSeconds===0&&!state.isRunning){
   advanceToNextPhase();
  }else{
   unlockAudio();mutate('toggle');
  }
 }else if(k==='r'){
  e.preventDefault();mutate('reset');
 }else if(k==='m'){
  e.preventDefault();unlockAudio();mutate('sound');
 }else if(k==='z'){
  e.preventDefault();toggleZenMode();
 }
});
async function init(){try{
 const client=await getSupabase(),{data,error}=await client.auth.getSession();if(error||!data.session)return;
 const uid=data.session.user.id;key='lanmao_focus_v3_'+uid;state=reconcileFocus(load(),Date.now()).state;persist();
 client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==uid)){ended=true;clearInterval(timer);setZenMode(false);state=freshFocus(Date.now());document.title=originalTitle||'Lanmao Space | 蓝昴空间';paint();panel(false);audio?.close().catch(()=>{});}});
 notify('仅保存于此账号的当前浏览器；手机 App 与其他设备分别计时。锁屏提示受系统限制。');
 paint();timer=setInterval(pulse,1000);
}catch{notify('专注钟暂不可用，请联网并登录后重试。');}}
paint();init();
