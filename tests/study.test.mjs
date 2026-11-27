import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dayAt} from '../lib/focus.mjs';
import {readerAccountKey, READER_PROGRESS_KEY} from '../lib/reader-account.mjs';

const source = readFileSync(new URL('../study/study.js', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
const now = new Date(2026, 10, 26, 15).getTime();

async function fixture(user, storage, at = now) {
    const listeners = {};
    let authChanged;
    let clock = at;
    const fields = {disabled: true};
    const status = {};
    const elements = Object.fromEntries(['goal', 'review', 'next'].map(name => [name, {name, value: ''}]));
    const form = {elements, addEventListener: (type, handler) => { listeners[type] = handler; },
        reset() { for (const input of Object.values(elements)) input.value = ''; }};
    const nodes = {'study-form': form, 'study-fields': fields, 'study-status': status};
    const node = id => nodes[id] ??= {
        hidden: true, value: '', textContent: '', children: [],
        addEventListener(type, handler) { listeners[id + type] = handler; },
        replaceChildren() { this.children = []; },
        append(item) { this.children.push(item); },
    };
    await vm.runInNewContext(source, {
        dayAt, readerAccountKey, READER_PROGRESS_KEY, Date: {now: () => clock},
        document: {getElementById: node, createElement: () => ({})},
        window: {addEventListener(type, handler) { listeners[type] = handler; }}, navigator: {},
        localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value),
            get length() { return storage.size; }, key: index => [...storage.keys()][index] ?? null},
        getSupabase: async () => ({auth: {
            getSession: async () => ({data: {session: user ? {user: {id: user}} : null}}),
            onAuthStateChange(callback) { authChanged = callback; },
        }}),
    });
    return {fields, status, elements, node, save: () => listeners.submit({preventDefault() {}}),
        setClock: time => { clock = time; },
        changeStorage: key => listeners.storage({key}),
        input(name, value, hasBeforeInput = true) {
            const target = elements[name];
            if (hasBeforeInput) listeners.beforeinput({target});
            target.value = value;
            listeners.input({target});
        },
        useSaved: () => listeners['study-use-savedclick'](), signOut: () => authChanged('SIGNED_OUT')};
}

test('学习页只接续当前账号的阅读进度，切换账号和退出时清除旧入口', async () => {
    const storage = new Map();
    const key = readerAccountKey(READER_PROGRESS_KEY, 'a');
    storage.set(key, JSON.stringify({bookId: 'private&reader'}));
    const owner = await fixture('a', storage);
    const other = await fixture('b', storage);
    const link = 'study-continue-reading';
    assert.equal(owner.node(link).href, '/reader.html?book=private%26reader');
    assert.equal(other.node(link).href, '/reader.html');
    storage.set(key, JSON.stringify({bookId: 'another'}));
    owner.changeStorage(key);
    assert.equal(owner.node(link).href, '/reader.html?book=another');
    owner.signOut();
    assert.equal(owner.node(link).href, '/reader.html');
});
test('页面一直打开时，午夜后新输入写入新一天，旧草稿可留在原日期', async () => {
    const storage = new Map();
    const before = new Date(2026, 10, 26, 23, 59).getTime();
    const after = before + 120000;
    const newDraft = await fixture('a', storage, before);
    newDraft.setClock(after);
    newDraft.input('goal', '今天的目标', false);
    await newDraft.save();
    const prefix = 'lanmao_study_notes_v1_a_';
    assert.equal(storage.has(prefix + dayAt(before)), false);
    assert.equal(JSON.parse(storage.get(prefix + dayAt(after))).goal, '今天的目标');

    const oldDraft = await fixture('a', storage, before);
    oldDraft.input('review', '昨天的复盘');
    oldDraft.setClock(after);
    oldDraft.input('next', '下次复习');
    assert.match(oldDraft.status.textContent, new RegExp(dayAt(before)));
    await oldDraft.save();
    assert.equal(JSON.parse(storage.get(prefix + dayAt(before))).review, '昨天的复盘');
    assert.equal(JSON.parse(storage.get(prefix + dayAt(before))).next, '下次复习');
    assert.match(oldDraft.status.textContent, /已切换至/);
    assert.equal(oldDraft.elements.goal.value, '今天的目标');
    assert.equal(oldDraft.elements.review.value, '');
    assert.match(oldDraft.node('study-previous-next').textContent, /下次复习/);
});

test('学习页按账号和日期保存记录，退出清空可见值，访客无编辑入口', async () => {
    const storage = new Map();
    const owner = await fixture('account-a', storage);
    owner.elements.goal.value = '读完方法部分';
    owner.elements.review.value = '能复述采样流程';
    owner.save();
    assert.match(owner.status.textContent, /已保存/);
    assert.equal(JSON.parse(storage.get('lanmao_study_notes_v1_account-a_' + dayAt(now))).goal, '读完方法部分');
    assert.equal((await fixture('account-a', storage)).elements.review.value, '能复述采样流程');
    assert.equal((await fixture('account-b', storage)).elements.goal.value, '');
    assert.equal((await fixture(null, storage)).fields.disabled, true);
    owner.signOut();
    assert.equal(owner.fields.disabled, true);
    assert.equal(owner.elements.goal.value, '');
});

test('学习页本地存储写入失败时保留表单内容并提示', async () => {
    const storage = new Map();
    storage.set = () => { throw new Error('Quota'); };
    const f = await fixture('test', storage);
    f.elements.review.value = '复盘测试';
    f.save();
    assert.equal(f.elements.review.value, '复盘测试');
    assert.match(f.status.textContent, /保存失败/);
});

test('次日显示上次起点及复盘历史，今天字段独立，其他账号看不到记录', async () => {
    const storage = new Map();
    const yesterday = await fixture('a', storage);
    yesterday.elements.next.value = '继续看结果部分';
    yesterday.elements.review.value = '能说明对照组';
    await yesterday.save();
    const tomorrow = now + 86400000;
    const page = await fixture('a', storage, tomorrow);
    assert.equal(page.elements.next.value, '');
    assert.equal(page.node('study-history-day').value, dayAt(now));
    assert.equal(page.node('study-history-review').textContent, '能说明对照组');
    assert.match(page.node('study-previous-next').textContent, /继续看结果部分/);
    const other = await fixture('b', storage, tomorrow);
    assert.equal(other.node('study-history').hidden, true);
    page.signOut();
    assert.equal(page.node('study-history-review').textContent, '');
});

test('不同标签页的独立字段合并，同一字段冲突保留本机已保存值和本页草稿', async () => {
    const storage = new Map();
    const first = await fixture('a', storage);
    const second = await fixture('a', storage);
    first.elements.goal.value = '阅读方法';
    await first.save();
    second.elements.review.value = '写形成性反思';
    await second.save();
    assert.equal(second.elements.goal.value, '阅读方法');
    const key = 'lanmao_study_notes_v1_a_' + dayAt(now);
    assert.equal(JSON.parse(storage.get(key)).review, '写形成性反思');
    first.elements.goal.value = '新的阅读计划';
    await first.save();
    second.elements.goal.value = '另一份草稿';
    second.elements.next.value = '看附录';
    await second.save();
    assert.match(second.status.textContent, /其他标签页/);
    assert.equal(second.elements.goal.value, '另一份草稿');
    assert.equal(JSON.parse(storage.get(key)).goal, '新的阅读计划');
    second.useSaved();
    await second.save();
    assert.equal(JSON.parse(storage.get(key)).next, '看附录');
    assert.equal(JSON.parse(storage.get(key)).goal, '新的阅读计划');
});
