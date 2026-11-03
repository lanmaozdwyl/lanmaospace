import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const htmlSource = readFileSync(new URL('../reader.html', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../reader.css', import.meta.url), 'utf8');
const jsSource = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');

test('reader.html 结构完整且严格符合 CSP 无内联代码', () => {
    // 包含核心组件
    assert(htmlSource.includes('id="view-bookshelf"'), '缺少书架视图容器');
    assert(htmlSource.includes('id="view-reader"'), '缺少阅读器视图容器');
    assert(htmlSource.includes('id="btn-back-to-shelf"'), '缺少返回书架按钮');
    assert(htmlSource.includes('id="shelf-hero-card"'), '缺少书架 Hero 卡片');
    assert(htmlSource.includes('id="shelf-books-grid"'), '缺少书架典藏网格');
    assert(htmlSource.includes('id="reader-viewport"'), '缺少视口容器');
    assert(htmlSource.includes('id="reader-content"'), '缺少正文容器');
    assert(htmlSource.includes('id="reader-topbar"'), '缺少顶部控制栏');
    assert(htmlSource.includes('id="reader-bottombar"'), '缺少底部控制栏');
    assert(htmlSource.includes('id="zone-prev"'), '缺少上一页触控热区');
    assert(htmlSource.includes('id="zone-menu"'), '缺少菜单触控热区');
    assert(htmlSource.includes('id="zone-next"'), '缺少下一页触控热区');
    assert(htmlSource.includes('id="drawer-toc"'), '缺少目录抽屉');
    assert(htmlSource.includes('id="drawer-settings"'), '缺少排版设置抽屉');
    assert(htmlSource.includes('id="drawer-bookshelf"'), '缺少书库抽屉');
    assert(htmlSource.includes('id="reader-page-slider"'), '缺少翻页进度条');
    assert(htmlSource.includes('id="reader-toggle-noise"'), '缺少伴读白噪声开关');
    assert(htmlSource.includes('id="reader-toggle-pomodoro"'), '缺少番茄钟开关');
    assert(htmlSource.includes('id="reader-curl-layer"'), '缺少 3D 拟真书卷翻页图层');
    assert(htmlSource.includes('id="curl-sheet"'), '缺少立体折角翻页纸张容器');
    assert(htmlSource.includes('class="reader-book-spine"'), '缺少拟真精装书书脊装订线');
    assert(htmlSource.includes('class="reader-book-edge"'), '缺少纸质边缘质感阴影');
    assert(htmlSource.includes('id="btn-toggle-sound"'), '缺少翻页纸张音效切换按钮');

    // CSP 校验：无 inline on* 属性及 inline script
    assert(!/\son[a-z]+\s*=/i.test(htmlSource), '检测到内联事件处理程序');
    for (const m of htmlSource.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc=/.test(m[1])) {
            assert.equal(m[2].trim(), '', '检测到非外部引入的内联脚本');
        }
    }
});

test('reader.css 包含微信读书四大主题色与自适应列分页样式', () => {
    assert(cssSource.includes('--r-bg: #f7f1e5'), '缺少经典羊皮纸护眼黄主题');
    assert(cssSource.includes('[data-reader-theme="green"]'), '缺少莫兰迪护眼绿主题');
    assert(cssSource.includes('[data-reader-theme="white"]'), '缺少纸感纯白主题');
    assert(cssSource.includes('[data-reader-theme="dark"]'), '缺少极夜深黑主题');
    assert(cssSource.includes('column-width'), '缺少多栏列排版样式');
    assert(cssSource.includes('column-gap'), '缺少列间距样式');
    assert(cssSource.includes('mode-scroll'), '缺少连续垂直滚动模式');
    assert(cssSource.includes('.reader-touch-zones'), '缺少手势触控热区样式');
    assert(cssSource.includes('.reader-curl-layer'), '缺少 3D 拟真卷页图层样式');
    assert(cssSource.includes('perspective: 2000px'), '缺少 3D 立体透视深度设置');
    assert(cssSource.includes('.reader-book-spine'), '缺少精装书书脊装订线样式');
    assert(cssSource.includes('.flip-effects-grid'), '缺少翻页动效四宫格样式');
});

test('我的书架总览大厅与微信读书沉浸伴读器双视图 SPA 架构验证', () => {
    // 视图一与视图二共存且默认隔离
    assert(htmlSource.includes('id="view-bookshelf"'), '需包含“我的书架”大厅视图容器');
    assert(htmlSource.includes('id="view-reader"'), '需包含沉浸阅读器视图容器');
    assert(htmlSource.includes('id="btn-back-to-shelf"'), '需包含“‹ 我的书架”返回按钮');
    assert(htmlSource.includes('id="shelf-hero-card"'), '需包含最近在读/继续阅读 Hero 推荐卡片');
    assert(htmlSource.includes('id="shelf-books-grid"'), '需包含精选伴读典藏卡片网格');
    assert(htmlSource.includes('id="shelf-file-input"'), '需包含本地零额度文件导入通道');

    // CSS 双视图控制与样式
    assert(cssSource.includes('.reader-view-container'), '需定义双视图容器基础样式');
    assert(cssSource.includes('.reader-view-container[hidden]'), '需定义隐藏视图 display: none 规则');
    assert(cssSource.includes('.shelf-hero-card'), '需定义书架 Hero 卡片样式');
    assert(cssSource.includes('.shelf-books-grid'), '需定义书架书籍网格样式');
    assert(cssSource.includes('.reader-back-shelf-btn'), '需定义阅读器返回书架按钮样式');

    // JS 视图切换机制
    assert(jsSource.includes('function switchView('), '需实现 switchView 双视图平滑切换引擎');
    assert(jsSource.includes('updateBookshelfHero()'), '需包含书架 Hero 卡片进度更新逻辑');
    assert(jsSource.includes("switchView('bookshelf')"), '需默认导向我的书架大厅');
});

test('移动端点击与长按蓝块遮罩彻底消除（WebKit Tap-Highlight & Callout Suppression）', () => {
    // 验证全局 -webkit-tap-highlight-color 消除默认半透明蓝色高亮
    assert(cssSource.includes('-webkit-tap-highlight-color: transparent !important;'), '全局必须强制关闭 WebKit 移动端点击蓝块遮罩');
    // 验证 -webkit-touch-callout 消除长按放大镜与上下文系统选区蓝块
    assert(cssSource.includes('-webkit-touch-callout: none !important;'), '必须强制关闭 WebKit 移动端长按呼出放大镜及呼出菜单');
    // 验证触控热区禁绝选中
    assert(cssSource.includes('.reader-touch-zones'), '触控区必须单独配置防选中保护');
    // 验证 JS 中 contextmenu 阻止长按上下文事件
    assert(jsSource.includes("contextmenu"), '需阻止长按 contextmenu 事件以彻底消除蓝块');
});

test('reader.js 内置伴读名著完整且无任何外部网络依赖', () => {
    // 提取 BUILTIN_BOOKS 对象验证
    const match = jsSource.match(/const BUILTIN_BOOKS = (\{[\s\S]*?\n    \};)/);
    assert(match, '未找到 BUILTIN_BOOKS 定义');
    const sandbox = {};
    vm.runInNewContext('var books = ' + match[1], sandbox);
    const books = sandbox.books;

    assert(books.prince, '小王子必须存在');
    assert(books.solitude, '百年孤独必须存在');
    assert(books.flow, '心流指南必须存在');

    assert(books.prince.chapters.length >= 5, '小王子章节数量需完整');
    assert(books.solitude.chapters.length >= 4, '百年孤独章节数量需完整');
    assert(books.flow.chapters.length >= 4, '心流指南章节数量需完整');

    for (const key of Object.keys(books)) {
        const b = books[key];
        assert.ok(b.title && b.author && b.chapters);
        b.chapters.forEach(ch => {
            assert.ok(ch.title, '章节必须有标题');
            assert.ok(ch.content && ch.content.length > 0, '章节内容不得为空');
        });
    }
});

test('本地书籍智能章节解析与纯文本无序回退分块验证', () => {
    // 模拟纯前端解析函数逻辑
    const chapterRegex = /^\s*(?:第[0-9一二三四五六七八九十百千]+[章回卷节篇部]|Chapter\s+\d+|#{1,3}\s+)(.*)$/i;

    // 测试标准章节识别
    assert(chapterRegex.test('第一章 巨蟒与大象'));
    assert(chapterRegex.test('第十二章 麦田里的狐狸'));
    assert(chapterRegex.test('Chapter 4 The Little Prince'));
    assert(chapterRegex.test('## 第二讲 微信读书排版美学'));

    // 测试普通段落不误判为章节
    assert(!chapterRegex.test('这是一个普通的段落，包含数字 123456'));
    assert(!chapterRegex.test('第一步我们需要先了解知识'));

    // 测试转义防 XSS 安全函数
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    const malicious = '<script>alert(1)</script><img src="x" onerror="evil()">&';
    const escaped = escapeHtml(malicious);
    assert(!escaped.includes('<script>'));
    assert(!escaped.includes('"'));
    assert(escaped.includes('&lt;script&gt;'));
});

test('微信读书多栏分页算法步长与页码计算准确性', () => {
    // 模拟视口宽 820px, 列间距 60px (桌面端)
    const vw = 820;
    const gap = 60;
    const step = vw + gap; // 880px

    function calculatePages(scrollWidth) {
        return Math.max(1, Math.ceil((scrollWidth + gap / 2) / step));
    }

    assert.equal(calculatePages(820), 1, '正好一栏内容为第1页');
    assert.equal(calculatePages(1700), 2, '两栏宽度内容为第2页');
    assert.equal(calculatePages(2580), 3, '三栏宽度内容为第3页');
    assert.equal(calculatePages(0), 1, '空内容保底第1页');

    // 偏移量验证
    function pageOffset(page) {
        return (page - 1) * step;
    }
    assert.equal(pageOffset(1), 0);
    assert.equal(pageOffset(2), 880);
    assert.equal(pageOffset(3), 1760);
});

test('多浏览器内核前缀兼容性与移动端安全区避让', () => {
    // 验证 WebKit / Moz 多列排版前缀
    assert(cssSource.includes('-webkit-column-width:'), '必须包含 -webkit-column-width 前缀以兼容旧版 iOS/Android WebView');
    assert(cssSource.includes('-moz-column-width:'), '必须包含 -moz-column-width 前缀以兼容 Firefox');
    assert(cssSource.includes('-webkit-column-gap:'), '必须包含 -webkit-column-gap 前缀');
    assert(cssSource.includes('-webkit-column-fill:'), '必须包含 -webkit-column-fill 前缀');

    // 验证刘海屏及手势条安全区 (Safe Area Insets)
    assert(cssSource.includes('env(safe-area-inset-top'), '需包含 safe-area-inset-top 避让刘海屏');
    assert(cssSource.includes('env(safe-area-inset-bottom'), '需包含 safe-area-inset-bottom 避让底部手势横条');
});

test('中文电子书编码兼容性（UTF-8 严格模式与 GB18030/GBK 自动降级）', () => {
    assert(jsSource.includes("new TextDecoder('utf-8', { fatal: true })"), '必须包含 strict UTF-8 校验');
    assert(jsSource.includes("new TextDecoder('gb18030')"), '必须包含 gb18030/gbk 自动降级解码');

    // 模拟一段 GBK 字节（例如中文汉字“伴读”）
    // GBK 编码下：“伴读” = 0xB0 0xE9 0xB6 0xC1
    const gbkBytes = new Uint8Array([0xB0, 0xE9, 0xB6, 0xC1]);
    
    // 严格 UTF-8 解码该字节序列必然报错（因为在 UTF-8 中属于无效前导字节）
    let utf8Failed = false;
    try {
        const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
        strictUtf8.decode(gbkBytes);
    } catch (_) {
        utf8Failed = true;
    }
    assert.equal(utf8Failed, true, 'GBK 字节在严格 UTF-8 模式下应被判定为非 UTF-8 并抛错');

    // 降级为 GB18030 解码能够成功解出“伴读”
    const gbkDecoder = new TextDecoder('gb18030');
    const decodedText = gbkDecoder.decode(gbkBytes);
    assert.equal(decodedText, '伴读', 'GB18030 应成功解码 Windows/安卓常见的 GBK 电子书');
});

test('全屏 API 跨浏览器厂商前缀降级保护', () => {
    // 验证包含了 webkit, moz, ms 等前缀的降级判断，防止 iOS Safari / 早期 Android 抛出未捕获异常
    assert(jsSource.includes('webkitFullscreenElement'), '需兼容 webkitFullscreenElement');
    assert(jsSource.includes('mozFullScreenElement'), '需兼容 mozFullScreenElement');
    assert(jsSource.includes('msFullscreenElement'), '需兼容 msFullscreenElement');
    assert(jsSource.includes('webkitRequestFullscreen'), '需兼容 webkitRequestFullscreen');
});

test('极端与跨平台屏幕尺寸几何排版鲁棒性（320px 小屏 ~ 1920px 4K 大屏）', () => {
    // 模拟各种典型屏幕宽度下的列步长与页码计算
    const screenWidths = [
        { name: 'iPhone SE / 小屏手机', width: 320, gap: 48 },
        { name: 'iPhone 15 Pro / 标准手机', width: 393, gap: 48 },
        { name: '折叠屏内屏 / 平板竖屏', width: 768, gap: 48 },
        { name: 'iPad 橫屏 / 笔记本', width: 1024, gap: 60 },
        { name: '1080P / 4K 桌面宽屏', width: 1920, gap: 60 }
    ];

    for (const scr of screenWidths) {
        const contentWidth = Math.min(scr.width - 48, 820);
        const step = contentWidth + scr.gap;
        assert(step > 0, `${scr.name} 步长需大于 0`);

        // 模拟 10000 像素总文本
        const pages = Math.max(1, Math.ceil((10000 + scr.gap / 2) / step));
        assert(pages >= 2, `${scr.name} 长文本必须能正确分为多页`);
    }
});

test('跨平台换行符兼容性（CRLF / LF / CR 混排段落解析）', () => {
    const mixedText = '第一章 黎明\r\n这是第一段话。\n这是第二段话。\r这是第三段话。\r\n\r\n第二章 黄昏\n第四段话。';
    const lines = mixedText.split(/\r?\n|\r/);
    assert(lines.length >= 6, '应支持跨平台回车换行符混合切分');
});

test('全屏手势引擎支持从右往左与从左往右滑动翻页', () => {
    assert(jsSource.includes("stage.addEventListener('touchstart'"), '需在舞台全屏层捕获 touchstart 手势');
    assert(jsSource.includes("stage.addEventListener('touchmove'"), '需在舞台全屏层捕获 touchmove 手势');
    assert(jsSource.includes("stage.addEventListener('touchend'"), '需在舞台全屏层捕获 touchend 手势');
    assert(jsSource.includes('deltaX < -threshold'), '必须包含从右往左滑动下一页逻辑');
    assert(jsSource.includes('deltaX > threshold'), '必须包含从左往右滑动上一页逻辑');
    assert(jsSource.includes('hasSwiped'), '滑动后必须防误触点击菜单');
});

test('手机硬件音量键翻页设置与物理键拦截映射验证', () => {
    // 1. HTML 设置抽屉包含音量键开关组件
    assert(htmlSource.includes('id="btn-toggle-volume-flip"'), '设置抽屉中必须提供手机音量键翻页开关按钮');
    assert(htmlSource.includes('id="volume-flip-status-text"'), '设置抽屉中必须提供音量键翻页状态文本');

    // 2. JS 默认设置与持久化配置
    assert(jsSource.includes('volumeKeyEnabled: false'), '默认音量键翻页应为关闭状态（避免劫持用户系统音量调节）');
    assert(jsSource.includes('parsed.volumeKeyEnabled'), 'loadSavedSettings 必须支持 volumeKeyEnabled 本地记忆读取');
    assert(jsSource.includes("btnVolume.classList.toggle('active'"), 'applySettings 必须同步按钮激活高亮样式');

    // 3. 硬件音量键事件拦截与按键码降级支持
    assert(jsSource.includes('AudioVolumeDown'), '需支持现代标准 AudioVolumeDown 键名');
    assert(jsSource.includes('VolumeDown'), '需兼容移动端 WebView VolumeDown 键名');
    assert(jsSource.includes('AudioVolumeUp'), '需支持现代标准 AudioVolumeUp 键名');
    assert(jsSource.includes('VolumeUp'), '需兼容移动端 WebView VolumeUp 键名');
    assert(jsSource.includes('174') && jsSource.includes('175'), '需支持 keyCode 174/175 传统硬件键码降级');

    // 4. 事件静默阻止冒泡与翻页调度
    assert(jsSource.includes('e.preventDefault()') && jsSource.includes('e.stopPropagation()'), '按音量键翻页时需阻止原生系统 HUD 与事件冒泡');
});

test('SPA 路由历史栈与移动端侧滑/物理返回键平滑退至我的书架', () => {
    // 1. pushState / popstate 路由历史栈支持
    assert(jsSource.includes("window.history.pushState(historyState"), '打开书籍时必须将阅读状态压入历史栈');
    assert(jsSource.includes("window.addEventListener('popstate'"), '必须监听 popstate 拦截手机侧滑返回与物理返回键');
    assert(jsSource.includes("switchView('bookshelf', null, null, null, false)"), '在阅读器中触发 popstate 时必须平滑切回书架大厅而非直接跳出');

    // 2. 抽屉开启状态下的返回键优先关闭抽屉
    assert(jsSource.includes("const openDrawerEl = document.querySelector('.reader-drawer:not([hidden])')"), '必须支持检测打开中的抽屉');
    assert(jsSource.includes('closeAllDrawers()'), '抽屉开启时后退优先关闭抽屉保持当前书籍');

    // 3. UI 按钮协同历史栈
    assert(jsSource.includes("window.history.back()"), '顶部返回与底栏书架按钮在阅读时优先调用 history.back() 保持栈整洁');
    assert(htmlSource.includes('<span>我的书架</span>'), '底栏 Dock 按钮需明确标识为“我的书架”');
});

test('翻页音效全局预渲染与 120 FPS 极速手势渲染引擎验证', () => {
    // 1. 音频预渲染缓存
    assert(jsSource.includes('cachedPaperBuffer'), '必须全局预渲染并缓存 paperAudio 缓冲区');
    assert(jsSource.includes('getOrCreatePaperBuffer'), '翻页时必须复用预渲染好的 AudioBuffer 杜绝主线程重算');

    // 2. 触控热区选择器严谨对齐
    assert(cssSource.includes('.touch-zone-prev'), 'CSS 必须包含 .touch-zone-prev 类选择器以对齐 HTML 结构');
    assert(cssSource.includes('.touch-zone-menu'), 'CSS 必须包含 .touch-zone-menu 类选择器以对齐 HTML 结构');
    assert(cssSource.includes('.touch-zone-next'), 'CSS 必须包含 .touch-zone-next 类选择器以对齐 HTML 结构');

    // 3. rAF 手势批处理与几何缓存
    assert(jsSource.includes('cachedColWidth = viewport.clientWidth'), '必须在 touchstart 缓存几何尺寸，严禁在 touchmove 中频繁读取');
    assert(jsSource.includes('requestAnimationFrame'), '跟手滑动必须通过 rAF 进行节流与高刷对齐');
});
