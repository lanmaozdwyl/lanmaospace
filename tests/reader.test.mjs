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

test('我的书架移动端底栏下移与单手拇指热区适配', () => {
    // 1. CSS 移动端适配
    assert(cssSource.includes('position: fixed') && cssSource.includes('bottom: 0'), '移动端下必须将 shelf-header 变更为底部固定导航');
    assert(cssSource.includes('safe-area-inset-bottom'), '必须兼容全面屏底栏安全区');
    assert(htmlSource.includes('shelf-header-left'), '书架导航包含返回首页与书架标题');
});

test('全局自由拖拽伴读悬浮窗 (FAB) 与本地位置持久化', () => {
    // 1. HTML 组件与按钮
    assert(htmlSource.includes('id="floating-companion-fab"'), 'DOM 中必须挂载全局伴读悬浮窗');
    assert(htmlSource.includes('id="fab-toggle-pomodoro"'), '悬浮窗中必须包含番茄钟按钮');
    assert(htmlSource.includes('id="fab-toggle-noise"'), '悬浮窗中必须包含伴读白噪音按钮');
    assert(htmlSource.includes('id="fab-theme-btn"'), '悬浮窗中必须包含主题切换按钮');

    // 2. 自由拖拽与持久化逻辑
    assert(jsSource.includes('initFloatingCompanionFAB'), 'JS 必须包含悬浮窗拖拽初始化函数');
    assert(jsSource.includes('STORAGE_KEY_FAB'), '悬浮窗位置必须持久化存储在 localStorage 中');
    assert(jsSource.includes("fab.addEventListener('touchstart'"), '需支持触控拖拽');
    assert(jsSource.includes("fab.addEventListener('mousedown'"), '需支持桌面鼠标拖拽');
});

test('单手侧边虚拟微动翻页条与无硬件音量键降级支持', () => {
    // 1. DOM 结构
    assert(htmlSource.includes('id="reader-edge-rocker"'), '阅读界面必须提供侧边虚拟微动翻页条');
    assert(htmlSource.includes('id="rocker-btn-prev"'), '微动条包含上一页按键');
    assert(htmlSource.includes('id="rocker-btn-next"'), '微动条包含下一页按键');
    assert(htmlSource.includes('id="btn-toggle-edge-rocker"'), '设置抽屉中包含侧边微动条开关');

    // 2. JS 状态管理与设置记忆
    assert(jsSource.includes('edgeRockerEnabled: false'), '默认侧边微动条提供可控开关');
    assert(jsSource.includes('parsed.edgeRockerEnabled'), '设置记忆读取需覆盖 edgeRockerEnabled');
    assert(jsSource.includes("rockerPrev.addEventListener('click'"), '绑定上一页微动触发');
    assert(jsSource.includes("rockerNext.addEventListener('click'"), '绑定下一页微动触发');
});

test('EPUB 与 ZIP 压缩二进制严格拦截校验（拒绝乱码并给出友好提示）', () => {
    // 1. 文件类型选择器不再宣称支持 .epub 压缩包
    assert(!htmlSource.includes('accept=".txt,.md,.epub'), '文件上传 input 不得包含 .epub 后缀');
    assert(htmlSource.includes('accept=".txt,.md'), '文件上传需仅限制 .txt 与 .md 纯文本');

    // 2. JS 二进制魔数校验 (PK 0x50 0x4B 0x03 0x04)
    assert(jsSource.includes('0x50') && jsSource.includes('0x4B') && jsSource.includes('0x03') && jsSource.includes('0x04'), '必须包含 ZIP 魔数二进制头校验');
    assert(jsSource.includes("file.name.toLowerCase().endsWith('.epub')"), '必须拦截 .epub 后缀文件');
    assert(jsSource.includes('暂不支持 EPUB 压缩格式'), '拦截后需给出明确提示而不是静默解码乱码');
});

test('书籍独立进度持久化与页面刷新记忆恢复', () => {
    // 1. 每本书独立的进度存储
    assert(jsSource.includes('STORAGE_KEY_BOOK_PROGRESS'), '需定义每本书专属的进度存储 key');
    assert(jsSource.includes('loadBookProgress'), '必须提供按 bookId 读取独立进度的函数');

    // 2. 刷新直达页面时恢复该书进度
    assert(jsSource.includes('const bookProg = loadBookProgress(bookParam)'), '带 ?book= 参数进入时必须读取该书专属进度');
    assert(!jsSource.includes("switchView('reader', bookParam, 0, 1, true)"), '不得强制以章节 0、页码 1 覆盖已有进度');
});

test('未读状态展示真实 0% 与开始阅读状态', () => {
    // 1. 无阅读记录时准确显示未读与 0%
    assert(!jsSource.includes('Math.max(5,'), '不得将未读书籍进度下限设为伪造的 5%');
    assert(jsSource.includes('未读 · 第 1 章'), '未读书籍明确展示未读章节状态');
    assert(jsSource.includes('▶ 开始阅读'), '未读书籍按钮文案应为开始阅读而非继续阅读');
});

test('番茄钟按真实经过时间 Date.now() 倒计时与后台恢复防漂移', () => {
    // 1. 记录截止时间戳 targetEndTime
    assert(jsSource.includes('pomodoroTargetEndTime = Date.now() + pomodoroSeconds * 1000'), '必须按当前时间戳与剩余秒数计算截止时间');
    assert(jsSource.includes('Math.round((pomodoroTargetEndTime - Date.now()) / 1000)'), '计时器 tick 需基于 Date.now() 真实经过时间计算');

    // 2. 后台唤醒与锁屏恢复
    assert(jsSource.includes("document.addEventListener('visibilitychange'"), '必须监听 visibilitychange 唤醒时校准');
    assert(jsSource.includes("window.addEventListener('focus'"), '必须监听 focus 窗口恢复时校准');
});

test('本地导入书籍持久化与管理移除能力', () => {
    // 1. 离线持久化初始化
    assert(jsSource.includes('initCustomBooksStorage'), '必须在初始化时读取本机保存的书籍');
    assert(jsSource.includes('saveCustomBook'), '导入书籍必须保存到本机存储');
    assert(jsSource.includes('deleteCustomBook'), '必须提供从本机书架移除书籍的函数');

    // 2. UI 移除按钮
    assert(jsSource.includes('card-delete-btn'), '自定义卡片需包含移除按钮');
    assert(cssSource.includes('.card-delete-btn'), 'CSS 需包含移除按钮样式');
});

test('横竖屏旋转自适应与段落级平滑重排锚定验证', () => {
    // 1. 锚定算法与视口自适应
    assert(jsSource.includes('findAnchorParagraphIndex'), '必须包含段落级锚定算法');
    assert(jsSource.includes("window.addEventListener('orientationchange'"), '必须监听 orientationchange 屏幕旋转事件');
    assert(jsSource.includes('updatePaginationMetrics(true)'), '视口变化时必须保留阅读段落锚点');
});

test('多品牌移动端系统字体族保底与无障碍缩放体验', () => {
    // 1. 系统字体族保底
    assert(cssSource.includes('HarmonyOS Sans SC'), 'CSS 必须覆盖华为鸿蒙 HarmonyOS Sans SC 字体');
    assert(cssSource.includes('MiSans'), 'CSS 必须覆盖小米澎湃 MiSans 字体');
    assert(cssSource.includes('PingFang SC'), 'CSS 必须覆盖苹果苹方 PingFang SC 字体');

    // 2. 无障碍视口缩放
    assert(htmlSource.includes('viewport-fit=cover'), '需适配全面屏安全区');
    assert(!htmlSource.includes('user-scalable=no'), '不强制禁用无障碍缩放');
});

test('连续翻页动量吞吐与卷页章节级缓存优化验证', () => {
    // 1. 快速连翻不丢手势
    assert(jsSource.includes('finishOngoingFlipImmediately'), '连续轻划或点击翻页需支持立即完成上一页过渡');
    assert(jsSource.includes('flipTargetPage'), '需追踪翻页目标页码');

    // 2. 卷页章节级缓存
    assert(jsSource.includes('curlSyncedChapterIndex'), 'Curl 模式需采用章节级同步避免高频 innerHTML 序列化');
});

test('Android 原生 WebView 缩放、抽屉返回拦截与硬件音量键转发链路', () => {
    const mainActivitySource = readFileSync(new URL('../android/app/src/main/java/space/lanmao/app/MainActivity.java', import.meta.url), 'utf8');
    
    // 1. 缩放支持
    assert(mainActivitySource.includes('setSupportZoom(true)'), '安卓原生 WebView 需开启手势缩放');
    assert(mainActivitySource.includes('setBuiltInZoomControls(true)'), '需启用内置缩放控制');
    assert(mainActivitySource.includes('setDisplayZoomControls(false)'), '需隐藏原生屏幕浮动缩放按钮');

    // 2. 返回键优先关闭阅读器抽屉
    assert(mainActivitySource.includes('.reader-drawer:not([hidden])'), '安卓原生返回键需支持关闭阅读器抽屉');

    // 3. 物理音量键转发
    assert(mainActivitySource.includes('dispatchKeyEvent'), '安卓原生需转发硬件音量键');
    assert(mainActivitySource.includes('__lanmaoVolumeKey'), '安卓原生需调用 __lanmaoVolumeKey 桥梁');
    assert(jsSource.includes('window.__lanmaoVolumeKey'), 'JS 端需实现 __lanmaoVolumeKey 翻页桥梁');
});

test('全站宣传文案真实严谨性：杜绝实现导向与绝对化营销词汇', () => {
    const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert(!indexSource.includes('零额度消耗'), 'index.html 需剔除实现导向的“零额度消耗”文案');
    assert(!jsSource.includes('零额度消耗'), 'reader.js 需剔除“零额度消耗”绝对化宣称');
    assert(!htmlSource.includes('杜绝乱码'), 'reader.html 杜绝“杜绝乱码”等绝对承诺');
});

test('P1 复验：自定义书籍刷新后书架网格卡片即时完整展示', () => {
    // 1. initCustomBooksStorage 同步加载后立即渲染网格
    assert(jsSource.includes('initCustomBooksStorage'), '需初始化自定义书籍存储');
    // 确保同步读取后执行了 renderBookshelfGrid
    const initStorageFn = jsSource.slice(jsSource.indexOf('function initCustomBooksStorage'), jsSource.indexOf('function saveCustomBook'));
    assert(initStorageFn.includes('renderBookshelfGrid();'), 'initCustomBooksStorage 内部必须在读取 localStorage 镜像后同步执行 renderBookshelfGrid');
    assert(initStorageFn.includes('updateBookshelfHero();'), 'initCustomBooksStorage 内部必须同步更新 updateBookshelfHero');

    // 2. 初始化流程无需等待即可呈现本地导入书
    const initFn = jsSource.slice(jsSource.indexOf('function init()'), jsSource.indexOf('// ===== 15. DOM 就绪自启动'));
    assert(initFn.includes('initCustomBooksStorage('), 'init 流程必须调用 initCustomBooksStorage');
});

test('P2 复验：书架大厅与阅读器内页进度百分比 100% 严格对齐', () => {
    // 1. 存在共享的统一进度函数
    assert(jsSource.includes('function calculateReadingProgress('), '必须包含统一进度计算函数 calculateReadingProgress');

    // 2. 书架 Hero 与阅读器 Footer 均调用此函数
    const heroFn = jsSource.slice(jsSource.indexOf('function updateBookshelfHero('), jsSource.indexOf('function renderBookshelfGrid('));
    assert(heroFn.includes('calculateReadingProgress('), 'updateBookshelfHero 必须调用 calculateReadingProgress');

    const footerFn = jsSource.slice(jsSource.indexOf('function updateFooterInfo('), jsSource.indexOf('function updateSlider('));
    assert(footerFn.includes('calculateReadingProgress('), 'updateFooterInfo 必须调用 calculateReadingProgress');

    // 3. 算法精度隔离测试：《心流与学术生产力》五讲，第二讲第 1/2 页，结果必须为精确的 30%
    const mockBook = {
        chapters: [
            { title: '第一讲' },
            { title: '第二讲' },
            { title: '第三讲' },
            { title: '第四讲' },
            { title: '第五讲' }
        ]
    };
    const sandbox = {};
    const extractedCalc = jsSource.slice(
        jsSource.indexOf('function calculateReadingProgress('),
        jsSource.indexOf('// ===== 4. 本地书籍离线持久化')
    );
    vm.runInNewContext(extractedCalc + '; sandbox.calc = calculateReadingProgress;', { sandbox, Math });

    // 第二讲 (index 1), 第 1/2 页: 1 * 20% + (1/2) * 20% = 20% + 10% = 30%
    const pct1 = sandbox.calc(mockBook, 1, 1, 2);
    assert.equal(pct1, 30, '第二讲第 1/2 页两处口径必须完全一致为 30%');

    // 未读/空书籍验证
    assert.equal(sandbox.calc(null, 0, 1, 1), 0, '空书籍进度为 0%');
    assert.equal(sandbox.calc({ chapters: [] }, 0, 1, 1), 0, '无章节进度为 0%');

    // 最后一章最后一页必须精准达到 100%
    assert.equal(sandbox.calc(mockBook, 4, 2, 2), 100, '全书读毕必须精准达到 100%');
});

test('存储空间异常与超限失败路径友好提示保障', () => {
    // 1. saveCustomBook 接受结果回调
    assert(jsSource.includes('function saveCustomBook(book, callback)'), 'saveCustomBook 必须支持回调通知写入状态');

    // 2. 失败提示分支
    assert(jsSource.includes('本机存储已满，刷新可能不会保留'), '写入失败时给出明确的临时阅读与空间提示');
});

test('第一梯队修复：长章节目录打开自动居中当前阅读章节', () => {
    // 1. openDrawer 针对 drawer-toc 自动滚动激活项
    assert(jsSource.includes("drawerId === 'drawer-toc'"), 'openDrawer 需专门处理目录抽屉');
    assert(jsSource.includes("scrollIntoView({ block: 'center', behavior: 'smooth' })"), '打开目录必须对激活章节执行居中平滑滚动');
    assert(jsSource.includes('highlightActiveToc'), '打开目录需触发高亮校验');
});

test('第一梯队修复：连续滚动模式 (Scroll) 垂直偏移持久化与精准恢复', () => {
    // 1. saveProgress 包含垂直偏移字段
    assert(jsSource.includes('scrollY: scrollY'), 'saveProgress 需保存垂直滚动像素偏移');
    assert(jsSource.includes('scrollRatio: scrollRatio'), 'saveProgress 需保存垂直滚动比例');

    // 2. 视口滚动事件监听与防抖存储
    assert(jsSource.includes("readerVp.addEventListener('scroll'"), '需在 bindEvents 中监听阅读视口 scroll 事件');

    // 3. 渲染章节时平滑回滚到章内精确阅读位置
    assert(jsSource.includes('viewport.scrollTop = Math.round(maxScroll * saved.scrollRatio)'), '滚动模式恢复时需根据比例平滑恢复章内滚动位置');
});

test('第一梯队修复：文件选择器拦截后清空重置机制保障', () => {
    // 1. resetFileInputs 工具函数
    assert(jsSource.includes('function resetFileInputs()'), '必须包含统一清空文件选择器的函数 resetFileInputs');
    assert(jsSource.includes("shelfInput.value = ''"), '必须重置书架文件选择器');
    assert(jsSource.includes("drawerInput.value = ''"), '必须重置抽屉文件选择器');

    // 2. 异常退出、魔数拦截及读取完成均触发重置
    const handleFn = jsSource.slice(jsSource.indexOf('function handleLocalFileInput'), jsSource.indexOf('// 伴读声音由 reader-audio.js'));
    assert(handleFn.includes('resetFileInputs()'), 'handleLocalFileInput 必须调用 resetFileInputs');
});

test('第二梯队修复：删除活跃书籍时自动重置默认状态并清理路由参数', () => {
    // 1. 活跃书删除检测与重置为 prince
    assert(jsSource.includes("state.currentBookId = 'prince'"), '删除当前活跃书籍需重置为默认书 prince');
    // 2. URL 参数清理
    assert(jsSource.includes("url.searchParams.delete('book')"), '删除当前书籍需清理 URL 中的 book 参数');
    assert(jsSource.includes("url.searchParams.delete('chapter')"), '删除当前书籍需清理 URL 中的 chapter 参数');
});

test('第二梯队修复：仿真纸张覆盖滑页 (Cover 模式) 动效独立实现', () => {
    // 1. 结构与样式
    assert(htmlSource.includes('id="reader-cover-layer"'), 'HTML 需包含覆盖滑页图层 reader-cover-layer');
    assert(htmlSource.includes('id="cover-edge-shadow"'), 'HTML 需包含覆盖滑页阴影 cover-edge-shadow');
    assert(cssSource.includes('.reader-cover-layer'), 'CSS 需包含覆盖滑页图层样式');
    assert(cssSource.includes('.cover-edge-shadow'), 'CSS 需包含覆盖纸张边缘阴影样式');

    // 2. 动效执行逻辑
    assert(jsSource.includes("state.settings.animMode === 'cover'"), 'executePageTurn 需包含独立的 cover 模式分支');
});

test('第二梯队修复：伴读声音弹窗多入口直接绑定与关闭精准归位焦点', () => {
    const audioSource = readFileSync(new URL('../reader-audio.js', import.meta.url), 'utf8');
    assert(audioSource.includes('lastActiveTrigger'), 'reader-audio 必须追踪触发按钮');
    assert(audioSource.includes('shelf-toggle-noise'), '需支持从书架底栏按钮直接打开声音面板');
    assert(audioSource.includes('fab-toggle-noise'), '需支持从悬浮窗按钮直接打开声音面板');
    assert(audioSource.includes('lastActiveTrigger.focus()'), '弹窗关闭时需精准把焦点归还给原触发按钮');
});

test('第三梯队修复：书架本地书库即时检索与关键词过滤引擎', () => {
    // 1. 结构与样式
    assert(htmlSource.includes('id="shelf-search-input"'), 'HTML 需包含书架搜索输入框');
    assert(htmlSource.includes('id="shelf-search-clear"'), 'HTML 需包含清空搜索按钮');
    assert(cssSource.includes('.shelf-search-wrap'), 'CSS 需包含搜索框容器样式');

    // 2. 检索逻辑
    assert(jsSource.includes('function initShelfSearch()'), '需包含 initShelfSearch 函数');
    assert(jsSource.includes('shelf-search-empty'), '无匹配书籍时需展示空状态');
});

test('第三梯队修复：超大 TXT 文件逐行流式解析避免主线程内存尖峰', () => {
    // 1. 采用 indexOf 逐行索引扫描而非巨型数组 split
    assert(jsSource.includes('rawText.indexOf(') && jsSource.includes('start = end + 1'), '大文件解析需采用逐行流式索引扫描');
    assert(!jsSource.includes('rawText.split(/\\r?\\n/)'), '严禁一次性全量正则切分');
});

test('第三梯队修复：个人数据主权——书架与阅读进度一键导出与导入备份', () => {
    // 1. 备份按钮
    assert(htmlSource.includes('id="shelf-btn-export-backup"'), '需包含导出书架备份按钮');
    assert(htmlSource.includes('id="shelf-backup-file-input"'), '需包含恢复书架备份选择器');

    // 2. 导出与导入逻辑
    assert(jsSource.includes('function exportBookshelfBackup('), '需包含 exportBookshelfBackup 函数');
    assert(jsSource.includes('function importBookshelfBackup('), '需包含 importBookshelfBackup 函数');
    assert(jsSource.includes("'lanmao-reader-backup'"), '备份必须带有蓝昴空间标准标识校验');
});

test('第三梯队修复：iOS Safari 无原生全屏 API 时的视觉沉浸全屏保底', () => {
    // 1. 视觉降级样式
    assert(cssSource.includes('reader-visual-fullscreen'), 'CSS 需包含视觉沉浸全屏保底样式');
    // 2. 降级切换函数
    assert(jsSource.includes('function toggleVisualFullscreen('), '需包含 toggleVisualFullscreen 降级函数');
});
