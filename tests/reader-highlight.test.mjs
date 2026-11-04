// reader-highlight.js 的功能测试：使用最小 DOM 桩，不依赖 jsdom，只验证算法逻辑。
// 桩只实现被测模块用到的 API，不等于真实浏览器；真实选区与排版仍需在浏览器里实测。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

class Node_ {
  constructor(type, name) { this.nodeType = type; this.nodeName = name; this.parentNode = null; this.childNodes = []; }
  get firstChild() { return this.childNodes[0] || null; }
  contains(n) { for (; n; n = n.parentNode) { if (n === this) return true; } return false; }
  detach(n) { if (n.parentNode) { const a = n.parentNode.childNodes; a.splice(a.indexOf(n), 1); n.parentNode = null; } }
  insertBefore(n, ref) { this.detach(n); const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length; this.childNodes.splice(i, 0, n); n.parentNode = this; return n; }
  appendChild(n) { return this.insertBefore(n, null); }
  removeChild(n) { this.detach(n); return n; }
  normalize() {
    for (const c of this.childNodes.slice()) { if (c.nodeType === 1) c.normalize(); }
    let prev = null;
    for (const c of this.childNodes.slice()) {
      if (c.nodeType === 3) {
        if (c.nodeValue === '') { this.removeChild(c); continue; }
        if (prev) { prev.nodeValue += c.nodeValue; this.removeChild(c); continue; }
        prev = c;
      } else { prev = null; }
    }
  }
}
class Text_ extends Node_ {
  constructor(v) { super(3, '#text'); this.nodeValue = v; }
  splitText(off) {
    const t = new Text_(this.nodeValue.slice(off));
    this.nodeValue = this.nodeValue.slice(0, off);
    const p = this.parentNode;
    if (p) { p.insertBefore(t, p.childNodes[p.childNodes.indexOf(this) + 1] || null); }
    return t;
  }
}
class El_ extends Node_ {
  constructor(tag) {
    super(1, tag.toUpperCase());
    this.attrs = {}; this.className = ''; this.offsetWidth = 0;
    const self = this;
    this.classList = {
      add(c) { const s = new Set(self.className.split(' ').filter(Boolean)); s.add(c); self.className = [...s].join(' '); },
      remove(c) { self.className = self.className.split(' ').filter((x) => x && x !== c).join(' '); }
    };
  }
  get id() { return this.attrs.id; }
  set id(v) { this.attrs.id = v; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  matches(sel) {
    return sel.split(',').some((p) => {
      const [tag, cls] = p.trim().split('.');
      return this.nodeName === tag.toUpperCase() && (!cls || this.className.split(' ').includes(cls));
    });
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 1) { if (c.matches(sel)) out.push(c); walk(c); } } };
    walk(this);
    return out;
  }
}
function pathOf(n) { const p = []; for (; n.parentNode; n = n.parentNode) { p.unshift(n.parentNode.childNodes.indexOf(n)); } return p; }
function cmp(an, ao, bn, bo) {
  if (an === bn) return Math.sign(ao - bo);
  if (an.contains(bn)) { let c = bn; while (c.parentNode !== an) c = c.parentNode; return ao <= an.childNodes.indexOf(c) ? -1 : 1; }
  if (bn.contains(an)) return -cmp(bn, bo, an, ao);
  const pa = pathOf(an), pb = pathOf(bn);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) { if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1; }
  return 0;
}
class Range_ {
  constructor() { this.startContainer = null; this.startOffset = 0; this.endContainer = null; this.endOffset = 0; }
  get collapsed() { return this.startContainer === this.endContainer && this.startOffset === this.endOffset; }
  setStart(n, o) { this.startContainer = n; this.startOffset = o; if (!this.endContainer) { this.endContainer = n; this.endOffset = o; } }
  setEnd(n, o) { this.endContainer = n; this.endOffset = o; if (!this.startContainer) { this.startContainer = n; this.startOffset = o; } }
  collapse(toStart) {
    if (toStart) { this.endContainer = this.startContainer; this.endOffset = this.startOffset; }
    else { this.startContainer = this.endContainer; this.startOffset = this.endOffset; }
  }
  comparePoint(n, o) {
    if (cmp(n, o, this.startContainer, this.startOffset) < 0) return -1;
    if (cmp(n, o, this.endContainer, this.endOffset) > 0) return 1;
    return 0;
  }
  intersectsNode(n) {
    const p = n.parentNode;
    if (!p) return true;
    const i = p.childNodes.indexOf(n);
    return cmp(p, i, this.endContainer, this.endOffset) < 0 && cmp(p, i + 1, this.startContainer, this.startOffset) > 0;
  }
  toString() {
    let root = this.startContainer;
    while (root.parentNode) root = root.parentNode;
    let out = '';
    const walk = (n) => {
      if (n.nodeType !== 3) { n.childNodes.forEach(walk); return; }
      const L = n.nodeValue.length;
      const before = n !== this.startContainer && cmp(n, L, this.startContainer, this.startOffset) <= 0;
      const after = n !== this.endContainer && cmp(n, 0, this.endContainer, this.endOffset) >= 0;
      if (before || after) return;
      out += n.nodeValue.slice(n === this.startContainer ? this.startOffset : 0, n === this.endContainer ? this.endOffset : L);
    };
    walk(root);
    return out;
  }
}
const head = new El_('head');
globalThis.document = {
  head,
  createElement: (t) => new El_(t),
  createRange: () => new Range_(),
  getElementById: (id) => head.childNodes.find((c) => c.attrs && c.attrs.id === id) || null,
  createTreeWalker(root, what, filter) {
    const list = [];
    const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { if (!filter || filter.acceptNode(c) === 1) list.push(c); } else { walk(c); } } };
    walk(root);
    let i = 0;
    return { nextNode: () => list[i++] || null };
  }
};

const H = createRequire(import.meta.url)('../reader-highlight.js');
const el = (tag, ...kids) => { const e = new El_(tag); kids.forEach((k) => e.appendChild(typeof k === 'string' ? new Text_(k) : k)); return e; };
const textOf = (n) => (n.nodeType === 3 ? n.nodeValue : n.childNodes.map(textOf).join(''));
const sel = (sn, so, en, eo) => { const r = new Range_(); r.setStart(sn, so); r.setEnd(en, eo); return r; };
const markText = (c, id) => c.querySelectorAll('mark.reader-highlight').filter((m) => m.getAttribute('data-id') === id).map(textOf).join('');
const P1 = 'the cat sat on the mat. the cat ran away.';
const chapter = () => el('div', el('p', P1), el('p', 'Second paragraph with ', el('em', 'emphasis'), ' inside.'));

test('锚点包含上下文与段落信息，且重排成不同文本节点后仍能还原', () => {
  const c1 = chapter();
  const t = c1.childNodes[0].childNodes[0];
  const a = H.createHighlightAnchor(sel(t, 4, t, 11), c1, { bookId: 'b1', chapterIndex: 2 });
  assert.equal(a.exact, 'cat sat');
  assert.equal(a.prefix, 'the ');
  assert.equal(a.blockIndex, 0);
  assert.equal(a.bookId, 'b1');
  assert.equal(a.chapterIndex, 2);
  assert.equal(a.rawText, 'cat sat');
  const c2 = el('div', el('p', 'the ca', 't sat on the mat. the cat ran away.'), el('p', 'Second paragraph with ', el('em', 'emphasis'), ' inside.'));
  const before = textOf(c2);
  const r = H.restoreHighlights(c2, [a]);
  assert.deepEqual(r.restored, [a.id]);
  assert.equal(markText(c2, a.id), 'cat sat');
  assert.equal(textOf(c2), before);
  assert.equal(c2.querySelectorAll('p').length, 2);
  assert.equal(c2.querySelectorAll('em').length, 1);
});

test('同一文字出现多次时，凭前后文选中正确的那一处', () => {
  const c1 = chapter();
  const t = c1.childNodes[0].childNodes[0];
  const s = P1.indexOf('the cat', 1);
  const a = H.createHighlightAnchor(sel(t, s, t, s + 7), c1, {});
  a.blockIndex = -1;
  delete a.position;
  const c2 = chapter();
  H.restoreHighlights(c2, [a]);
  assert.equal(c2.childNodes[0].childNodes[0].nodeValue, 'the cat sat on the mat. ');
  assert.equal(markText(c2, a.id), 'the cat');
});

test('跨段落选区还原后不破坏段落与标签结构', () => {
  const c1 = chapter();
  const t1 = c1.childNodes[0].childNodes[0];
  const t2 = c1.childNodes[1].childNodes[0];
  const a = H.createHighlightAnchor(sel(t1, 15, t2, 6), c1, {});
  const c2 = chapter();
  const before = textOf(c2);
  H.restoreHighlights(c2, [a]);
  assert.equal(markText(c2, a.id), P1.slice(15) + 'Second');
  assert.equal(textOf(c2), before);
  assert.equal(c2.querySelectorAll('p').length, 2);
  assert.ok(c2.querySelectorAll('mark.reader-highlight').every((m) => m.querySelectorAll('p').length === 0));
});

test('整段元素边界选区能生成锚点', () => {
  const c = chapter();
  const p = c.childNodes[0];
  const a = H.createHighlightAnchor(sel(p, 0, p, 1), c, {});
  assert.equal(a.exact, P1);
});

test('同一段内交叉划线都能还原', () => {
  const c = el('div', el('p', 'abcdefghij'));
  const list = [
    { id: 'h1', chapterIndex: 0, exact: 'cdef', prefix: 'ab', suffix: 'ghij' },
    { id: 'h2', chapterIndex: 0, exact: 'efgh', prefix: 'abcd', suffix: 'ij' }
  ];
  const r = H.restoreHighlights(c, list);
  assert.deepEqual(r.restored, ['h1', 'h2']);
  assert.equal(markText(c, 'h1'), 'cdef');
  assert.equal(markText(c, 'h2'), 'efgh');
  assert.equal(textOf(c), 'abcdefghij');
});

test('全角字符、弯引号、多余空白和换行都能容错匹配', () => {
  const nl = String.fromCharCode(10), sp = String.fromCharCode(0x3000), Q = String.fromCharCode(34);
  const dom = 'Ｈello，' + nl + '  “世界”' + sp + 'test';
  const c = el('div', el('p', 'x ' + dom + ' y'));
  const h = { id: 'h1', chapterIndex: 0, exact: 'hello, ' + Q + '世界' + Q + ' test', prefix: 'x ', suffix: ' y' };
  const r = H.restoreHighlights(c, [h]);
  assert.deepEqual(r.restored, [h.id]);
  assert.equal(markText(c, 'h1'), dom);
  assert.equal(textOf(c), 'x ' + dom + ' y');
});

test('正文中间被改动时走头尾匹配并标记 fuzzy，找不到时进入 failed', () => {
  const exact = 'alpha bravo charlie delta echo foxtrot golf';
  const dom = 'alpha bravo charlie sierra echo foxtrot golf';
  const c = el('div', el('p', dom));
  const r = H.restoreHighlights(c, [
    { id: 'f1', chapterIndex: 0, exact, prefix: '', suffix: '' },
    { id: 'x1', chapterIndex: 0, exact: 'nonexistent phrase here', prefix: '', suffix: '' }
  ]);
  assert.deepEqual(r.fuzzy, ['f1']);
  assert.deepEqual(r.restored, ['f1']);
  assert.deepEqual(r.failed, [{ id: 'x1', reason: 'not-found' }]);
  assert.equal(markText(c, 'f1'), dom);
});

test('重复调用不会叠加标记，清除后恢复为原文本节点', () => {
  const c = el('div', el('p', P1));
  const h = { id: 'h1', chapterIndex: 0, exact: 'cat sat', prefix: 'the ', suffix: ' on the mat.' };
  H.restoreHighlights(c, [h]);
  const n1 = c.querySelectorAll('mark.reader-highlight').length;
  H.restoreHighlights(c, [h]);
  assert.equal(c.querySelectorAll('mark.reader-highlight').length, n1);
  assert.equal(H.clearHighlights(c), n1);
  const p = c.childNodes[0];
  assert.equal(p.childNodes.length, 1);
  assert.equal(p.childNodes[0].nodeValue, P1);
});

test('scrollToHighlight 找到时触发回调并闪烁，找不到时返回 false', () => {
  const c = el('div', el('p', P1));
  H.restoreHighlights(c, [{ id: 'h1', chapterIndex: 0, exact: 'cat sat', prefix: 'the ', suffix: '' }]);
  let revealed = 0;
  assert.equal(H.scrollToHighlight(c, 'h1', { reveal: (first, all) => { revealed = all.length; }, flashMs: 1 }), true);
  assert.equal(revealed, 1);
  assert.ok(c.querySelectorAll('mark.reader-highlight')[0].className.includes('reader-highlight--flash'));
  assert.equal(H.scrollToHighlight(c, 'nope'), false);
});
