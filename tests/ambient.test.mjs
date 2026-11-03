import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');const code=source.slice(source.indexOf('// ===== Ambient Focus Sounds'),source.indexOf('// ===== Register PWA'));
function fixture(){
 const handlers={},elements=new Map(),timers=new Map();let timerId=0,starts=0,stops=0;
 function el(id){if(!elements.has(id))elements.set(id,{textContent:'',value:'65',checked:true,dataset:{},events:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(k,fn){this.events[k]=fn;}});return elements.get(id);}
 const cards=['rain','brown'].map(k=>{const e=el(k);e.dataset.sound=k;return e;});
 const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}});
 function node(stoppable=false){const n={gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){}};if(stoppable){n.start=()=>starts++;n.stop=()=>stops++;}return n;}
 class Audio{constructor(){this.sampleRate=16;this.currentTime=0;this.state='running';this.destination={};}createGain(){return node();}createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}createBufferSource(){return node(true);}createBiquadFilter(){return node();}createOscillator(){return node(true);}}
 const ctx={window:{AudioContext:Audio,addEventListener:(name,fn)=>handlers[name]=fn},document:{getElementById:el,querySelectorAll:selector=>selector==='.ambient-sound-card'?cards:[]},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(code,ctx);return {el,signal:detail=>handlers['lanmao-focus-state']({detail}),flush:()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}},get starts(){return starts;},get stops(){return stops;}};
}
test('本页主动开始专注触发播放，完成或休息停止声音',()=>{const f=fixture();f.signal({running:true,mode:'focus',allowStart:true});assert.equal(f.starts,1);assert.equal(f.el('ambient-play-label').textContent,'暂停声音');f.signal({running:false,mode:'focus'});assert.equal(f.el('ambient-play-label').textContent,'开启声音');f.flush();assert.equal(f.stops,1);});
test('跨标签恢复或页面加载不自动播音，取消联动后不受专注状态影响',()=>{const f=fixture();f.signal({running:true,mode:'focus',allowStart:false});assert.equal(f.starts,0);f.el('ambient-pomodoro-sync').checked=false;f.signal({running:true,mode:'focus',allowStart:true});assert.equal(f.starts,0);});
test('暂停后快速重新播放，旧淡出回调不能停止新声音',()=>{const f=fixture(),play=f.el('ambient-master-play').events.click;play();play();play();assert.equal(f.starts,2);assert.equal(f.stops,1);f.flush();assert.equal(f.stops,1);assert.equal(f.el('ambient-play-label').textContent,'暂停声音');});
