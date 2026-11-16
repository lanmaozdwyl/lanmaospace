import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeEstimate, persistenceState, initStoragePanel } from '../lib/reader-storage.mjs';

test('容量：零使用、未知配额、负值和非数值不伪造百分比', () => {
    assert.equal(summarizeEstimate({ usage: 0, quota: 100 }).percent, 0);
    assert.equal(summarizeEstimate({ usage: 25, quota: 100 }).percent, 25);
    assert.equal(summarizeEstimate({ usage: 101, quota: 100 }).percent, 100);
    for (const quota of [0, -1, undefined, NaN, Infinity, '100']) {
        const result = summarizeEstimate({ usage: 0, quota });
        assert.equal(result.percent, null);
        assert.match(result.text, /配额 未知/);
    }
    assert.match(summarizeEstimate({ usage: -1 }).text, /已用 未知/);
});

test('持久存储：查询不擅自申请，区分已授权、不支持和查询异常', async () => {
    let calls = 0;
    const storage = { persisted: async () => false, persist: async () => { calls++; return true; } };
    assert.equal(await persistenceState(storage), 'available');
    assert.equal(calls, 0);
    assert.equal(await persistenceState({ persisted: async () => true }), 'granted');
    assert.equal(await persistenceState(undefined), 'unsupported');
    assert.equal(await persistenceState({ persisted: async () => false }), 'unsupported');
    assert.equal(await persistenceState({ persisted: async () => { throw Error(); } }), 'error');
});

function fixture(storage) {
    const nodes = new Map();
    function node(id) {
        if (!nodes.has(id)) nodes.set(id, {
            id, hidden: false, open: false, style: {}, textContent: '', value: '', handlers: {},
            addEventListener(type, callback) { this.handlers[type] = callback; },
            click() { return this.handlers.click?.({ target: this }); },
            showModal() { this.open = true; }, close() { this.open = false; },
            removeAttribute() {}, setAttribute() {},
        });
        return nodes.get(id);
    }
    let exported = 0;
    const imported = [];
    initStoragePanel({ document: { getElementById: node }, storage,
        getStats: () => ({ books: 3, highlights: 7, bookmarks: 2 }),
        exportBackup: async () => { assert.equal(node('storage-guard-dialog').open, false); exported++; },
        importBackup: file => { assert.equal(node('storage-guard-dialog').open, false); imported.push(file); },
    });
    return { node, imported, exports: () => exported };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('面板：打开时显示实际统计、0%容量，不触发授权', async () => {
    let calls = 0;
    const f = fixture({ persisted: async () => false, persist: async () => { calls++; }, estimate: async () => ({ usage: 0, quota: 100 }) });
    f.node('shelf-btn-storage-guard').click();
    await settle();
    assert.equal(calls, 0);
    assert.equal(f.node('storage-meta-highlights').textContent, '7');
    assert.equal(f.node('storage-usage-bar-fill').style.width, '0%');
    assert.equal(f.node('storage-request-persist-btn').hidden, false);
});

test('申请：拒绝与异常可重试；成功隐藏按钮；并发点击仅申请一次', async () => {
    for (const result of ['denied', 'error', 'granted']) {
        let release;
        let calls = 0;
        const f = fixture({ persisted: async () => false, persist: () => { calls++; return new Promise((resolve, reject) => { release = () => result === 'error' ? reject(Error()) : resolve(result === 'granted'); }); } });
        f.node('shelf-btn-storage-guard').click(); await settle();
        const button = f.node('storage-request-persist-btn');
        const pending = button.click(); await button.click();
        assert.equal(calls, 1); assert.equal(button.disabled, true);
        release(); await pending;
        assert.equal(button.disabled, false);
        assert.equal(button.hidden, result === 'granted');
        assert.match(f.node('storage-persist-badge').textContent, result === 'error' ? /失败/ : result === 'denied' ? /未获批准/ : /已获/);
    }
});

test('较慢的初始检测不会覆盖主动申请结果', async () => {
    let release;
    const f = fixture({ persisted: () => new Promise(resolve => { release = resolve; }), persist: async () => true });
    f.node('shelf-btn-storage-guard').click();
    await f.node('storage-request-persist-btn').click();
    release(false); await settle();
    assert.match(f.node('storage-persist-badge').textContent, /已获/);
});

test('不支持与容量查询失败提供降级提示；关闭支持 Esc', async () => {
    const f = fixture(undefined);
    f.node('shelf-btn-storage-guard').click(); await settle();
    assert.match(f.node('storage-persist-badge').textContent, /不支持/);
    assert.equal(f.node('storage-request-persist-btn').hidden, true);
    assert.match(f.node('storage-usage-num').textContent, /无法提供/);
    f.node('storage-guard-dialog').handlers.cancel({ preventDefault() {} });
    assert.equal(f.node('storage-guard-dialog').hidden, true);
});

test('备份：导出和导入先退出模态；取消不导入；选择相同文件仍可重试', async () => {
    const f = fixture(undefined);
    f.node('shelf-btn-storage-guard').click();
    await f.node('storage-dialog-btn-export').click();
    assert.equal(f.exports(), 1);
    const input = f.node('storage-backup-file-input');
    input.files = []; input.handlers.change(); assert.equal(f.imported.length, 0);
    const file = { name: 'backup.json' };
    for (let i = 0; i < 2; i++) {
        f.node('shelf-btn-storage-guard').click();
        input.files = [file]; input.value = file.name; input.handlers.change();
        assert.equal(input.value, '');
    }
    assert.deepEqual(f.imported, [file, file]);
});

test('原生恢复输入位于模态内部，键盘可用，保留原恢复校验且未引入永久保证', () => {
    const html = readFileSync(new URL('../reader.html', import.meta.url), 'utf8');
    const panel = html.match(/<dialog id="storage-guard-dialog"[\s\S]*?<\/dialog>/)[0];
    assert.match(panel, /<input[^>]*id="storage-backup-file-input"[^>]*class="reader-file-picker"/);
    assert.doesNotMatch(panel, /for="shelf-backup-file-input"|\son\w+=|永久|绝不会/);
    const js = readFileSync(new URL('../reader.js', import.meta.url), 'utf8');
    assert.match(js, /importBackup: importBookshelfBackup/);
    assert.match(js, /data\.app !== 'lanmao-reader-backup'/);
    assert.match(js, /非法备份文件格式/);
});
