// 自托管 SDK 的守门测试。
// 上一版 Supabase SDK 从 cdn.jsdelivr.net 动态 import，CSP 的 script-src 就得放行整个域；
// 版本虽然钉死了，但"这个域名今天下午给的任何字节"都成了运行时信任边界的一部分，而且加不了 SRI
// （动态 import 的响应头里没有 hash 可供校验）。改成站点内 lib/vendor 那份以后，这条边界应该彻底消失。
// 这个测试钉的就是"消失并且不会悄悄回来"：任何一条退化都会让 CI 红。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const rootDir = fileURLToPath(root);
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

// _headers 是按行解析的：顶格一条是路径，缩进的才是它的头，# 开头整行丢弃。
const headerRules = (() => {
    const rules = [];
    let current = null;
    for (const raw of text('_headers').split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.startsWith('#')) continue;
        if (/^\S/.test(line)) {
            current = { path: line, headers: [] };
            rules.push(current);
        } else if (current) {
            current.headers.push(line.trim());
        }
    }
    return rules;
})();

const cacheOf = rule => rule.headers.filter(h => h.startsWith('Cache-Control:'));

function pages() {
    const out = [];
    const walk = dir => {
        for (const name of readdirSync(dir)) {
            if (['.git', 'node_modules', 'dist', 'coverage'].includes(name)) continue;
            const full = join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (name.endsWith('.html')) out.push('/' + relative(rootDir, full).replaceAll('\\', '/'));
        }
    };
    walk(rootDir);
    return out;
}

test('_headers 的缓存边界：max-age 只挂在 /*，文档逐条点名 no-cache', () => {
    // Cloudflare Pages 对命中的规则做拼接而不是覆盖。曾经写在子路径上的 max-age
    // 会被 /* 的 no-cache 压成死规则（87af9f3 就是这么清掉七条一年 immutable 的），
    // 所以反过来写：默认放行 5 分钟，文档一条条点名 no-cache。
    // 拼接口径下漏一条只是那个页面最多多缓存 5 分钟，不会把私密响应发给别人。
    const global = headerRules.find(rule => rule.path === '/*');
    assert.ok(global, '/* 规则不见了，安全头会整批失效');
    const [cc] = cacheOf(global);
    assert.match(cc || '', /max-age=\d+/, '/* 上没有 max-age，静态资源又会每次回源校验');
    assert.equal(/no-cache|no-store|must-revalidate/.test(cc || ''), false,
        `/* 上出现了 "${cc}"：它会拼到每条子路径上把 max-age 全压掉，正是 87af9f3 清理掉的坑`);

    for (const rule of headerRules) {
        if (rule === global) continue;
        for (const line of cacheOf(rule)) {
            assert.equal(/max-age|immutable/.test(line), false,
                `${rule.path} 上的 "${line}" 和 /* 拼在一起语义不清，文档只该写 no-cache/no-store`);
        }
    }
    // 文件名带版本号这条要留着：将来真要上一年 immutable，前提是升级走"新增文件 + 改引用"，
    // 而不是覆盖同名文件——否则长缓存会把旧 SDK 钉在所有回访浏览器里。
    assert.match(manifest.bundle.file, /^lib\/vendor\/supabase-js-\d+\.\d+\.\d+\.mjs$/);
});

test('每个页面都在 _headers 里点名了 no-cache，新增页面不会漏', () => {
    const noCache = new Set(headerRules
        .filter(rule => cacheOf(rule).some(line => /\bno-cache\b|\bno-store\b/.test(line)))
        .map(rule => rule.path));
    assert.ok(noCache.size >= 12, `只有 ${noCache.size} 条不缓存规则，解析可能出了问题`);
    for (const page of pages()) {
        assert.ok(noCache.has(page), `${page} 没有 no-cache 规则，发版后最多会有 5 分钟新旧混载`);
    }
    // 反向控制：集合本身是活的，少一条就会被上面那个循环抓出来。
    assert.equal(noCache.has('/a-page-nobody-added.html'), false);
});

test('preconnect 的域就是 memo-config.js 里那个 Supabase 地址，且不会漏页', () => {
    // preconnect 只有写在静态 HTML 的 head 里才抢得到时间：等 JS 跑起来再插，
    // DNS + TCP + TLS 已经和第一个请求排在一起了。代价是域名从此有了第二处副本，
    // 换 Supabase 项目时漏改一处，所有页面就默默退回冷启动，所以在这里钉住。
    const cfg = text('memo-config.js').match(/url:\s*"(https:\/\/[^"]+)"/)[1].replace(/\/$/, '');
    for (const page of pages()) {
        const html = text('.' + page);
        const pre = [...html.matchAll(/<link rel="preconnect" href="([^"]+)"[^>]*>/g)];
        for (const m of pre) {
            assert.equal(m[1].replace(/\/$/, ''), cfg, `${page} 的 preconnect 与 memo-config.js 的 url 不一致`);
            assert.match(m[0], /crossorigin/, `${page} 的 preconnect 少了 crossorigin：Supabase 走的是 CORS fetch，不带这个属性预热出来的连接用不上`);
        }
        if (/src="[^"]*auth-guard\.js"/.test(html)) {
            assert.ok(pre.length > 0, `${page} 挂了 auth-guard.js 却没有 preconnect，首个数据请求要多吃一次 TLS 握手`);
        }
    }
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
