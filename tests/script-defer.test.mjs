// 解析阻塞脚本守护。
// 浏览器碰到没有 defer/async 的 <script src> 就停下解析、等下载、等执行，
// 一张 45 KB 的书架 HTML 后面挂着 362 KB 的 reader.js 时，首屏要多等一个来回。
// type="module" 天生就是 defer，不用重复标注；这里只盯经典脚本。
// 第二半段盯执行顺序：defer 脚本和 module 脚本同属"延迟执行"队列，按文档顺序跑，
// 所以 memo-config.js 必须排在所有读 window.LANMAO_MEMO_CONFIG 的脚本前面 ——
// 位置错了不是报错而是悄悄地拿到 undefined，登录直接起不来，很难查。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const SKIP = ['.git', 'node_modules', 'dist', 'coverage'];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (SKIP.includes(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full.slice(root.length).split('\\').join('/'));
    }
    return out;
}

const allFiles = walk(root);
const pages = allFiles.filter(f => f.endsWith('.html'));
const scriptsOf = text => [...text.matchAll(/<script\b([^>]*)>/gi)]
    .map(m => ({ attrs: m[1], src: /src\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1] }));
const read = f => readFileSync(join(root, f), 'utf8');
const blocking = text => scriptsOf(text)
    .filter(s => s.src && !/\btype\s*=\s*["']module["']/i.test(s.attrs))
    .filter(s => !/\b(defer|async)\b/i.test(s.attrs))
    .map(s => s.src);

test('每个带 src 的经典脚本都标了 defer 或 async', () => {
    assert.ok(pages.length >= 10, `只找到 ${pages.length} 个页面，扫描范围不对`);
    for (const file of pages) assert.deepEqual(blocking(read(file)), [], `${file} 上有解析阻塞的脚本`);
});

test('反向控制：漏掉 defer 的写法确实会被抓出来', () => {
    const sample = '<script src="reader.js"></script><script type="module" src="a.js"></script>';
    assert.deepEqual(blocking(sample), ['reader.js']);
});

test('memo-config.js 排在每个使用它的脚本前面', () => {
    const consumers = allFiles.filter(f => /\.(m?js)$/.test(f) && f !== 'memo-config.js')
        .filter(f => read(f).includes('LANMAO_MEMO_CONFIG'));
    assert.ok(consumers.length > 0, '没找到任何消费者，这条守护会变成摆设');
    for (const file of pages) {
        const srcs = scriptsOf(read(file)).filter(s => s.src).map(s => s.src);
        // 页面上的 src 有 "memo-config.js"、"../memo-config.js"、"/mobile-nav.js" 三种写法，
        // 一律去掉前导斜杠和相对段再比，否则守护会因为路径拼法不同而漏检。
        const bare = s => s.replace(/^\.?\.?\//, '').replace(/^\//, '');
        const at = name => srcs.findIndex(s => bare(s) === name);
        const cfg = at('memo-config.js');
        for (const name of consumers) {
            const used = at(name);
            if (used < 0) continue;
            assert.ok(cfg >= 0 && cfg < used,
                `${file} 里 memo-config.js 排在了 ${name} 后面或压根没引`);
        }
    }
});
