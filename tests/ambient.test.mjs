import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {AMBIENT_SOUNDS, AmbientPlayer} from '../lib/ambient.mjs';
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(o={}){
 const nodes=[],tasks=new Map();let n=0,fetches=0;
 const param=()=>({value:1,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}});
 const context={currentTime:0,state:'running',destination:{},resume:o.resume||(()=>Promise.resolve()),decodeAudioData:o.decode||(()=>Promise.resolve({duration:46})),createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBufferSource(){const x={starts:0,stops:0,connect(){},disconnect(){},start(){this.starts++;},stop(){this.stops++;}};nodes.push(x);return x;}};
 const player=new AmbientPlayer({createContext:()=>context,schedule:fn=>{tasks.set(++n,fn);return n;},cancel:n=>tasks.delete(n),fetchAudio:o.fetch|| (async()=>{fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};})});
 return {player,nodes,tasks,get fetches(){return fetches;},flush(){for(const [key,fn] of [...tasks]){tasks.delete(key);fn();}}};
}
test('按需加载、循环播放，音量可归零',async()=>{const f=fixture();assert.equal(f.fetches,0);await f.player.play();assert.equal(f.fetches,1);assert.equal(f.nodes[0].loop,true);assert.equal(f.player.state,'playing');f.player.setVolume(0);assert.equal(f.player.gain.gain.value,0);});
test('快速暂停重播，旧淡出不能停止新声音，缓存避免重复下载',async()=>{const f=fixture();await f.player.play();f.player.pause();await f.player.play();f.flush();assert.equal(f.nodes[0].stops,1);assert.equal(f.nodes[1].stops,0);assert.equal(f.fetches,1);});
test('快速换声，旧加载结果不能覆盖新选择',async()=>{let resolve;const f=fixture({fetch:async u=>u.includes('stream')?new Promise(r=>resolve=r):{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}});const old=f.player.play();await tick();await f.player.play('forest');resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});await old;assert.equal(f.player.current,'forest');assert.equal(f.nodes.length,1);assert.deepEqual([...f.player.cache.keys()],['forest']);});
test('加载中取消，迟到的解码不能播放',async()=>{let resolve;const f=fixture({decode:()=>new Promise(r=>resolve=r)});const p=f.player.play();await tick();f.player.pause();resolve({});await p;assert.equal(f.nodes.length,0);assert.equal(f.player.state,'paused');});
test('网络错误可显示失败并重试',async()=>{let fail=true;const f=fixture({fetch:async()=>({ok:!fail,arrayBuffer:async()=>new ArrayBuffer(4)})});await f.player.play();assert.equal(f.player.state,'error');fail=false;await f.player.play();assert.equal(f.player.state,'playing');});
test('系统拒绝恢复或坏音频解码时都退出加载',async()=>{for(const o of [{resume:()=>Promise.reject(Error())},{decode:()=>Promise.reject(Error())}]){const f=fixture(o);await f.player.play();assert.equal(f.player.state,'error');assert.equal(f.nodes.length,0);}});
test('恢复一直未完成也能在超时后退出',async()=>{const f=fixture({resume:()=>new Promise(()=>{})});const p=f.player.play();f.flush();await p;assert.equal(f.player.state,'error');});
test('浏览器原生 fetch 和计时器不被播放器重新绑定接收者',async()=>{
 const saved={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const f=fixture();await f.player.play();let requests=0;
 try {
  globalThis.setTimeout=function(){assert.equal(this,undefined);return 1;};
  globalThis.clearTimeout=function(){assert.equal(this,undefined);};
  globalThis.fetch=async function(){assert.equal(this,undefined);requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};};
  const player=new AmbientPlayer({createContext:()=>f.player.context});await player.play();assert.equal(player.state,'playing');assert.equal(requests,1);player.dispose();
 } finally {Object.assign(globalThis,saved);}
});
test('缓存最多两段；离开页面清理节点和缓存',async()=>{const f=fixture();for(const id of ['stream','forest','waves'])await f.player.play(id);assert.deepEqual([...f.player.cache.keys()],['forest','waves']);f.player.dispose();assert.equal(f.player.cache.size,0);assert.equal(f.player.retiring.size,0);assert(f.nodes.every(n=>n.stops===1));});
function uiFixture(o = {}){
 const elements=new Map(),handlers={},tasks=new Map();let now=0,task=0;
 const storage = o.storage || new Map();
 const localStorage = {
  getItem: k => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k)
 };
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'40',checked:true,dataset:{},events:{},textContent:'',attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},append(){},focus(){this.focused=true;}});return elements.get(id);};
 const cards=AMBIENT_SOUNDS.map(s=>Object.assign(el(s.id),{dataset:{sound:s.id}}));const pills=[0,900,1800,3600].map(n=>Object.assign(el(String(n)),{dataset:{timer:String(n)}}));
 const f=fixture();class Player{constructor({onState}){f.player.onState=onState;return f.player;}}
 const document={getElementById:el,createElement:el,querySelectorAll:s=>s.includes('sound-card')?cards:pills,addEventListener:(k,fn)=>handlers[k]=fn};
 const code=fs.readFileSync(new URL('../ambient.js',import.meta.url),'utf8').replace(/^import .*;\s*/,'');
 vm.runInNewContext(code,{AMBIENT_SOUNDS,AmbientPlayer:Player,document,window:{addEventListener:(k,fn)=>handlers[k]=fn},Date:{now:()=>now},setTimeout:fn=>{tasks.set(++task,fn);return task;},clearTimeout:id=>tasks.delete(id),localStorage});
 return {...f,el,cards,pills,storage,signal:d=>handlers['lanmao-focus-state']({detail:d}),advance:ms=>{now+=ms;handlers.visibilitychange();}};
}
test('仅本页主动开始专注才播放，跨标签恢复不播放，休息暂停',async()=>{const f=uiFixture();f.signal({running:true,mode:'focus',allowStart:false});await tick();assert.equal(f.nodes.length,0);f.signal({running:true,mode:'focus',allowStart:true});await tick();assert.equal(f.player.state,'playing');f.signal({running:false,mode:'break'});assert.equal(f.player.state,'paused');f.el('ambient-pomodoro-sync').checked=false;f.signal({running:true,mode:'focus',allowStart:true});await tick();assert.equal(f.player.state,'paused');});
test('键盘切换更新焦点和单选状态，点击当前声音暂停',async()=>{const f=uiFixture();f.cards[0].events.keydown({key:'End',preventDefault(){}});await tick();assert.equal(f.player.current,'forest');assert(f.cards.at(-1).focused);assert.equal(f.cards.at(-1).attrs['aria-checked'],'true');f.cards.at(-1).events.click();assert.equal(f.player.state,'paused');});
test('后台恢复时按真实截止时间停止定时播放',async()=>{const f=uiFixture();f.el('ambient-master-play').events.click();await tick();f.pills[1].events.click();f.advance(901000);assert.equal(f.player.state,'paused');assert.match(f.el('ambient-current-status').textContent,/定时已结束/);assert.equal(f.pills[0].attrs['aria-pressed'],'true');});
test('8段音频授权、哈希、体积和雨声强弱顺序正确',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),manifest=JSON.parse(fs.readFileSync(new URL('../audio/manifest.json',import.meta.url)));assert.equal(AMBIENT_SOUNDS.length,8);assert.equal(manifest.length,8);let bytes=0;for(const s of AMBIENT_SOUNDS){assert(html.includes(`data-sound="${s.id}"`));assert(s.credits.every(c=>c.author&&c.url.startsWith('https://')&&c.licenseUrl));const e=manifest.find(m=>m.id===s.id),data=fs.readFileSync(new URL('..'+s.url,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),e.sha256);assert(e.bytes<600000&&e.seconds>=40&&e.peak<.85);bytes+=data.length;}assert(bytes<4600000);const rms=id=>manifest.find(m=>m.id===id).rms;assert(rms('rain-light')<rms('rain-medium'));assert(rms('rain-medium')<rms('rain-heavy'));});

test('伴读声音系统升级：音量数值实时反馈、本地持久化记忆与一键静音/恢复', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    // 1. 结构与样式完整性验证
    assert(html.includes('id="ambient-vol-mute"'), '需包含静音/恢复控制按钮');
    assert(html.includes('id="ambient-vol-icon"'), '需包含音量图标标识');
    assert(html.includes('id="ambient-vol-value"'), '需包含音量百分比实时数值标签');
    assert(css.includes('.ambient-vol-btn'), '需定义音量控制按钮样式');
    assert(css.includes('.ambient-vol-value'), '需定义音量数值显示样式');

    // 2. 初始默认渲染（40% 音量）
    const f1 = uiFixture();
    assert.equal(f1.el('ambient-vol-value').textContent, '40%');
    assert.equal(f1.el('ambient-vol-icon').textContent, '🔉');
    assert.equal(f1.el('ambient-vol-mute').attrs['aria-label'], '静音声音');
    assert.equal(f1.player.volume, 0.4);

    // 3. 拖动调节音量与状态持久化
    f1.el('ambient-volume').value = '80';
    f1.el('ambient-volume').events.input({ target: { value: '80' } });
    assert.equal(f1.el('ambient-vol-value').textContent, '80%');
    assert.equal(f1.el('ambient-vol-icon').textContent, '🔊');
    assert.equal(f1.player.volume, 0.8);
    assert.equal(f1.storage.get('lanmao_ambient_vol_v1'), '80');

    // 4. 一键极速静音与恢复
    f1.el('ambient-vol-mute').events.click();
    assert.equal(f1.el('ambient-volume').value, '0');
    assert.equal(f1.el('ambient-vol-value').textContent, '0%');
    assert.equal(f1.el('ambient-vol-icon').textContent, '🔇');
    assert.equal(f1.el('ambient-vol-mute').attrs['aria-label'], '恢复音量');
    assert.equal(f1.player.volume, 0);
    assert.equal(f1.storage.get('lanmao_ambient_vol_v1'), '0');

    // 再次点击：恢复至静音前的 80%
    f1.el('ambient-vol-mute').events.click();
    assert.equal(f1.el('ambient-volume').value, '80');
    assert.equal(f1.el('ambient-vol-value').textContent, '80%');
    assert.equal(f1.el('ambient-vol-icon').textContent, '🔊');
    assert.equal(f1.el('ambient-vol-mute').attrs['aria-label'], '静音声音');
    assert.equal(f1.player.volume, 0.8);
    assert.equal(f1.storage.get('lanmao_ambient_vol_v1'), '80');

    // 5. 跨会话/刷新恢复已有音量记忆
    const customStorage = new Map([['lanmao_ambient_vol_v1', '15']]);
    const f2 = uiFixture({ storage: customStorage });
    assert.equal(f2.el('ambient-vol-value').textContent, '15%');
    assert.equal(f2.el('ambient-vol-icon').textContent, '🔉');
    assert.equal(f2.player.volume, 0.15);
});

test('伴读白噪音触控滑块防误滚与静音/定时人机工程学：44px 靶心与 touch-action 防误滑', () => {
    const styleCss = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    assert(styleCss.includes('.ambient-vol-slider') && styleCss.includes('touch-action: none'), '音量滑块必须配置 touch-action: none 消除水平拖动引发纵向页面晃动');
    assert(/@media\s*\([^)]*max-width:\s*600px[^)]*\)[\s\S]*?\.ambient-vol-btn\s*\{[^}]*min-width:\s*44px/i.test(styleCss), '手机窄屏下静音按钮需配置不低于 44px 靶心');
    assert(/@media\s*\([^)]*max-width:\s*600px[^)]*\)[\s\S]*?\.ambient-vol-slider::-webkit-slider-thumb\s*\{[^}]*width:\s*22px/i.test(styleCss), '手机窄屏下滑块 thumb 需放大至 22px 方便触控');
    assert(/@media\s*\([^)]*max-width:\s*600px[^)]*\)[\s\S]*?\.ambient-timer-pill\s*\{[^}]*min-height:\s*44px/i.test(styleCss), '定时胶囊需具备 44px 人机工程学高度');
});

test('伴读声音防挂死升级：音频拉取并行不被挂起的恢复阻断，且支持非根路径相对回退与预解锁', async () => {
    // 1. 网络拉取不被挂起的 resume 阻塞
    let fetchStarted = false;
    let finishResume;
    const pendingResume = new Promise(r => { finishResume = r; });
    const f = fixture({
        resume: () => pendingResume,
        fetch: async () => {
            fetchStarted = true;
            return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
        }
    });

    const playPromise = f.player.play();
    await tick();
    // 此时 resume 仍在 pending，但 fetch 必须已启动
    assert.equal(fetchStarted, true, '即使 resume 尚未 resolve，fetch 也应立即并发启动');
    assert.equal(f.player.state, 'loading');

    // 恢复完成，播放顺畅开始
    finishResume();
    await playPromise;
    assert.equal(f.player.state, 'playing');

    // 2. 根路径 404 时自动降级为相对路径拉取
    const requestedUrls = [];
    const fFallback = fixture({
        fetch: async url => {
            requestedUrls.push(url);
            if (url.startsWith('/audio/')) {
                return { ok: false, status: 404, headers: new Map() };
            }
            return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8), headers: new Map() };
        }
    });
    await fFallback.player.play('stream');
    assert.deepEqual(requestedUrls, ['/audio/stream.mp3', 'audio/stream.mp3'], '首选 /audio 失败时应尝试相对路径 audio/');
    assert.equal(fFallback.player.state, 'playing');

    // 3. 支持预解锁 unlock()
    assert.equal(typeof f.player.unlock, 'function', '播放器必须导出 unlock 方法用于手势唤醒');
    f.player.unlock();
});

test('学术专注钟与伴读声音全链路双向联动：主卡片与悬浮钟联动开关、状态双向同步、休息自动淡出与持久化', async () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    const ambientJs = fs.readFileSync(new URL('../ambient.js', import.meta.url), 'utf8');
    const focusJs = fs.readFileSync(new URL('../focus.js', import.meta.url), 'utf8');

    // 1. HTML 节点结构完整性
    assert(html.includes('id="focus-ambient-toggle"'), '主专注卡片必须包含伴读白噪音联动开关');
    assert(html.includes('id="pomodoro-ambient-toggle"'), '悬浮番茄钟小面板必须包含伴读联动按钮');
    assert(html.includes('id="ambient-pomodoro-sync"'), '声音面板必须包含专注钟联动选项');

    // 2. CSS 样式与深浅模式状态
    assert(css.includes('.pomodoro-act-ambient'), '需定义小面板伴读联动按钮样式');
    assert(css.includes('.focus-btn-icon.off') || css.includes('.pomodoro-act-ambient.off'), '需定义联动关闭时的置灰样式');

    // 3. JavaScript 双向联动状态机与持久化键名
    assert(ambientJs.includes('lanmao_ambient_sync_v1'), 'ambient.js 需使用统一的本地持久化存储键名');
    assert(focusJs.includes('lanmao_ambient_sync_v1'), 'focus.js 需使用统一的本地持久化存储键名');
    assert(focusJs.includes('function syncAmbientButton'), 'focus.js 必须具备联动状态按钮同步函数');
    assert(focusJs.includes('function toggleAmbientSync'), 'focus.js 必须具备联动状态切换函数');
    assert(ambientJs.includes('function syncAmbientSyncUI'), 'ambient.js 必须具备全站联动 UI 同步函数');
    assert(ambientJs.includes('lanmao-ambient-sync-changed'), '需分发或监听全站联动设置变更事件');

    // 4. 模拟运行联动流程：专注开始自动播放、休息自动静音淡出
    const f = uiFixture();
    // 默认开启联动，专注开始自动播放
    f.signal({ running: true, mode: 'focus', allowStart: true });
    await tick();
    assert.equal(f.player.state, 'playing', '开启联动时，开始深度专注必须自动播放伴读声音');

    // 切换至休息模式，伴读声音自动静音暂停
    f.signal({ running: true, mode: 'short-break', allowStart: true });
    await tick();
    assert.equal(f.player.state, 'paused', '进入小憩休息模式时，伴读声音必须自动静音暂停');
    assert(f.el('ambient-current-status').textContent.includes('休息') || f.el('ambient-current-status').textContent.includes('暂停'), '休息暂停时需提供贴心状态反馈');

    // 关闭联动开关后，开始专注不再自动播放
    f.el('ambient-pomodoro-sync').checked = false;
    f.signal({ running: true, mode: 'focus', allowStart: true });
    await tick();
    assert.equal(f.player.state, 'paused', '关闭联动开关后，开始专注不得擅自自动播放声音');
});

