// 只保存当前账号在当前浏览器的数据；不提供跨设备同步。
export const MODES = Object.freeze({focus:1500,'short-break':300,'long-break':900});
export function dayAt(ms){const d=new Date(ms);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
export function freshFocus(now){return {mode:'focus',remainingSeconds:1500,isRunning:false,endTime:0,sound:true,date:dayAt(now),completedCount:0,totalMinutes:0};}
export function readFocus(raw,now){
 const s=freshFocus(now);let p;try{p=JSON.parse(raw);}catch{return s;}if(!p||typeof p!=='object')return s;
 s.mode=Object.hasOwn(MODES,p.mode)?p.mode:'focus';const max=MODES[s.mode];
 s.remainingSeconds=Number.isFinite(p.remainingSeconds)?Math.max(0,Math.min(max,Math.ceil(p.remainingSeconds))):max;
 s.sound=p.sound!==false;s.date=typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)?p.date:s.date;
 for(const k of ['completedCount','totalMinutes'])s[k]=Number.isSafeInteger(p[k])&&p[k]>=0?Math.min(p[k],100000000):0;
 s.endTime=Number.isFinite(p.endTime)&&p.endTime>0&&p.endTime<=now+max*1000?p.endTime:0;s.isRunning=p.isRunning===true&&s.endTime>0;
 return s;
}
export function reconcileFocus(input,now){
 const s={...input};const today=dayAt(now);let completed=false;
 if(s.date!==today){s.date=today;s.completedCount=0;}
 if(s.isRunning){
  s.remainingSeconds=Math.max(0,Math.ceil((s.endTime-now)/1000));
  if(s.remainingSeconds===0){completed=true;s.isRunning=false;
   if(s.mode==='focus'){if(dayAt(s.endTime)===today)s.completedCount++;s.totalMinutes+=MODES[s.mode]/60;}
   s.endTime=0;
  }
 }
 return {state:s,completed};
}
export function changeFocus(input,action,now){
 let {state:s,completed}=reconcileFocus(input,now);
 if(action==='toggle'){if(s.isRunning){s.isRunning=false;s.endTime=0;}else{s.remainingSeconds=s.remainingSeconds||MODES[s.mode];s.endTime=now+s.remainingSeconds*1000;s.isRunning=true;}}
 else if(action==='reset'){s.remainingSeconds=MODES[s.mode];s.isRunning=false;s.endTime=0;}
 else if(action==='sound')s.sound=!s.sound;
 else if(Object.hasOwn(MODES,action)){s.mode=action;s.remainingSeconds=MODES[action];s.isRunning=false;s.endTime=0;}
 return {state:s,completed};
}
