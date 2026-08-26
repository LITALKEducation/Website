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
  // Educational hand-offs (for example TCAS Fortune) may prefill a draft.
  // The visitor still reviews and explicitly sends it; nothing is submitted
  // automatically, and the query parameter is not persisted by this page.
  const handoffPrompt = new URLSearchParams(window.location.search).get('prompt');
  if (handoffPrompt && handoffPrompt.length <= 500) input.value = handoffPrompt;
  const sendBtn = document.getElementById('ask-send');
  const suggestBtn = document.getElementById('ask-suggest-btn');
  const menu = document.getElementById('ask-menu');
  const consent = document.getElementById('ask-consent');
  const consentAccept = document.getElementById('ask-consent-accept');
  const consentSignInRow = document.getElementById('ask-consent-signin-row');
  const consentSignIn = document.getElementById('ask-consent-signin');

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


  /* ---- Optional sign-in ------------------------------------------------ *
   * A LITALK student signing in with their @litalkeducation.com account has
   * their questions filed under their student id, so they can read them back
   * here or from the portal. Everyone else keeps using the page anonymously:
   * it is also for people deciding whether to enrol, and a sign-in wall would
   * turn them away.
   *
   * Same Auth0 client settings as the portal (js/student-portal.js) so one
   * session covers both — signing in there signs you in here. */
  const AUDIENCE = 'https://admin.litalkeducation.com/files-api';
  const auth0Client =
    typeof auth0 !== 'undefined'
      ? new auth0.Auth0Client({
          domain: 'auth.litalkeducation.com',
          clientId: 'NmKUxriv62IDG9yQQ3CZqkVp2ujkjdbp',
          useRefreshTokens: true,
          useRefreshTokensFallback: true,
          cacheLocation: 'localstorage',
          authorizationParams: { redirect_uri: window.location.href.split('?')[0], audience: AUDIENCE },
        })
      : null;

  const account = document.getElementById('ask-account');
  const accountText = document.getElementById('ask-account-text');
  const signInBtn = document.getElementById('ask-signin-btn');
  const historyBtn = document.getElementById('ask-history-btn');
  const historyPanel = document.getElementById('ask-history');
  const historyList = document.getElementById('ask-history-list');
  const historyClose = document.getElementById('ask-history-close');

  let authToken = null;
  let studentId = null;

  // Auth0's silent auth can hang rather than reject in in-app browsers that
  // restrict storage — the portal hit this too. Race it so a stuck call
  // leaves the page anonymous instead of never resolving.
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  }

  async function restoreSession() {
    if (!auth0Client) return;
    try {
      if (location.search.includes('code=') && location.search.includes('state=')) {
        await auth0Client.handleRedirectCallback();
        history.replaceState({}, document.title, location.pathname);
      }
      authToken = await withTimeout(auth0Client.getTokenSilently(), 6000);
      const user = await auth0Client.getUser().catch(() => null);
      studentId = user && user.email ? user.email.split('@')[0] : null;
    } catch (err) {
      authToken = null;
      studentId = null;
    }
    // A signed-in student accepted the AI Chat Terms when they registered,
    // and the server no longer asks them for consent — so drop the gate if
    // it went up before the session resolved.
    if (studentId && consent && !consent.hidden) hideConsent();
    syncAccount();
  }

  function syncAccount() {
    if (!auth0Client) return; // SDK blocked — leave the strip hidden entirely
    // The gate covers this area, so while it is up the sign-in offer lives
    // inside the gate instead. Showing both would put an unclickable button
    // underneath an overlay.
    const gated = consent && !consent.hidden;
    account.hidden = gated;
    if (consentSignInRow) consentSignInRow.hidden = Boolean(studentId);
    const signedIn = Boolean(studentId);
    signInBtn.hidden = signedIn;
    historyBtn.hidden = !signedIn;
    accountText.textContent = signedIn
      ? (lang() === 'th' ? `บันทึกไว้ในบัญชี ${studentId}` : `Saving to ${studentId}`)
      : (lang() === 'th' ? 'เข้าสู่ระบบเพื่อเก็บคำถามไว้ดูภายหลัง' : 'Sign in to keep your questions');
  }

  const signIn = () => {
    if (auth0Client) auth0Client.loginWithRedirect();
  };
  if (signInBtn) signInBtn.addEventListener('click', signIn);
  if (consentSignIn) consentSignIn.addEventListener('click', signIn);

  /* ---- Saved questions -------------------------------------------------- */
  async function openHistory() {
    historyPanel.hidden = false;
    historyList.textContent = lang() === 'th' ? 'กำลังโหลด...' : 'Loading...';
    try {
      const res = await fetch(`${chat.API}/portal/${encodeURIComponent(studentId)}/chats?scope=vocab`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      const rows = data.conversations || [];
      historyList.textContent = '';
      if (!rows.length) {
        historyList.textContent = lang() === 'th' ? 'ยังไม่มีคำถามที่บันทึกไว้' : 'No saved questions yet.';
        return;
      }
      rows.forEach((row) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ask-history__item';
        const q = document.createElement('span');
        q.className = 'ask-history__q';
        q.textContent = row.firstMessage || '—';
        const meta = document.createElement('span');
        meta.className = 'ask-history__meta';
        meta.textContent = `${String(row.startedAt || '').slice(0, 16)} · ${row.messages}`;
        item.append(q, meta);
        item.addEventListener('click', () => loadConversation(row.conversationId));
        historyList.appendChild(item);
      });
    } catch (err) {
      historyList.textContent = lang() === 'th' ? 'โหลดไม่สำเร็จ' : "Couldn't load your questions.";
    }
  }

  async function loadConversation(id) {
    try {
      const res = await fetch(`${chat.API}/portal/${encodeURIComponent(studentId)}/chats/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.messages) return;
      // Replaying a past conversation replaces the thread and resumes it, so
      // a follow-up question continues where it left off.
      if (typing) typing.finish();
      thread.textContent = '';
      conversationId = id;
      data.messages.forEach((m) => appendMessage(m.role === 'user' ? 'user' : 'assistant', m.content, { instant: true }));
      historyPanel.hidden = true;
    } catch (err) {
      /* leave the panel open so they can try another one */
    }
  }

  if (historyBtn) historyBtn.addEventListener('click', openHistory);
  if (historyClose) historyClose.addEventListener('click', () => { historyPanel.hidden = true; });

  document.addEventListener('litalk:langchange', syncAccount);
  restoreSession();

  /* ---- Terms gate ------------------------------------------------------ */
  function showConsent() {
    if (!consent) return;
    consent.hidden = false;
    syncAccount();
    // inert, not just disabled: the composer must also drop out of the tab
    // order so the gate can't be skipped with a keyboard.
    form.setAttribute('inert', '');
    closeMenu();
    // On a phone the gate is a real dialog over the page, so the page behind
    // it must not scroll. Harmless on desktop, where it is an inline panel.
    document.body.classList.add('ask-gated');
    // Move focus into the dialog, or a keyboard user is left on the inert
    // composer with nothing to tab to.
    if (consentAccept) consentAccept.focus({ preventScroll: true });
  }

  function hideConsent() {
    if (consent) consent.hidden = true;
    form.removeAttribute('inert');
    document.body.classList.remove('ask-gated');
    syncAccount();
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

  document.querySelectorAll('[data-ask-prompt]').forEach((item) => {
    item.addEventListener('click', () => {
      input.value = item.getAttribute('data-ask-prompt') || '';
      syncComposer();
      input.focus();
    });
  });

  // Markdown rendering lives in js/markdown.js, shared with the /ask page
  // and the student portal so all three render the same subset.
  const renderMarkdown = (text) => window.litalkMarkdown(text);

  /* ---- Thread ---------------------------------------------------------- */
  function appendMessage(role, text, options) {
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

    if (role === 'assistant' && options && options.instant) {
      // Replayed from history — it isn't arriving now, so typing it out
      // would misrepresent an old answer as a fresh one.
      body.innerHTML = renderMarkdown(text);
    } else if (role === 'assistant') {
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
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
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

  // The overlay covers the page, but the composer must also stop accepting
  // input behind it — otherwise a keyboard user can still type and send.
  document.addEventListener('litalk:serviceblocked', () => {
    form.setAttribute('inert', '');
  });

  syncComposer();
})();
