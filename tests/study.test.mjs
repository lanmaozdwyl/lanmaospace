import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dayAt} from '../lib/focus.mjs';

const source = readFileSync(new URL('../study/study.js', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '');
const now = new Date(2026, 10, 26, 15).getTime();

async function fixture(user, storage) {
    const listeners = {};
    let authChanged;
    const fields = {disabled: true};
    const status = {};
    const elements = {goal: {value: ''}, review: {value: ''}, next: {value: ''}};
    const form = {elements, addEventListener: (type, handler) => { listeners[type] = handler; },
        reset() { for (const input of Object.values(elements)) input.value = ''; }};
    const nodes = {'study-form': form, 'study-fields': fields, 'study-status': status};
    await vm.runInNewContext(source, {
        dayAt, Date: {now: () => now}, document: {getElementById: id => nodes[id]},
        window: {addEventListener() {}},
        localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
        getSupabase: async () => ({auth: {
            getSession: async () => ({data: {session: user ? {user: {id: user}} : null}}),
            onAuthStateChange(callback) { authChanged = callback; },
        }}),
    });
    return {fields, status, elements, save: () => listeners.submit({preventDefault() {}}), signOut: () => authChanged('SIGNED_OUT')};
}

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
