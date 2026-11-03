// 只读上线验收：不登录、不访问私人内容、不读取配置密钥。
// HTML 用关键标记核验（托管平台可能改写 HTML 或做干净地址跳转，不只比原始哈希）；
// JS/CSS/目录数据用换行规范化后的哈希或结构比对；商品图片只核验状态、类型与大小，不比对字节。
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const site = (process.argv[2] || 'https://lanmaospace.pages.dev').replace(/\/$/, '');
const root = new URL('../', import.meta.url);
const digest = text => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
const localText = path => readFile(new URL(path, root), 'utf8');
let ready = true;

async function fetchText(path) {
    const response = await fetch(`${site}/${path}?verify=${Date.now()}`, {
        headers: {'Cache-Control': 'no-cache'},
        signal: AbortSignal.timeout(15000),
    });
    return response;
}

function noteRedirect(path, response) {
    try {
        const finalPath = new URL(response.url).pathname.replace(/\/$/, '') || '/';
        const requested = `/${path}`.replace(/\/$/, '') || '/';
        return finalPath !== requested ? ` (redirected to ${finalPath})` : '';
    } catch {
        return '';
    }
}

async function checkMarkers(path, markers) {
    try {
        const response = await fetchText(path);
        if (!response.ok) { console.log(`${path}: HTTP ${response.status}`); ready = false; return; }
        const remote = await response.text();
        const missing = markers.filter(marker => !remote.includes(marker));
        const matches = missing.length === 0;
        console.log(`${path}: HTTP ${response.status}, ${matches ? 'MATCH' : 'OLD_OR_DIFFERENT missing=' + missing.join(',')}${noteRedirect(path, response)}`);
        ready &&= matches;
    } catch (error) { ready = false; console.log(`${path}: REQUEST_FAILED (${error.name})`); }
}

async function checkHash(path) {
    try {
        const response = await fetchText(path);
        if (!response.ok) { console.log(`${path}: HTTP ${response.status}`); ready = false; return; }
        const remote = await response.text();
        const matches = digest(remote) === digest(await localText(path));
        console.log(`${path}: HTTP ${response.status}, ${matches ? 'MATCH' : 'OLD_OR_DIFFERENT'}${noteRedirect(path, response)}`);
        ready &&= matches;
    } catch (error) { ready = false; console.log(`${path}: REQUEST_FAILED (${error.name})`); }
}

for (const [path, markers] of [
    ['memo.html', ['backup-panel', 'conflict-panel', 'preview-dialog', 'memo-sync-status', 'clear-search-button']],
    ['store.html', ['catalog-error', 'catalog-retry', 'detail-metadata', 'id="search"', 'id="products"']],
    ['index.html', ['guestbookStatus', 'id="toolbox"', 'tools/']],
    ['login.html', ['login-form', 'login-panel', 'recovery-form']],
    ['faq.html', ['faq-purchase','faq-warranty','faq-account','faq-contact']],
    ['account.html', ['account-reset-password','account-signout-all','account-actions']],
    ['space.html', ['space-form','member-list','post-list','edit-post-form','member-search-form','reports-panel','export-space','space-usage','toggle-member-block','blocks-panel']],
    ['profile.html', ['avatar-presets', 'avatar-upload', 'avatar-preview', 'data-header-avatar']],
    ['tools/', ['tools-search', 'data-filter="translate"', 'deepl.com/translator']],
]) await checkMarkers(path, markers);

for (const path of [
    'memo.js', 'memo-core.mjs', 'memo.css', 'login.js', 'guestbook-admin.js',
    'lib/supabase-client.js', 'store.js', 'lib/catalog.mjs', 'tools/tools.js', 'tools/tools.css',
    'guestbook.js', 'auth-guard.js', 'profile.js', 'profile.css', 'lib/avatar.mjs', 'faq.css', 'store.css', 'space.js', 'space.css', 'lib/space.mjs', 'lib/space-export.mjs', 'lib/account-security.mjs', 'account.js', 'script.js','style.css','mobile.css','mobile-nav.js','focus.js','lib/focus.mjs','sw.js','manifest.json',
]) await checkHash(path);

// 商品目录：结构比对（名称、分类、价格顺序一致），不把字节差异当成内容不一致。
try {
    const local = JSON.parse(await localText('products.json'));
    const response = await fetchText('products.json');
    if (!response.ok) { console.log(`products.json: HTTP ${response.status}`); ready = false; }
    else {
        const remote = await response.json();
        const same = Array.isArray(remote) && remote.length === local.length &&
            remote.every((item, i) => item.name === local[i].name && item.category === local[i].category && item.price === local[i].price);
        console.log(`products.json: HTTP ${response.status}, ${same ? `MATCH (${local.length} items)` : 'OLD_OR_DIFFERENT'}${noteRedirect('products.json', response)}`);
        ready &&= same;
    }
} catch (error) { ready = false; console.log(`products.json: REQUEST_FAILED (${error.name})`); }

// 商品图片：只核验可访问、类型为图片、有内容，并记录大小供性能核对；不转换、不重绘。
try {
    const local = JSON.parse(await localText('products.json'));
    const images = [...new Set(local.filter(item => item.image).map(item => item.image))];
    for (const image of images) {
        try {
            const response = await fetch(`${site}/${image}?verify=${Date.now()}`, {
                headers: {'Cache-Control': 'no-cache'},
                signal: AbortSignal.timeout(15000),
            });
            const buffer = response.ok ? await response.arrayBuffer() : null;
            const type = response.headers.get('content-type') || '';
            const ok = response.ok && type.startsWith('image/') && buffer && buffer.byteLength > 0;
            console.log(`${image}: HTTP ${response.status}, ${type || 'no-type'}, ${buffer ? (buffer.byteLength / 1024).toFixed(0) + ' KB' : 'no-body'}, ${ok ? 'OK' : 'CHECK'}`);
            ready &&= ok;
        } catch (error) { ready = false; console.log(`${image}: REQUEST_FAILED (${error.name})`); }
    }
} catch (error) { ready = false; console.log(`product images: REQUEST_FAILED (${error.name})`); }

console.log(ready
    ? 'PASS: 正式站已加载本地版本的备忘录、商店与工具站资源。'
    : 'NOT_READY: 正式站尚未匹配本地版本，请检查部署状态；不要仅凭推送成功声称已上线。');
process.exitCode = ready ? 0 : 2;
