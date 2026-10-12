/**
 * Sennovate A4 Report Paginator
 * ---------------------------------------------------------------------------
 * Runs INSIDE the standalone report document (in-app preview iframe, the
 * server-side headless Chrome PDF renderer and the browser print fallback),
 * so page breaks are always computed from the real rendered text and fonts.
 *
 *  - Every page is a true A4 sheet (210 x 297 mm) with running header/footer.
 *  - Content flows continuously: whatever fits on a page is placed there and
 *    the remainder continues on the next page. Nothing is clipped or dropped.
 *  - Paragraphs and list items are split between words, code blocks between
 *    lines, tables between rows (header row repeated), lists keep numbering.
 *  - Headings marked `.kwn` (keep-with-next) are never left alone at the
 *    bottom of a page.
 *  - All output is live HTML text, so the PDF contains selectable, searchable
 *    vector text (no screenshots / raster images of text).
 *
 * IMPORTANT: this function is serialised with Function.prototype.toString()
 * and injected into the report HTML, so it must stay fully self-contained
 * (no imports, no references to outer-scope variables).
 */
export function paginateReport() {
  var doc = document;
  var flow = doc.getElementById('report-flow');
  var book = doc.getElementById('report-book');
  var tpl = doc.getElementById('page-template');
  if (!flow || !book || !tpl) return;

  var INLINE = { STRONG: 1, B: 1, EM: 1, I: 1, CODE: 1, A: 1, SPAN: 1, BR: 1, SUP: 1, SUB: 1, SMALL: 1, U: 1, MARK: 1, KBD: 1, WBR: 1 };
  var cur = null;

  function newPage() {
    var frag = tpl.content.cloneNode(true);
    var page = frag.querySelector('.page');
    book.appendChild(frag);
    page = book.lastElementChild;
    var body = page.querySelector('.page-body');
    var content = page.querySelector('.page-content');
    var bcs = getComputedStyle(body);
    var lim = body.clientHeight - parseFloat(bcs.paddingTop || '0') - parseFloat(bcs.paddingBottom || '0');
    cur = { page: page, body: body, content: content, limit: lim - 2 };
    return cur;
  }

  function fits() {
    return cur.content.getBoundingClientRect().height <= cur.limit + 0.5;
  }

  function remaining() {
    return cur.limit - cur.content.getBoundingClientRect().height;
  }

  function isWs(n) {
    return n.nodeType === 3 && !/\S/.test(n.nodeValue);
  }

  function isKwn(n) {
    return n.nodeType === 1 && (n.classList.contains('kwn') || /^H[1-6]$/.test(n.tagName));
  }

  function meaningfulCount(container) {
    var c = 0;
    for (var i = 0; i < container.childNodes.length; i++) {
      var n = container.childNodes[i];
      if (isWs(n)) continue;
      if (n.nodeType === 1 && (isKwn(n) || n.tagName === 'THEAD' || n.tagName === 'CAPTION')) continue;
      c++;
    }
    return c;
  }

  function noSplit(el) {
    return el.nodeType !== 1 || el.classList.contains('nosplit') || /^(TR|IMG|SVG|svg|HR|THEAD|CAPTION|H1|H2|H3|H4|H5|H6)$/.test(el.tagName);
  }

  function isTextLeaf(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (!INLINE[el.children[i].tagName]) return false;
    }
    return /\S/.test(el.textContent || '');
  }

  function lineHeight(el) {
    var cs = getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh)) lh = parseFloat(cs.fontSize) * 1.45;
    return lh || 14;
  }

  function textPoints(el, re) {
    var pts = [];
    var w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue;
      if (re === null) {
        for (var k = 1; k < v.length; k++) pts.push({ node: n, offset: k });
      } else {
        re.lastIndex = 0;
        var m;
        while ((m = re.exec(v))) {
          var off = m.index + m[0].length;
          if (off > 0 && off < v.length) pts.push({ node: n, offset: off });
          if (m[0].length === 0) re.lastIndex++;
        }
      }
    }
    return pts;
  }

  function cut(el, p) {
    var r1 = doc.createRange();
    r1.setStart(el, 0);
    r1.setEnd(p.node, p.offset);
    var r2 = doc.createRange();
    r2.setStart(p.node, p.offset);
    r2.setEnd(el, el.childNodes.length);
    var head = el.cloneNode(false);
    head.appendChild(r1.cloneContents());
    var tail = el.cloneNode(false);
    tail.appendChild(r2.cloneContents());
    head.removeAttribute('id');
    tail.removeAttribute('id');
    tail.classList.add('cont');
    return [head, tail];
  }

  function trySplitWith(el, parent, pts, minH) {
    var lo = 0, hi = pts.length - 1, best = -1, bestParts = null;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var parts = cut(el, pts[mid]);
      parent.appendChild(parts[0]);
      var ok = fits() && parts[0].getBoundingClientRect().height >= minH;
      var tooBig = !fits();
      parent.removeChild(parts[0]);
      if (ok) { best = mid; bestParts = parts; lo = mid + 1; }
      else if (tooBig) { hi = mid - 1; }
      else { lo = mid + 1; }
    }
    if (best < 0) return null;
    parent.appendChild(bestParts[0]);
    return bestParts[1];
  }

  function splitText(el, parent, force) {
    var lh = lineHeight(el);
    var minH = force ? 1 : Math.min(lh * 2 - 1, el.getBoundingClientRect ? lh * 2 - 1 : lh);
    var isPre = el.tagName === 'PRE' || el.classList.contains('pre');
    var tail = null;
    if (isPre) tail = trySplitWith(el, parent, textPoints(el, /\n/g), minH);
    if (!tail) tail = trySplitWith(el, parent, textPoints(el, /\s+/g), minH);
    if (!tail && (isPre || force)) tail = trySplitWith(el, parent, textPoints(el, null), force ? 1 : minH);
    if (!tail) return { placed: false, rem: el };
    // keep tail margin tidy and leading whitespace trimmed
    if (tail.firstChild && tail.firstChild.nodeType === 3) tail.firstChild.nodeValue = tail.firstChild.nodeValue.replace(/^[ \t]+/, '');
    return { placed: true, rem: tail };
  }

  function splitChildren(node, parent, force) {
    var shell = node.cloneNode(false);
    parent.appendChild(shell);
    var kids = Array.prototype.slice.call(node.childNodes);
    var olStart = node.tagName === 'OL' ? parseInt(node.getAttribute('start') || '1', 10) : 0;
    var liPlaced = 0;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (isWs(kid)) { shell.appendChild(kid); continue; }
      var res = place(kid, shell, force && meaningfulCount(shell) === 0);
      if (!res.rem) {
        if (kid.tagName === 'LI') liPlaced++;
        continue;
      }
      if (res.placed && kid.tagName === 'LI') liPlaced++;
      var carry = [];
      if (!res.placed) {
        // keep headings / table header with the content that follows them
        while (shell.lastChild && (isWs(shell.lastChild) || isKwn(shell.lastChild))) {
          var last = shell.lastChild;
          shell.removeChild(last);
          if (!isWs(last)) carry.unshift(last);
        }
      }
      var rest = node.cloneNode(false);
      rest.removeAttribute('id');
      rest.classList.add('cont');
      if (node.tagName === 'TABLE') {
        var th = node.querySelector(':scope > thead');
        if (th && carry.indexOf(th) < 0) {
          rest.appendChild(th.cloneNode(true));
        }
      }
      if (node.tagName === 'OL') {
        var startAt = olStart + liPlaced - (res.placed ? 1 : 0);
        rest.setAttribute('start', String(startAt));
      }
      for (var c = 0; c < carry.length; c++) {
        if (carry[c].tagName === 'THEAD' && rest.querySelector(':scope > thead')) continue;
        rest.appendChild(carry[c]);
      }
      rest.appendChild(res.rem);
      for (var j = i + 1; j < kids.length; j++) rest.appendChild(kids[j]);
      if (meaningfulCount(shell) === 0) {
        parent.removeChild(shell);
        rest.classList.remove('cont');
        return { placed: false, rem: rest };
      }
      return { placed: true, rem: rest };
    }
    return { placed: true, rem: null };
  }

  function place(node, parent, force) {
    if (node.nodeType !== 1) {
      parent.appendChild(node);
      if (fits()) return { placed: true, rem: null };
      parent.removeChild(node);
      return { placed: false, rem: node };
    }
    parent.appendChild(node);
    if (fits()) return { placed: true, rem: null };
    parent.removeChild(node);
    if (noSplit(node)) return { placed: false, rem: node };
    if (isTextLeaf(node)) return splitText(node, parent, force);
    return splitChildren(node, parent, force);
  }

  // ---- Layout -------------------------------------------------------------
  var items = Array.prototype.slice.call(flow.childNodes).filter(function (n) { return !isWs(n); });
  flow.parentNode.removeChild(flow);
  newPage();
  var guard = 0;
  while (items.length && guard++ < 100000) {
    var item = items.shift();
    var empty = meaningfulCount(cur.content) === 0 && cur.content.children.length === 0;
    if (item.nodeType === 1 && !empty) {
      if (item.getAttribute('data-break') === 'page') { newPage(); items.unshift(item); continue; }
      var ms = parseFloat(item.getAttribute('data-min-space') || '0');
      if (ms && remaining() < ms) { newPage(); items.unshift(item); continue; }
    }
    var res = place(item, cur.content, empty);
    if (!res.rem) continue;
    if (!res.placed && empty) {
      // Unsplittable block taller than a full page: never drop content.
      cur.content.appendChild(res.rem);
      cur.page.classList.add('overflowing');
      continue;
    }
    var carry = [];
    if (!res.placed) {
      while (cur.content.lastChild && (isWs(cur.content.lastChild) || isKwn(cur.content.lastChild))) {
        var l = cur.content.lastChild;
        cur.content.removeChild(l);
        if (!isWs(l)) carry.unshift(l);
      }
    }
    newPage();
    items = carry.concat([res.rem], items);
  }

  // ---- Page numbers & table of contents ----------------------------------
  var pages = book.querySelectorAll('.page');
  var total = pages.length;
  for (var p = 0; p < pages.length; p++) {
    pages[p].setAttribute('data-page', String(p + 1));
    var nums = pages[p].querySelectorAll('.pg-num');
    for (var q = 0; q < nums.length; q++) nums[q].textContent = String(p + 1);
    var tots = pages[p].querySelectorAll('.pg-total');
    for (var t = 0; t < tots.length; t++) tots[t].textContent = String(total);
  }
  var tocRefs = doc.querySelectorAll('[data-toc-ref]');
  for (var r = 0; r < tocRefs.length; r++) {
    var target = doc.getElementById(tocRefs[r].getAttribute('data-toc-ref'));
    var pg = target && target.closest('.page');
    tocRefs[r].textContent = pg ? pg.getAttribute('data-page') : '';
  }
  doc.documentElement.setAttribute('data-paginated', 'true');
  doc.documentElement.setAttribute('data-total-pages', String(total));
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'sennovate-report-ready', pages: total, height: doc.documentElement.scrollHeight }, '*');
    }
  } catch (e) { /* ignore */ }
}
