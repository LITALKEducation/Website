/**
 * LITALK Education — blog.js
 * Shared helpers for the blog listing (blog.html), single posts
 * (blog-post.html) and the "latest articles" section on the home page.
 *
 * Posts are written and approved in the LITALK admin console and served
 * by the same Cloudflare Worker that powers the student portal.
 */

'use strict';

(function () {
  const BLOG_API = 'https://istudent.litalkeducation.com';

  const lang = () => (typeof window.litalkGetLang === 'function'
    ? window.litalkGetLang()
    : (document.documentElement.getAttribute('data-lang') || 'en'));

  /* ---------- API ---------- */

  async function fetchPosts() {
    const res = await fetch(`${BLOG_API}/blog/posts`);
    if (!res.ok) throw new Error(`Blog API responded ${res.status}`);
    const data = await res.json();
    return data.posts || [];
  }

  async function fetchPost(slug) {
    const res = await fetch(`${BLOG_API}/blog/posts/${encodeURIComponent(slug)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Blog API responded ${res.status}`);
    const data = await res.json();
    return data.post || null;
  }

  function coverUrl(post) {
    return post.hasCover ? `${BLOG_API}/blog/posts/${encodeURIComponent(post.slug)}/cover` : null;
  }

  // A cover can be a short (≤15s) video clip instead of a still image.
  function isVideoCover(post) {
    return !!(post.coverMime && post.coverMime.startsWith('video/'));
  }

  /* ---------- Text helpers ---------- */

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Bilingual field: fall back to the other language when one is missing.
  function pick(post, field) {
    const th = post[`${field}Th`];
    const en = post[field];
    return lang() === 'th' ? (th || en || '') : (en || th || '');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(lang() === 'th' ? 'th-TH' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ---------- Full Markdown rendering ----------
     Uses marked (loaded by blog-post.html) for spec-compliant CommonMark +
     GFM: nested lists, tables, blockquotes, fenced code, strikethrough,
     task lists, autolinks, setext headings, hard line breaks, etc.

     marked renders whatever HTML the Markdown asks for — including raw
     <script>/<img onerror> that a writer (or a compromised staff account)
     could type directly into the source. Every article renders on the
     public site for every visitor, so the HTML that comes back is run
     through sanitizeHtml() below: an allowlist of tags/attributes, with
     unknown tags unwrapped (children kept, wrapper dropped) rather than
     trusted, and unsafe link/image URL schemes (javascript:, data:*
     except inline images) stripped. */

  const ALLOWED_TAGS = new Set([
    'P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'STRONG', 'B', 'EM', 'I', 'S', 'DEL', 'BLOCKQUOTE',
    'UL', 'OL', 'LI', 'CODE', 'PRE', 'A', 'IMG',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'INPUT',
  ]);
  // Removed outright (with their contents) rather than unwrapped.
  const HARD_REMOVE_TAGS = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM',
    'LINK', 'META', 'BASE', 'SVG', 'MATH', 'NOSCRIPT', 'TEMPLATE',
  ]);

  function isSafeLinkHref(value) {
    const v = (value || '').trim();
    if (!v) return false;
    // No scheme (relative path, #anchor, etc.) is safe; an explicit scheme
    // must be one of the ones below — this blocks javascript:/data:/etc.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return true;
    return /^(https?:|mailto:|tel:)/i.test(v);
  }

  function isSafeImageSrc(value) {
    const v = (value || '').trim();
    if (!v) return false;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return true; // relative path
    if (/^https?:/i.test(v)) return true;
    // Inline base64 raster images only — data:image/svg+xml can carry a
    // <script> inside the SVG's XML and is deliberately excluded.
    return /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(v);
  }

  // Bottom-up: clean a node's children before deciding the node's own fate,
  // so an unwrapped wrapper's children are already sanitized when they get
  // hoisted up to their grandparent.
  function sanitizeNode(root) {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === Node.COMMENT_NODE) {
        node.remove();
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName;
      if (HARD_REMOVE_TAGS.has(tag)) {
        node.remove();
        return;
      }

      sanitizeNode(node);

      if (tag === 'INPUT') {
        // Only GFM task-list checkboxes survive (marked renders them
        // disabled already; the disabled state is reasserted below anyway).
        const isCheckbox = (node.getAttribute('type') || '').toLowerCase() === 'checkbox';
        if (!isCheckbox) { node.remove(); return; }
        const checked = node.hasAttribute('checked');
        Array.from(node.attributes).forEach((a) => node.removeAttribute(a.name));
        node.setAttribute('type', 'checkbox');
        node.setAttribute('disabled', '');
        if (checked) node.setAttribute('checked', '');
        return;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        // Unknown/disallowed tag (raw <div>, <span style=...>, etc.) —
        // keep its already-sanitized children, drop the wrapper itself.
        while (node.firstChild) root.insertBefore(node.firstChild, node);
        node.remove();
        return;
      }

      if (tag === 'A' && !isSafeLinkHref(node.getAttribute('href'))) {
        while (node.firstChild) root.insertBefore(node.firstChild, node);
        node.remove();
        return;
      }
      if (tag === 'IMG' && !isSafeImageSrc(node.getAttribute('src'))) {
        node.remove();
        return;
      }

      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        let keep = false;
        if (tag === 'A') keep = name === 'href' || name === 'title';
        else if (tag === 'IMG') keep = name === 'src' || name === 'alt' || name === 'title';
        else if (tag === 'CODE') keep = name === 'class' && /^language-[\w-]+$/.test(attr.value);
        else if (tag === 'TH' || tag === 'TD') keep = name === 'align' || name === 'colspan' || name === 'rowspan';
        else if (tag === 'OL') keep = name === 'start' && /^\d+$/.test(attr.value);
        if (!keep) node.removeAttribute(attr.name);
      });

      if (tag === 'A' && /^https?:/i.test((node.getAttribute('href') || '').trim())) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'IMG') {
        node.setAttribute('loading', 'lazy');
      }
    });
  }

  function sanitizeHtml(rawHtml) {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    sanitizeNode(doc.body);
    return doc.body.innerHTML;
  }

  // Minimal fallback for the rare case the marked CDN failed to load —
  // headings/lists/bold/italic/code/links only, but never renders raw HTML
  // since the source is escaped up front.
  function mdToHtmlFallback(md) {
    const esc = escapeHtml(md).replace(/\r\n/g, '\n');
    const lines = esc.split('\n');
    const out = [];
    let list = null;
    let inCode = false;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const inline = (s) => s
      .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        closeList();
        out.push(inCode ? '</code></pre>' : '<pre><code>');
        inCode = !inCode;
        continue;
      }
      if (inCode) { out.push(line); continue; }
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { closeList(); const l = h[1].length + 1; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
      const q = line.match(/^&gt;\s?(.*)$/);
      if (q) { closeList(); out.push(`<blockquote><p>${inline(q[1])}</p></blockquote>`); continue; }
      const ul = line.match(/^\s*[-*]\s+(.*)$/);
      if (ul) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ol) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
      closeList();
      if (line.trim() === '') continue;
      out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    if (inCode) out.push('</code></pre>');
    return out.join('\n');
  }

  /* ---------- Footnotes ----------
     marked (even with GFM) does not implement the [^ref] / [^ref]: syntax,
     so footnotes are handled here around the core renderer:

       Some claim.[^1]              →  Some claim.<sup><a>[1]</a></sup>
       [^1]: The supporting source.  →  collected into a list at the end

     Definitions are pulled out of the source first (so marked never sees
     them as link-reference definitions), each in-text reference is swapped
     for an inert placeholder that survives both marked and the HTML
     sanitizer, and the trusted <sup>/<section> markup is stitched in only
     afterwards. Footnote *content* still flows through the same renderer,
     so it is sanitized like the rest of the article; numbering follows the
     order references first appear, and unreferenced definitions are dropped
     (matching GitHub/CommonMark footnote behaviour). */

  // Private-use sentinels — ordinary text to marked, DOMParser and the
  // sanitizer, so a reference placeholder rides through untouched and is
  // only expanded into real markup once the surrounding HTML is safe.
  const FN_REF_OPEN = '';
  const FN_REF_CLOSE = '';
  const FN_MASK_OPEN = '';
  const FN_MASK_CLOSE = '';

  function parseFootnotes(md) {
    const lines = String(md || '').split('\n');
    const defs = new Map();      // key -> raw Markdown of the definition
    const bodyLines = [];

    // Pull definitions ([^key]: text, plus indented continuation lines).
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^ {0,3}\[\^([^\]]+)\]:[ \t]*(.*)$/);
      if (!m) { bodyLines.push(lines[i]); continue; }
      const key = m[1].trim();
      const content = [m[2]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.trim() === '') {
          // A blank line continues the definition only if what follows is
          // still indented (a lazy continuation paragraph).
          if (i + 2 < lines.length && /^( {2,}|\t)/.test(lines[i + 2])) {
            content.push('');
            i++;
            continue;
          }
          break;
        }
        if (/^( {2,}|\t)/.test(next)) {
          content.push(next.replace(/^(\t| {2,4})/, ''));
          i++;
          continue;
        }
        break;
      }
      if (key) defs.set(key, content.join('\n').trim());
    }

    if (defs.size === 0) return { body: bodyLines.join('\n'), order: [], defs, occByKey: new Map() };

    // Mask fenced/inline code so a [^x] typed inside a code sample is left
    // as literal text rather than turned into a footnote reference.
    const masks = [];
    const mask = (m) => { masks.push(m); return FN_MASK_OPEN + (masks.length - 1) + FN_MASK_CLOSE; };
    let body = bodyLines.join('\n')
      .replace(/```[\s\S]*?```/g, mask)
      .replace(/`[^`\n]*`/g, mask);

    const order = [];
    const numByKey = new Map();
    const occByKey = new Map();
    body = body.replace(/\[\^([^\]]+)\]/g, (full, rawKey) => {
      const key = rawKey.trim();
      if (!defs.has(key)) return full; // reference with no definition — leave as-is
      if (!numByKey.has(key)) { order.push(key); numByKey.set(key, order.length); occByKey.set(key, 0); }
      const num = numByKey.get(key);
      const occ = occByKey.get(key) + 1;
      occByKey.set(key, occ);
      return FN_REF_OPEN + num + ':' + occ + FN_REF_CLOSE;
    });

    body = body.replace(new RegExp(FN_MASK_OPEN + '(\\d+)' + FN_MASK_CLOSE, 'g'), (_m, idx) => masks[+idx]);
    return { body, order, defs, occByKey };
  }

  function buildFootnotes(order, defs, occByKey, render) {
    const isTh = lang() === 'th';
    const heading = isTh ? 'เชิงอรรถ' : 'Footnotes';
    const backLabel = isTh ? 'กลับไปยังเนื้อหา' : 'Back to content';
    const items = order.map((key, i) => {
      const num = i + 1;
      const content = render(defs.get(key) || '');
      const occ = occByKey.get(key) || 1;
      let backrefs = '';
      for (let j = 1; j <= occ; j++) {
        const sup = occ > 1 ? `<sup>${j}</sup>` : '';
        backrefs += `<a href="#fnref-${num}-${j}" class="footnote-backref" aria-label="${escapeHtml(backLabel)}">↩${sup}</a>`;
      }
      return `<li id="fn-${num}" class="footnotes__item">` +
        `<div class="footnotes__content">${content}</div>` +
        `<span class="footnotes__backrefs">${backrefs}</span></li>`;
    }).join('');
    return `<section class="footnotes" aria-label="${escapeHtml(heading)}">` +
      `<h2 class="footnotes__title">${escapeHtml(heading)}</h2>` +
      `<ol class="footnotes__list">${items}</ol></section>`;
  }

  function mdToHtml(md) {
    const useMarked = typeof marked !== 'undefined';
    const render = useMarked
      ? (m) => sanitizeHtml(marked.parse(m || '', { gfm: true, breaks: false }))
      : (m) => mdToHtmlFallback(m || '');

    const { body, order, defs, occByKey } = parseFootnotes(md);
    let html = render(body);

    // Expand the inert reference placeholders into superscript links now
    // that the article HTML has already been sanitized.
    html = html.replace(new RegExp(FN_REF_OPEN + '(\\d+):(\\d+)' + FN_REF_CLOSE, 'g'),
      (_m, num, occ) => `<sup class="footnote-ref" id="fnref-${num}-${occ}">` +
        `<a href="#fn-${num}" aria-label="Footnote ${num}">[${num}]</a></sup>`);

    if (order.length) html += buildFootnotes(order, defs, occByKey, render);
    return html;
  }

  /* ---------- Card rendering ---------- */

  function cardHtml(post) {
    const cover = coverUrl(post);
    const title = pick(post, 'title');
    const titleEn = post.title || post.titleTh || '';
    const titleTh = post.titleTh || post.title || '';
    const excerpt = pick(post, 'excerpt');
    const excerptEn = post.excerpt || post.excerptTh || '';
    const excerptTh = post.excerptTh || post.excerpt || '';
    const cat = escapeHtml(post.category || 'Article');
    const coverMedia = cover
      ? (isVideoCover(post)
        ? `<video src="${cover}" autoplay muted loop playsinline disablepictureinpicture aria-label="${escapeHtml(titleEn)}"></video>`
        : `<img src="${cover}" alt="${escapeHtml(titleEn)}" loading="lazy" width="400" height="225">`)
      : null;
    const img = coverMedia
      ? `<div class="blog-card__img">${coverMedia}</div>`
      : `<div class="blog-card__img blog-card__img--placeholder" aria-hidden="true">LITALK</div>`;
    const excerptHtml = excerpt
      ? `<p class="blog-card__excerpt" data-en="${escapeHtml(excerptEn)}" data-th="${escapeHtml(excerptTh)}">${escapeHtml(excerpt)}</p>`
      : '';
    return `
      <article class="blog-card">
        <a href="blog-post?slug=${encodeURIComponent(post.slug)}" aria-label="${escapeHtml(title)}">${img}</a>
        <div class="blog-card__body">
          <span class="blog-card__tag">${cat}</span>
          <h3 class="blog-card__title" data-en="${escapeHtml(titleEn)}" data-th="${escapeHtml(titleTh)}">${escapeHtml(title)}</h3>
          ${excerptHtml}
          <div class="blog-card__meta">
            <span class="blog-card__date" data-post-date="${escapeHtml(post.publishedAt || '')}">${fmtDate(post.publishedAt)}</span>
            <a href="blog-post?slug=${encodeURIComponent(post.slug)}" class="blog-card__link" data-en="Read more →" data-th="อ่านเพิ่มเติม →">${lang() === 'th' ? 'อ่านเพิ่มเติม →' : 'Read more →'}</a>
          </div>
        </div>
      </article>`;
  }

  // Re-localise dynamic dates when the language toggle flips (titles and
  // links carry data-en/data-th, so the global switcher already covers them).
  document.addEventListener('litalk:langchange', () => {
    document.querySelectorAll('[data-post-date]').forEach(el => {
      const iso = el.getAttribute('data-post-date');
      if (iso) el.textContent = fmtDate(iso);
    });
  });

  /* ---------- Home page: swap in the latest published posts ---------- */

  async function initHomeLatest() {
    const grid = document.getElementById('home-blog-grid');
    if (!grid) return;
    try {
      const posts = (await fetchPosts()).slice(0, 3);
      if (posts.length === 0) return; // keep the static cards
      grid.innerHTML = posts.map(cardHtml).join('');
    } catch (err) {
      // Network/API failure — the static cards stay as the fallback.
      console.warn('blog: could not load latest posts', err);
    }
  }

  document.addEventListener('DOMContentLoaded', initHomeLatest);

  window.LitalkBlog = { fetchPosts, fetchPost, coverUrl, isVideoCover, cardHtml, mdToHtml, fmtDate, pick, escapeHtml, lang };
})();
