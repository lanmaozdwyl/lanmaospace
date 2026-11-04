import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validateCatalog, productDetails, availabilityLabels} from '../lib/catalog.mjs';

const catalogData = [
    {name: 'ChatGPT Plus', category: 'ChatGPT', period: '1 个月', note: '核对订阅状态。', price: 124, image: 'images/products/chatgpt-plus.png'},
    {name: 'Claude Pro', category: 'Claude', period: '1 个月', note: '确认使用时间。', price: 165},
    {name: 'Grok Plus', category: 'Grok', period: '1 个月', note: '核对已有订阅。', price: 70},
];

class El {
    constructor(tag = 'div') {
        this.tag = tag;
        this.children = [];
        this.textContent = '';
        this.className = '';
        this.value = '';
        this.hidden = false;
        this.disabled = false;
        this.href = '';
        this.src = '';
        this.alt = '';
        this.attrs = {};
        this.listeners = {};
        this.focused = false;
        this.open = false;
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k]; }
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
    fire(name, ...args) { for (const fn of this.listeners[name] ?? []) fn(...args); }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getBoundingClientRect() {
        return { left: 100, right: 400, top: 100, bottom: 500, width: 300, height: 400 };
    }
    get classList() {
        return {
            add: (...classes) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); classes.forEach(c => set.add(c)); this.className = [...set].join(' '); },
            remove: (...classes) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); classes.forEach(c => set.delete(c)); this.className = [...set].join(' '); },
            contains: c => this.className.split(/\s+/).includes(c),
        };
    }
}

const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

async function runStore(fetchImpl) {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, new El());
        return elements.get(id);
    };
    const filters = new El('div');
    const body = new El('body');
    let copiedText = '';
    const navigator = {
        clipboard: {
            writeText: async (t) => { copiedText = t; }
        }
    };
    const document = {
        getElementById: get,
        querySelector: sel => (sel === '.shop-filters' ? filters : new El('div')),
        createElement: tag => new El(tag),
        body,
    };
    const source = readFileSync(new URL('../store.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/m, '');
    const ctx = vm.createContext({
        document, console, AbortSignal, navigator,
        fetch: (...args) => fetchImpl(...args),
        validateCatalog, productDetails, availabilityLabels,
        setTimeout, clearTimeout,
    });
    const done = vm.runInContext(`(async()=>{${source}\n})()`, ctx);
    return {elements, get, filters, done, flush, getCopiedText: () => copiedText};
}

const successFetch = () => async () => ({ok: true, json: async () => structuredClone(catalogData)});
const titles = grid => grid.children.map(card => card.children[1].textContent);
const countText = get => get('result-count').textContent;

test('加载失败显示错误，搜索与分类不改写失败提示', async () => {
    const {get, filters, done} = await runStore(async () => { throw Error('network down'); });
    await done; await flush();
    assert.equal(get('catalog-error').hidden, false);
    assert.equal(countText(get), '商品加载失败，请重试。');
    assert.equal(get('empty').hidden, true);
    assert.equal(get('products').children.length, 0);
    assert.equal(get('catalog-retry').disabled, false);
    get('search').value = 'ChatGPT';
    get('search').fire('input');
    assert.equal(countText(get), '商品加载失败，请重试。');
    assert.equal(get('empty').hidden, true);
    assert.equal(get('products').children.length, 0);
    filters.children[0].onclick();
    assert.equal(countText(get), '商品加载失败，请重试。');
    assert.equal(get('empty').hidden, true);
});

test('重试期间按钮禁用并显示读取中，成功后恢复', async () => {
    let resolveFetch;
    const pending = new Promise(r => { resolveFetch = r; });
    const fetchImpl = () => pending.then(() => ({ok: true, json: async () => structuredClone(catalogData)}));
    const {get, done} = await runStore(fetchImpl);
    await flush(2);
    assert.equal(get('catalog-retry').disabled, true);
    assert.equal(countText(get), '正在读取商品…');
    resolveFetch();
    await done; await flush();
    assert.equal(get('catalog-retry').disabled, false);
    assert.equal(countText(get), '3 款可咨询商品');
    assert.equal(get('products').children.length, 3);
});

test('搜索与分类组合筛选一致', async () => {
    const {get, filters, done} = await runStore(successFetch());
    await done; await flush();
    const search = get('search');
    search.value = 'claude'; search.fire('input');
    assert.deepEqual(titles(get('products')), ['Claude Pro']);
    assert.equal(countText(get), '1 款可咨询商品');
    search.value = ''; search.fire('input');
    assert.equal(get('products').children.length, 3);
    const grok = filters.children.find(b => b.textContent === 'Grok');
    grok.onclick();
    assert.deepEqual(titles(get('products')), ['Grok Plus']);
    search.value = 'pro'; search.fire('input');
    assert.equal(get('products').children.length, 0);
    assert.equal(get('empty').hidden, false);
    const all = filters.children.find(b => b.textContent === '全部');
    all.onclick();
    assert.deepEqual(titles(get('products')), ['Claude Pro']);
});

test('详情打开设置字段并显示，关闭后焦点回到触发按钮', async () => {
    const {get, done} = await runStore(successFetch());
    await done; await flush();
    const card = get('products').children[0];
    const button = card.children[4];
    button.onclick();
    const detail = get('detail');
    assert.equal(detail.open, true);
    assert.equal(get('detail-title').textContent, 'ChatGPT Plus');
    assert.match(get('detail-period').textContent, /¥124/);
    assert.equal(get('detail-note').textContent, '核对订阅状态。');
    assert.match(get('inquiry').href, /3126477562/);
    detail.close();
    assert.equal(button.focused, true);
});

test('无匹配时显示空提示并计数为零', async () => {
    const {get, done} = await runStore(successFetch());
    await done; await flush();
    get('search').value = '不存在的商品 xyz';
    get('search').fire('input');
    assert.equal(get('products').children.length, 0);
    assert.equal(get('empty').hidden, false);
    assert.equal(countText(get), '0 款可咨询商品');
});

test('未填写质保时不生成 undefined 或退款承诺',async()=>{
 const {get,done}=await runStore(successFetch());await done;await flush();
 get('products').children[0].children[4].onclick();
 assert.equal(get('detail-warranty-text').textContent,'质保与售后范围请在付款前联系店主确认。');
});
test('无质保与已填写质保商品展示对应说明',async()=>{
 const rows=catalogData.map((p,i)=>({...p,warranty:i===0?'无质保':'质保 1 个月'}));
 const {get,done}=await runStore(async()=>({ok:true,json:async()=>rows}));await done;await flush();
 get('products').children[0].children[4].onclick();assert.equal(get('detail-warranty-text').className,'warranty-none');
 get('products').children[1].children[4].onclick();assert.match(get('detail-warranty-text').textContent,/质保 1 个月/);assert.equal(get('detail-warranty-text').className,'');
});

test('商品详情弹窗支持点击遮罩底板关闭与原位焦点恢复', async () => {
    const {get, done} = await runStore(successFetch());
    await done; await flush();
    const card = get('products').children[0];
    const button = card.children[4];
    button.onclick();
    const detail = get('detail');
    assert.equal(detail.open, true);

    // 1. 点击弹窗内容区域内（例如 x=200, y=200），不应关闭弹窗
    detail.fire('click', {target: detail, clientX: 200, clientY: 200});
    assert.equal(detail.open, true);

    // 2. 点击弹窗外部遮罩（例如 x=50, y=50，小于 rect.left=100），触发关闭并恢复触发按钮焦点
    detail.fire('click', {target: detail, clientX: 50, clientY: 50});
    assert.equal(detail.open, false);
    assert.equal(button.focused, true);
});

test('一键快捷复制 QQ 号并提供友好提示反馈', async () => {
    const {get, done, getCopiedText} = await runStore(successFetch());
    await done; await flush();
    const copyBtn = get('copy-qq-btn');
    assert.equal(typeof copyBtn.onclick, 'function');

    await copyBtn.onclick();
    assert.equal(getCopiedText(), '3126477562');
    assert.match(copyBtn.textContent, /已复制 QQ 号/);
    assert.equal(copyBtn.classList.contains('copied'), true);
    assert.match(get('copy-qq-feedback').textContent, /3126477562/);
});
