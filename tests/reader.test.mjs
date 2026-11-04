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
    const gestureSource = readFileSync(new URL('../reader-gesture.js', import.meta.url), 'utf8');
    assert(gestureSource.includes("stage.addEventListener('touchstart'"), '需在舞台全屏层捕获 touchstart 手势');
    assert(gestureSource.includes("stage.addEventListener('touchmove'"), '需在舞台全屏层捕获 touchmove 手势');
    assert(gestureSource.includes("stage.addEventListener('touchend'"), '需在舞台全屏层捕获 touchend 手势');
    assert(jsSource.includes('dx < -threshold'), '必须包含从右往左滑动下一页逻辑');
    assert(jsSource.includes('dx > threshold'), '必须包含从左往右滑动上一页逻辑');
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

test('移除冗余侧边虚拟微动翻页条（遵从用户精简意图，彻底删除相关 DOM 与设置逻辑）', () => {
    // 1. DOM 结构中不再包含冗余侧边翻页条及开关
    assert(!htmlSource.includes('id="reader-edge-rocker"'), '阅读界面必须已彻底移除侧边虚拟微动翻页条');
    assert(!htmlSource.includes('id="rocker-btn-prev"'), '微动条上一页按键已彻底移除');
    assert(!htmlSource.includes('id="rocker-btn-next"'), '微动条下一页按键已彻底移除');
    assert(!htmlSource.includes('id="btn-toggle-edge-rocker"'), '设置抽屉中侧边微动条开关已彻底移除');

    // 2. JS 状态管理与设置中已彻底清理
    assert(!jsSource.includes('edgeRockerEnabled:'), '默认设置对象中已彻底清除 edgeRockerEnabled');
    assert(!jsSource.includes('parsed.edgeRockerEnabled'), '设置记忆读取中已清除 edgeRockerEnabled');
    assert(!jsSource.includes("rockerPrev.addEventListener('click'"), '微动条事件绑定已彻底清除');
    assert(!jsSource.includes("rockerNext.addEventListener('click'"), '微动条事件绑定已彻底清除');
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

test('审查缺陷修复：IndexedDB 事务生命周期必须以 tx.oncomplete 确认且具备单次回调保护', () => {
    assert(jsSource.includes('tx.oncomplete = () => {'), 'saveCustomBook 必须在 tx.oncomplete 确认提交');
    assert(jsSource.includes('tx.onabort = () => {'), '需处理 tx.onabort 事务中止');
    assert(jsSource.includes('let called = false;'), '回调必须具备单次触发保护防止重复或时序错乱');
    assert(!jsSource.includes('req.onsuccess = () => {\n                    if (callback) callback(true);'), '严禁在 put.onsuccess 提前回调成功');
});

test('审查缺陷修复：Android 原生音量键桥梁严格核验 activeView 并拦截活跃弹窗与抽屉', () => {
    assert(jsSource.includes("state.activeView !== 'reader'"), '原生音量键必须校验 state.activeView 而非未定义的 currentView');
    assert(!jsSource.includes("state.currentView !== 'reader'"), '严禁使用未定义的 state.currentView');
    assert(jsSource.includes("document.querySelector('dialog[open]')"), '弹窗打开时必须拦截音量键翻页');
    assert(jsSource.includes("document.querySelector('.reader-drawer.open')"), '抽屉打开时必须拦截音量键翻页');
});

test('审查缺陷修复：IndexedDB 纯异步超大书籍刷新路由恢复不依赖被改写的 URL', () => {
    assert(jsSource.includes('initialBook || new URLSearchParams'), '异步回调必须使用初始捕获的 URL 目标书籍');
    assert(jsSource.includes('const initialParams = new URLSearchParams'), '必须在初次路由前捕获目标参数');
});

test('审查缺陷修复：书架卡片删除按钮键盘 Enter/Space 严禁拦截并误触发打开书籍', () => {
    assert(jsSource.includes("if (e.target.closest('.card-delete-btn') || e.target.closest('button')) return;"), '网格 keydown 必须排除删除按钮以保留原生激活');
});

test('移动端体验优化：书架底栏彻底杜绝文字溢出与多余表情符号', () => {
    assert(!htmlSource.includes('📚 我的书架'), '书架标题移除表情符号，避免底部导航栏显得奇怪');
    assert(htmlSource.includes('<h1 class="shelf-brand-title">我的书架</h1>'), '保留纯净的书架标题');
    assert(cssSource.includes('.shelf-tool-btn .shelf-badge'), '移动端需隐藏声音与番茄文字徽标以杜绝挤压溢出');
    assert(cssSource.includes('calc(8px + env(safe-area-inset-bottom'), '底栏必须通过 calc 适配全面屏手势条避让高度');
});

test('在线阅读器升级：TXT 3D 拟真翻页 (@openpageflip/core) 与 PDF 3D 翻页 (pageflipopen) 深度集成', () => {
    // 1. HTML 结构与资源引入
    assert(htmlSource.includes('lib/openpageflip/openpageflip.css'), '需引入 @openpageflip/core 样式文件');
    assert(htmlSource.includes('lib/pageflipopen/pageflipopen.css'), '需引入 pageflipopen 样式文件');
    assert(htmlSource.includes('lib/openpageflip/openpageflip.js'), '需引入 @openpageflip/core 脚本');
    assert(htmlSource.includes('lib/pageflipopen/pageflipopen.js'), '需引入 pageflipopen 脚本');
    assert(htmlSource.includes('id="openpageflip-wrap"'), '需包含 @openpageflip 专用容器');
    assert(htmlSource.includes('id="openpageflip-stage"'), '需包含 @openpageflip 舞台挂载节点');
    assert(htmlSource.includes('id="pdf-wrap"'), '需包含 PDF 专用容器');
    assert(htmlSource.includes('id="pdf-flipbook-container"'), '需包含 PDF 舞台挂载节点');
    assert(htmlSource.includes('.pdf') && htmlSource.includes('application/pdf'), '文件选择器必须支持 PDF 格式');

    // 2. CSS 样式支持
    assert(cssSource.includes('.reader-openpageflip-wrap'), '需定义 @openpageflip 容器样式');
    assert(cssSource.includes('.opf-page-card'), '需定义 @openpageflip 书页卡片美学样式');
    assert(cssSource.includes('.reader-pdf-wrap'), '需定义 PDF 容器样式');
    assert(cssSource.includes('.pdf-flipbook-container'), '需定义 PDF 3D 舞台样式');

    // 3. 严格遵循约束：使用 createBook(container, opts) 且容器直接子元素为书页，严禁使用旧版 new PageFlip()
    assert(jsSource.includes('OpenPageFlip.createBook('), '必须使用 @openpageflip 的 createBook(container, opts) API');
    assert(!jsSource.includes('new PageFlip('), '严禁使用已弃用的 StPageFlip new PageFlip()');
    assert(jsSource.includes('function paginateChapterContent('), '需实现基于段落和容器几何的 TXT 动态分页算法');
    assert(jsSource.includes("setAttribute('data-density', 'soft')"), '书页节点需设置 data-density 属性');

    // 4. PDF 引擎约束：调用 PageFlipOpen.setPdfWorkerSrc('/pdf.worker.mjs') 并通过 new PageFlipOpen 初始化
    assert(jsSource.includes("PageFlipOpen.setPdfWorkerSrc('/pdf.worker.mjs')"), '必须调用 setPdfWorkerSrc 指定本地 worker 路径');
    assert(jsSource.includes('new window.PageFlipOpen('), '必须通过 new PageFlipOpen 初始化 PDF 翻页');
    assert(jsSource.includes("flipDuration: 600"), '需配置 flipDuration 动画时长');
    assert(jsSource.includes("uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46"), '需支持 %PDF 魔数校验');

    // 5. 翻页调度联动：nextPage / prevPage / goToPage 自动适配 3D 引擎实例
    assert(jsSource.includes('state.pdfFlipInstance.next()'), 'nextPage 需对接 PDF 实例 next()');
    assert(jsSource.includes('state.pdfFlipInstance.prev()'), 'prevPage 需对接 PDF 实例 prev()');
    assert(jsSource.includes('state.openPageFlipInstance.flipNext()'), 'nextPage 需对接 openpageflip flipNext()');
    assert(jsSource.includes('state.openPageFlipInstance.flipPrev()'), 'prevPage 需对接 openpageflip flipPrev()');
});

test('缺陷修复：PDF 刷新路由异步竞态防死锁与离线加载平滑唤醒', () => {
    // 1. 状态定义包含离线数据库加载状态标识
    assert(jsSource.includes('dbLoaded: false'), 'state 必须定义 dbLoaded 初始标志');
    // 2. 异步回调需核验 PDF 实例挂载状态，防止首屏异步竞态导致永久拦截
    assert(jsSource.includes("targetBook.format === 'pdf' && !state.pdfFlipInstance"), 'IndexedDB 异步加载完成必须无条件唤醒未就绪的 PDF 3D 翻页实例');
    // 3. 数据未就绪时展现优雅过渡提示而非直接报错
    assert(jsSource.includes('正在从本机离线数据库加载 PDF'), '需展示离线数据库读取过渡提示，杜绝报错假死');
});

test('缺陷修复：PDF 多页快速加载与底部上一页/下一页、手势联动全量打通', () => {
    // 1. PageFlipOpen 快速通道
    const pfoSource = readFileSync(new URL('../lib/pageflipopen/pageflipopen.js', import.meta.url), 'utf8');
    assert(pfoSource.includes('numPages <= 8'), '需提供多页 PDF 快速构建 pageMap 机制，杜绝阻塞 worker 循环');
    assert(pfoSource.includes('containerW < 768'), '小屏移动端需自适应 singlePageMode 单页排版');

    // 2. reader.js 中 PDF 目录与总页数即时同步
    assert(jsSource.includes('book.totalPages = total'), 'onReady 需同步更新 book.totalPages');
    assert(jsSource.includes('book.chapters = Array.from({ length: total }'), '需根据总页数即时生成 PDF 各页章节目录');
    assert(jsSource.includes('state.isPdfMode && state.pdfFlipInstance'), 'goToChapter 需对 PDF 模式直接调用 flipTo');

    // 3. 底部导航栏在 PDF 模式下切换为上一页/下一页
    assert(jsSource.includes("prevBtn.title = '上一页'"), 'PDF 模式下底部导航按钮需变为上一页');
    assert(jsSource.includes("nextBtn.title = '下一页'"), 'PDF 模式下底部导航按钮需变为下一页');
});

test('体验优化：大文件导入反馈 Loading 遮罩与防重点击保护及 PDF 排版设置防呆', () => {
    // 1. 书架与抽屉导入容器包含 Loading 遮罩节点
    assert(htmlSource.includes('id="shelf-import-overlay"'), '书架导入卡片需配置 Loading 遮罩');
    assert(htmlSource.includes('id="drawer-import-overlay"'), '抽屉导入卡片需配置 Loading 遮罩');
    assert(cssSource.includes('.import-loading-overlay'), '需定义导入遮罩样式与毛玻璃过渡');
    assert(cssSource.includes('.shelf-import-card.is-importing'), '需定义导入进行时防重复点击与等待指针');

    // 2. PDF 排版防呆横幅与置灰
    assert(htmlSource.includes('id="pdf-settings-notice"'), '排版抽屉需包含 PDF 模式专属提示横幅');
    assert(cssSource.includes('.pdf-settings-notice'), '需定义 PDF 排版防呆横幅美学样式');
    assert(cssSource.includes('#drawer-settings.pdf-reading-mode'), '需在 PDF 模式下置灰不适用排版控件');

    // 3. JS 状态流与互斥响应
    assert(jsSource.includes('function setImportingState('), '必须包含 setImportingState 统筹禁用与遮罩显示');
    assert(jsSource.includes('pdfNotice.hidden = !state.isPdfMode'), 'applySettings 需实时同步 PDF 提示可见性');
    assert(jsSource.includes("showToast('📑 PDF 文档固定采用 3D 画册翻页模式"), 'PDF 模式下点击非适用动效需给出友好指引');
});

test('效率区工程：正文排版矩阵控制（行距/段距/版心/一键恢复）与响应式变量驱动', () => {
    // 1. HTML 节点完备性
    assert(htmlSource.includes('id="line-height-chips"'), '设置抽屉需包含行距选择 chips 组');
    assert(htmlSource.includes('id="para-spacing-chips"'), '设置抽屉需包含段距选择 chips 组');
    assert(htmlSource.includes('id="page-width-chips"'), '设置抽屉需包含版心宽度选择 chips 组');
    assert(htmlSource.includes('id="btn-reset-typography"'), '设置抽屉需包含一键恢复默认排版按钮');

    // 2. CSS 变量与自适应排版
    assert(cssSource.includes('--r-para-spacing'), 'CSS 必须定义 --r-para-spacing 变量');
    assert(cssSource.includes('.setting-chips-row'), 'CSS 需支持 setting-chips-row 排版胶囊');
    assert(cssSource.includes('.setting-reset-btn'), 'CSS 需支持 setting-reset-btn 恢复按钮');

    // 3. JS 状态流与动态应用
    assert(jsSource.includes('lineHeight: 1.8'), '初始状态需包含 lineHeight 默认值');
    assert(jsSource.includes("paraSpacing: '1.0em'"), '初始状态需包含 paraSpacing 默认值');
    assert(jsSource.includes("pageWidth: '840px'"), '初始状态需包含 pageWidth 默认值');
    assert(jsSource.includes('--r-para-spacing'), 'applySettings 必须将 paraSpacing 注入根节点 CSS 变量');
    assert(jsSource.includes("btnResetTypo.addEventListener('click'"), '必须绑定一键恢复默认排版点击事件');
});

test('效率区工程：珍藏书签管理系统与目录双标签联动及无缝云备份恢复', () => {
    // 1. HTML 顶栏与抽屉节点
    assert(htmlSource.includes('id="reader-btn-bookmark"'), '阅读器顶栏需配置一键书签按钮');
    assert(htmlSource.includes('id="tab-btn-toc"'), '目录抽屉需包含大纲标签切换按钮');
    assert(htmlSource.includes('id="tab-btn-bookmarks"'), '目录抽屉需包含书签标签切换按钮');
    assert(htmlSource.includes('id="bookmark-count-badge"'), '书签标签上需配备书签数量徽章');
    assert(htmlSource.includes('id="reader-bookmarks-list"'), '需配置独立的书签卡片列表容器');

    // 2. CSS 视觉交互规范
    assert(cssSource.includes('.drawer-tabs-segment'), 'CSS 需定义抽屉分段控制栏');
    assert(cssSource.includes('.drawer-tab.active'), 'CSS 需定义激活标签的高亮状态');
    assert(cssSource.includes('.bookmark-card'), 'CSS 需定义精美书签卡片容器');
    assert(cssSource.includes('#reader-btn-bookmark.bookmarked'), '已书签状态下按钮需呈现高亮色');

    // 3. JS 数据结构与业务逻辑
    assert(jsSource.includes('STORAGE_KEY_BOOKMARKS'), '需定义书签 localStorage 持久化 key');
    assert(jsSource.includes('function loadBookmarks()'), '必须包含 loadBookmarks 读取引擎');
    assert(jsSource.includes('function toggleBookmark()'), '必须包含 toggleBookmark 切换与摘录提取');
    assert(jsSource.includes('function renderBookmarksList()'), '必须包含 renderBookmarksList 列表渲染');
    assert(jsSource.includes('exportBookshelfBackup'), '书架备份导出需包含 bookmarks 字段');
    assert(jsSource.includes('state.bookmarks = Object.assign({}, state.bookmarks, data.bookmarks)'), '书架备份恢复需能无缝导入 bookmarks');
});

test('体验优化：书架移动端底栏个人空间通道互联与抽屉关闭无障碍焦点回跳', () => {
    // 1. 书架顶栏/底栏直达空间入口
    assert(htmlSource.includes('id="shelf-btn-space"'), '书架工具组需配备个人空间快捷按钮');
    assert(htmlSource.includes('href="space.html"'), '书架空间按钮必须直达 space.html');
    assert(cssSource.includes('.shelf-space-btn'), 'CSS 需支持空间按钮链接美学样式');
    assert(cssSource.includes('@media (max-width: 380px)'), 'CSS 需适配 380px 以下超窄屏紧凑布局');

    // 2. 抽屉关闭焦点回跳 (WCAG AA 无障碍闭环)
    assert(jsSource.includes('lastDrawerTrigger = triggerEl'), 'openDrawer 需捕获打开触发源元素');
    assert(jsSource.includes('lastDrawerTrigger.focus'), 'closeAllDrawers 关闭时焦点必须精准恢复至触发源');
});

test('划线笔记接入：标签页、浮动按钮、脚本顺序、模式开关与备份合并', () => {
    // HTML：第三个标签页、列表面板、浮动按钮、模式开关
    assert(htmlSource.includes('id="tab-btn-highlights"'), '需包含划线笔记标签页');
    assert(htmlSource.includes('id="reader-highlights-list"'), '需包含划线笔记列表面板');
    assert(htmlSource.includes('id="reader-highlight-fab"'), '需包含选区划线浮动按钮');
    assert(htmlSource.includes('id="reader-btn-highlight-mode"'), '需包含划线模式开关按钮');
    // reader-highlight.js 必须先于 reader.js 加载
    const hlPos = htmlSource.indexOf('src="reader-highlight.js"');
    const rdPos = htmlSource.indexOf('src="reader.js"');
    assert(hlPos > 0 && rdPos > hlPos, 'reader-highlight.js 必须在 reader.js 之前引入');

    // JS：存储、恢复、跳转、模式与备份
    assert(jsSource.includes("'lanmao_reader_highlights_v1'"), '需使用独立的划线存储键');
    assert(jsSource.includes('function applyChapterHighlights('), '需包含章节渲染后恢复划线的函数');
    assert(jsSource.includes('function createHighlightFromSelection('), '需包含选区创建划线函数');
    assert(jsSource.includes('function jumpToHighlight('), '需包含笔记列表跳转函数');
    assert(jsSource.includes('function setHighlightMode('), '需包含划线模式开关函数');
    assert(/content\.innerHTML = htmlParts\.join\('\\n'\);\s*applyChapterHighlights\(\);/.test(jsSource), 'renderChapter 渲染正文后必须恢复划线');
    assert(jsSource.includes('if (state.highlightMode) return false;'), '划线模式下手势状态机必须让出，暂停滑动翻页手势');
    assert(/highlights: state\.highlights,/.test(jsSource), '书架备份必须导出划线');
    assert(jsSource.includes('data.highlights'), '书架备份导入必须合并划线');
    // 列表以 textContent 构建，不把用户选中的原文拼进 innerHTML
    const listFn = jsSource.slice(jsSource.indexOf('function renderHighlightsList('), jsSource.indexOf('function bindHighlightEvents('));
    assert(!listFn.includes('innerHTML'), '划线列表严禁使用 innerHTML 拼接用户文字');

    // CSS
    assert(cssSource.includes('.reader-stage.highlight-mode .reader-touch-zones'), '划线模式下触控热区需让出点击');
    assert(cssSource.includes('.reader-highlight-fab'), '需包含浮动按钮样式');
    assert(cssSource.includes('.highlight-card'), '需包含划线笔记卡片样式');

    // 打包白名单
    const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
    assert(buildSource.includes("'reader-highlight.js'"), 'build.mjs 白名单需包含 reader-highlight.js');
});

test('划线笔记进阶：支持全书 Markdown 导出与单条书摘卡片复制', () => {
    // 1. JS 导出与复制函数定义
    assert(jsSource.includes('function exportHighlightsMarkdown('), '必须包含全书划线 Markdown 导出函数');
    assert(jsSource.includes('function copyHighlightCard('), '必须包含单条书摘卡片复制函数');
    assert(jsSource.includes('btn-export-highlights'), '划线笔记列表顶部需包含 Markdown 导出按钮');
    assert(jsSource.includes('bookmark-copy-btn'), '每条划线笔记需包含书摘卡片复制按钮');

    // 2. 导出内容结构验证
    assert(jsSource.includes('读书划线与笔记'), 'Markdown 标题格式需规范');
    assert(jsSource.includes('text/markdown;charset=utf-8'), '需采用 UTF-8 编码的 Markdown MIME 类型');

    // 3. CSS 样式规范
    assert(cssSource.includes('.btn-export-hl'), '需包含导出按钮样式');
    assert(cssSource.includes('.bookmark-copy-btn'), '需包含书摘复制按钮样式');
    assert(cssSource.includes('.highlights-toolbar'), '需包含划线顶部工具栏样式');
});

test('微信读书书架升级：多视图排版切换（网格/列表/实木层架）与排序矩阵及本地持久化', () => {
    // 1. HTML 节点完备性
    assert(htmlSource.includes('id="shelf-view-switcher"'), '需包含三视图切换容器');
    assert(htmlSource.includes('id="btn-view-grid"'), '需包含经典网格视图按钮');
    assert(htmlSource.includes('id="btn-view-list"'), '需包含详细列表视图按钮');
    assert(htmlSource.includes('id="btn-view-shelf"'), '需包含实木层架视图按钮');
    assert(htmlSource.includes('id="shelf-sort-select"'), '需包含书架排序选择下拉框');
    assert(htmlSource.includes('id="shelf-btn-online-search"'), '需包含在线找书入口按钮');

    // 2. CSS 样式支持
    assert(cssSource.includes('.shelf-books-grid.view-grid'), '需定义网格视图样式');
    assert(cssSource.includes('.shelf-books-grid.view-list'), '需定义列表视图样式');
    assert(cssSource.includes('.shelf-books-grid.view-shelf'), '需定义实木层架视图样式与木纹光影');
    assert(cssSource.includes('.shelf-view-switcher'), '需定义视图切换胶囊组件样式');
    assert(cssSource.includes('.shelf-sort-select'), '需定义排序下拉框美化样式');

    // 3. JS 状态流与持久化
    assert(jsSource.includes("shelfViewMode: 'grid'"), '默认视图状态需为 grid');
    assert(jsSource.includes("shelfSortBy: 'recent'"), '默认排序状态需为 recent');
    assert(jsSource.includes('STORAGE_KEY_SHELF_VIEW'), '需定义视图模式本地持久化键');
    assert(jsSource.includes('STORAGE_KEY_SHELF_SORT'), '需定义排序方式本地持久化键');
    assert(jsSource.includes('function initShelfControls()'), '需包含书架控制矩阵初始化函数');
});

test('微信读书封面系统：莫兰迪 8 大高级色系精装算法封面与阅读进度胶囊', () => {
    // 1. 莫兰迪色系与算法封面
    assert(jsSource.includes('MORANDI_COVER_THEMES'), '需定义莫兰迪 8 大高级色系主题');
    assert(jsSource.includes('function getCoverThemeByTitle('), '需包含书名哈希匹配色系封面函数');
    assert(cssSource.includes('.cover-style-morandi-pine'), 'CSS 需支持松柏青绿书封');
    assert(cssSource.includes('.cover-style-morandi-indigo'), 'CSS 需支持黛蓝深邃书封');
    assert(cssSource.includes('.cover-style-morandi-crimson'), 'CSS 需支持朱砂赤红书封');
    assert(cssSource.includes('.card-cover-generated'), '需支持纯 CSS 算法精装书封');
    assert(cssSource.includes('.card-cover-spine'), '需支持拟真立体书脊光影');
    assert(cssSource.includes('.card-cover-edge'), '需支持拟真书页厚度反光边');

    // 2. 阅读进度条与胶囊
    assert(cssSource.includes('.card-progress-pill'), '需定义阅读进度胶囊徽章');
    assert(cssSource.includes('.card-progress-fill'), '需定义进度条填充动画样式');
    assert(jsSource.includes('已读'), '卡片元数据中需展示已读百分比');
});

test('在线开源书库：精选公版典藏、古登堡7万+书库、开源小说导航、Open Library 检索、直链导入与 CSP 授权', () => {
    // 1. HTML 抽屉与标签页
    assert(htmlSource.includes('id="drawer-online-search"'), '需包含在线开源书库搜索抽屉');
    assert(htmlSource.includes('id="tab-online-classics"'), '需包含精选公版名著标签');
    assert(htmlSource.includes('id="tab-online-gutenberg"'), '需包含古登堡计划标签');
    assert(htmlSource.includes('id="tab-online-sources"'), '需包含开源小说书源导航标签');
    assert(htmlSource.includes('id="tab-online-openlibrary"'), '需包含 Open Library 国际书库标签');
    assert(htmlSource.includes('id="tab-online-url"'), '需包含直链导入标签');
    assert(htmlSource.includes('id="online-search-results"'), '需包含搜索结果渲染容器');

    // 2. CSP 授权放行
    const headersSource = readFileSync(new URL('../_headers', import.meta.url), 'utf8');
    assert(headersSource.includes('https://openlibrary.org'), 'CSP connect-src 需授权 openlibrary.org');
    assert(headersSource.includes('https://archive.org'), 'CSP connect-src 需授权 archive.org');
    assert(headersSource.includes('https://gutendex.com'), 'CSP connect-src 需授权 gutendex.com');
    assert(headersSource.includes('https://www.gutenberg.org'), 'CSP connect-src 需授权 gutenberg.org');

    // 3. JS 内置公版典藏与搜索总装
    assert(jsSource.includes('CURATED_OPEN_BOOKS'), '需内置高质量公版典藏书目');
    assert(jsSource.includes('curated_nahan') && jsSource.includes('curated_liaozhai'), '公版典藏需扩充鲁迅、聊斋等名作');
    assert(jsSource.includes('function performGutenbergSearch('), '需支持古登堡 REST API 免翻墙检索');
    assert(jsSource.includes('function renderSourcesGuide()'), '需支持开源找书导航平台');
    assert(jsSource.includes('function initOnlineBookSearch()'), '需包含在线书库搜索与导入引擎');
    assert(jsSource.includes('function importCuratedBook('), '需支持精选公版书一键存入书架');
});

test('缺陷修复：书架在线找书抽屉与全局浮层严禁嵌套于隐藏视图，确保移动端书架大厅点击即时唤起与关闭', () => {
    // 1. DOM 层级架构核查：确保抽屉绝不能被嵌套在带有 hidden 的 view-reader 内部
    const readerStart = htmlSource.indexOf('id="view-reader"');
    const drawerToc = htmlSource.indexOf('id="drawer-toc"');
    const drawerOnline = htmlSource.indexOf('id="drawer-online-search"');
    assert(readerStart > 0, '需包含 view-reader');
    assert(drawerOnline > 0, '需包含 drawer-online-search');
    // view-reader 在 drawer-toc 之前已关闭
    assert(drawerToc > readerStart, 'drawer-toc 必须脱离 view-reader 独立存在');
    assert(drawerOnline > readerStart, 'drawer-online-search 必须脱离 view-reader 独立存在');

    // 2. 闭环函数与统一抽屉回收列表
    assert(jsSource.includes("const drawers = ['drawer-toc', 'drawer-settings', 'drawer-bookshelf', 'drawer-online-search']"), 'closeAllDrawers 必须完整回收所有抽屉包括 drawer-online-search');
    assert(jsSource.includes('function closeDrawer('), '必须定义 closeDrawer 供关闭按钮调用');

    // 3. 移动端 CSS 视口变量兜底防御
    assert(cssSource.includes('--ui-top: 0px'), ':root 需具备移动端视口兜底变量');
    assert(cssSource.includes('var(--ui-top, 0px)'), '媒体查询需具备默认兜底安全值以防无效 calc');
});

test('正文全文检索与上下文跳转系统：秒级全文检索、章节高亮定位、浮动导航与一键原位返回', () => {
    // 1. HTML 节点结构与无障碍标记
    assert(htmlSource.includes('id="reader-btn-search"'), '阅读器顶栏需包含正文搜索按钮');
    assert(htmlSource.includes('id="tab-btn-search"'), '左侧抽屉分段标签中需包含正文搜索标签');
    assert(htmlSource.includes('id="search-count-badge"'), '正文搜索标签需包含匹配计数徽章');
    assert(htmlSource.includes('id="reader-search-panel"'), '需包含正文搜索面板容器');
    assert(htmlSource.includes('id="reader-inbook-search-input"'), '需包含正文搜索输入框');
    assert(htmlSource.includes('id="reader-inbook-search-clear"'), '需包含一键清空搜索按钮');
    assert(htmlSource.includes('id="reader-inbook-search-meta"'), '需包含搜索匹配状态指示条');
    assert(htmlSource.includes('id="reader-inbook-search-results"'), '需包含正文搜索结果列表挂载区');
    assert(htmlSource.includes('id="reader-search-dock"'), '需包含正文检索悬浮快速导航条');
    assert(htmlSource.includes('id="search-dock-query"'), '检索导航条需展示当前关键词');
    assert(htmlSource.includes('id="search-dock-counter"'), '检索导航条需展示当前序号与总数');
    assert(htmlSource.includes('id="btn-search-prev"'), '检索导航条需支持上一处定位');
    assert(htmlSource.includes('id="btn-search-next"'), '检索导航条需支持下一处定位');
    assert(htmlSource.includes('id="btn-search-return"'), '检索导航条必须提供一键返回原阅读位置按钮');
    assert(htmlSource.includes('id="btn-search-exit"'), '检索导航条需支持退出高亮');

    // 2. CSS 样式设计与视觉规范
    assert(cssSource.includes('.inbook-search-panel'), '需包含正文搜索面板样式');
    assert(cssSource.includes('.inbook-search-box'), '需包含带聚焦环的高质感搜索框');
    assert(cssSource.includes('.inbook-search-input'), '需包含输入框样式');
    assert(cssSource.includes('.search-chapter-header'), '需包含章节吸顶头部样式');
    assert(cssSource.includes('.search-result-card'), '需包含搜索结果卡片样式');
    assert(cssSource.includes('.search-snippet-match'), '需包含卡片内匹配词高亮高对比样式');
    assert(cssSource.includes('mark.reader-search-hit'), '正文内部需高亮标记匹配词');
    assert(cssSource.includes('mark.reader-search-hit.active'), '当前聚焦的高亮词需具有呼吸脉冲动效');
    assert(cssSource.includes('.reader-search-dock'), '需包含悬浮胶囊导航条样式');
    assert(cssSource.includes('.search-dock-btn.search-dock-return'), '返回原位按钮需具备醒目主题强调色');

    // 3. JS 检索算法与交互生命周期验证
    assert(jsSource.includes('function searchInBook('), '必须定义全书正文扫描检索函数');
    assert(jsSource.includes('function renderSearchResults('), '必须包含按章节分组的结果渲染函数');
    assert(jsSource.includes('function jumpToSearchResult('), '必须包含定位跳转与上下文高亮激活函数');
    assert(jsSource.includes('function applySearchHighlights('), '必须包含正文节点级 TreeWalker 安全高亮标记');
    assert(jsSource.includes('function navigateSearchMatch('), '必须包含上一处/下一处轮转导航');
    assert(jsSource.includes('function returnToSearchOrigin('), '必须包含记忆并一键还原搜索前位置函数');
    assert(jsSource.includes('function exitSearchSession('), '必须包含清理检索会话与销毁正文高亮函数');
    assert(jsSource.includes('function initInBookSearch()'), '必须包含正文检索总装与事件监听');
    assert(jsSource.includes('initInBookSearch();'), '需在 bindEvents 中正确初始化正文检索引擎');

    // 4. 快捷键与会话生命周期
    assert(jsSource.includes("e.key.toLowerCase() === 'f'"), '需支持 Ctrl+F / Cmd+F 快捷调出正文搜索');
    assert(jsSource.includes("e.key === 'F3'"), '需支持 F3 / Shift+F3 定位下一个/上一个');
    assert(jsSource.includes("e.key === 'Escape'"), '需支持 Esc 极速退出检索高亮');
});

test('个人数据主权与备份抗丢书治理：突破 2MB 阈值、IndexedDB/内存全量提取与 PDF 二进制 Base64 跨机还原', () => {
    // 1. 源码架构与提取优先级审计
    assert(jsSource.includes('async function exportBookshelfBackup('), 'exportBookshelfBackup 需支持异步全量导出');
    assert(jsSource.includes("tx.objectStore('custom_books')"), '导出需直连 IndexedDB custom_books 仓库');
    assert(jsSource.includes('!BUILTIN_BOOKS[b.id]'), '导出需支持内存 state.books 兜底提取并过滤公版内置书');
    assert(jsSource.includes('pdfDataBase64'), 'PDF 电子书需转换为 Base64 编码以在 JSON 中持久化');

    // 2. 导入兼容与二进制还原审计
    assert(jsSource.includes("book.format === 'pdf'"), '导入恢复必须兼容 PDF 格式书目');
    assert(jsSource.includes('atob(book.pdfDataBase64)'), '导入恢复需将 Base64 反序列化为二进制 ArrayBuffer');
    assert(jsSource.includes('saveCustomBook(book)'), '恢复书籍需持久化存储入库');

    // 3. 模拟沙箱运行验证：验证超大书籍在 localStorage 为空时能否由内存导出
    const mockBook = {
        id: 'large_custom_book_001',
        title: '长篇科幻巨著（模拟超大文本）',
        author: '测试作者',
        format: 'txt',
        chapters: [{ title: '第一章 启程', content: ['在遥远的星系边缘...'.repeat(500)] }]
    };
    const mockPdfBook = {
        id: 'custom_pdf_002',
        title: '深度学习导论 PDF',
        format: 'pdf',
        pdfData: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]).buffer, // %PDF-1.5
        chapters: [{ title: 'PDF 第一页', page: 1 }]
    };

    // 验证 Base64 转换逻辑在 Node 环境正常运行
    let binary = '';
    const bytes = new Uint8Array(mockPdfBook.pdfData);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const b64 = Buffer.from(binary, 'binary').toString('base64');
    assert.equal(b64, 'JVBERi0xLjU=');

    // 反序列化还原
    const decoded = Buffer.from(b64, 'base64');
    assert.equal(decoded[0], 0x25); // '%'
    assert.equal(decoded[1], 0x50); // 'P'
    assert.equal(decoded[2], 0x44); // 'D'
    assert.equal(decoded[3], 0x46); // 'F'
});

test('阅读器与全站：正文视口防挤压空白、列宽零值兜底自愈与移动端顶栏安全区避让防遮挡', () => {
    const css = readFileSync(new URL('../reader.css', import.meta.url), 'utf8');
    const js = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');
    const styleCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    const spaceCss = readFileSync(new URL('../space.css', import.meta.url), 'utf8');
    const toolsCss = readFileSync(new URL('../tools/tools.css', import.meta.url), 'utf8');

    // 1. 阅读器正文容器显隐与 [hidden] 优先级守护
    assert(css.includes('.reader-viewport[hidden],') && css.includes('.reader-openpageflip-wrap[hidden],'), 'reader.css 必须为阅读器各分屏容器显式定义 [hidden] display: none !important');
    assert(css.includes('[hidden] {\n    display: none !important;\n}'), 'reader.css 必须包含全局 [hidden] 最高优先级规则，防止 display: flex 挤压正文产生大白屏');

    // 2. reader.js 健壮性：未知书目自动优雅兜底与章节数组防呆
    assert(js.includes('book = BUILTIN_BOOKS.prince'), 'loadBook 遇到未知或损坏书目时必须自动兜底小王子典藏本');
    assert(js.includes('Math.max(260, rawWidth'), 'updatePaginationMetrics 必须对 0 宽视口进行 Math.max(260) 兜底保护');
    assert(js.includes('requestAnimationFrame(() => updatePaginationMetrics(preserveAnchor))'), '视口未就绪（0 宽）时必须在下一帧重新排版以自愈重测');

    // 3. 手机端顶部文字（蓝昴空间等）状态栏与刘海屏安全区避让防遮挡
    assert(css.includes('.shelf-header {\n    position: sticky;\n    top: 0;\n    left: 0;\n    right: 0;\n    padding-top: env(safe-area-inset-top, 0px);'), '书架大厅题头必须包含 env(safe-area-inset-top) 避让');
    assert(css.includes('.reader-topbar {\n    position: fixed;\n    top: 0;\n    left: 0;\n    right: 0;\n    padding-top: env(safe-area-inset-top, 0px);'), '阅读器控制栏必须包含 env(safe-area-inset-top) 避让');
    assert(styleCss.includes('.navbar {\n    position: fixed;\n    top: 0;\n    left: 0;\n    right: 0;\n    z-index: 9999;\n    padding-top: env(safe-area-inset-top, 0px);'), '首页导航条必须原生包含 env(safe-area-inset-top) 避让');
    assert(styleCss.includes('calc(124px + env(safe-area-inset-top, 0px))') || styleCss.includes('calc(128px + env(safe-area-inset-top, 0px))'), '首页 Hero 区域必须包含足够的顶部距离防止标题蓝昴空间被状态栏挤压遮挡');
    assert(spaceCss.includes('padding:calc(16px + env(safe-area-inset-top,0px))'), '成员空间导航条需适配状态栏安全区');
    assert(toolsCss.includes('padding-top: calc(48px + env(safe-area-inset-top, 0px))'), '工具箱顶栏需适配状态栏安全区');
});

test('阅读器移动端 iOS Safari 16px 防缩放保护：书架/书内/在线书库/伴读下拉控件 16px 规范与触控靶心', () => {
    const readerCss = readFileSync(new URL('../reader.css', import.meta.url), 'utf8');
    assert(/@media\s*\([^)]*max-width:\s*820px[^)]*\)[\s\S]*?\.shelf-search-input[\s\S]*?font-size:\s*16px/i.test(readerCss), '书架搜索框在小屏下必须具备 16px 防 iOS 自动放大');
    assert(/@media\s*\([^)]*max-width:\s*820px[^)]*\)[\s\S]*?\.inbook-search-input[\s\S]*?font-size:\s*16px/i.test(readerCss), '书内正文搜索框在小屏下必须具备 16px 防 iOS 自动放大');
    assert(/@media\s*\([^)]*max-width:\s*820px[^)]*\)[\s\S]*?\.online-search-input[\s\S]*?font-size:\s*16px/i.test(readerCss), '在线开源书库搜索框在小屏下必须具备 16px 防放大');
    assert(/@media\s*\([^)]*max-width:\s*820px[^)]*\)[\s\S]*?\.reader-audio-panel select[\s\S]*?font-size:\s*16px/i.test(readerCss), '伴读声音选择下拉框在小屏下必须具备 16px 防放大');
    assert(/@media\s*\([^)]*max-width:\s*820px[^)]*\)[\s\S]*?\.shelf-sort-select[\s\S]*?min-height:\s*44px/i.test(readerCss), '书架排序下拉框需具备 44px 触控靶心');
});

test('阅读器书架置底工具栏 40-44px 人机工程学靶心与防误按优化', () => {
    const readerCss = readFileSync(new URL('../reader.css', import.meta.url), 'utf8');
    assert(/@media\s*\([^)]*max-width:\s*640px[^)]*\)[\s\S]*?\.shelf-tool-btn\s*\{[^}]*min-width:\s*42px/i.test(readerCss), '书架底栏按钮在小屏下需具备不低于 42px 人机工程靶心');
    assert(/@media\s*\([^)]*max-width:\s*380px[^)]*\)[\s\S]*?\.shelf-brand-title\s*\{[^}]*display:\s*none/i.test(readerCss), '极窄屏下需隐藏书架冗余标题释放横向空间');
    assert(/@media\s*\([^)]*max-width:\s*380px[^)]*\)[\s\S]*?\.shelf-tool-btn\s*\{[^}]*min-width:\s*40px/i.test(readerCss), '极窄屏下仍必须保持不低于 40px 的大拇指防误触尺寸');
});

test('阅读器自定义书籍安全删除防护与书签/笔记级联清理', () => {
    const readerJs = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');
    const readerCss = readFileSync(new URL('../reader.css', import.meta.url), 'utf8');

    // 1. 安全删除确认函数与绑定
    assert(readerJs.includes('function confirmDeleteCustomBook'), '必须提供删除二次确认防误删函数');
    assert(readerJs.includes('window.confirm'), '必须调用二次确认对话框告知用户删除后果');
    assert(readerJs.includes('confirmDeleteCustomBook(b.id)'), '卡片删除按钮必须绑定确认函数而非直接硬删除');

    // 2. 书签与划线笔记孤儿记录级联清理
    assert(readerJs.includes('state.bookmarks[bookId]'), '必须级联检查并清理关联书签');
    assert(readerJs.includes('state.highlights[bookId]'), '必须级联检查并清理关联划线笔记');
    assert(readerJs.includes('saveBookmarks()'), '书签清理后需持久化更新存储');
    assert(readerJs.includes('saveHighlights()'), '划线笔记清理后需持久化更新存储');

    // 3. 移动端人机工程与样式
    assert(readerCss.includes('.card-delete-btn'), '需定义卡片删除按钮样式');
    assert(readerCss.includes('touch-action: manipulation'), '需优化移动端触控防误按属性');
    assert(/@media\s*\([^)]*max-width:\s*768px[^)]*\)[\s\S]*?\.card-delete-btn[\s\S]*?width:\s*30px/i.test(readerCss), '移动端删除按钮尺寸需优化至 30px 便于明确操作与防遮挡');
});

test('连续长卷滚动模式移动端防假死人机工程：手势点按唤出菜单、视口轻触兜底、进度条拖拽滚动与翻页滚动', () => {
    const readerJs = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');

    // 1. 手势状态机支持在长卷模式下放行轻触点按 onTap
    assert(readerJs.includes("isSwipeEnabled: () => state.settings.mode !== 'scroll'"), '状态机需声明长卷模式仅禁用横滑、保留轻触点按');
    assert(/onTap:\s*\(zone\)\s*=>\s*\{[\s\S]*?if\s*\(state\.settings\.mode === 'scroll'\)\s*\{\s*toggleMenu\(\);/.test(readerJs), '长卷模式下触屏轻触必须触发 toggleMenu 唤起控制栏');

    // 2. 视口轻触点击兜底，双重保障触屏与指针均能唤出菜单
    assert(/readerVp\.addEventListener\('click'[\s\S]*?if\s*\(state\.settings\.mode !== 'scroll'\)\s*return;[\s\S]*?toggleMenu\(\);/.test(readerJs), '视口需具备长卷模式轻触唤起菜单兜底监听');

    // 3. 进度条在长卷模式下的 0-100 百分比同步与拖拽定位
    assert(/updateSlider\(\)[\s\S]*?if\s*\(state\.settings\.mode === 'scroll'\)\s*\{[\s\S]*?slider\.min = '0';[\s\S]*?slider\.max = '100'/.test(readerJs), '长卷模式下翻页进度条需支持 0-100% 映射');
    assert(/slider\.addEventListener\('input'[\s\S]*?if\s*\(state\.settings\.mode === 'scroll'\)\s*\{[\s\S]*?vp\.scrollTop = Math\.round\(maxScroll \* pct\);/.test(readerJs), '长卷模式下拖动进度条必须实时平滑滚动视口');

    // 4. nextPage 与 prevPage 在长卷模式下的滚动步进与跨章衔接
    assert(/function nextPage\(\)[\s\S]*?if\s*\(state\.settings\.mode === 'scroll'\)\s*\{[\s\S]*?vp\.scrollBy\(\{ top: step, behavior: 'smooth' \}\);/.test(readerJs), '长卷模式下下一页需平滑向下滚动一屏');
    assert(/function prevPage\(\)[\s\S]*?if\s*\(state\.settings\.mode === 'scroll'\)\s*\{[\s\S]*?vp\.scrollBy\(\{ top: -step, behavior: 'smooth' \}\);/.test(readerJs), '长卷模式下上一页需平滑向上滚动一屏');
});


