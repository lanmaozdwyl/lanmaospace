// 收录策略测试：把"全站只有首页参与搜索"这件事从口头约定变成机器把关。
// 学到的两条：
//   a) noindex 只有被爬虫抓到才生效。一旦 robots 把它 Disallow，爬虫看不到声明，
//      URL 反而可能以"无摘要标题"的形式被收录——所以带 noindex 的页面绝不能出现在 Disallow 里。
//   b) sitemap 与 noindex 不能互相打脸：写进 sitemap 的页面必须是可索引的。
// 新增内容页时这个测试会拦住你，这是故意的：逼你当场决定它到底要不要进搜索结果。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const ORIGIN = 'https://lanmaospace.pages.dev';

// 页面清单取自构建白名单，外加 tools/ 子目录：新页面一进白名单就必须表态。
const buildSource = readFileSync(new URL('scripts/build.mjs', ROOT), 'utf8');
const whitelisted = buildSource.match(/const files=\[([^\]]+)\]/)[1]
    .split(',')
    .map(part => part.trim().replace(/^'|'$/g, ''))
    .filter(name => name.endsWith('.html'));
const pages = [...whitelisted, ...readdirSync(new URL('tools/', ROOT)).filter(name => name.endsWith('.html')).map(name => `tools/${name}`)];

// 站内 URL 路径：index.html 走裸路径，其余按文件名。
function urlPath(file) {
    if (file === 'index.html') return '/';
    if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
    return `/${file}`;
}

function source(file) {
    return readFileSync(new URL(file, ROOT), 'utf8');
}

function hasNoIndex(file) {
    return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(source(file));
}

const robotsSource = source('robots.txt');
const disallows = [...robotsSource.matchAll(/^Disallow:\s*(\S+)\s*$/gmi)].map(match => match[1]);
const sitemapSource = source('sitemap.xml');
const sitemapPaths = [...sitemapSource.matchAll(/<loc>[^<]*<\/loc>/g)]
    .map(tag => tag[0].replace(/<\/?loc>/g, '').replace(ORIGIN, '').replace(/^https?:\/\/[^/]+/, ''));

const indexable = pages.filter(file => !hasNoIndex(file));

test('全站只允许首页可索引；其他 html 必须自己声明 noindex', () => {
    assert.deepEqual(indexable, ['index.html'],
        '可索引页面集合变了：新页面要么写 noindex，要么连同 robots.txt / sitemap.xml / 这条断言一起改清楚再放行');
    assert.ok(!hasNoIndex('index.html'), '首页被写成 noindex 的话，整站就没有内容进搜索了');
});

test('robots.txt 不得 Disallow 带 noindex 的页面：禁抓会让声明失效', () => {
    for (const file of pages) {
        if (!hasNoIndex(file)) continue;
        const path = urlPath(file);
        const blocked = disallows.find(rule => path === rule || path.startsWith(rule));
        assert.equal(blocked, undefined, `${path} 既 noindex 又被 Disallow（规则 ${blocked}）：爬虫抓不到声明，反而可能被无摘要收录`);
    }
});

test('数据文件与 relay 接口不进爬虫：这些不是内容，抓了只白打上游', () => {
    assert.ok(disallows.includes('/sbproxy'), '/sbproxy 前端已不调用，仍要挡住爬虫');
    assert.ok(disallows.includes('/products.json'), '商店数据当前不上线，不该被抓');
});

test('sitemap 只列可索引页面，且一个都不能漏', () => {
    for (const path of sitemapPaths) {
        const file = path === '/' ? 'index.html' : (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));
        assert.ok(pages.includes(file), `${path} 在 sitemap 里但不在页面清单上`);
        assert.ok(!hasNoIndex(file), `${path} 带 noindex，却又被提交进 sitemap`);
    }
    assert.deepEqual(sitemapPaths.sort(), indexable.map(urlPath).sort(), 'sitemap 与可索引页面集合不一致');
});

test('首页 canonical、og:url 与 sitemap 用同一个 URL 写法', () => {
    const home = source('index.html');
    const canonical = home.match(/<link rel="canonical" href="([^"]+)"/);
    const ogUrl = home.match(/<meta property="og:url" content="([^"]+)"/);
    assert.ok(canonical, '首页缺 canonical：11xy 那站就吃过索引页/词条页斜杠写法不一致的亏，我们全站保持一种');
    assert.equal(canonical[1], `${ORIGIN}/`);
    assert.equal(ogUrl && ogUrl[1], canonical[1], 'og:url 要和 canonical 同形');
    assert.ok(sitemapPaths.includes(new URL(canonical[1]).pathname), 'canonical 指向的 URL 得在 sitemap 里');
});
