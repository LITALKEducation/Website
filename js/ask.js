/**
 * Ask LITALK — immersive AI learning workspace.
 * Keeps the existing chat API, consent model, Auth0 session, saved history,
 * visitor id and shared Markdown renderer while presenting them as a modern
 * full-page AI conversation experience.
 */
'use strict';

(function initAskPage() {
  const form = document.getElementById('ask-form');
  if (!form) return;

  const chat = window.litalkChat;
  if (!chat) return;

  const body = document.body;
  const stage = document.getElementById('ask-stage');
  const workspace = document.getElementById('ask-workspace');
  const box = document.getElementById('ask-composer-box');
  const thread = document.getElementById('ask-thread');
  const input = document.getElementById('ask-input');
  const sendBtn = document.getElementById('ask-send');
  const suggestBtn = document.getElementById('ask-suggest-btn');
  const menu = document.getElementById('ask-menu');
  const newChatBtn = document.getElementById('ask-new-chat');
  const sidebar = document.getElementById('ask-sidebar');
  const sidebarToggle = document.getElementById('ask-sidebar-toggle');
  const sidebarClose = document.getElementById('ask-sidebar-close');
  const sidebarBackdrop = document.getElementById('ask-sidebar-backdrop');

  const consent = document.getElementById('ask-consent');
  const consentAccept = document.getElementById('ask-consent-accept');
  const consentSignInRow = document.getElementById('ask-consent-signin-row');
  const consentSignIn = document.getElementById('ask-consent-signin');

  const account = document.getElementById('ask-account');
  const accountText = document.getElementById('ask-account-text');
  const signInBtn = document.getElementById('ask-signin-btn');
  const historyBtn = document.getElementById('ask-history-btn');
  const historyPanel = document.getElementById('ask-history');
  const historyList = document.getElementById('ask-history-list');
  const historyClose = document.getElementById('ask-history-close');

  const STRINGS = {
    en: {
      pending: 'Thinking…',
      genericError: 'Something went wrong. Please try again.',
      connError: "I couldn't reach Ask LITALK. Please try again.",
      assistant: 'Ask LITALK',
      loading: 'Loading chats…',
      noHistory: 'No saved chats yet.',
      historyError: "Couldn't load your chats.",
      signedIn: 'Chats saved to',
      signedOut: 'Sign in to keep your chats across devices',
    },
    th: {
      pending: 'กำลังคิด…',
      genericError: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      connError: 'เชื่อมต่อ Ask LITALK ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      assistant: 'Ask LITALK',
      loading: 'กำลังโหลดแชท…',
      noHistory: 'ยังไม่มีแชทที่บันทึกไว้',
      historyError: 'โหลดประวัติแชทไม่สำเร็จ',
      signedIn: 'บันทึกแชทในบัญชี',
      signedOut: 'เข้าสู่ระบบเพื่อเก็บแชทไว้ใช้ต่อบนอุปกรณ์อื่น',
    },
  };

  const lang = () => (typeof window.litalkGetLang === 'function' ? window.litalkGetLang() : 'en');
  const t = (key) => (STRINGS[lang()] || STRINGS.en)[key];
  const renderMarkdown = (text) => (typeof window.litalkMarkdown === 'function' ? window.litalkMarkdown(text) : text);

  let conversationId = null;
  let busy = false;
  let typing = null;
  let authToken = null;
  let studentId = null;

  const handoffPrompt = new URLSearchParams(window.location.search).get('prompt');
  if (handoffPrompt && handoffPrompt.length <= 1000) input.value = handoffPrompt;

  function openSidebar() {
    body.classList.add('ask-sidebar-open');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    body.classList.remove('ask-sidebar-open');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('ask-sidebar-open')) closeSidebar();
  });

  function syncComposer() {
    const value = input.value;
    const expanded = value.length > 95 || value.includes('\n');
    box.classList.toggle('is-expanded', expanded);
    sendBtn.hidden = !value.trim() || busy;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 190)}px`;
  }

  box.addEventListener('mousedown', (event) => {
    if (event.target.closest('button, a')) return;
    event.preventDefault();
    input.focus();
  });

  function startNewChat(options = {}) {
    if (typing) {
      typing.finish();
      typing = null;
    }
    conversationId = null;
    thread.textContent = '';
    stage.classList.remove('has-thread');
    input.value = '';
    syncComposer();
    closeMenu();
    closeSidebar();
    if (options.focus !== false) input.focus();
    if (workspace) workspace.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  }

  if (newChatBtn) newChatBtn.addEventListener('click', () => startNewChat());

  /* Auth0 — same session as the student portal. */
  const AUDIENCE = 'https://admin.litalkeducation.com/files-api';
  const auth0Client = typeof auth0 !== 'undefined'
    ? new auth0.Auth0Client({
        domain: 'auth.litalkeducation.com',
        clientId: 'NmKUxriv62IDG9yQQ3CZqkVp2ujkjdbp',
        useRefreshTokens: true,
        useRefreshTokensFallback: true,
        cacheLocation: 'localstorage',
        authorizationParams: {
          redirect_uri: window.location.href.split('?')[0],
          audience: AUDIENCE,
        },
      })
    : null;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  }

  function syncAccount() {
    if (!account || !auth0Client) return;
    const gated = consent && !consent.hidden;
    account.hidden = gated;
    if (consentSignInRow) consentSignInRow.hidden = Boolean(studentId);

    const signedIn = Boolean(studentId);
    if (signInBtn) signInBtn.hidden = signedIn;
    if (historyBtn) historyBtn.hidden = !signedIn;
    if (historyPanel) historyPanel.hidden = !signedIn;

    if (accountText) {
      accountText.textContent = signedIn
        ? `${t('signedIn')} ${studentId}`
        : t('signedOut');
    }
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
    } catch (error) {
      authToken = null;
      studentId = null;
    }

    if (studentId && consent && !consent.hidden) hideConsent();
    syncAccount();
    if (studentId) openHistory({ quiet: true });
  }

  function signIn() {
    if (auth0Client) auth0Client.loginWithRedirect();
  }

  if (signInBtn) signInBtn.addEventListener('click', signIn);
  if (consentSignIn) consentSignIn.addEventListener('click', signIn);

  async function openHistory({ quiet = false } = {}) {
    if (!historyPanel || !historyList || !studentId || !authToken) return;
    historyPanel.hidden = false;
    historyList.textContent = t('loading');

    try {
      const response = await fetch(`${chat.API}/portal/${encodeURIComponent(studentId)}/chats?scope=vocab`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json().catch(() => ({}));
      const rows = data.conversations || [];
      historyList.textContent = '';

      if (!rows.length) {
        const empty = document.createElement('div');
        empty.className = 'ask-history__note';
        empty.textContent = t('noHistory');
        historyList.appendChild(empty);
        return;
      }

      rows.forEach((row) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ask-history__item';

        const question = document.createElement('span');
        question.className = 'ask-history__q';
        question.textContent = row.firstMessage || '—';

        const meta = document.createElement('span');
        meta.className = 'ask-history__meta';
        const date = String(row.startedAt || '').slice(0, 10);
        const messages = Number(row.messages || 0);
        meta.textContent = [date, messages ? `${messages} messages` : ''].filter(Boolean).join(' · ');

        item.append(question, meta);
        item.addEventListener('click', () => loadConversation(row.conversationId));
        historyList.appendChild(item);
      });
    } catch (error) {
      historyList.textContent = t('historyError');
      if (!quiet) console.warn('Ask LITALK history failed to load');
    }
  }

  async function loadConversation(id) {
    if (!studentId || !authToken || !id) return;
    try {
      const response = await fetch(`${chat.API}/portal/${encodeURIComponent(studentId)}/chats/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.messages)) return;

      if (typing) typing.finish();
      thread.textContent = '';
      stage.classList.add('has-thread');
      conversationId = id;
      data.messages.forEach((message) => {
        appendMessage(message.role === 'user' ? 'user' : 'assistant', message.content, { instant: true, noScroll: true });
      });
      closeSidebar();
      requestAnimationFrame(() => {
        if (workspace) workspace.scrollTop = workspace.scrollHeight;
        input.focus();
      });
    } catch (error) {
      /* Keep history available so another conversation can be selected. */
    }
  }

  if (historyBtn) historyBtn.addEventListener('click', () => openHistory());
  if (historyClose) historyClose.addEventListener('click', () => { historyPanel.hidden = true; });

  /* Consent gate shared with the floating LITALK assistant. */
  function showConsent() {
    if (!consent) return;
    consent.hidden = false;
    form.setAttribute('inert', '');
    closeMenu();
    syncAccount();
    if (consentAccept) consentAccept.focus({ preventScroll: true });
  }

  function hideConsent() {
    if (consent) consent.hidden = true;
    form.removeAttribute('inert');
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

  /* Prompt tools */
  function openMenu() {
    if (!menu || !suggestBtn) return;
    menu.hidden = false;
    suggestBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!menu || !suggestBtn) return;
    menu.hidden = true;
    suggestBtn.setAttribute('aria-expanded', 'false');
  }

  if (suggestBtn) {
    suggestBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (menu.hidden) openMenu(); else closeMenu();
    });
  }

  document.addEventListener('click', (event) => {
    if (menu && !menu.hidden && !menu.contains(event.target) && event.target !== suggestBtn) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu && !menu.hidden) {
      closeMenu();
      suggestBtn.focus();
    }
  });

  if (menu) {
    menu.querySelectorAll('.ask-menu__item').forEach((item) => {
      item.addEventListener('click', () => {
        closeMenu();
        input.value = item.getAttribute('data-q') || '';
        syncComposer();
        input.focus();
      });
    });
  }

  document.querySelectorAll('[data-ask-prompt]').forEach((item) => {
    item.addEventListener('click', () => {
      input.value = item.getAttribute('data-ask-prompt') || '';
      syncComposer();
      input.focus();
    });
  });

  function scrollToLatest(behavior = 'smooth') {
    if (!workspace) return;
    requestAnimationFrame(() => workspace.scrollTo({ top: workspace.scrollHeight, behavior }));
  }

  function appendMessage(role, text, options = {}) {
    stage.classList.add('has-thread');

    const row = document.createElement('div');
    row.className = `ask-msg ask-msg--${role}`;

    if (role !== 'user') {
      const avatar = document.createElement('div');
      avatar.className = 'ask-msg__avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('i');
      icon.className = role === 'error' ? 'fas fa-triangle-exclamation' : 'fas fa-sparkles';
      avatar.appendChild(icon);
      row.appendChild(avatar);
    }

    const content = document.createElement('div');
    content.className = 'ask-msg__content';

    if (role !== 'user') {
      const who = document.createElement('div');
      who.className = 'ask-msg__who';
      who.textContent = t('assistant');
      content.appendChild(who);
    }

    const messageBody = document.createElement('div');
    messageBody.className = 'ask-msg__body';
    content.appendChild(messageBody);
    row.appendChild(content);
    thread.appendChild(row);

    if (role === 'assistant' && options.instant) {
      messageBody.innerHTML = renderMarkdown(text);
    } else if (role === 'assistant' && typeof window.litalkTypewriter === 'function') {
      typing = window.litalkTypewriter(messageBody, renderMarkdown(text), {
        onTick: () => scrollToLatest('auto'),
        onDone: () => { typing = null; },
      });
    } else if (role === 'assistant') {
      messageBody.innerHTML = renderMarkdown(text);
    } else {
      messageBody.textContent = text;
    }

    if (!options.noScroll) scrollToLatest(role === 'pending' ? 'auto' : 'smooth');
    return row;
  }

  async function ask(message) {
    if (busy || !message) return;
    if (typing) {
      typing.finish();
      typing = null;
    }

    appendMessage('user', message);
    input.value = '';
    busy = true;
    syncComposer();
    const pending = appendMessage('pending', t('pending'));

    try {
      const response = await fetch(`${chat.API}/chat/ask`, {
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

      const data = await response.json().catch(() => ({}));
      pending.remove();

      if (!response.ok || data.status === 'error') {
        if (data.needsConsent) {
          localStorage.removeItem(chat.CONSENT_KEY);
          showConsent();
          return;
        }
        appendMessage('error', data.message || t('genericError'));
        return;
      }

      conversationId = data.conversationId || conversationId;
      appendMessage('assistant', data.reply || '');
      if (studentId) openHistory({ quiet: true });
    } catch (error) {
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
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener('litalk:langchange', () => {
    thread.querySelectorAll('.ask-msg__who').forEach((element) => {
      element.textContent = t('assistant');
    });
    syncAccount();
    if (studentId) openHistory({ quiet: true });
  });

  document.addEventListener('litalk:serviceblocked', () => {
    form.setAttribute('inert', '');
  });

  syncComposer();
  restoreSession();
})();
