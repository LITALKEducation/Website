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

  /* ---------- Minimal, safe Markdown renderer ----------
     Input is escaped BEFORE any markup is generated, so post content can
     never inject HTML — only the tags produced here are emitted. */
  function mdToHtml(md) {
    const esc = escapeHtml(md).replace(/\r\n/g, '\n');
    const lines = esc.split('\n');
    const out = [];
    let list = null;      // 'ul' | 'ol' | null
    let inCode = false;

    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

    const inline = (s) => s
      .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    for (const raw of lines) {
      const line = raw;

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
      if (ul) {
        if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${inline(ul[1])}</li>`);
        continue;
      }

      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ol) {
        if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${inline(ol[1])}</li>`);
        continue;
      }

      closeList();
      if (line.trim() === '') continue;
      out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    if (inCode) out.push('</code></pre>');
    return out.join('\n');
  }

  /* ---------- Card rendering ---------- */

  function cardHtml(post) {
    const cover = coverUrl(post);
    const title = pick(post, 'title');
    const titleEn = post.title || post.titleTh || '';
    const titleTh = post.titleTh || post.title || '';
    const cat = escapeHtml(post.category || 'Article');
    const img = cover
      ? `<div class="blog-card__img"><img src="${cover}" alt="${escapeHtml(titleEn)}" loading="lazy" width="400" height="225"></div>`
      : `<div class="blog-card__img blog-card__img--placeholder" aria-hidden="true">LITALK</div>`;
    return `
      <article class="blog-card">
        <a href="blog-post?slug=${encodeURIComponent(post.slug)}" aria-label="${escapeHtml(title)}">${img}</a>
        <div class="blog-card__body">
          <span class="blog-card__tag">${cat}</span>
          <h3 class="blog-card__title" data-en="${escapeHtml(titleEn)}" data-th="${escapeHtml(titleTh)}">${escapeHtml(title)}</h3>
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

  window.LitalkBlog = { fetchPosts, fetchPost, coverUrl, cardHtml, mdToHtml, fmtDate, pick, escapeHtml, lang };
})();
