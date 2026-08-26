/**
 * LITALK Education — service-notice.js
 *
 * Shows the scheduled service notices an admin sets in the admin panel, and
 * enforces the blocking ones on the client. Loaded on every public page.
 */
'use strict';

/* Public-site bootstrap: service-notice.js is already loaded across the
   marketing/public surface, so it is the single entry point for the shared
   navigation/language standard. Portal pages are intentionally excluded. */
(function bootstrapPublicUiStandards() {
  const surfaces = (document.body?.getAttribute('data-service-surface') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (surfaces.includes('portal') || window.LITALK_UI) return;
  if (document.querySelector('script[data-litalk-site-nav]')) return;
  const script = document.createElement('script');
  script.src = '/js/site-nav.js?v=20260826c';
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
      previewing: 'Admin preview — notices are hidden for you on this browser.',
    },
    th: {
      opening_soon: { title: 'กำลังจะเปิดเร็ว ๆ นี้', body: 'ส่วนนี้ของ LITALK ยังไม่เปิดให้บริการ เรากำลังเก็บรายละเอียดขั้นสุดท้ายอยู่' },
      trial_opening_soon: { title: 'กำลังจะเปิดให้ทดลองเร็ว ๆ นี้', body: 'เรากำลังจะเปิดให้ทดลองใช้งานเร็ว ๆ นี้ ขอบคุณที่รอนะคะ' },
      closing_soon: { title: 'กำลังจะปิดปรับปรุงเร็ว ๆ นี้', body: 'ส่วนนี้จะปิดให้บริการชั่วคราว เราจะกลับมาให้เร็วที่สุด' },
      trial_closing_soon: { title: 'ช่วงทดลองใช้งานกำลังจะปิด', body: 'ช่วงทดลองใช้งานของส่วนนี้กำลังจะสิ้นสุดลง' },
      custom: { title: 'ประกาศจากระบบ', body: '' },
      blockedFallback: 'ส่วนนี้ของ LITALK ปิดให้บริการชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง',
      dismiss: 'รับทราบ', until: 'คาดว่าจะกลับมา', from: 'เริ่ม',
      previewing: 'โหมดพรีวิวสำหรับแอดมิน — ประกาศถูกซ่อนไว้เฉพาะเบราว์เซอร์นี้',
    },
  };

  const t = () => COPY[lang()] || COPY.en;
  function surfaces() {
    const raw = document.body.getAttribute('data-service-surface') || '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function bypassToken() {
    const fromUrl = new URLSearchParams(location.search).get('bypass');
    if (fromUrl) {
      try { sessionStorage.setItem(BYPASS_KEY, fromUrl); } catch (_) { /* private mode */ }
      return fromUrl;
    }
    try { return sessionStorage.getItem(BYPASS_KEY) || ''; } catch (_) { return ''; }
  }

  const dismissKey = (n) => `${n.id}:${n.announceFrom || ''}:${n.startsAt || ''}:${n.endsAt || ''}`;
  function dismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch (_) { return []; }
  }
  function remember(notice) {
    try {
      const all = dismissed();
      all.push(dismissKey(notice));
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(all.slice(-40)));
    } catch (_) { /* show again next time */ }
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
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(lang() === 'th' ? 'th-TH' : 'en-GB', {
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
    icon.innerHTML = `<i class="fas ${blocking ? 'fa-circle-pause' : 'fa-bullhorn'}"></i>`;
    card.appendChild(icon);

    const h = document.createElement('h2');
    h.className = 'svc-card__title'; h.textContent = title; card.appendChild(h);
    if (body) {
      const p = document.createElement('p');
      p.className = 'svc-card__body'; p.textContent = body; card.appendChild(p);
    }

    const when = blocking ? notice.endsAt : notice.startsAt;
    const formatted = formatTime(when);
    if (formatted) {
      const meta = document.createElement('p');
      meta.className = 'svc-card__meta';
      meta.textContent = `${blocking ? t().until : t().from}: ${formatted}`;
      card.appendChild(meta);
    }

    if (!blocking && notice.dismissible) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'svc-card__btn'; btn.textContent = t().dismiss;
      btn.addEventListener('click', () => {
        remember(notice);
        const layer = card.closest('.svc-layer');
        if (layer) layer.remove();
        document.body.classList.remove('svc-locked');
      });
      card.appendChild(btn);
    }
    return card;
  }

  function show(notice, blocking) {
    const layer = document.createElement('div');
    layer.className = `svc-layer${blocking ? ' svc-layer--blocking' : ''}`;
    layer.appendChild(buildCard(notice, blocking));
    document.body.appendChild(layer);
    if (blocking) document.body.classList.add('svc-locked');
  }

  function apply() {
    const mine = surfaces();
    if (!mine.length) return;
    const relevant = state.notices.filter((n) => Array.isArray(n.surfaces) && n.surfaces.some((s) => mine.includes(s)));
    const blocking = relevant.find((n) => n.phase === 'blocking');
    if (blocking) {
      show(blocking, true);
      document.dispatchEvent(new CustomEvent('litalk:serviceblocked', { detail: { notice: blocking } }));
      return;
    }
    const seen = dismissed();
    const announcement = relevant.find((n) => n.phase === 'announcement' && !seen.includes(dismissKey(n)));
    if (announcement) show(announcement, false);
  }

  async function load() {
    const token = bypassToken();
    const url = `${API}/service-status${token ? `?bypass=${encodeURIComponent(token)}` : ''}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json();
      state.notices = Array.isArray(data.notices) ? data.notices : [];
      state.bypass = Boolean(data.bypass);
    } catch (_) {
      state.notices = [];
    }
    state.ready = true;
    apply();
    document.dispatchEvent(new CustomEvent('litalk:serviceready', { detail: state }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();

  return {
    blocked(surface) { return state.notices.some((n) => n.phase === 'blocking' && n.surfaces.includes(surface)); },
    get ready() { return state.ready; },
    get notices() { return state.notices.slice(); },
  };
})();

/* Cross-page fixes kept here because this file is loaded on all public and
   portal surfaces, including the editorial blog pages that do not load the
   shared Markdown bundle. */
(function installCrossPageFixesWhenReady() {
  function install() {
    if (typeof window.renderPortalDataError === 'function' && !window.renderPortalDataError.__litalkHardened) {
      const original = window.renderPortalDataError;
      const wrapped = function (message) { return original(message, null); };
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();