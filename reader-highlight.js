/**
 * reader-highlight.js
 * 正文划线锚定与高亮还原（纯原生 JS，无外部依赖）
 *
 * 设计思路（参考 W3C Web Annotation 的 TextQuoteSelector + TextPositionSelector）：
 * 1. 不存屏幕页码，也不存 DOM 偏移量，只存文本本身：exact（选中原文）+ prefix/suffix（前后文）。
 * 2. 把章节容器内所有文本节点按统一规则规范化（折叠空白、全角转半角、去零宽字符、统一弯引号、小写），
 *    得到一条线性字符串。字号、行高、版宽、横竖屏只影响排版，不影响这条字符串，所以锚点不会因重排失效。
 * 3. 还原时在线性字符串中查找 exact；同文多处出现时，用 prefix/suffix 匹配长度、blockIndex、position 打分选最佳。
 * 4. 精确查找失败（正文被轻微修订）时，退到头尾片段、再退到上下文夹取，并在结果里标记 fuzzy；仍失败则进入 failed，不会静默丢失。
 * 5. 先在字符串层算出所有区间，切成互不交叉的小段，再只对文本节点 splitText 后包裹 mark，
 *    不移动、不删除任何原有标签；交叉划线用嵌套 mark 表达，每个划线 id 都能查到。
 *
 * 对外接口：
 *   createHighlightAnchor(selection, chapterContainer, options) -> 锚点对象或 null
 *   restoreHighlights(chapterContainer, highlightList, options) -> { restored, fuzzy, failed }
 *   scrollToHighlight(container, highlightId, options) -> boolean
 *   clearHighlights(container) -> 去掉的 mark 数量
 *   HIGHLIGHT_SCHEMA：划线记录的 JSON Schema
 *
 * 注意：本文件独立，尚未接入 reader.js，也未加入 scripts/build.mjs 的打包白名单，接入时需自行添加。
 */
(function (global, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (global) { global.ReaderHighlight = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var CONTEXT_LEN = 32; // 前后文各取多少个规范化字符
  // 段落级块元素：blockIndex 即其在 querySelectorAll 结果中的序号（mark 不是块，不影响序号）
  var BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,figcaption,dd,dt';
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, RT: 1, RP: 1, TEMPLATE: 1 };
  var QUOTE = String.fromCharCode(34);
  var APOS = String.fromCharCode(39);

  /* ------------------------------------------------------------------ */
  /* 1. 锚点数据结构（JSON Schema）                                       */
  /* ------------------------------------------------------------------ */
  var HIGHLIGHT_SCHEMA = {
    type: 'object',
    required: ['id', 'bookId', 'chapterIndex', 'exact', 'prefix', 'suffix'],
    properties: {
      schemaVersion: { type: 'integer', description: '数据结构版本，目前为 1' },
      id: { type: 'string', description: '划线唯一 ID（UUID）' },
      bookId: { type: 'string', description: '所属书籍 ID' },
      chapterIndex: { type: 'integer', minimum: 0, description: '章节序号' },
      blockIndex: { type: 'integer', minimum: -1, description: '起点所在段落在章节内的序号，-1 表示未知；只用于消歧，不作为唯一依据' },
      blockOffset: { type: ['integer', 'null'], description: '起点相对所在段落起点的规范化字符偏移' },
      exact: { type: 'string', description: '选中的原文（已规范化，用于匹配）' },
      prefix: { type: 'string', description: '选区之前的上下文（规范化后最多 32 字符）' },
      suffix: { type: 'string', description: '选区之后的上下文（规范化后最多 32 字符）' },
      rawText: { type: 'string', description: '选中文本的原样内容，仅用于笔记列表展示' },
      position: {
        type: 'object',
        description: '章节规范化文本中的起止位置，仅作为同文多处时的提示，不作为唯一依据',
        properties: { start: { type: 'integer' }, end: { type: 'integer' } }
      },
      color: { type: 'string' },
      note: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  };

  /* ------------------------------------------------------------------ */
  /* 2. 文本规范化与线性索引                                              */
  /* ------------------------------------------------------------------ */

  // 零宽字符与软连字符：直接丢弃
  function isDropCode(c) {
    return c === 0x200b || c === 0x200c || c === 0x200d || c === 0xfeff || c === 0xad || c === 0x2060;
  }

  // 各类空白（含换行、制表、不换行空格、全角空格等）：折叠为单个空格
  function isSpaceCode(c) {
    return c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x3000 || c === 0x2028 || c === 0x2029 ||
      (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f;
  }

  // 单字符规范化，保证结果长度为 0 或 1，这样规范化文本与字符映射才能一一对应
  function foldChar(ch) {
    var c = ch.charCodeAt(0);
    if (isDropCode(c)) { return ''; }
    if (isSpaceCode(c)) { return ' '; }
    if (c === 0x2018 || c === 0x2019) { return APOS; }
    if (c === 0x201c || c === 0x201d) { return QUOTE; }
    var n = ch;
    if (c > 127 && ch.normalize) {
      var t = ch.normalize('NFKC'); // 全角字母数字、全角标点转半角
      if (t.length === 1) { n = t; }
    }
    var l = n.toLowerCase();
    return l.length === 1 ? l : n;
  }

  function trimSpaces(s) {
    var a = 0, b = s.length;
    while (a < b && s.charAt(a) === ' ') { a++; }
    while (b > a && s.charAt(b - 1) === ' ') { b--; }
    return s.slice(a, b);
  }

  // 字符串规范化（规则与索引完全一致），用于处理存储的 exact/prefix/suffix
  function normalizeString(str, trim) {
    var out = [], last = false;
    for (var i = 0; i < str.length; i++) {
      var f = foldChar(str.charAt(i));
      if (f === '') { continue; }
      if (f === ' ') { if (last) { continue; } last = true; } else { last = false; }
      out.push(f);
    }
    var s = out.join('');
    return trim ? trimSpaces(s) : s;
  }

  function toArray(list) { return Array.prototype.slice.call(list); }

  /**
   * 为容器建立线性文本索引。
   * 返回 { text, infos, map }：
   *   text  规范化后的整章文本
   *   infos 每个文本节点一项：{ node, start, len, rs[], re[], r2n }
   *         start 为该节点第一个规范化字符在 text 中的位置；
   *         rs[k]/re[k] 为第 k 个规范化字符在该节点原始字符串中的起止下标；
   *         r2n[i] 为原始下标 i 之前共有多少规范化字符（绝对位置），用于把选区端点换算成 text 位置。
   * 已存在的 reader-highlight 标记只是包了一层元素，文本节点内容不变，所以索引与有无划线无关。
   */
  function buildTextIndex(root) {
    var infos = [], map = new Map(), parts = [], total = 0, lastSpace = true;
    var walker = document.createTreeWalker(root, 4, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== root; p = p.parentNode) {
          if (p.nodeType === 1 && (SKIP_TAGS[p.nodeName] || p.hasAttribute('data-reader-ignore'))) { return 2; }
        }
        return 1;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var raw = node.nodeValue;
      var info = { node: node, start: total, len: 0, rs: [], re: [], r2n: new Int32Array(raw.length + 1) };
      for (var i = 0; i < raw.length; i++) {
        info.r2n[i] = total;
        var f = foldChar(raw.charAt(i));
        if (f === '' || (f === ' ' && lastSpace)) { continue; } // 零宽字符、连续空白不产生字符
        lastSpace = (f === ' ');
        parts.push(f);
        info.rs.push(i);
        info.re.push(i + 1);
        total++;
        info.len++;
      }
      info.r2n[raw.length] = total;
      infos.push(info);
      map.set(node, info);
    }
    return { text: parts.join(''), infos: infos, map: map };
  }

  // 把 DOM 边界点 (container, offset) 换算成规范化文本中的位置
  function boundaryToNorm(index, container, offset) {
    if (container.nodeType === 3) {
      var info = index.map.get(container);
      if (info) { return info.r2n[Math.min(offset, info.r2n.length - 1)]; }
    }
    // 边界在元素上（如整段选中）：取边界点之后的第一个文本节点的起点
    var r = document.createRange();
    r.setStart(container, offset);
    r.collapse(true);
    for (var i = 0; i < index.infos.length; i++) {
      if (r.comparePoint(index.infos[i].node, 0) >= 0) { return index.infos[i].start; }
    }
    return index.text.length;
  }

  function infoAt(index, pos) {
    for (var i = 0; i < index.infos.length; i++) {
      var f = index.infos[i];
      if (f.len > 0 && pos >= f.start && pos < f.start + f.len) { return f; }
    }
    return null;
  }

  function blockElementOf(node, container) {
    var el = node.nodeType === 1 ? node : node.parentNode;
    while (el && el !== container) {
      if (el.nodeType === 1 && el.matches && el.matches(BLOCK_SELECTOR)) { return el; }
      el = el.parentNode;
    }
    return null;
  }

  // 某个块元素在规范化文本中的 [起, 止) 区间
  function blockRange(index, el) {
    var s = -1, e = -1;
    for (var i = 0; i < index.infos.length; i++) {
      var f = index.infos[i];
      if (f.len > 0 && el.contains(f.node)) { if (s < 0) { s = f.start; } e = f.start + f.len; }
    }
    return s < 0 ? null : [s, e];
  }

  function trimRange(text, s, e) {
    while (s < e && text.charAt(s) === ' ') { s++; }
    while (e > s && text.charAt(e - 1) === ' ') { e--; }
    return e > s ? [s, e] : null;
  }

  function makeId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) { return crypto.randomUUID(); }
    return 'hl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function commonSuffixLen(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a.charAt(a.length - 1 - n) === b.charAt(b.length - 1 - n)) { n++; }
    return n;
  }

  function commonPrefixLen(a, b) {
    var n = 0;
    while (n < a.length && n < b.length && a.charAt(n) === b.charAt(n)) { n++; }
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* 3. 生成锚点                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * 根据用户选区生成稳定锚点。
   * @param {Selection|Range} selection 当前选区（window.getSelection() 或 Range）
   * @param {Element} chapterContainer 当前章节正文容器
   * @param {Object} [options] { id, bookId, chapterIndex, color, note, contextLength }
   * @returns {Object|null} 符合 HIGHLIGHT_SCHEMA 的记录；选区为空或不在容器内时返回 null
   */
  function createHighlightAnchor(selection, chapterContainer, options) {
    options = options || {};
    var range = selection && selection.getRangeAt ? (selection.rangeCount ? selection.getRangeAt(0) : null) : selection;
    if (!range || range.collapsed || !chapterContainer) { return null; }
    if (!range.intersectsNode(chapterContainer)) { return null; }

    var index = buildTextIndex(chapterContainer);
    var text = index.text;
    // 选区越出容器时，把越界的一端夹到章节首/尾
    var s = chapterContainer.contains(range.startContainer) ? boundaryToNorm(index, range.startContainer, range.startOffset) : 0;
    var e = chapterContainer.contains(range.endContainer) ? boundaryToNorm(index, range.endContainer, range.endOffset) : text.length;
    var trimmed = trimRange(text, s, e); // 去掉首尾空白，避免锚点以空格开头
    if (!trimmed) { return null; }
    s = trimmed[0];
    e = trimmed[1];

    var ctx = options.contextLength || CONTEXT_LEN;
    var info = infoAt(index, s);
    var blockEl = info ? blockElementOf(info.node, chapterContainer) : null;
    var blocks = toArray(chapterContainer.querySelectorAll(BLOCK_SELECTOR));
    var blockIndex = blockEl ? blocks.indexOf(blockEl) : -1;
    var br = blockEl ? blockRange(index, blockEl) : null;

    return {
      schemaVersion: SCHEMA_VERSION,
      id: options.id || makeId(),
      bookId: options.bookId || '',
      chapterIndex: options.chapterIndex == null ? 0 : options.chapterIndex,
      blockIndex: blockIndex,
      blockOffset: br ? s - br[0] : null,
      exact: text.slice(s, e),
      prefix: text.slice(Math.max(0, s - ctx), s),
      suffix: text.slice(e, e + ctx),
      rawText: range.toString().trim(),
      position: { start: s, end: e },
      color: options.color || 'default',
      note: options.note || '',
      createdAt: new Date().toISOString()
    };
  }

  /* ------------------------------------------------------------------ */
  /* 4. 定位：在规范化文本中找回区间                                      */
  /* ------------------------------------------------------------------ */

  function locate(index, h, blocks) {
    var text = index.text;
    var exact = normalizeString(h.exact, true);
    if (!exact) { return null; }
    var prefix = normalizeString(h.prefix || '', false);
    var suffix = normalizeString(h.suffix || '', false);
    var hint = h.position && typeof h.position.start === 'number' ? h.position.start : -1;
    var bRange = null;
    if (typeof h.blockIndex === 'number' && h.blockIndex >= 0 && blocks[h.blockIndex]) {
      bRange = blockRange(index, blocks[h.blockIndex]);
    }

    // 打分：前后文匹配越长越好；落在原段落内加分；离原位置越近越好（仅作打破平局）
    function score(i, len) {
      var ps = commonSuffixLen(prefix, text.slice(Math.max(0, i - prefix.length), i));
      var ss = commonPrefixLen(suffix, text.slice(i + len, i + len + suffix.length));
      var sc = ps + ss;
      if (bRange && i >= bRange[0] && i + len <= bRange[1]) { sc += 10; }
      if (hint >= 0) { sc -= Math.min(Math.abs(i - hint) / Math.max(text.length, 1), 1); }
      return sc;
    }

    // 第一层：精确匹配，枚举所有出现位置（允许重叠）并择优
    var best = -1, bestScore = -Infinity, from = 0, i;
    while ((i = text.indexOf(exact, from)) >= 0) {
      var sc = score(i, exact.length);
      if (sc > bestScore) { bestScore = sc; best = i; }
      from = i + 1;
    }
    if (best >= 0) { return { s: best, e: best + exact.length, fuzzy: false }; }

    // 第二层：头尾片段匹配（正文中间被改动过）
    var span = Math.floor(exact.length * 1.5) + 20;
    var n = Math.min(16, exact.length);
    var head = exact.slice(0, n), tail = exact.slice(exact.length - n);
    var fb = null, fbScore = -Infinity;
    from = 0;
    while ((i = text.indexOf(head, from)) >= 0) {
      var t = text.indexOf(tail, i);
      if (t >= 0 && t + tail.length - i <= span) {
        var s2 = score(i, t + tail.length - i);
        if (s2 > fbScore) { fbScore = s2; fb = { s: i, e: t + tail.length }; }
      }
      from = i + 1;
    }
    if (fb) { return { s: fb.s, e: fb.e, fuzzy: true }; }

    // 第三层：用前后文夹取（选中文字本身被改写，但上下文还在）
    var pT = prefix.slice(-12), sH = suffix.slice(0, 12);
    if (pT.length >= 6 && sH.length >= 6) {
      var pi = text.indexOf(pT);
      while (pi >= 0) {
        var cs = pi + pT.length;
        var si = text.indexOf(sH, cs);
        if (si >= cs && si - cs <= span) {
          var r = trimRange(text, cs, si);
          if (r) { return { s: r[0], e: r[1], fuzzy: true }; }
        }
        pi = text.indexOf(pT, pi + 1);
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* 5. 还原高亮                                                          */
  /* ------------------------------------------------------------------ */

  function wrapNode(node, id, overlap) {
    var m = document.createElement('mark');
    m.className = overlap ? 'reader-highlight reader-highlight--overlap' : 'reader-highlight';
    m.setAttribute('data-id', id);
    node.parentNode.insertBefore(m, node);
    m.appendChild(node);
    return m;
  }

  // ids[0] 为最外层 mark，其余依次嵌套在内
  function wrapPiece(textNode, ids) {
    var cur = textNode;
    for (var k = ids.length - 1; k >= 0; k--) { cur = wrapNode(cur, ids[k], ids.length > 1); }
  }

  /**
   * 把一组规范化区间落到 DOM 上。
   * 步骤：收集所有端点 -> 切成互不交叉的小段（每段记录覆盖它的全部 id）-> 逐文本节点换算回原始下标并包裹。
   * 同一个文本节点内的多个小段从后往前切分，这样前面的原始下标始终有效。
   */
  function applyRanges(index, ranges) {
    if (!ranges.length) { return; }
    ranges.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    var bounds = [];
    ranges.forEach(function (r) { bounds.push(r.s, r.e); });
    bounds.sort(function (a, b) { return a - b; });
    bounds = bounds.filter(function (v, k) { return k === 0 || v !== bounds[k - 1]; });

    var segs = [];
    for (var b = 0; b < bounds.length - 1; b++) {
      var lo = bounds[b], hi = bounds[b + 1], ids = [];
      ranges.forEach(function (r) { if (r.s <= lo && r.e >= hi) { ids.push(r.id); } });
      if (ids.length) { segs.push({ lo: lo, hi: hi, ids: ids }); }
    }

    index.infos.forEach(function (info) {
      if (info.len === 0) { return; }
      var nodeLo = info.start, nodeHi = info.start + info.len, pieces = [];
      for (var k = 0; k < segs.length; k++) {
        var sg = segs[k];
        if (sg.hi <= nodeLo) { continue; }
        if (sg.lo >= nodeHi) { break; }
        var a = Math.max(sg.lo, nodeLo) - info.start;
        var z = Math.min(sg.hi, nodeHi) - info.start;
        var r0 = info.rs[a], r1 = info.re[z - 1];
        if (r1 > r0) { pieces.push({ r0: r0, r1: r1, ids: sg.ids }); }
      }
      var node = info.node;
      for (var p = pieces.length - 1; p >= 0; p--) {
        var pc = pieces[p];
        var mid = node.splitText(pc.r0); // node 保留左半部分，原始下标不变
        if (pc.r1 - pc.r0 < mid.nodeValue.length) { mid.splitText(pc.r1 - pc.r0); }
        wrapPiece(mid, pc.ids);
      }
    });
  }

  /** 清除容器内全部高亮并还原文本节点（unwrap + normalize），不留下任何额外标签。 */
  function clearHighlights(container) {
    var marks = toArray(container.querySelectorAll('mark.reader-highlight'));
    var parents = [];
    marks.forEach(function (m) {
      var parent = m.parentNode;
      if (!parent) { return; }
      while (m.firstChild) { parent.insertBefore(m.firstChild, m); }
      parent.removeChild(m);
      if (parents.indexOf(parent) < 0) { parents.push(parent); }
    });
    parents.forEach(function (p) { if (p.normalize) { p.normalize(); } });
    return marks.length;
  }

  /**
   * 章节重新渲染、字号改变或首次加载后调用。可重复调用：每次先清除旧高亮再整体重建。
   * @param {Element} chapterContainer 章节正文容器
   * @param {Object[]} highlightList 该章节的划线记录
   * @param {Object} [options] { chapterIndex, injectStyle }
   * @returns {{restored:string[], fuzzy:string[], failed:{id:string,reason:string}[]}}
   */
  function restoreHighlights(chapterContainer, highlightList, options) {
    options = options || {};
    if (options.injectStyle !== false) { ensureStyle(); }
    clearHighlights(chapterContainer);
    var result = { restored: [], fuzzy: [], failed: [] };
    if (!highlightList || !highlightList.length) { return result; }

    var index = buildTextIndex(chapterContainer);
    var blocks = toArray(chapterContainer.querySelectorAll(BLOCK_SELECTOR));
    var ranges = [];
    highlightList.forEach(function (h) {
      if (!h || !h.exact) { result.failed.push({ id: h && h.id, reason: 'empty' }); return; }
      if (options.chapterIndex != null && h.chapterIndex !== options.chapterIndex) { return; }
      var hit = locate(index, h, blocks);
      if (!hit) { result.failed.push({ id: h.id, reason: 'not-found' }); return; }
      ranges.push({ id: h.id, s: hit.s, e: hit.e });
      result.restored.push(h.id);
      if (hit.fuzzy) { result.fuzzy.push(h.id); }
    });
    applyRanges(index, ranges);
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* 6. 定位回跳与闪烁                                                    */
  /* ------------------------------------------------------------------ */

  function ensureStyle() {
    if (typeof document === 'undefined' || document.getElementById('reader-highlight-style')) { return; }
    var css = [
      'mark.reader-highlight{background:var(--reader-highlight-bg,rgba(0,113,227,.22));color:inherit;border-radius:2px;padding:0;-webkit-box-decoration-break:clone;box-decoration-break:clone}',
      'mark.reader-highlight mark.reader-highlight{background:var(--reader-highlight-bg-overlap,rgba(0,113,227,.36))}',
      '@media (prefers-color-scheme:dark){mark.reader-highlight{background:var(--reader-highlight-bg,rgba(41,151,255,.32))}mark.reader-highlight mark.reader-highlight{background:var(--reader-highlight-bg-overlap,rgba(41,151,255,.5))}}',
      '@keyframes reader-highlight-flash{0%,100%{box-shadow:0 0 0 0 rgba(100,181,255,0)}30%{box-shadow:0 0 0 4px rgba(100,181,255,.85)}}',
      '.reader-highlight--flash{animation:reader-highlight-flash .5s ease-in-out 3}',
      '@media (prefers-reduced-motion:reduce){.reader-highlight--flash{animation:none;outline:2px solid #64b5ff}}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'reader-highlight-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /**
   * 点击笔记列表时调用：滚动到划线并闪烁。
   * @param {Element} container 章节正文容器
   * @param {string} highlightId 划线 ID
   * @param {Object} [options] { reveal(firstMark, allMarks)、flashMs }
   *   reader 是分页（CSS 多栏）时，传 reveal 回调先翻到对应页，再由回调自行定位；
   *   不传则使用 scrollIntoView（尊重 prefers-reduced-motion）。
   * @returns {boolean} 是否找到该划线
   */
  function scrollToHighlight(container, highlightId, options) {
    options = options || {};
    ensureStyle();
    var marks = toArray(container.querySelectorAll('mark.reader-highlight')).filter(function (m) {
      return m.getAttribute('data-id') === highlightId;
    });
    if (!marks.length) { return false; }
    var first = marks[0];
    if (typeof options.reveal === 'function') {
      options.reveal(first, marks);
    } else if (first.scrollIntoView) {
      var reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      first.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'center' });
    }
    marks.forEach(function (m) {
      m.classList.remove('reader-highlight--flash');
      void m.offsetWidth; // 强制重排，让动画可以重复触发
      m.classList.add('reader-highlight--flash');
      if (m._flashTimer) { clearTimeout(m._flashTimer); }
      m._flashTimer = setTimeout(function () { m.classList.remove('reader-highlight--flash'); }, options.flashMs || 1800);
    });
    return true;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    HIGHLIGHT_SCHEMA: HIGHLIGHT_SCHEMA,
    createHighlightAnchor: createHighlightAnchor,
    restoreHighlights: restoreHighlights,
    clearHighlights: clearHighlights,
    scrollToHighlight: scrollToHighlight,
    buildTextIndex: buildTextIndex,
    normalizeString: normalizeString
  };
});
