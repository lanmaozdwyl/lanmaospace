import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportMetrics, installViewport} from '../lib/viewport.mjs';
import {initTheme} from '../lib/theme.mjs';

test('键盘缩小可见区域和页面平移后，弹窗取得真实宽高与偏移', () => {
    assert.deepEqual(viewportMetrics({width:390,height:330,offsetTop:80,offsetLeft:0},{innerWidth:390,innerHeight:844}), {width:390,height:330,top:80,left:0});
    assert.deepEqual(viewportMetrics(undefined,{innerWidth:320,innerHeight:568}), {width:320,height:568,top:0,left:0});
    assert.deepEqual(viewportMetrics({width:NaN,height:0,offsetTop:-20,offsetLeft:Infinity},{}), {width:360,height:640,top:0,left:0});
});

test('视口变化更新弹窗边界，打开/关闭状态同步且重复安装不会重复监听', () => {
    const target = () => ({events:new Map(),addEventListener(k,f){this.events.set(k,f);},removeEventListener(k){this.events.delete(k);}});
    const styles=new Map(),classes=new Set(),frames=new Map();let frame=0,open=false,observer;
    const root={style:{setProperty:(k,v)=>styles.set(k,v)}};
    const doc=Object.assign(target(),{body:{classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}},querySelector:()=>open?{}:null});
    const visual=Object.assign(target(),{width:390,height:844,offsetTop:0,offsetLeft:0});
    const win=Object.assign(target(),{visualViewport:visual,requestAnimationFrame:f=>{frames.set(++frame,f);return frame;},cancelAnimationFrame:n=>frames.delete(n),MutationObserver:class{constructor(f){observer=f;}observe(){}disconnect(){}}});
    const dispose=installViewport({root,doc,win});assert.equal(installViewport({root,doc,win}),dispose);
    visual.height=330;visual.offsetTop=70;open=true;visual.events.get('resize')();observer();
    assert.equal(frames.size,1);for(const f of frames.values())f();frames.clear();
    assert.equal(styles.get('--ui-height'),'330px');assert.equal(styles.get('--ui-top'),'70px');assert(classes.has('mobile-dialog-open'));
    open=false;doc.events.get('close')();assert(!classes.has('mobile-dialog-open'), '恢复焦点前同步取消底栏隐藏');
    dispose();assert.equal(visual.events.size,0);
});

test('手机和桌面主题入口共用状态，深色切浅色同时更新根节点、正文和按钮', () => {
    const root={dataset:{}},body={dataset:{}},handlers={},saved=new Map();
    const button={setAttribute(k,v){this[k]=v;},addEventListener(k,f){handlers[k]=f;}};
    const theme=initTheme({root,body,button,storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},media:{matches:true,addEventListener(){}}});
    handlers.click();assert.equal(root.dataset.theme,'light');assert.equal(body.dataset.theme,'light');
    theme.toggle();assert.equal(root.dataset.theme,'dark');assert.equal(body.dataset.theme,'dark');
    theme.toggle();assert.equal(root.dataset.theme,'light');assert.equal(body.dataset.theme,'light');assert.equal(button['aria-label'],'切换至暗色模式');assert.equal(saved.get('lanmao_theme'),'light');
});

test('本地存储被禁用时，主题切换仍然可用', () => {
    const root={dataset:{}},body={dataset:{}};
    const theme=initTheme({root,body,storage:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}},media:{matches:false,addEventListener(){}}});
    assert.doesNotThrow(()=>theme.toggle());assert.equal(root.dataset.theme,'dark');assert.equal(body.dataset.theme,'dark');
});

test('首页联系方式：一键复制 QQ 号与双通道剪贴板降级支持', async () => {
    const { readFileSync } = await import('node:fs');
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const scriptJs = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    // 1. HTML 节点结构与辅助功能属性
    assert(indexHtml.includes('id="contact-copy-qq-btn"'), '联系卡片需包含快捷复制 QQ 按钮');
    assert(indexHtml.includes('id="contact-qq-feedback"'), '需包含复制成功状态反馈提示节点');
    assert(indexHtml.includes('3126477562'), '需明文展示真实 QQ 号码');

    // 2. CSS 样式规范
    assert(styleCss.includes('.contact-item-group'), '需定义联系项并排响应式容器');
    assert(styleCss.includes('.contact-copy-btn'), '需定义一键复制按钮样式');
    assert(styleCss.includes('.contact-feedback'), '需定义复制成功轻量提示反馈样式');

    // 3. JS 双通道剪贴板复制逻辑
    assert(scriptJs.includes('initContactCopyQQ'), '需定义首页 QQ 复制初始化函数');
    assert(scriptJs.includes('3126477562'), '复制目标需为精确 QQ 号');
    assert(scriptJs.includes('navigator.clipboard'), '需优先调用系统原生剪贴板 API');
    assert(scriptJs.includes('execCommand'), '需包含 textarea 降级复制机制，保证微信/内嵌视窗兼容性');
});
