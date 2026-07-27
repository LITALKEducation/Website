/**
 * LITALK Education — ask.js
 * The /ask page: an English vocabulary tutor. Unlike the floating assistant
 * in main.js, the chat IS the page, so there's no panel to open and the
 * thread fills the layout.
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
  const thread = document.getElementById('ask-thread');
  const input = document.getElementById('ask-input');
  const sendBtn = document.getElementById('ask-send');
  const empty = document.getElementById('ask-empty');
  const consent = document.getElementById('ask-consent');
  const consentAccept = document.getElementById('ask-consent-accept');

  const STRINGS = {
    en: {
      pending: 'Looking it up...',
      genericError: 'Something went wrong. Please try again.',
      connError: "Couldn't reach the assistant. Please try again.",
      you: 'You',
      lilly: 'Nong Lilly',
    },
    th: {
      pending: 'กำลังค้นหา...',
      genericError: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      connError: 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      you: 'คุณ',
      lilly: 'น้องลิลลี่',
    },
  };
  const lang = () => (typeof window.litalkGetLang === 'function' ? window.litalkGetLang() : 'en');
  const t = (key) => (STRINGS[lang()] || STRINGS.en)[key];

  let conversationId = null;
  let busy = false;

  /* ---- Terms gate ------------------------------------------------------ */
  function showConsent() {
    if (!consent) return;
    consent.hidden = false;
    // Not just visually disabled: inert keeps the composer out of the tab
    // order too, so the gate can't be skipped with a keyboard.
    form.setAttribute('inert', '');
  }

  function hideConsent() {
    if (consent) consent.hidden = true;
    form.removeAttribute('inert');
    if (input) input.focus();
  }

  if (!chat.hasConsent()) showConsent();
  if (consentAccept) {
    consentAccept.addEventListener('click', () => {
      chat.rememberConsent();
      hideConsent();
    });
  }

  /* ---- Markdown -------------------------------------------------------- *
   * Same safe subset the other two assistants render (bold, italic, code,
   * links, lists, paragraphs). Everything is escaped first, so replies can
   * never inject markup. */
  function renderMarkdown(text) {
    const escapeHtml = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = (s) =>
      escapeHtml(s)
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const out = [];
    let list = null;
    for (const rawLine of String(text).split('\n')) {
      const line = rawLine.trimEnd();
      const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        const tag = bullet ? 'ul' : 'ol';
        if (list !== tag) {
          if (list) out.push(`</${list}>`);
          out.push(`<${tag}>`);
          list = tag;
        }
        out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
        continue;
      }
      if (list) {
        out.push(`</${list}>`);
        list = null;
      }
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list}>`);
    return out.join('');
  }

  /* ---- Thread ---------------------------------------------------------- */
  function appendMessage(role, text) {
    if (empty) empty.hidden = true;
    const row = document.createElement('div');
    row.className = `ask-msg ask-msg--${role}`;

    if (role !== 'user') {
      const who = document.createElement('div');
      who.className = 'ask-msg__who';
      who.textContent = role === 'pending' ? t('lilly') : t('lilly');
      row.appendChild(who);
    }

    const body = document.createElement('div');
    body.className = 'ask-msg__body';
    if (role === 'assistant') body.innerHTML = renderMarkdown(text);
    else body.textContent = text;
    row.appendChild(body);

    thread.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return row;
  }

  /* ---- Send ------------------------------------------------------------ */
  async function ask(message) {
    if (busy || !message) return;
    appendMessage('user', message);
    input.value = '';
    autoGrow();
    busy = true;
    sendBtn.disabled = true;
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
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value.trim());
  });

  // Enter sends, Shift+Enter makes a new line — the convention every chat
  // input on this site already follows.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }
  input.addEventListener('input', autoGrow);

  // Starter chips: prefill and send, so a first-time visitor can see what a
  // useful question looks like without having to think of one.
  document.querySelectorAll('.ask-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!chat.hasConsent()) {
        showConsent();
        return;
      }
      ask(chip.getAttribute('data-q') || chip.textContent.trim());
    });
  });
})();
