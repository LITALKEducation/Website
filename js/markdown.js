/**
 * LITALK Education — shared Markdown renderer and client hardening.
 *
 * Security boundary:
 * - AI Markdown is escaped before markup is produced.
 * - Third-party marked output is sanitized through a strict allowlist before
 *   it can reach innerHTML. This protects the course catalogue and learning
 *   surfaces, which intentionally use marked for richer staff-authored
 *   Markdown.
 * - Links/images only keep safe URL schemes and event/style attributes are
 *   removed.
 */
'use strict';

(function initSharedMarkdownAndHardening() {
  const MAX_LIST_DEPTH = 4;

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeUrl = (value, image) => {
    const v = String(value || '').trim();
    if (!v) return false;
    // Browsers strip ASCII tabs/newlines/control characters while resolving
    // URLs. Reject them before scheme validation so values such as
    // "java\nscript:" cannot be normalized back into javascript: on click.
    if (/[\u0000-\u001F\u007F]/.test(v)) return false;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return true;
    if (image) return /^https?:/i.test(v) || /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(v);
    return /^(https?:|mailto:|tel:)/i.test(v);
  };

  const ALLOWED_TAGS = new Set([
    'P','BR','HR','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','S','DEL',
    'BLOCKQUOTE','UL','OL','LI','CODE','PRE','A','IMG','TABLE','THEAD','TBODY',
    'TFOOT','TR','TH','TD','DIV','SPAN'
  ]);
  const HARD_REMOVE_TAGS = new Set([
    'SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','LINK','META','BASE','SVG',
    'MATH','NOSCRIPT','TEMPLATE'
  ]);

  function sanitizeNode(root) {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === Node.COMMENT_NODE) { node.remove(); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (HARD_REMOVE_TAGS.has(tag)) { node.remove(); return; }

      sanitizeNode(node);

      if (!ALLOWED_TAGS.has(tag)) {
        while (node.firstChild) root.insertBefore(node.firstChild, node);
        node.remove();
        return;
      }

      if (tag === 'A' && !safeUrl(node.getAttribute('href'), false)) {
        while (node.firstChild) root.insertBefore(node.firstChild, node);
        node.remove();
        return;
      }
      if (tag === 'IMG' && !safeUrl(node.getAttribute('src'), true)) {
        node.remove();
        return;
      }

      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        let keep = false;
        if (tag === 'A') keep = name === 'href' || name === 'title';
        else if (tag === 'IMG') keep = ['src','alt','title','width','height'].includes(name);
        else if (tag === 'CODE') keep = name === 'class' && /^language-[\w-]+$/.test(attr.value);
        else if (tag === 'TH' || tag === 'TD') keep = ['align','colspan','rowspan'].includes(name);
        else if (tag === 'OL') keep = name === 'start' && /^\d+$/.test(attr.value);
        else if (tag === 'DIV') keep = name === 'class' && attr.value === 'md-table-wrap';
        if (!keep) node.removeAttribute(attr.name);
      });

      if (tag === 'A' && /^https?:/i.test((node.getAttribute('href') || '').trim())) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'IMG') node.setAttribute('loading', 'lazy');
    });
  }

  function sanitizeHtml(raw) {
    const doc = new DOMParser().parseFromString(String(raw || ''), 'text/html');
    sanitizeNode(doc.body);
    return doc.body.innerHTML;
  }
  window.litalkSanitizeHtml = sanitizeHtml;

  // marked intentionally supports raw HTML and therefore is not a sanitizer.
  // Patch its public parse entrypoint once, before courses.js/learn.js render.
  if (window.marked && typeof window.marked.parse === 'function' && !window.marked.__litalkSanitized) {
    const originalParse = window.marked.parse.bind(window.marked);
    window.marked.parse = function litalkSafeMarkedParse(source, options) {
      return sanitizeHtml(originalParse(source == null ? '' : source, options));
    };
    window.marked.__litalkSanitized = true;
  }

  function inline(text) {
    let out = escapeHtml(text);
    const codes = [];
    out = out.replace(/`([^`\n]+)`/g, (_, code) => {
      codes.push(code);
      return `\u0000CODE${codes.length - 1}\u0000`;
    });

    const URL_PART = '((?:[^\\s()]|\\([^\\s()]*\\))*)';
    out = out.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${URL_PART}\\)`, 'g'), (_m, alt, src) => {
      if (!safeUrl(src, true)) return alt;
      const label = (alt || '').trim() || 'image';
      return `<a href="${src}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    out = out.replace(new RegExp(`\\[([^\\]]+)\\]\\(${URL_PART}\\)`, 'g'), (_m, label, url) => {
      return safeUrl(url, false)
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
    });

    out = out
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');

    return out.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  }

  const isTableDivider = (line) => /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');
  const splitRow = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

  function alignments(divider) {
    return splitRow(divider).map((cell) => {
      const left = cell.startsWith(':');
      const right = cell.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return left ? 'left' : '';
    });
  }

  window.litalkMarkdown = function renderMarkdown(text) {
    const lines = String(text == null ? '' : text).split('\n');
    const out = [];
    const lists = [];
    let paragraph = [];

    const closeParagraph = () => {
      if (!paragraph.length) return;
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const closeLists = (toDepth = 0) => {
      while (lists.length > toDepth) {
        const level = lists.pop();
        if (level.liOpen) out.push('</li>');
        out.push(`</${level.tag}>`);
      }
    };
    const closeAll = () => { closeParagraph(); closeLists(0); };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trimEnd();
      const trimmed = line.trim();

      const fence = trimmed.match(/^```+\s*([A-Za-z0-9+#-]*)\s*$/);
      if (fence) {
        closeAll();
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) body.push(lines[i++]);
        out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
        continue;
      }
      if (!trimmed) { closeParagraph(); continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { closeAll(); out.push('<hr>'); continue; }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        closeAll();
        const level = Math.min(heading[1].length + 2, 5);
        out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }

      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        closeAll();
        const body = [quote[1]];
        while (i + 1 < lines.length && /^\s*>\s?/.test(lines[i + 1])) body.push(lines[++i].replace(/^\s*>\s?/, ''));
        out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
        continue;
      }

      if (trimmed.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
        closeAll();
        const header = splitRow(trimmed);
        const align = alignments(lines[++i]);
        const cell = (value, index, tag) => `<${tag}${align[index] ? ` align="${align[index]}"` : ''}>${inline(value)}</${tag}>`;
        const body = [];
        while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) body.push(splitRow(lines[++i]));
        out.push(`<div class="md-table-wrap"><table><thead><tr>${header.map((v,n) => cell(v,n,'th')).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((v,n) => cell(v,n,'td')).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }

      const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const numbered = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        closeParagraph();
        const [, indent, content] = bullet || numbered;
        const tag = bullet ? 'ul' : 'ol';
        const depth = Math.min(Math.floor(indent.replace(/\t/g, '  ').length / 2), MAX_LIST_DEPTH - 1);
        closeLists(depth + 1);

        const current = lists[lists.length - 1];
        if (current && lists.length === depth + 1 && current.tag !== tag) {
          if (current.liOpen) out.push('</li>');
          const old = lists.pop();
          out.push(`</${old.tag}>`);
        }
        while (lists.length < depth + 1) {
          out.push(`<${tag}>`);
          lists.push({ tag, liOpen: false });
        }
        const level = lists[lists.length - 1];
        if (level.liOpen) out.push('</li>');
        out.push(`<li>${inline(content)}`);
        level.liOpen = true;
        continue;
      }

      closeLists(0);
      paragraph.push(trimmed);
    }

    closeAll();
    return sanitizeHtml(out.join(''));
  };

  window.litalkTypewriter = function typeInto(container, html, options) {
    const opts = options || {};
    const safeHtml = sanitizeHtml(html);
    const done = () => {
      container.removeAttribute('aria-busy');
      if (opts.onDone) opts.onDone();
    };
    const settle = () => {
      container.innerHTML = safeHtml;
      done();
      return { finish() {} };
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !window.requestAnimationFrame || !safeHtml) return settle();

    container.innerHTML = safeHtml;
    const blocks = Array.from(container.children);
    if (!blocks.length) return settle();
    const steps = blocks.map((block) => {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue) { nodes.push({ node, text: node.nodeValue }); node.nodeValue = ''; }
      }
      block.classList.add('md-pending');
      return { block, nodes };
    });
    const total = steps.reduce((sum, s) => sum + s.nodes.reduce((n, x) => n + x.text.length, 0), 0);
    if (!total) return settle();

    const duration = Math.min(Math.max(total * 11, 500), 3200);
    const perFrame = Math.max(1, Math.ceil(total / (duration / 16.7)));
    container.setAttribute('aria-busy', 'true');
    const caret = document.createElement('span');
    caret.className = 'md-caret';
    caret.setAttribute('aria-hidden', 'true');
    let bi = 0, ni = 0, ci = 0, frame = null, finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      if (frame) cancelAnimationFrame(frame);
      steps.forEach((step) => {
        step.block.classList.remove('md-pending');
        step.nodes.forEach((entry) => { entry.node.nodeValue = entry.text; });
      });
      caret.remove();
      done();
    }
    function tick() {
      let budget = perFrame;
      while (budget > 0) {
        const step = steps[bi];
        if (!step) return finish();
        if (step.block.classList.contains('md-pending')) {
          step.block.classList.remove('md-pending');
          step.block.appendChild(caret);
        }
        const entry = step.nodes[ni];
        if (!entry) { bi++; ni = 0; ci = 0; continue; }
        const take = Math.min(budget, entry.text.length - ci);
        ci += take; budget -= take;
        entry.node.nodeValue = entry.text.slice(0, ci);
        if (ci >= entry.text.length) { ni++; ci = 0; }
      }
      if (opts.onTick) opts.onTick();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return { finish };
  };

  function installRuntimeFixes() {
    if (typeof window.renderPortalDataError === 'function' && !window.renderPortalDataError.__litalkHardened) {
      const originalError = window.renderPortalDataError;
      const wrapped = function (message) { return originalError(message, null); };
      wrapped.__litalkHardened = true;
      window.renderPortalDataError = wrapped;
    }

    if (typeof window.resolveAuthedStudentId === 'function' &&
        typeof window.getPortalToken === 'function' &&
        typeof window.resolveStudentIdFromToken === 'function' &&
        !window.resolveAuthedStudentId.__litalkHardened) {
      const originalResolve = window.resolveAuthedStudentId;
      const originalWhoami = window.resolveStudentIdFromToken;
      const hardened = async function () {
        const token = await window.getPortalToken();
        if (!token) return null;
        const id = await originalWhoami(token);
        if (!id) return null;
        window.resolveStudentIdFromToken = async () => id;
        try { return await originalResolve(); }
        finally { window.resolveStudentIdFromToken = originalWhoami; }
      };
      hardened.__litalkHardened = true;
      window.resolveAuthedStudentId = hardened;
    }

    const hamburger = document.getElementById('hamburger');
    const drawer = document.getElementById('mobile-drawer');
    if (hamburger && drawer && !hamburger.dataset.resizeGuard) {
      hamburger.dataset.resizeGuard = '1';
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
          hamburger.classList.remove('open');
          drawer.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      }, { passive: true });
    }

    const newsletter = document.getElementById('newsletter-form');
    if (newsletter && !newsletter.dataset.realSubmitGuard) {
      newsletter.dataset.realSubmitGuard = '1';
      newsletter.addEventListener('submit', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const lang = document.documentElement.getAttribute('data-lang') || 'en';
        let status = newsletter.querySelector('[data-newsletter-status]');
        if (!status) {
          status = document.createElement('p');
          status.setAttribute('data-newsletter-status', '');
          status.setAttribute('role', 'status');
          status.style.marginTop = '10px';
          status.style.fontSize = '13px';
          status.style.color = 'var(--clr-muted)';
          newsletter.appendChild(status);
        }
        status.textContent = lang === 'th'
          ? 'ระบบสมัครข่าวสารยังไม่เปิดใช้งาน กรุณาติดตาม LITALK ผ่านช่องทางโซเชียลในระหว่างนี้'
          : 'Newsletter signup is not available yet. Please follow LITALK on social media for updates.';
      }, true);
    }

    if (!document.getElementById('litalk-runtime-fixes-style')) {
      const style = document.createElement('style');
      style.id = 'litalk-runtime-fixes-style';
      style.textContent = '@media (pointer:coarse){.ask-icon-btn,.ask-send{width:44px;height:44px;}}';
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installRuntimeFixes);
  else installRuntimeFixes();
})();
