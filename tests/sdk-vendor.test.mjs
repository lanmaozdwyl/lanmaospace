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

test('版本号写在文件名里的 SDK 走 immutable，别的路径不许蹭这条', () => {
    const headers = text('_headers');
    const rule = headers.match(/\/lib\/vendor\/\*\n\s+Cache-Control:\s*([^\n]+)/);
    assert.ok(rule, 'vendored SDK 没有单独的缓存规则，每次访问都要回源校验 218 KB');
    assert.match(rule[1], /max-age=31536000/, rule[1]);
    assert.match(rule[1], /immutable/, rule[1]);
    // 文件名带版本才可以这么写：升级是新增文件、改两处引用，而不是覆盖同名文件。
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
