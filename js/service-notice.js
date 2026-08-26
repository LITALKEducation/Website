/**
 * LITALK Education — service notices and public UI bootstrap.
 */
'use strict';

(function bootstrapPublicUiStandards() {
  const surfaces = (document.body?.getAttribute('data-service-surface') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);

  if (surfaces.includes('ask') && !document.querySelector('link[data-litalk-ask-consent]')) {
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = '/css/ask-consent.css?v=20260826b';
    styles.dataset.litalkAskConsent = 'shared';
    document.head.appendChild(styles);
  }

  if (location.pathname.startsWith('/courses') && !document.querySelector('script[data-litalk-course-fixes]')) {
    const courseFixes = document.createElement('script');
    courseFixes.src = '/js/course-production-fixes.js?v=20260826a';
    courseFixes.defer = true;
    courseFixes.dataset.litalkCourseFixes = '1';
    document.head.appendChild(courseFixes);
  }

  if (surfaces.includes('portal') || window.LITALK_UI) return;
  if (document.querySelector('script[data-litalk-site-nav]')) return;
  const script = document.createElement('script');
  script.src = '/js/site-nav.js?v=20260826e';
  script.defer = true;
  script.dataset.litalkSiteNav = '1';
  document.head.appendChild(script);
})();

window.litalkService = (function initServiceNotices() {
  const API = 'https://istudent.litalkeducation.com';
  const BYPASS_KEY = 'litalk_service_bypass';
  const DISMISSED_KEY = 'litalk_service_dismissed';
  const TIMEOUT_MS = 5000;
  const state = { notices: [], bypass: false, ready: false };

  const lang = () => {
    if (typeof window.litalkGetLang === 'function') return window.litalkGetLang();
    return document.documentElement.lang === 'th' ? 'th' : 'en';
  };

  const COPY = {
    en: {
      opening_soon: { title: 'Opening soon', body: 'This part of LITALK is not open yet. We are putting the finishing touches on it.' },
      trial_opening_soon: { title: 'Trial opening soon', body: 'We are about to open this for a trial run. Thanks for your patience.' },
      closing_soon: { title: 'Closing soon for maintenance', body: 'This will be unavailable for a short while. We will be back as soon as we can.' },
      trial_closing_soon: { title: 'Trial ending soon', body: 'The trial period for this is ending shortly.' },
      custom: { title: 'Service notice', body: '' },
      blockedFallback: 'This part of LITALK is temporarily unavailable. Please try again later.',
      dismiss: 'Got it', until: 'Expected back', from: 'Starts',
    },
    th: {
      opening_soon: { title: 'กำลังจะเปิดเร็ว ๆ นี้', body: 'ส่วนนี้ของ LITALK ยังไม่เปิดให้บริการ เรากำลังเก็บรายละเอียดขั้นสุดท้ายอยู่' },
      trial_opening_soon: { title: 'กำลังจะเปิดให้ทดลองเร็ว ๆ นี้', body: 'เรากำลังจะเปิดให้ทดลองใช้งานเร็ว ๆ นี้ ขอบคุณที่รอนะคะ' },
      closing_soon: { title: 'กำลังจะปิดปรับปรุงเร็ว ๆ นี้', body: 'ส่วนนี้จะปิดให้บริการชั่วคราว เราจะกลับมาให้เร็วที่สุด' },
      trial_closing_soon: { title: 'ช่วงทดลองใช้งานกำลังจะปิด', body: 'ช่วงทดลองใช้งานของส่วนนี้กำลังจะสิ้นสุดลง' },
      custom: { title: 'ประกาศจากระบบ', body: '' },
      blockedFallback: 'ส่วนนี้ของ LITALK ปิดให้บริการชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง',
      dismiss: 'รับทราบ', until: 'คาดว่าจะกลับมา', from: 'เริ่ม',
    },
  };

  const t = () => COPY[lang()] || COPY.en;
  const surfaces = () => (document.body.getAttribute('data-service-surface') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);

  function bypassToken() {
    const fromUrl = new URLSearchParams(location.search).get('bypass');
    if (fromUrl) {
      try { sessionStorage.setItem(BYPASS_KEY, fromUrl); } catch (_) {}
      return fromUrl;
    }
    try { return sessionStorage.getItem(BYPASS_KEY) || ''; } catch (_) { return ''; }
  }

  const dismissKey = (notice) => `${notice.id}:${notice.announceFrom || ''}:${notice.startsAt || ''}:${notice.endsAt || ''}`;
  function dismissed() {
    try {
      const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function remember(notice) {
    try {
      const all = dismissed();
      all.push(dismissKey(notice));
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(all.slice(-40)));
    } catch (_) {}
  }

  function copyFor(notice) {
    const th = lang() === 'th';
    const preset = t()[notice.preset] || t().custom;
    return {
      title: (th ? notice.titleTh : notice.titleEn) || preset.title,
      body: (th ? notice.bodyTh : notice.bodyEn) || preset.body,
    };
  }

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(lang() === 'th' ? 'th-TH' : 'en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function buildCard(notice, blocking) {
    const { title, body } = copyFor(notice);
    const card = document.createElement('div');
    card.className = `svc-card${blocking ? ' svc-card--blocking' : ''}`;
    card.setAttribute('role', blocking ? 'alertdialog' : 'status');
    if (blocking) card.setAttribute('aria-modal', 'true');

    const icon = document.createElement('div');
    icon.className = 'svc-card__icon';
    const iconGlyph = document.createElement('i');
    iconGlyph.className = `fas ${blocking ? 'fa-circle-pause' : 'fa-bullhorn'}`;
    icon.appendChild(iconGlyph);
    card.appendChild(icon);

    const heading = document.createElement('h2');
    heading.className = 'svc-card__title';
    heading.textContent = title;
    card.appendChild(heading);

    if (body) {
      const paragraph = document.createElement('p');
      paragraph.className = 'svc-card__body';
      paragraph.textContent = body;
      card.appendChild(paragraph);
    }

    const formatted = formatTime(blocking ? notice.endsAt : notice.startsAt);
    if (formatted) {
      const meta = document.createElement('p');
      meta.className = 'svc-card__meta';
      meta.textContent = `${blocking ? t().until : t().from}: ${formatted}`;
      card.appendChild(meta);
    }

    if (!blocking && notice.dismissible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'svc-card__btn';
      button.textContent = t().dismiss;
      button.addEventListener('click', () => {
        remember(notice);
        card.closest('.svc-layer')?.remove();
      });
      card.appendChild(button);
    }
    return card;
  }

  function show(notice, blocking) {
    document.querySelectorAll('.svc-layer').forEach((layer) => layer.remove());
    const layer = document.createElement('div');
    layer.className = `svc-layer${blocking ? ' svc-layer--blocking' : ''}`;
    layer.appendChild(buildCard(notice, blocking));
    document.body.appendChild(layer);
    document.body.classList.toggle('svc-locked', blocking);
  }

  function apply() {
    const mine = surfaces();
    if (!mine.length) return;
    const relevant = state.notices.filter((notice) => Array.isArray(notice.surfaces)
      && notice.surfaces.some((surface) => mine.includes(surface)));
    const blocking = relevant.find((notice) => notice.phase === 'blocking');
    if (blocking) {
      show(blocking, true);
      document.dispatchEvent(new CustomEvent('litalk:serviceblocked', { detail: { notice: blocking } }));
      return;
    }
    document.body.classList.remove('svc-locked');
    const seen = dismissed();
    const announcement = relevant.find((notice) => notice.phase === 'announcement' && !seen.includes(dismissKey(notice)));
    if (announcement) show(announcement, false);
  }

  async function load() {
    const token = bypassToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = `${API}/service-status${token ? `?bypass=${encodeURIComponent(token)}` : ''}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`service-status ${response.status}`);
      const data = await response.json();
      state.notices = Array.isArray(data.notices) ? data.notices : [];
      state.bypass = Boolean(data.bypass);
    } catch (_) {
      state.notices = [];
    } finally {
      clearTimeout(timer);
    }
    state.ready = true;
    apply();
    document.dispatchEvent(new CustomEvent('litalk:serviceready', { detail: state }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();

  return {
    blocked(surface) {
      return state.notices.some((notice) => notice.phase === 'blocking'
        && Array.isArray(notice.surfaces) && notice.surfaces.includes(surface));
    },
    get ready() { return state.ready; },
    get notices() { return state.notices.slice(); },
  };
})();

(function installCrossPageFixesWhenReady() {
  function install() {
    if (typeof window.renderPortalDataError === 'function' && !window.renderPortalDataError.__litalkHardened) {
      const original = window.renderPortalDataError;
      const wrapped = function (message) { return original(message, null); };
      wrapped.__litalkHardened = true;
      window.renderPortalDataError = wrapped;
    }

    if (typeof window.resolveAuthedStudentId === 'function'
        && typeof window.getPortalToken === 'function'
        && typeof window.resolveStudentIdFromToken === 'function'
        && !window.resolveAuthedStudentId.__litalkHardened) {
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
          document.body.classList.remove('nav-drawer-open');
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
        const language = document.documentElement.getAttribute('data-lang') || 'en';
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
        status.textContent = language === 'th'
          ? 'ระบบสมัครข่าวสารยังไม่เปิดใช้งาน กรุณาติดตาม LITALK ผ่านช่องทางโซเชียลในระหว่างนี้'
          : 'Newsletter signup is not available yet. Please follow LITALK on social media for updates.';
      }, true);
    }

    if (!document.getElementById('litalk-cross-page-fixes-style')) {
      const style = document.createElement('style');
      style.id = 'litalk-cross-page-fixes-style';
      style.textContent = '@media (pointer:coarse){.ask-icon-btn,.ask-send{width:44px;height:44px;}}';
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
