// CSS 结构体检。三条都是被真实坑逼出来的：
//   1) `body[data-theme="dark"] .x,` 换行紧跟 `@media {…}` —— 选择器列表里冒出一个 at-rule
//      是解析错误，Chrome 实测会把整块丢掉。后果不是"少个样式"这么客气：留言板快捷标签在深色下
//      仍然是 #424245 的深灰字，压在 #1c1c1e 的卡片上几乎看不见。
//   2) `body:not([data-theme="light"])` 只有在"系统深色"时才等于深色；写在 @media 外面，
//      系统浅色 + 用户没手动选主题时也会糊上一层深色样式。
//   3) var(--x) 引用了从没定义过的变量，声明在计算值阶段整条失效（不是回退成继承值那么简单）。
//      全站 var(--primary) 就是这种哑火。带 fallback 的 var(--x, y) 不算违规。
// 解析器只认 { } ; 三种结构字符，先剥注释，不依赖缩进换行，所以改格式骗不过它。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const rel = path => path.slice(root.length).split(sep).join('/');
const SKIP_DIRS = ['.git', 'node_modules', 'dist', 'coverage'];

function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.includes(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else out.push(rel(full));
    }
    return out;
}
const repoFiles = walk(root);
const read = path => readFileSync(join(root, path), 'utf8');

// 第三方翻页库和打包产物不归我们修。
const VENDOR = ['lib/pageflipopen/', 'lib/openpageflip/', 'lib/vendor/'];
const cssFiles = repoFiles.filter(f => f.endsWith('.css') && !VENDOR.some(v => f.startsWith(v)));
const runtimeFiles = repoFiles.filter(f => /\.(html|m?js)$/.test(f) && !VENDOR.some(v => f.startsWith(v)));

const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// 每个 { 都产出一条 { prelude, at: 外层 at-rule 列表, isAt }。
function rules(css) {
    const stack = [];
    const out = [];
    let buffer = '';
    for (const ch of strip(css)) {
        if (ch === '{') {
            const prelude = buffer.trim();
            stack.push({ prelude, isAt: prelude.startsWith('@') });
            out.push({ prelude, isAt: stack[stack.length - 1].isAt, at: stack.filter(s => s.isAt).map(s => s.prelude) });
            buffer = '';
        } else if (ch === '}') {
            stack.pop();
            buffer = '';
        } else if (ch === ';') {
            buffer = '';
        } else {
            buffer += ch;
        }
    }
    return out;
}

const isDarkMedia = prelude => /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.test(prelude);
const AUTO_DARK = /:not\(\s*\[data-theme=["']?light["']?\]\s*\)/;
const oneLine = text => text.replace(/\s+/g, ' ').slice(0, 90);
const deadBlocks = rules => rules.filter(r => !r.isAt && /@/.test(r.prelude)).map(r => oneLine(r.prelude));
const strayAutoDark = rules => rules
    .filter(r => !r.isAt && AUTO_DARK.test(r.prelude) && !r.at.some(isDarkMedia))
    .map(r => oneLine(r.prelude));

test('没有"选择器后面直接跟 @media"的死块', () => {
    assert.ok(cssFiles.length >= 5, `只扫到 ${cssFiles.length} 个 css 文件，枚举可能被改坏了`);
    const dead = cssFiles.flatMap(f => deadBlocks(rules(read(f))).map(d => `${f}: ${d}`));
    assert.deepEqual(dead, [], `选择器里混进 at-rule，浏览器会把整条规则当解析错误丢掉：\n${dead.join('\n')}`);
    // 反向控制：坑的原文必须认得，否则这条测试是假绿的。
    const planted = rules('body[data-theme="dark"] .x,\n@media (prefers-color-scheme: dark) {\n  body:not([data-theme="light"]) .x { color: #fff; }\n}');
    assert.deepEqual(deadBlocks(planted).length, 1, '死块识别逻辑失效');
    assert.deepEqual(deadBlocks(rules('body[data-theme="dark"] .x { color: #fff; }')).length, 0, '合法写法被误报');
});

test('body:not([data-theme="light"]) 只能待在 prefers-color-scheme: dark 里', () => {
    const stray = cssFiles.flatMap(f => strayAutoDark(rules(read(f))).map(s => `${f}: ${s}`));
    assert.deepEqual(stray, [], `系统浅色时也会命中的"自动深色"选择器：\n${stray.join('\n')}`);
    // 反向控制：外面要报，里面要放过。
    assert.deepEqual(strayAutoDark(rules('body:not([data-theme="light"]) .y { color: #000; }')).length, 1, '检查认不出裸写的自动深色');
    assert.deepEqual(strayAutoDark(rules('@media (prefers-color-scheme: dark) { body:not([data-theme="light"]) .y { color: #000; } }')).length, 0, '合法写法被误报');
});

test('每个 var(--x) 要么有定义，要么自带 fallback', () => {
    const defined = new Set();
    for (const f of cssFiles) {
        for (const m of strip(read(f)).matchAll(/[{;\s](-{2}[A-Za-z0-9-]+)\s*:/g)) defined.add(m[1]);
    }
    for (const f of runtimeFiles) {
        const text = read(f);
        for (const m of text.matchAll(/setProperty\(\s*['"](-{2}[A-Za-z0-9-]+)['"]/g)) defined.add(m[1]);
        for (const m of text.matchAll(/style="[^"]*?(-{2}[A-Za-z0-9-]+)\s*:/g)) defined.add(m[1]);
    }
    const missing = cssFiles.flatMap(f => [...strip(read(f)).matchAll(/var\(\s*(-{2}[A-Za-z0-9-]+)(\s*,)?/g)]
        .filter(m => !m[2] && !defined.has(m[1])).map(m => `${f}: ${m[1]}`));
    assert.deepEqual([...new Set(missing)].sort(), [], `未定义就使用的自定义属性，声明会整条失效：\n${[...new Set(missing)].sort().join('\n')}`);
    // 反向控制：未定义要点名，带 fallback 的要放过。
    const probe = [...'a{color:var(--nope);border-color:var(--nope2, #fff)}'.matchAll(/var\(\s*(-{2}[A-Za-z0-9-]+)(\s*,)?/g)]
        .filter(m => !m[2] && !defined.has(m[1])).map(m => m[1]);
    assert.deepEqual(probe, ['--nope'], '变量检查失效');
});
