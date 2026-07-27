/**
 * LITALK Education — ask.js
 * The /ask page: an English vocabulary tutor.
 *
 * The composer follows the shadcn @blocks-so/ai-01 block — one centred pill
 * holding the input and its controls in a single grid, restructuring from
 * [leading | input | trailing] to stacked [input / footer] once the text
 * outgrows a line, with the send button appearing only when there is
 * something to send. Reimplemented in plain JS/CSS: this site has no React
 * or Tailwind, and a build pipeline for one page would cost more than the
 * block is worth.
 *
 * Shares the visitor id and terms consent with the floating assistant via
 * window.litalkChat (defined in main.js, which loads first) — accepting the
 * terms in either place covers both.
 */

'use strict';

(function initAskPage() {
  const form = document.getElementById('ask-form');
  if (!form) return; // not the /ask page

  const chat = window.litalkChat;
  const stage = document.getElementById('ask-stage');
  const box = document.getElementById('ask-composer-box');
  const thread = document.getElementById('ask-thread');
  const input = document.getElementById('ask-input');
  const sendBtn = document.getElementById('ask-send');
  const suggestBtn = document.getElementById('ask-suggest-btn');
  const menu = document.getElementById('ask-menu');
  const consent = document.getElementById('ask-consent');
  const consentAccept = document.getElementById('ask-consent-accept');

  const STRINGS = {
    en: { pending: 'Looking it up...', genericError: 'Something went wrong. Please try again.', connError: "Couldn't reach the assistant. Please try again.", lilly: 'Nong Lilly' },
    th: { pending: 'กำลังค้นหา...', genericError: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', connError: 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', lilly: 'น้องลิลลี่' },
  };
  const lang = () => (typeof window.litalkGetLang === 'function' ? window.litalkGetLang() : 'en');
  const t = (key) => (STRINGS[lang()] || STRINGS.en)[key];

  let conversationId = null;
  let busy = false;
  // The in-progress typewriter, so a new question can cut the previous
  // answer short instead of leaving two replies animating at once.
  let typing = null;

  /* ---- Composer shape -------------------------------------------------- *
   * Same trigger as the block: expand once the text can no longer sit
   * comfortably on one line, measured by length or an explicit newline. */
  const EXPAND_AT = 100;

  function syncComposer() {
    const value = input.value;
    box.classList.toggle('is-expanded', value.length > EXPAND_AT || value.includes('\n'));
    sendBtn.hidden = !value.trim() || busy;

    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }

  // Clicking anywhere in the pill focuses the input, which is what the
  // block's `cursor: text` on the container implies.
  box.addEventListener('mousedown', (event) => {
    if (event.target.closest('button, a')) return;
    event.preventDefault();
    input.focus();
  });

  /* ---- Terms gate ------------------------------------------------------ */
  function showConsent() {
    if (!consent) return;
    consent.hidden = false;
    // inert, not just disabled: the composer must also drop out of the tab
    // order so the gate can't be skipped with a keyboard.
    form.setAttribute('inert', '');
    closeMenu();
  }

  function hideConsent() {
    if (consent) consent.hidden = true;
    form.removeAttribute('inert');
    input.focus();
  }

  if (!chat.hasConsent()) showConsent();
  if (consentAccept) {
    consentAccept.addEventListener('click', () => {
      chat.rememberConsent();
      hideConsent();
    });
  }

  /* ---- Suggestion menu -------------------------------------------------- */
  function openMenu() {
    menu.hidden = false;
    suggestBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    menu.hidden = true;
    suggestBtn.setAttribute('aria-expanded', 'false');
  }

  suggestBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== suggestBtn) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      closeMenu();
      suggestBtn.focus();
    }
  });

  menu.querySelectorAll('.ask-menu__item').forEach((item) => {
    item.addEventListener('click', () => {
      closeMenu();
      // Fills the composer rather than sending straight away, so the visitor
      // can see the shape of a good question and edit it before asking.
      input.value = item.getAttribute('data-q') || '';
      input.focus();
      syncComposer();
    });
  });

  // Markdown rendering lives in js/markdown.js, shared with the /ask page
  // and the student portal so all three render the same subset.
  const renderMarkdown = (text) => window.litalkMarkdown(text);

  /* ---- Thread ---------------------------------------------------------- */
  function appendMessage(role, text) {
    stage.classList.add('has-thread');
    const row = document.createElement('div');
    row.className = `ask-msg ask-msg--${role}`;

    if (role !== 'user') {
      const who = document.createElement('div');
      who.className = 'ask-msg__who';
      who.textContent = t('lilly');
      row.appendChild(who);
    }

    const body = document.createElement('div');
    body.className = 'ask-msg__body';
    row.appendChild(body);
    thread.appendChild(row);

    if (role === 'assistant') {
      // Typed out rather than dropped in whole — see litalkTypewriter.
      typing = window.litalkTypewriter(body, renderMarkdown(text), {
        onTick: () => row.scrollIntoView({ block: 'nearest' }),
        onDone: () => {
          typing = null;
        },
      });
    } else {
      body.textContent = text;
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return row;
  }

  /* ---- Send ------------------------------------------------------------ */
  async function ask(message) {
    if (busy || !message) return;
    if (typing) typing.finish();
    appendMessage('user', message);
    input.value = '';
    busy = true;
    syncComposer();
    const pending = appendMessage('pending', t('pending'));

    try {
      const res = await fetch(`${chat.API}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          visitorId: chat.getVisitorId(),
          lang: lang(),
          termsVersion: chat.hasConsent() ? chat.TERMS_VERSION : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      pending.remove();
      if (!res.ok || data.status === 'error') {
        // Terms revised (or never recorded server-side): re-prompt rather
        // than showing an error the reader can't act on.
        if (data.needsConsent) {
          localStorage.removeItem(chat.CONSENT_KEY);
          showConsent();
          return;
        }
        appendMessage('error', data.message || t('genericError'));
        return;
      }
      conversationId = data.conversationId;
      appendMessage('assistant', data.reply || '');
    } catch (err) {
      pending.remove();
      appendMessage('error', t('connError'));
    } finally {
      busy = false;
      syncComposer();
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value.trim());
  });

  input.addEventListener('input', syncComposer);

  // Enter sends, Shift+Enter makes a new line — the convention every chat
  // input on this site already follows.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  // The "Nong Lilly" byline is rendered text, so it has to be re-rendered
  // when the site language changes rather than swapped by the data-en sweep.
  document.addEventListener('litalk:langchange', () => {
    thread.querySelectorAll('.ask-msg__who').forEach((el) => {
      el.textContent = t('lilly');
    });
  });

  syncComposer();
})();
