import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../reader.js',import.meta.url),'utf8');

function backupFixture(database = null) {
    const storage = new Map();
    const notices = [];
    let fileTask;
    const c = {
        state: {books: {}, bookmarks: {}, highlights: {}},
        localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
        STORAGE_KEY_BOOK_PROGRESS: 'positions', STORAGE_KEY_PROGRESS: 'recent', STORAGE_KEY_CUSTOM_BOOKS: 'books',
        dbInstance: database, window: {}, console: {warn() {}}, atob,
        FileReader: class {
            readAsText(data) { fileTask = this.onload({target: {result: JSON.stringify(data)}}); }
        },
        showToast: message => notices.push(message),
        saveBookmarks() {}, renderBookmarksList() {}, renderBookshelfGrid() {}, updateBookshelfHero() {},
    };
    vm.createContext(c);
    for (const [from, to] of [
        ['loadSavedProgress', 'loadBookProgress'],
        ['isGutenbergArchive', 'initCustomBooksStorage'],
        ['saveCustomBook', 'confirmDeleteCustomBook'],
        ['showPdfImportResult', 'setImportingState'],
    ]) {
        vm.runInContext(source.slice(source.indexOf('    function ' + from + '('), source.indexOf('    function ' + to + '(')), c);
    }
    vm.runInContext('finishCustomBooksLoad();', c);
    return {c, storage, notices, async restore(data) {
        c.importBookshelfBackup({app: 'lanmao-reader-backup', customBooks: [], ...data});
        await fileTask;
    }};
}

test('恢复旧书架备份保留较新或无日期的本机进度，新位置及书签可补入', async () => {
    const {c, storage, restore} = backupFixture();
    storage.set('positions', JSON.stringify({same: {chapterIndex: 8, timestamp: 90}, legacy: {chapterIndex: 6}, newer: {chapterIndex: 2, timestamp: 20}}));
    storage.set('recent', JSON.stringify({bookId: 'same', chapterIndex: 8, timestamp: 90}));
    c.state.bookmarks.same = [{id: 'still-here'}, {id: 'overlap', excerpt: '本机'}];
    await restore({
        bookProgress: {same: {chapterIndex: 3, timestamp: 30}, legacy: {chapterIndex: 1, timestamp: 80}, newer: {chapterIndex: 4, timestamp: 70}},
        lastProgress: {bookId: 'old-only', chapterIndex: 7, timestamp: 35},
        bookmarks: {same: [{id: 'overlap', excerpt: '备份'}, {id: 'from-backup'}, {id: 'from-backup'}]},
    });
    const positions = JSON.parse(storage.get('positions'));
    assert.equal(positions.same.chapterIndex, 8);
    assert.equal(positions.legacy.chapterIndex, 6);
    assert.equal(positions.newer.chapterIndex, 4);
    assert.equal(positions['old-only'].chapterIndex, 7);
    assert.equal(JSON.parse(storage.get('recent')).bookId, 'same');
    assert.deepEqual(Array.from(c.state.bookmarks.same, item => item.id), ['still-here', 'overlap', 'from-backup']);
    assert.equal(c.state.bookmarks.same[1].excerpt, '本机');
    storage.delete('recent');
    await restore({lastProgress: {bookId: 'old-only', chapterIndex: 7, timestamp: 35}});
    assert.equal(JSON.parse(storage.get('recent')).bookId, 'old-only');
});

test('PDF 只有在 IndexedDB 完成后才算保存，失败仍可临时阅读', async () => {
    const book = {id: 'pdf', title: '测试', format: 'pdf', chapters: [], pdfData: new ArrayBuffer(8)};
    const {c, storage, notices, restore} = backupFixture();
    assert.equal(await new Promise(resolve => c.saveCustomBook(book, resolve)), false);
    assert.equal(c.state.books.pdf, book);
    assert.equal(storage.has('books'), false);
    await restore({customBooks: [
        {id: 'missing', title: '缺少正文', format: 'pdf'},
        {id: 'pdf-backup', title: '有正文', format: 'pdf', pdfDataBase64: 'JVBERg=='},
    ]});
    assert.match(notices.at(-1), /已保存 0 本书.*2 本未能保存/);
    assert.equal(Object.hasOwn(c.state.books, 'missing'), false);

    let tx;
    const durable = backupFixture({transaction() { tx = {objectStore: () => ({put: () => ({})})}; return tx; }});
    const results = [];
    durable.c.saveCustomBook(book, saved => results.push(saved));
    assert.deepEqual(results, []);
    tx.oncomplete();
    assert.deepEqual(results, [true]);
    durable.c.saveCustomBook(book, saved => results.push(saved));
    tx.onabort();
    assert.deepEqual(results, [true, false]);
});

test('备份合并不同存储位置的书籍，恢复后仍有完整 PDF 正文', async () => {
    const pdf = {id: 'pdf', title: '测试 PDF', format: 'pdf', chapters: [], pdfData: Uint8Array.of(37, 80, 68, 70).buffer};
    const {pdfData, ...pdfMirror} = pdf;
    const database = {transaction() {return {objectStore: () => ({getAll() {
        const request = {result: [pdf]};
        queueMicrotask(() => request.onsuccess());
        return request;
    }})};}};
    const {c, storage, notices} = backupFixture(database);
    storage.set('books', JSON.stringify([{id: 'txt', title: '镜像正文', chapters: [{title: '第一章', content: ['可恢复正文']}]}, pdfMirror]));
    c.state.books = {pdf: pdfMirror, missing: {id: 'missing', title: '旧 PDF', format: 'pdf', chapters: []}};
    let backupBlob;
    Object.assign(c, {Blob, btoa, setTimeout() {}, BUILTIN_BOOKS: {}, STORAGE_KEY_SETTINGS: 'settings',
        URL: {createObjectURL: blob => {backupBlob = blob; return 'blob:fake';}},
        document: {createElement: () => ({click() {}}), body: {appendChild() {}, removeChild() {}}}});
    vm.runInContext(source.slice(source.indexOf('    async function exportBookshelfBackup('), source.indexOf('    function showPdfImportResult(')), c);
    await c.exportBookshelfBackup();
    const backup = JSON.parse(await backupBlob.text());
    assert.deepEqual(backup.customBooks.map(book => book.id), ['txt', 'pdf']);
    assert.equal(backup.customBooks[1].pdfDataBase64, 'JVBERg==');
    assert.match(notices.at(-1), /1 本 PDF 缺少正文/);

    const target = backupFixture({transaction() {
        const tx = {objectStore: () => ({put() { queueMicrotask(() => tx.oncomplete()); return {}; }})};
        return tx;
    }});
    await target.restore({customBooks: backup.customBooks});
    assert.equal(target.c.state.books.txt.chapters[0].content[0], '可恢复正文');
    assert.deepEqual([...new Uint8Array(target.c.state.books.pdf.pdfData)], [...new Uint8Array(pdfData)]);
});

async function onlineSearch(name, nextFunction, searchResults, download, save = true) {
    const cards = [];
    const saved = [];
    const notices = [];
    const context = vm.createContext({
        resultsContainer: {appendChild: card => cards.push(card)}, state: {books: {}},
        document: {createElement() {
            const button = {addEventListener: (_, handler) => {button.click = handler;}};
            return {button, querySelector: () => button};
        }},
        getCoverThemeByTitle: () => '', escapeHtml: String,
        fetch: async url => url.endsWith('/qa.txt') ? download() : {ok: true, json: async () => searchResults},
        parseUploadedFile: (_, text) => ({chapters: [{title: '正文', content: [text]}]}),
        saveOnlineBook: async book => {if (save) saved.push(book); return save;},
        renderBookshelfGrid() {}, updateBookshelfHero() {},
        showToast: text => notices.push(text), console: {error() {}},
    });
    const start = source.indexOf('    async function ' + name + '(');
    vm.runInContext(source.slice(source.indexOf('    function isGutenbergArchive('), source.indexOf('    function initCustomBooksStorage(')), context);
    const end = source.indexOf(nextFunction, start);
    vm.runInContext(source.slice(start, end), context);
    await context[name]('test');
    return {cards, saved, notices, context};
}

test('古登堡的网络错误、HTTP 错误和 HTML 回退均不保存，成功时才显示已保存', async () => {
    const results = {results: [{id: 8, title: '测试书', formats: {'text/plain': 'https://gutenberg.invalid/qa.txt'}}]};
    const setup = (download, save) => onlineSearch('performGutenbergSearch', '        // 渲染开源小说', results, download, save);
    for (const download of [
        () => {throw new Error('Network');},
        () => ({ok: false}),
        () => ({ok: true, text: async () => '<!doctype html><html>Error</html>'}),
    ]) {
        const f = await setup(download);
        await f.cards[0].button.click();
        assert.equal(f.saved.length, 0);
        assert.equal(f.cards[0].button.disabled, false);
        assert.equal(f.cards[0].button.textContent, '重试导入');
    }
    const content = () => ({ok: true, text: async () => '有效正文'});
    const storageFailure = await setup(content, false);
    await storageFailure.cards[0].button.click();
    assert.equal(storageFailure.cards[0].button.disabled, false);
    assert.match(storageFailure.notices.at(-1), /未能保存/);
    const f = await setup(content);
    await f.cards[0].button.click();
    assert.equal(f.saved[0].chapters[0].content[0], '有效正文');
    assert.equal(f.cards[0].button.textContent, '✓ 正文已在书架中');
});

test('Open Library 书目和已有节选在入库后都有明确的内容标签', async () => {
    const f = await onlineSearch('performOpenLibrarySearch', '        // 自定义直链导入逻辑', {docs: [
        {key: '/works/OL123W', title: '测试书', author_name: ['作者']},
    ]});
    assert.match(f.cards[0].innerHTML, /https:\/\/openlibrary\.org\/works\/OL123W/);
    await f.cards[0].button.click();
    assert.equal(f.saved[0].title, '测试书（书目）');
    assert.equal(f.saved[0].tag, '书目 · 无正文');
    const excerpt = f.context.labelShelfEdition({id: 'curated_sanguo', title: '三国演义'});
    assert.equal(excerpt.title, '三国演义（节选）');
    assert.equal(f.context.labelShelfEdition(excerpt).title, excerpt.title);
});

test('第一次打开在线找书时，结果容器里只有注释也会显示节选', () => {
    let click;
    let renders = 0;
    const results = {hasChildNodes: () => true, firstElementChild: null};
    const nodes = {
        'shelf-btn-online-search': {addEventListener: (_, handler) => {click = handler;}},
        'online-search-results': results,
        'tab-online-classics': {getAttribute: () => 'true'},
    };
    const start = source.indexOf('        // 在线找书入口按钮');
    vm.runInNewContext(source.slice(start, source.indexOf('\n    }', start)), {
        document: {getElementById: id => nodes[id]},
        openDrawer() {},
        window: {_renderOnlineClassics() {renders++; results.firstElementChild = {};}},
    });
    click();
    click();
    assert.equal(renders, 1);
});
test('追加章节不会改变当前章节保存的相对阅读位置',()=>{
 const section={offsetTop:1200,offsetHeight:1000};
 const c={state:{currentChapterIndex:1},document:{querySelector:()=>section}};vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('    function getChapterScrollAnchor('),source.indexOf('    function saveProgress(')),c);
 const viewport={scrollTop:1450,scrollHeight:2400,clientHeight:600};
 assert.equal(c.getChapterScrollAnchor(viewport).scrollRatio,.25);
 viewport.scrollHeight=6000;assert.equal(c.getChapterScrollAnchor(viewport).scrollRatio,.25);
 assert.equal(c.getChapterScrollAnchor(viewport).scrollY,250);
 assert.equal(c.getChapterScrollAnchor(viewport).scrollAnchorVersion,2);
 c.state.currentBook={chapters:[{},{}]};viewport.scrollHeight=2200;viewport.scrollTop=1600;assert.equal(c.getChapterScrollAnchor(viewport).scrollRatio,1);
});
test('朗读切换后旧回调不能跳过新段落，同一回调也不能重复推进',()=>{
 const spoken=[];
 const c={state:{tts:{active:true,paused:false,currentParaIndex:0,paragraphs:[{text:'第一段'},{text:'第二段'},{text:'第三段'}]}},
  document:{querySelectorAll:()=>[]},isTTSSupported:()=>true,updateTTSBarUI(){},stopTTS(){},showToast(){},console,
  window:{speechSynthesis:{cancel(){},speak:u=>spoken.push(u)},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('    function speakCurrentParagraph('),source.indexOf('    function startTTS(')),c);
 c.speakCurrentParagraph();const old=spoken[0];c.state.tts.currentParaIndex=1;c.speakCurrentParagraph();const current=spoken[1];
 old.onend();old.onerror({error:'network'});assert.equal(c.state.tts.currentParaIndex,1);assert.equal(spoken.length,2);
 current.onend();assert.equal(c.state.tts.currentParaIndex,2);assert.equal(spoken.length,3);
 current.onend();assert.equal(c.state.tts.currentParaIndex,2);assert.equal(spoken.length,3);
});
