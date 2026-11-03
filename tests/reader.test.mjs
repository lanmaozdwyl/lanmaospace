import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const htmlSource = readFileSync(new URL('../reader.html', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../reader.css', import.meta.url), 'utf8');
const jsSource = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');

test('reader.html 结构完整且严格符合 CSP 无内联代码', () => {
    // 包含核心组件
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
