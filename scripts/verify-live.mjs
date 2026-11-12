// 只读上线验收：不登录、不访问私人内容、不读取配置密钥。
// HTML 用关键标记核验（托管平台可能改写 HTML 或做干净地址跳转，不只比原始哈希）；
// JS/CSS/目录数据用换行规范化后的哈希或结构比对；商品图片只核验状态、类型与大小，不比对字节。
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const site = (process.argv[2] || 'https://lanmaospace.pages.dev').replace(/\/$/, '');
const root = new URL('../', import.meta.url);
const digest = text => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
const localText = path => readFile(new URL(path, root), 'utf8');
const vendorFile = JSON.parse(await localText('lib/vendor/vendor.json')).bundle.file;
let ready = true;
const stale = [];       // 确认拿到内容但和本地不一致 —— 真的没发上去
const unverified = [];  // 网络没跑通 —— 不能据此说线上是旧的

// 网络抖动不等于"正式站还是旧版本"。以前一次 15s 超时就下 NOT_READY 的结论，
// 结果这种告警看多了就只能整条忽略；这里按 15s/40s/90s 重试三轮，
// 仍然失败的项目单独归类，既不谎报上线成功，也不冤枉部署。
const TIMEOUTS = [15000, 40000, 90000];
async function fetchText(path) {
    let last;
    for (const ms of TIMEOUTS) {
        try {
            return await fetch(`${site}/${path}?verify=${Date.now()}`, {
                headers: {'Cache-Control': 'no-cache'},
                signal: AbortSignal.timeout(ms),
            });
        } catch (error) { last = error; }
    }
    throw last;
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
        if (!response.ok) { console.log(`${path}: HTTP ${response.status}`); ready = false; stale.push(path); return; }
        const remote = await response.text();
        const missing = markers.filter(marker => !remote.includes(marker));
        const matches = missing.length === 0;
        console.log(`${path}: HTTP ${response.status}, ${matches ? 'MATCH' : 'OLD_OR_DIFFERENT missing=' + missing.join(',')}${noteRedirect(path, response)}`);
        if (!matches) stale.push(path);
        ready &&= matches;
    } catch (error) { ready = false; unverified.push(path); console.log(`${path}: REQUEST_FAILED (${error.name})，已重试 ${TIMEOUTS.length} 次`); }
}

async function checkHash(path) {
    try {
        const response = await fetchText(path);
        if (!response.ok) { console.log(`${path}: HTTP ${response.status}`); ready = false; stale.push(path); return; }
        const remote = await response.text();
        const matches = digest(remote) === digest(await localText(path));
        console.log(`${path}: HTTP ${response.status}, ${matches ? 'MATCH' : 'OLD_OR_DIFFERENT'}${noteRedirect(path, response)}`);
        if (!matches) stale.push(path);
        ready &&= matches;
    } catch (error) { ready = false; unverified.push(path); console.log(`${path}: REQUEST_FAILED (${error.name})，已重试 ${TIMEOUTS.length} 次`); }
}

for (const [path, markers] of [
    ['memo.html', ['backup-panel', 'conflict-panel', 'preview-dialog', 'memo-sync-status', 'clear-search-button']],
    ['store.html', ['catalog-error', 'catalog-retry', 'detail-metadata', 'id="search"', 'id="products"']],
    ['reader.html', ['reader-audio-panel','reader-audio-select','reader-audio.js']],
    ['index.html', ['spotlight-close', 'guestbookStatus', 'home-simple', 'home-account', 'home-primary-action', 'data-paused-section="books"', 'data-paused-section="music"', 'data-paused-section="links"', 'data-paused-section="toolbox"', 'ambient-credits', 'data-sound="forest"', 'ambient.js']],
    ['login.html', ['login-form', 'login-panel', 'recovery-form']],
    ['faq.html', ['faq-purchase','faq-warranty','faq-account','faq-contact']],
    ['account.html', ['account-reset-password','account-signout-all','account-actions']],
    ['space.html', ['space-form','member-list','post-list','edit-post-form','member-search-form','reports-panel','export-space','space-usage','toggle-member-block','blocks-panel']],
    ['profile.html', ['avatar-presets', 'avatar-upload', 'avatar-preview', 'data-header-avatar']],
    ['tools/', ['tools-search', 'data-filter="translate"', 'deepl.com/translator']],
]) await checkMarkers(path, markers);

for (const path of [
    'memo.js', 'memo-core.mjs', 'memo.css', 'login.js', 'guestbook-admin.js',
    'lib/supabase-client.js', vendorFile,
    'store.js', 'lib/catalog.mjs', 'tools/tools.js', 'tools/tools.css',
    'guestbook.js', 'auth-guard.js', 'profile.js', 'profile.css', 'lib/avatar.mjs', 'faq.css', 'store.css', 'space.js', 'space.css', 'lib/space.mjs', 'lib/space-export.mjs', 'lib/account-security.mjs','lib/signout.mjs', 'account.js', 'script.js','style.css','mobile.css','mobile-nav.js','lib/theme.mjs','lib/viewport.mjs','motion.css','focus.js','lib/focus.mjs','ambient.js','reader-audio.js','reader.js','reader.css','lib/ambient.mjs','audio/manifest.json','sw.js','manifest.json',
]) await checkHash(path);

// 自托管声音逐字节验收，避免只有按钮上线而音频漏发或返回 HTML。
for (const track of JSON.parse(await localText('audio/manifest.json'))) {
    try {
        const response = await fetchText(track.file);
        const bytes = response.ok ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
        const match = response.ok && response.headers.get('content-type')?.includes('audio/') &&
            bytes.length === track.bytes && createHash('sha256').update(bytes).digest('hex') === track.sha256;
        console.log(`${track.file}: HTTP ${response.status}, ${match ? 'MATCH' : 'OLD_OR_DIFFERENT'}`);
        if (!match) stale.push(track.file);
        ready &&= match;
    } catch (error) { ready = false; unverified.push(track.file); console.log(`${track.file}: REQUEST_FAILED (${error.name})，已重试 ${TIMEOUTS.length} 次`); }
}

// 商品目录：结构比对（名称、分类、价格顺序一致），不把字节差异当成内容不一致。
try {
    const local = JSON.parse(await localText('products.json'));
    const response = await fetchText('products.json');
    if (!response.ok) { console.log(`products.json: HTTP ${response.status}`); ready = false; stale.push('products.json'); }
    else {
        const remote = await response.json();
        const same = Array.isArray(remote) && remote.length === local.length &&
            remote.every((item, i) => item.name === local[i].name && item.category === local[i].category && item.price === local[i].price);
        console.log(`products.json: HTTP ${response.status}, ${same ? `MATCH (${local.length} items)` : 'OLD_OR_DIFFERENT'}${noteRedirect('products.json', response)}`);
        if (!same) stale.push('products.json');
        ready &&= same;
    }
} catch (error) { ready = false; unverified.push('products.json'); console.log(`products.json: REQUEST_FAILED (${error.name})，已重试 ${TIMEOUTS.length} 次`); }

// 商品图片：只核验可访问、类型为图片、有内容，并记录大小供性能核对；不转换、不重绘。
try {
    const local = JSON.parse(await localText('products.json'));
    const images = [...new Set(local.filter(item => item.image).map(item => item.image))];
    for (const image of images) {
        try {
            const response = await fetchText(image);
            const buffer = response.ok ? await response.arrayBuffer() : null;
            const type = response.headers.get('content-type') || '';
            const ok = response.ok && type.startsWith('image/') && buffer && buffer.byteLength > 0;
            console.log(`${image}: HTTP ${response.status}, ${type || 'no-type'}, ${buffer ? (buffer.byteLength / 1024).toFixed(0) + ' KB' : 'no-body'}, ${ok ? 'OK' : 'CHECK'}`);
            if (!ok) stale.push(image);
            ready &&= ok;
        } catch (error) { ready = false; unverified.push(image); console.log(`${image}: REQUEST_FAILED (${error.name})，已重试 ${TIMEOUTS.length} 次`); }
    }
} catch (error) { ready = false; unverified.push('商品图片清单'); console.log(`product images: REQUEST_FAILED (${error.name})`); }

// 顺手把两条安全边界也在正式站上验一遍：CSP 的 script-src 只放行 'self' 才算真的
// 甩掉了第三方脚本源；自托管 SDK 必须按 JS 类型返回，类型不对浏览器直接拒绝执行。
for (const [label, path, detail] of [
    ['CSP script-src', 'login.html', h => (/script-src ([^;]+)/.exec(h.get('content-security-policy') || '')?.[1] || '(缺失)').trim()],
    ['SDK Content-Type', vendorFile, h => h.get('content-type') || '(缺失)'],
]) {
    try {
        const response = await fetchText(path);
        const value = detail(response.headers);
        const ok = response.ok && (label === 'CSP script-src' ? value === "'self'" : value.includes('javascript'));
        console.log(`${label}: HTTP ${response.status}, ${value}, ${ok ? 'OK' : 'CHECK'}`);
        if (!ok) stale.push(label);
        ready &&= ok;
    } catch (error) { ready = false; unverified.push(label); console.log(`${label}: REQUEST_FAILED (${error.name})，已重试 ${TIMEOUTS.length} 次`); }
}

// 三种结论分开说：确认过时、只是没验完、全部一致。混成一句 NOT_READY 的话，
// 下次真出问题时没人看得出来。
if (stale.length) {
    console.log(`NOT_READY: ${stale.length} 项确认与本地不一致，别当成已上线：${stale.join(', ')}`);
} else if (unverified.length) {
    console.log(`INCONCLUSIVE: 已核对的部分全部一致，但 ${unverified.length} 项因网络没验完：${unverified.join(', ')}`);
} else {
    console.log('PASS: 正式站已加载本地版本的备忘录、商店与工具站资源。');
}
process.exitCode = ready ? 0 : 2;
