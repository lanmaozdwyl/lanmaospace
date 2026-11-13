// 长卷滚动的"当前章节"定位必须走缓存，不能每次滚动都重扫全文档。
// 旧实现每个 scroll 事件 querySelectorAll('.scroll-chapter-section') 再逐节读
// offsetTop + offsetHeight，而同一个回调末尾要写页眉和进度条；写一次布局就脏一次，
// 下一帧的读必然触发整卷强制重排。这里用假 DOM 数读取次数把这件事钉住：
// 允许第一次测，之后的滚动一次都不许多读。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');
const FROM = '    // ----- 长卷模式"当前读到第几章"的定位缓存 -----';
const TO = '    // 0 宽视口自愈重测的次数上限';
const block = () => {
    const start = source.indexOf(FROM);
    const end = source.indexOf(TO);
    assert.ok(start >= 0 && end > start, '找不到长卷定位缓存代码块，切片前提已经变了');
    return source.slice(start, end);
};

// 每读一次 offsetTop 记一笔，等价于浏览器被迫做一次布局测量。
function fakeSections(specs) {
    const reads = { count: 0 };
    const nodes = specs.map((s, i) => ({
        get offsetTop() { reads.count++; return s.top; },
        getAttribute: n => (n === 'data-chapter-index'
            ? (s.attr === undefined ? String(i) : s.attr)
            : null),
    }));
    return { reads, el: { querySelectorAll: sel => {
        assert.equal(sel, '.scroll-chapter-section');
        return nodes;
    } } };
}

function boot(specs) {
    const { reads, el } = fakeSections(specs);
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(`${block()}\nthis.api = { scrollSections, invalidateScrollSections, measureScrollSections, findScrollSectionIndex };`, ctx);
    return { api: ctx.api, reads, el };
}

test('二分定位取"最后一个顶边不超过视线"的分区，视线在首节之上时不算切换', () => {
    const tops = [0, 900, 1800, 2700];
    assert.equal(vmFind(tops, 0), 0);
    assert.equal(vmFind(tops, 899), 0);
    assert.equal(vmFind(tops, 900), 1);
    assert.equal(vmFind(tops, 2000), 2);
    assert.equal(vmFind(tops, 99999), 3);
    assert.equal(vmFind([], 100), -1, '空文档必须返回 -1，让调用方保持原章节');
    assert.equal(vmFind([500], 100), -1, '视线还没到第一节时不能乱切');
});

// 单独取一个纯函数出来跑，省得为了测二分把整套状态机搬进 vm。
function vmFind(tops, triggerY) {
    const { api } = boot([]);
    return api.findScrollSectionIndex(tops, triggerY);
}

test('缓存命中期间不再读布局；显式作废后才重测一次', () => {
    const specs = [{ top: 0 }, { top: 900 }, { top: 1800 }];
    const { api, reads, el } = boot(specs);
    assert.equal(api.scrollSections.dirty, true, '初始必须是脏的，否则打开新书会拿到空缓存');

    for (let i = 0; i < 5; i++) {
        if (api.scrollSections.dirty) api.measureScrollSections(el);
        // 视线 1000px 落在顶边 900 的那一节里，不是下一节。
        assert.equal(api.findScrollSectionIndex(api.scrollSections.tops, 1000), 1);
    }
    assert.equal(reads.count, 3, '五趟定位只准测一遍，每节读一次');
    // 摊平再比：数组是 vm 里造的，原型跟本 realm 不同，deepStrictEqual 会判不等。
    assert.deepEqual([...api.scrollSections.indexes], [0, 1, 2]);

    api.invalidateScrollSections();
    assert.equal(api.scrollSections.dirty, true);
    if (api.scrollSections.dirty) api.measureScrollSections(el);
    assert.equal(reads.count, 6, '作废之后应当重测，且只重测一遍');
});

test('data-chapter-index 缺失或非法时退回文档顺序，不会定位到错误的章', () => {
    const { api, el } = boot([
        { top: 0, attr: '7' },
        { top: 900, attr: null },
        { top: 1800, attr: 'abc' },
    ]);
    // 第二、三节拿不到合法编号：读不到就按位置补 1、2，第一节仍尊重真实编号 7。
    api.measureScrollSections(el);
    assert.deepEqual([...api.scrollSections.indexes], [7, 1, 2]);
});

test('全文只有 measureScrollSections 一处扫描分区，扫描循环不允许回到滚动回调', () => {
    const hits = [...source.matchAll(/querySelectorAll\(['"]\.scroll-chapter-section['"]\)/g)];
    assert.equal(hits.length, 1, `分区扫描出现了 ${hits.length} 次，滚动回调里不能再来一遍`);
    assert.doesNotMatch(source, /sections\.forEach\(sec\s*=>/, '旧的逐节 offsetTop 扫描必须删干净');
});

test('滚动回调按帧合批，一帧内多次 scroll 只执行一遍', () => {
    assert.match(source, /scrollFrame = requestAnimationFrame\(runScrollPass\)/);
    assert.match(source, /if \(scrollFrame\) return;/);
    // 合批只在监听器里做，回调本体仍然要留在 runScrollPass 中，
    // 否则以后有人把逻辑挪回监听器，节流就形同虚设。
    assert.match(source, /const runScrollPass = \(\) => \{[\s\S]*?scrollFrame = 0;[\s\S]*?updateSlider\(\);/);
});
