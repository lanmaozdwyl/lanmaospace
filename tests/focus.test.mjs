import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshFocus,readFocus,reconcileFocus,changeFocus} from '../lib/focus.mjs';
const now=new Date(2026,10,3,12,0,0).getTime();
test('倒计时按真实经过时间恢复，暂停不丢失后台经过时间',()=>{const s=changeFocus(freshFocus(now),'toggle',now).state;const paused=changeFocus(s,'toggle',now+12500).state;assert.equal(paused.remainingSeconds,1488);assert.equal(paused.isRunning,false);assert.equal(paused.endTime,0);});
test('同一轮完成只累计一次',()=>{const s=changeFocus(freshFocus(now),'toggle',now).state;const first=reconcileFocus(s,now+1500000);assert(first.completed);assert.equal(first.state.completedCount,1);assert.equal(first.state.totalMinutes,25);const again=reconcileFocus(first.state,now+1600000);assert.equal(again.completed,false);assert.equal(again.state.completedCount,1);});
test('跨午夜重置今日次数，保留累计时长',()=>{const before=new Date(2026,10,3,23,59,59).getTime();const s={...freshFocus(before),completedCount:2,totalMinutes:50,isRunning:true,endTime:before+2000};const {state}=reconcileFocus(s,before+3000);assert.equal(state.date,'2026-11-04');assert.equal(state.completedCount,1);assert.equal(state.totalMinutes,75);});
test('隔天打开不会把昨日已结束计时计为今天完成',()=>{const s=changeFocus(freshFocus(now),'toggle',now).state;const {state}=reconcileFocus(s,now+86400000);assert.equal(state.completedCount,0);assert.equal(state.totalMinutes,25);assert.equal(reconcileFocus(state,now+86401000).state.totalMinutes,25);});
test('休息完成不增加专注统计，切换模式停止旧计时',()=>{const s=changeFocus(freshFocus(now),'short-break',now).state;const running=changeFocus(s,'toggle',now).state;assert.equal(reconcileFocus(running,now+300000).state.completedCount,0);const next=changeFocus(running,'long-break',now+1000).state;assert.equal(next.isRunning,false);assert.equal(next.remainingSeconds,900);});
test('损坏或不可信本地数据不能变成 HTML 或无穷计时',()=>{assert.deepEqual(readFocus('{bad',now),freshFocus(now));const s=readFocus(JSON.stringify({mode:'constructor',completedCount:'<img>',totalMinutes:-5,remainingSeconds:1e100,endTime:now+9e12,isRunning:true}),now);assert.equal(s.mode,'focus');assert.equal(s.completedCount,0);assert.equal(s.totalMinutes,0);assert.equal(s.remainingSeconds,1500);assert.equal(s.isRunning,false);});
test('重置和提示音设置不重置已有专注统计',()=>{const s={...freshFocus(now),completedCount:4,totalMinutes:100};const next=changeFocus(changeFocus(s,'reset',now).state,'sound',now).state;assert.equal(next.completedCount,4);assert.equal(next.totalMinutes,100);assert.equal(next.sound,false);});

test('学术专注钟：桌面端快捷键（Space启停/R重置/M提示音/Z禅定）与沉浸全屏禅定模式', () => {
    const focusJs = readFileSync(new URL('../focus.js', import.meta.url), 'utf8');
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    // 1. HTML 节点规范与辅助功能
    assert(indexHtml.includes('id="focus-zen-toggle"'), '首页专注卡片需包含禅定模式开关按钮');
    assert(indexHtml.includes('id="focus-zen-close"'), '首页专注卡片需包含退出禅定模式关闭按钮');
    assert(indexHtml.includes('focus-shortcuts-hint'), '需提供桌面快捷键操作指引提示区');
    assert(indexHtml.includes('<kbd>Space</kbd>'), '快捷键提示需标明 Space 启停');

    // 2. CSS 样式与全屏禅定覆盖
    assert(styleCss.includes('body.focus-zen-active'), '需定义全屏禅定激活类样式');
    assert(styleCss.includes('.focus-zen-close-btn'), '需定义禅定模式退出按钮样式');
    assert(styleCss.includes('.focus-shortcuts-hint'), '需定义快捷键指示区样式');

    // 3. focus.js 状态机与按键分流交互
    assert(focusJs.includes('function setZenMode('), '需包含禅定模式切换与焦点管理函数');
    assert(focusJs.includes('function isInputActive('), '必须包含输入控件防误触探测函数，避免在输入时拦截打字');
    assert(focusJs.includes("'focus-zen-active'"), '需操作 body 的 focus-zen-active 类');
    assert(focusJs.includes('e.code===\'Space\'') || focusJs.includes("e.code === 'Space'"), '需监听 Space 空格键启停');
    assert(focusJs.includes('Escape'), '需支持 Esc 键极速退出禅定模式');
    assert(focusJs.includes('zenOpener'), '退出禅定模式时需安全无损将焦点恢复给触发源');
});
