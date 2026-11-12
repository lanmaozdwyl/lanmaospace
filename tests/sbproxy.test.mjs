// sbproxy 代理边界测试：钉住"只转发数据与存储接口"这条决定。
// 上一版把 Supabase 路径原样透传，等于用本站域名开放了 /auth/v1 的密码撞库与
// 验证码爆破，而 Cloudflare 会替请求方掩掉源 IP，让上游的频率限制失效。
// 说明：转发请求体那行用的是 Workers 的流语义，Node 里构造流式 body 需要 duplex，
// 所以这里只驱动 GET/HEAD 与各个拒绝分支，写方法不在覆盖范围内。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = (await import('../_worker.js')).default;
const UPSTREAM = 'https://kyhhzaftsyakibdisiqj.supabase.co';
const SITE = 'https://lanmaospace.pages.dev';

let upstreamCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async request => {
    upstreamCalls.push({
        url: request.url,
        method: request.method,
        redirect: request.redirect,
        cookie: request.headers.get('cookie'),
        apikey: request.headers.get('apikey'),
        origin: request.headers.get('origin'),
    });
    return new Response('[]', { status: 200 });
};
test.after(() => { globalThis.fetch = realFetch; });

const assetsCalls = [];
const env = { ASSETS: { fetch: async request => { assetsCalls.push(request.url); return new Response('asset', { status: 200 }); } } };

function page(path, headers = {}) {
    return new Request(`${SITE}${path}`, { headers: { apikey: 'public-anon-key', ...headers } });
}

async function status(path, headers) {
    const response = await worker.fetch(page(path, headers), env);
    return response.status;
}

test('/sbproxy 之外的路径照常回静态资源，高级模式不能把网站挡住', async () => {
    const response = await worker.fetch(new Request(`${SITE}/reader`), env);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'asset');
    assert.ok(assetsCalls.some(url => url.endsWith('/reader')));
    assert.equal(upstreamCalls.length, 0);
});

test('数据与存储接口按原路径转发，Cookie 不往上带', async () => {
    upstreamCalls = [];
    const response = await worker.fetch(page('/sbproxy/rest/v1/messages?select=id&limit=10', { cookie: 'session=secret' }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(upstreamCalls, [{
        url: `${UPSTREAM}/rest/v1/messages?select=id&limit=10`,
        method: 'GET',
        redirect: 'manual',
        cookie: null,
        apikey: 'public-anon-key',
        origin: null,
    }]);

    upstreamCalls = [];
    await worker.fetch(page('/sbproxy/storage/v1/object/public/avatars/u1/avatar'), env);
    assert.equal(upstreamCalls[0].url, `${UPSTREAM}/storage/v1/object/public/avatars/u1/avatar`);
});

test('鉴权与实时接口拒绝：撞库、验证码爆破、找回密码轰炸都从这里进来', async () => {
    upstreamCalls = [];
    for (const path of [
        '/sbproxy/auth/v1/token?grant_type=password',
        '/sbproxy/auth/v1/verify',
        '/sbproxy/auth/v1/recover',
        '/sbproxy/auth/v1/signup',
        '/sbproxy/realtime/v1/websocket',
    ]) assert.equal(await status(path), 403, path);
    assert.equal(upstreamCalls.length, 0);
});

test('路径前缀要精确匹配，裸 /sbproxy 不能落到上游根目录', async () => {
    upstreamCalls = [];
    assert.equal(await status('/sbproxy'), 403);
    assert.equal(await status('/sbproxy/rest/v1evil'), 403);
    // /sbproxyfoo 不是代理路径：上一版用 /^\/sbproxy/ 剥前缀会把它转成 /foo 送上去。
    assetsCalls.length = 0;
    assert.equal((await worker.fetch(page('/sbproxyfoo/rest/v1'), env)).status, 200);
    assert.ok(assetsCalls.some(url => url.endsWith('/sbproxyfoo/rest/v1')));
    assert.equal(upstreamCalls.length, 0);
});

test('不带 apikey 不转发；非本站 Origin 拒绝', async () => {
    upstreamCalls = [];
    assert.equal((await worker.fetch(new Request(`${SITE}/sbproxy/rest/v1/messages`), env)).status, 403);
    assert.equal(await status('/sbproxy/rest/v1/messages', { origin: 'https://evil.example' }), 403);
    assert.equal(upstreamCalls.length, 0);
    assert.equal(await status('/sbproxy/rest/v1/messages', { origin: SITE }), 200);
});

test('_worker.js 必须进 dist，且不能再拷贝 functions 目录', async () => {
    const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
    const files = build.match(/const files=\[([^\]]+)\]/)[1];
    assert.ok(files.includes("'_worker.js'"), '漏了 _worker.js 会退回静态模式，代理失效');
    const dirs = build.match(/for\(const dir of \[([^\]]+)\]/)[1];
    assert.ok(!dirs.includes('functions'), 'functions 目录已随 Pages Functions 版代理删除，列入会让 cpSync ENOENT 打断构建');
    assert.ok(dirs.includes("'lib'"), 'lib 目录仍需拷贝');
});
