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
    fire(name) { for (const fn of this.listeners[name] ?? []) fn(); }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
}

const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

async function runStore(fetchImpl) {
    const elements = new Map();
    const get = id => {
        if (!elements.has(id)) elements.set(id, new El());
        return elements.get(id);
    };
    const filters = new El('div');
    const document = {
        getElementById: get,
        querySelector: sel => (sel === '.shop-filters' ? filters : new El('div')),
        createElement: tag => new El(tag),
    };
    const source = readFileSync(new URL('../store.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/m, '');
    const ctx = vm.createContext({
        document, console, AbortSignal,
        fetch: (...args) => fetchImpl(...args),
        validateCatalog, productDetails, availabilityLabels,
        setTimeout, clearTimeout,
    });
    const done = vm.runInContext(`(async()=>{${source}\n})()`, ctx);
    return {elements, get, filters, done, flush};
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
