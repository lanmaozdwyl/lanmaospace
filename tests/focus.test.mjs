import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MODES,freshFocus,readFocus,reconcileFocus,changeFocus} from '../lib/focus.mjs';
const now=new Date(2026,10,3,12,0,0).getTime();
test('倒计时按真实经过时间恢复，暂停不丢失后台经过时间',()=>{const s=changeFocus(freshFocus(now),'toggle',now).state;const paused=changeFocus(s,'toggle',now+12500).state;assert.equal(paused.remainingSeconds,1488);assert.equal(paused.isRunning,false);assert.equal(paused.endTime,0);});
test('同一轮完成只累计一次',()=>{const s=changeFocus(freshFocus(now),'toggle',now).state;const first=reconcileFocus(s,now+1500000);assert(first.completed);assert.equal(first.state.completedCount,1);assert.equal(first.state.totalMinutes,25);const again=reconcileFocus(first.state,now+1600000);assert.equal(again.completed,false);assert.equal(again.state.completedCount,1);});
test('跨午夜重置今日次数，保留累计时长',()=>{const before=new Date(2026,10,3,23,59,59).getTime();const s={...freshFocus(before),completedCount:2,totalMinutes:50,isRunning:true,endTime:before+2000};const {state}=reconcileFocus(s,before+3000);assert.equal(state.date,'2026-11-04');assert.equal(state.completedCount,1);assert.equal(state.totalMinutes,75);});
test('隔天打开不会把昨日已结束计时计为今天完成',()=>{const s=changeFocus(freshFocus(now),'toggle',now).state;const {state}=reconcileFocus(s,now+86400000);assert.equal(state.completedCount,0);assert.equal(state.totalMinutes,25);assert.equal(reconcileFocus(state,now+86401000).state.totalMinutes,25);});
test('休息完成不增加专注统计，切换模式停止旧计时',()=>{const s=changeFocus(freshFocus(now),'short-break',now).state;const running=changeFocus(s,'toggle',now).state;assert.equal(reconcileFocus(running,now+300000).state.completedCount,0);const next=changeFocus(running,'long-break',now+1000).state;assert.equal(next.isRunning,false);assert.equal(next.remainingSeconds,900);});
test('损坏或不可信本地数据不能变成 HTML 或无穷计时',()=>{assert.deepEqual(readFocus('{bad',now),freshFocus(now));const s=readFocus(JSON.stringify({mode:'constructor',completedCount:'<img>',totalMinutes:-5,remainingSeconds:1e100,endTime:now+9e12,isRunning:true}),now);assert.equal(s.mode,'focus');assert.equal(s.completedCount,0);assert.equal(s.totalMinutes,0);assert.equal(s.remainingSeconds,1500);assert.equal(s.isRunning,false);});
test('重置和提示音设置不重置已有专注统计',()=>{const s={...freshFocus(now),completedCount:4,totalMinutes:100};const next=changeFocus(changeFocus(s,'reset',now).state,'sound',now).state;assert.equal(next.completedCount,4);assert.equal(next.totalMinutes,100);assert.equal(next.sound,false);});

test('已聚焦的按钮保留原生空格操作，页面空格仍可启停', async () => {
    const handlers = new Map();
    const storage = new Map();
    const key = 'lanmao_focus_v3_test';
    const on = (event, handler) => handlers.set(event, handler);
    const code = readFileSync(new URL('../focus.js', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
    vm.runInNewContext(code, {
        MODES, freshFocus, readFocus, reconcileFocus, changeFocus,
        document: {getElementById: () => null, querySelectorAll: () => [], addEventListener: on},
        window: {dispatchEvent() {}, addEventListener: on}, CustomEvent: class {},
        localStorage: {getItem: name => storage.get(name) ?? null, setItem: (name, value) => storage.set(name, value)},
        navigator: {}, setInterval() {},
        getSupabase: async () => ({auth: {
            async getSession() { return {data: {session: {user: {id: 'test'}}}}; },
            onAuthStateChange() {},
        }}),
    });
    function space(overrides = {}) {
        const event = {key: ' ', code: 'Space', preventDefault() {this.defaultPrevented = true;}, ...overrides};
        handlers.get('keydown')(event);
        return Boolean(event.defaultPrevented);
    }
    assert.equal(space(), false);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(space({target: {closest: selectors => selectors.includes('button') ? {} : null}}), false);
    assert.equal(JSON.parse(storage.get(key)).isRunning, false);
    assert.equal(space(), true);
    assert.equal(JSON.parse(storage.get(key)).isRunning, true);
    assert.equal(space({repeat: true}), false);
    assert.equal(JSON.parse(storage.get(key)).isRunning, true);
    assert.equal(space(), true);
    assert.equal(JSON.parse(storage.get(key)).isRunning, false);
});

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

test('学术专注钟：专注与小憩无缝轮转进阶胶囊导引与一键开启心流闭环', () => {
    const focusJs = readFileSync(new URL('../focus.js', import.meta.url), 'utf8');
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    // 1. HTML 节点结构与无障碍标记
    assert(indexHtml.includes('id="focus-next-action-wrap"'), '主专注卡片需包含轮转进阶胶囊容器');
    assert(indexHtml.includes('id="focus-next-pill-btn"'), '主专注卡片需包含进阶操作按钮');
    assert(indexHtml.includes('id="focus-next-pill-text"'), '需包含动态提示文案载体');
    assert(indexHtml.includes('id="pomodoro-next-wrap"'), '悬浮番茄钟小面板需包含轮转导引容器');
    assert(indexHtml.includes('id="pomodoro-next-btn"'), '悬浮番茄钟小面板需包含进阶按钮');

    // 2. CSS 样式设计与动效
    assert(styleCss.includes('.focus-next-action-wrap'), '需定义主卡片轮转胶囊容器样式');
    assert(styleCss.includes('.focus-next-pill-btn'), '需定义主卡片轮转进阶按钮样式');
    assert(styleCss.includes('.pomodoro-next-wrap'), '需定义悬浮小卡片轮转胶囊容器样式');
    assert(styleCss.includes('.pomodoro-next-btn'), '需定义悬浮小卡片轮转按钮样式');
    assert(styleCss.includes('@keyframes focusPillFadeIn'), '需具备平滑淡入动效');

    // 3. focus.js 轮转计算与交互生命周期
    assert(focusJs.includes('updateNextActionPills'), 'paint 中需包含进阶胶囊渲染与状态更新');
    assert(focusJs.includes('advanceToNextPhase'), '需包含一键启动下一阶段函数');
    assert(focusJs.includes('focus-next-pill-btn'), '需监听主卡片进阶按钮点击');
    assert(focusJs.includes('pomodoro-next-btn'), '需监听悬浮卡片进阶按钮点击');
    assert(focusJs.includes('advanceToNextPhase();'), '当倒计时归零时按空格需无缝进阶下一轮');
});

test('学术专注钟移动端轻量化与触控人机工程：隐藏无意义物理快捷键提示、窄屏数据行防折行与全触控靶心', () => {
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    const mobileCss = readFileSync(new URL('../mobile.css', import.meta.url), 'utf8');

    // 1. 移动端快捷键提示安全隐藏
    assert(/@media\s*\([^)]*max-width:\s*820px[^)]*\)[\s\S]*?\.focus-shortcuts-hint\s*\{[^}]*display:\s*none\s*!important/i.test(styleCss), 'style.css 必须在 max-width: 820px 媒体查询中隐藏物理快捷键提示');
    assert(mobileCss.includes('.focus-shortcuts-hint{display:none!important}'), 'mobile.css 需在移动端启用状态下隐藏快捷键提示');

    // 2. 窄屏统计行自适应与防折行
    assert(/@media\s*\([^)]*max-width:\s*480px[^)]*\)[\s\S]*?\.focus-stats-row\s*\{[^}]*display:\s*grid/i.test(styleCss), '窄屏下专注数据统计行需采用自适应网格防挤压');
    assert(/@media\s*\([^)]*max-width:\s*480px[^)]*\)[\s\S]*?\.focus-stat-divider\s*\{[^}]*display:\s*none/i.test(styleCss), '窄屏下需隐藏竖向分割线');
    assert(styleCss.includes('.focus-stats-row .focus-stat-item:last-child') && styleCss.includes('grid-column: span 2'), '窄屏下保存范围徽章需跨两列全宽显示以防折行');

    // 3. 触控靶心人机工程学
    assert(/@media\s*\([^)]*max-width:\s*600px[^)]*\)[\s\S]*?\.focus-btn\s*\{[^}]*min-height:\s*44px/i.test(styleCss), '移动端控制按钮需满足最小 44px 触控靶心');
});

test('学术专注钟：专注与休息双场景提示音（Web Audio双振荡器晶莹钟声）、挂起自唤醒、后台桌面通知与标签页状态标语', () => {
    const focusJs = readFileSync(new URL('../focus.js', import.meta.url), 'utf8');
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

    // 1. 结构与按钮声明
    assert(indexHtml.includes('id="focus-sound-toggle"'), '主专注卡片需包含提示音切换按钮');
    assert(indexHtml.includes('id="pomodoro-sound-toggle"'), '悬浮番茄钟小面板需包含快捷提示音切换按钮');
    assert(styleCss.includes('.pomodoro-sound-btn'), 'style.css 需定义小面板提示音按钮样式');
    assert(styleCss.includes('.pomodoro-sound-btn.off'), '需定义提示音静音状态置灰样式');

    // 2. 双场景钟声与泛音振荡器合成算法
    assert(focusJs.includes('async function sound('), '需声明异步 sound 函数支持挂起自恢复');
    assert(focusJs.includes("mode==='short-break'||mode==='long-break'"), '需精准区分专注完成与休息完成双场景');
    assert(focusJs.includes("o1.type='sine'") && focusJs.includes("o2.type='triangle'"), '需采用正弦基频+三角波八度泛音双振荡器实现通透晶莹钟声');
    assert(focusJs.includes("audio.state==='suspended'") && focusJs.includes('audio.resume()'), '当音频上下文处于 suspended 挂起态时必须主动 resume 唤醒以防后台哑火');
    assert(focusJs.includes('previewChime'), '开启提示音时需具备即时试听反馈短音');

    // 3. 后台可见性与桌面通知、标签页动态标语
    assert(focusJs.includes('sendDesktopNotification'), '需支持页面挂在后台时发送系统桌面级通知');
    assert(focusJs.includes('requestNotificationPermission'), '需在用户交互时申请桌面通知权限');
    assert(focusJs.includes('🔔 【专注达成！】') && focusJs.includes('☕ 【休息结束！】'), '计时结束时需更新 document.title 给予标签页明确通知');
});
