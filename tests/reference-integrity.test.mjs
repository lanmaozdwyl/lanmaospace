// 站内引用完整性。分三个方向盯：
//   1) 引用了仓库里根本不存在的路径 —— 上线就是 404 / 白屏；
//   2) 仓库里有、但 scripts/build.mjs 的白名单不拷 —— dist 里没有，线上照样 404。
//      FAQ 那次就是 HTML/CSS 进了仓库却忘了进 files 列表，本地看得好好的，发出去才炸；
//   3) images/ 与 audio/ 里没有任何文件引用它 —— 每次构建白带的死重量（16 号任务的孤儿商品图）。
// 解析器故意写得保守：外部域、锚点、mailto/tel/data、带 ${} 的模板串一律跳过，
// 宁可漏报也不要在 CI 里喊狼来了。漏掉的部分由下面的反向控制保证"规则本身是活的"。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve, sep } from 'node:path';

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

// 只扫真正会上线的东西：tests/ 与 scripts/ 里的字符串是给 CI 看的，不是站内引用；
// lib/vendor/ 是打包产物和它的清单，里面出现 "/vector" 这种字符串很正常，不该当引用解析
// （它的完整性由 sdk-vendor.test.mjs 用 sha256 钉着）。
const EXCLUDED = ['lib/pageflipopen/', 'lib/openpageflip/', 'lib/vendor/'];
const RUNTIME = f => /\.(html|css|m?js|json)$/.test(f)
    && !/^(tests|scripts)\//.test(f)
    && !/^package(-lock)?\.json$/.test(f)
    && !EXCLUDED.some(v => f.startsWith(v));
const runtimeFiles = repoFiles.filter(RUNTIME);

// 被 _redirects 接管的路径（/lanmaospace.apk）与 _worker.js 自己应答的路径（/sbproxy/*）
// 都没有对应文件，属于"按设计存在"。
const served = new Set(
    read('_redirects').split('\n')
        .map(line => line.trim().split(/\s+/)[0])
        .filter(p => p && !p.startsWith('#'))
);

function collect(file, text) {
    const found = [];
    const push = raw => { if (raw) found.push(raw.trim()); };
    if (file.endsWith('.html')) {
        for (const m of text.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) push(m[1]);
        for (const m of text.matchAll(/property="og:image[^"]*"\s+content="([^"]+)"/g)) push(m[1]);
    } else if (file.endsWith('.css')) {
        for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) push(m[1]);
    } else if (/\.(m?js)$/.test(file)) {
        for (const m of text.matchAll(/(?:import\s*\(\s*|from\s+)["']([^"']+)["']/g)) push(m[1]);
        // 带扩展名的站内路径字面量，以及单段无扩展名的页面短链（/login、/reader）。
        for (const m of text.matchAll(/["'](\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]{2,5})["']/g)) push(m[1]);
        for (const m of text.matchAll(/["'](\/[a-z0-9][a-z0-9-]*)["']/g)) push(m[1]);
    } else if (file.endsWith('.json')) {
        for (const m of text.matchAll(/"((?:\/?[\w.-]+\/)*[\w.-]+\.(?:png|jpg|jpeg|svg|webp|mp3|css|m?js|json))"/g)) push(m[1]);
    }
    return found;
}

// 把一条引用归一成仓库内路径；解析不出来的（外部域、锚点、模板串、跳转/代理路径）返回 null。
export function normalize(fromFile, raw) {
    let v = raw;
    if (!v || v[0] === '#' || /^\s/.test(v)) return null;
    if (/^(https?:|data:|mailto:|tel:|javascript:|blob:|about:|\/\/)/i.test(v)) return null;
    if (v.includes('${') || v.includes('*')) return null;
    v = v.split('?')[0].split('#')[0];
    if (!v) return null;
    if (v === '/') return 'index.html';
    // JSON 里的路径是应用拿来拼 URL 的数据（products.json 的 images/products/*.webp、
    // audio/manifest.json 的 audio/*.mp3），一律按站点根解析，不按 JSON 文件自身位置。
    const base = fromFile.endsWith('.json') ? '' : dirname(fromFile);
    const path = v.startsWith('/') ? v.slice(1) : join(base, v).replaceAll('\\', '/');
    if (v.startsWith('/sbproxy') || served.has(v) || served.has('/' + path)) return null;
    return path.replace(/^\.\//, '');
}

export function resolveRef(fromFile, target) {
    const base = resolve(root, target);
    for (const candidate of [base, base + '.html', join(base, 'index.html')]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) return rel(candidate).replace(/^\.\//, '');
    }
    return null;
}

function buildTargets() {
    const build = read('scripts/build.mjs');
    const listed = new Set(build.match(/const files=\[([^\]]+)\]/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1)));
    const dirs = build.match(/for\(const dir of \[([^\]]+)\]/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
    const shipped = new Set(listed);
    for (const f of repoFiles) if (dirs.some(d => f.startsWith(d + '/'))) shipped.add(f);
    return shipped;
}

const refs = [];
for (const file of runtimeFiles) {
    for (const raw of collect(file, read(file))) {
        const target = normalize(file, raw);
        if (!target) continue;
        refs.push({ from: file, raw, target });
    }
}

test('站点引用的每个路径都能在仓库里找到', () => {
    const broken = refs.filter(r => !resolveRef(r.from, r.target))
        .map(r => `${r.from} -> ${r.raw}`);
    assert.deepEqual(broken, [], `这些引用没有对应文件，上线就是 404：\n${broken.join('\n')}`);
    assert.ok(refs.length > 200, `只解析出 ${refs.length} 条站内引用，采集器大概是被改坏了`);
});

test('被引用的文件确实在 build.mjs 的白名单里', () => {
    const shipped = buildTargets();
    const missed = [...new Map(refs
        .map(r => ({ from: r.from, file: resolveRef(r.from, r.target) }))
        .filter(r => r.file && !shipped.has(r.file))
        .map(r => [r.file, `${r.file}   ← ${r.from}`])).values()].sort();
    assert.deepEqual(missed, [], `这些文件被引用但不会进 dist：要么补进 build.mjs 的白名单，要么别引用：\n${missed.join('\n')}`);
});

test('images 与 audio 里没有无人引用的死重量', () => {
    const haystack = runtimeFiles.map(read).join('\n');
    const orphans = repoFiles.filter(f =>
        (/^(images|audio)\//.test(f)) && !f.endsWith('manifest.json') && !haystack.includes(f.split('/').pop()));
    assert.deepEqual(orphans, [], `这些资源没人引用，删掉或补上入口：\n${orphans.join('\n')}`);
});

// 反向控制：上面三条如果永远为真，就是装饰。这里用合成输入确认它们真的会红。
test('采集器抓得住"文件不存在"和"存在但不发布"', () => {
    assert.equal(normalize('index.html', '/nope/missing.png'), 'nope/missing.png');
    assert.equal(resolveRef('index.html', 'nope/missing.png'), null, '缺文件的引用没被判为损坏');
    // HANDOFF.md 确实在仓库里，也确实不在发布白名单里。
    assert.ok(resolveRef('index.html', 'HANDOFF.md'), 'HANDOFF.md 解析失败，这条反向控制失效了');
    assert.equal(buildTargets().has('HANDOFF.md'), false, 'build.mjs 开始把文档拷进 dist 了');
    // 跳转与代理路径必须继续豁免，否则第一条真测试会被 /lanmaospace.apk 卡住。
    assert.equal(normalize('index.html', '/lanmaospace.apk'), null, '_redirects 里的路径不该被当成缺文件');
    assert.equal(normalize('script.js', 'https://cdn.jsdelivr.net/x.js'), null, '外部域不该进站内引用检查');
});
