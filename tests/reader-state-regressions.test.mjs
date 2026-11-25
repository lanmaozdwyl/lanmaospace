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
