// 自托管 SDK 的守门测试。
// 上一版 Supabase SDK 从 cdn.jsdelivr.net 动态 import，CSP 的 script-src 就得放行整个域；
// 版本虽然钉死了，但"这个域名今天下午给的任何字节"都成了运行时信任边界的一部分，而且加不了 SRI
// （动态 import 的响应头里没有 hash 可供校验）。改成站点内 lib/vendor 那份以后，这条边界应该彻底消失。
// 这个测试钉的就是"消失并且不会悄悄回来"：任何一条退化都会让 CI 红。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const text = path => readFileSync(new URL(path, root), 'utf8');
const manifest = JSON.parse(text('lib/vendor/vendor.json'));

test('vendored 文件的字节就是清单里那份，不是后来被顺手改过的', () => {
    const bytes = readFileSync(new URL(manifest.bundle.file, root));
    assert.equal(bytes.length, manifest.bundle.bytes, '字节数与 vendor.json 不符');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.bundle.sha256,
        'sha256 与 vendor.json 不符：要么产物被改动，要么清单没跟着更新');
});

test('清单只记 registry.npmjs.org 的回源哈希，不记镜像地址', () => {
    assert.ok(manifest.packages.length >= 1);
    for (const pkg of manifest.packages) {
        assert.match(pkg.tarball, /^https:\/\/registry\.npmjs\.org\//, `${pkg.name} 的 tarball 不是官方源`);
        assert.match(pkg.sha512, /^sha512-[A-Za-z0-9+/=]{86,}$/, `${pkg.name} 的 integrity 形状不对`);
        assert.equal(pkg.bytesMatchedOfficial, true, `${pkg.name} 打包时没跟官方 tarball 逐字节比过`);
    }
    // 文件名里的版本必须就是清单里那个 SDK 版本，别说一套装一套。
    const sdk = manifest.packages.find(pkg => pkg.name === '@supabase/supabase-js');
    assert.equal(manifest.bundle.file, `lib/vendor/supabase-js-${sdk.version}.mjs`);
});

test('客户端从站内绝对路径加载 SDK，运行时不留任何第三方脚本源', () => {
    // 注释里写"以前用 jsdelivr"是有用的历史信息，不该让它把测试卡住：
    // 这条断言管的是代码，所以先剥掉行注释再查外部域。
    const client = text('lib/supabase-client.js').replace(/^\s*\/\/.*$/gm, '');
    const url = client.match(/SUPABASE_SDK_URL\s*=\s*"([^"]+)"/)[1];
    assert.ok(url.startsWith('/'), `SDK 地址应该是站内绝对路径，现在是 ${url}`);
    assert.ok(!/^https?:/.test(url), 'SDK 不能再从外部域加载');
    assert.ok(existsSync(new URL('.' + url, root)), `${url} 在仓库里不存在，上线就是 404 白屏`);
    // validateConfig 里 "https://" 是合法配置校验，不是加载地址；要抓的是"把外部 URL 当模块说明符"。
    assert.equal(/(?:import\s*\(\s*|from\s+)["'`]https?:/.test(client), false,
        'supabase-client.js 仍以外部 URL 作为模块说明符');
});

test('_headers 里不许出现"看着生效其实被 /* 的 no-cache 压掉"的缓存规则', () => {
    // Cloudflare Pages 对每条命中的规则做的是拼接而不是覆盖。线上实测
    // /lib/vendor/supabase-js-2.39.0.mjs 的响应头是
    //   Cache-Control: no-cache, public, max-age=31536000, immutable
    // no-cache 要求每次回源校验，所以后半段永远不会生效——87af9f3 清掉七条一年
    // immutable 规则就是这个原因。加 SDK 时不小心又写了一条，这里拦下来。
    const headers = text('_headers');
    const blocks = headers.split(/\n(?=\/)/).filter(b => /^\//.test(b));
    assert.ok(blocks.length >= 2, `_headers 只解析出 ${blocks.length} 条规则，格式可能改了`);
    const global = blocks.find(b => b.startsWith('/*'));
    assert.match(global, /^ {2}Cache-Control: no-cache$/m, '/* 不再是全站 no-cache，缓存边界要重新审');
    for (const block of blocks) {
        if (block === global) continue;
        for (const line of block.match(/^ {2}Cache-Control:.*$/gm) || []) {
            assert.equal(/max-age|immutable/.test(line), false,
                `${block.split('\n')[0]} 上的 "${line.trim()}" 是条死规则：/* 的 no-cache 会一起拼进来压过它`);
        }
    }
    // 文件名带版本号这条要留着：将来真要长缓存，前提是升级走"新增文件 + 改引用"，
    // 而不是覆盖同名文件——否则一年缓存会把旧 SDK 钉在所有回访浏览器里。
    assert.match(manifest.bundle.file, /^lib\/vendor\/supabase-js-\d+\.\d+\.\d+\.mjs$/);
});

test('CSP 的 script-src 收到只剩 self，两处配置一起改', () => {
    for (const file of ['_headers', 'netlify.toml']) {
        const scripts = text(file).match(/script-src ((?:[^;'"]|'[^']*')*)/)[1];
        assert.ok(!/https?:\/\//.test(scripts), `${file} 的 script-src 还放行了外部域：${scripts.trim()}`);
        assert.ok(scripts.includes("'self'"), `${file} 的 script-src 不该把 self 也去掉`);
    }
});

test('vendored 文件确实会进 dist：它在 build.mjs 拷贝的目录里', () => {
    const build = text('scripts/build.mjs');
    const dirs = build.match(/for\(const dir of \[([^\]]+)\]/)[1];
    const topDir = manifest.bundle.file.split('/')[0];
    assert.ok(dirs.includes(`'${topDir}'`), `${topDir}/ 不在拷贝列表，lib/vendor 不会出现在 dist`);
    assert.ok(!build.includes('vendor'), 'build.mjs 不该出现按文件名过滤 vendor 的特例');
});
