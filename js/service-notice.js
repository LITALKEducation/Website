/**
 * LITALK Education — service-notice.js
 *
 * Shows the scheduled service notices an admin sets in the admin panel, and
 * enforces the blocking ones on the client. Loaded on every public page.
 *
 * Each page declares what it is with `data-service-surface` on <body> (a
 * comma-separated list, since /ask is both the "ask" surface and part of the
 * website). The server decides which notices are live and what phase each is
 * in; this file only renders the result.
 *
 * Two phases:
 *   announcement — a dismissible card. The page still works.
 *   blocking     — a full overlay with no way past it. The API refuses the
 *                  same surface independently, so this is presentation, not
 *                  the security boundary.
 *
 * Fails open in every direction. If the request fails, times out, or the
 * surface isn't covered, nothing is shown — a maintenance banner that appears
 * because the network blipped would be worse than no banner at all.
 *
 * Admins previewing a blocked page append ?bypass=<token> once; it is kept in
 * sessionStorage so links within the site keep working, and it is verified
 * server-side — the token is never compared here.
 */

'use strict';

window.litalkService = (function initServiceNotices() {
  const API = 'https://istudent.litalkeducation.com';
  const BYPASS_KEY = 'litalk_service_bypass';
  const DISMISSED_KEY = 'litalk_service_dismissed';
  const TIMEOUT_MS = 5000;

  const state = { notices: [], bypass: false, ready: false };

  // The marketing site has a language toggle; the student portal does not and
  // is Thai throughout. Falling back to <html lang> rather than to 'en' means
  // a portal visitor gets a Thai notice instead of an English one sitting in
  // the middle of an otherwise Thai page.
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
      dismiss: 'Got it',
      until: 'Expected back',
      from: 'Starts',
      previewing: 'Admin preview — notices are hidden for you on this browser.',
    },
    th: {
      opening_soon: { title: 'กำลังจะเปิดเร็ว ๆ นี้', body: 'ส่วนนี้ของ LITALK ยังไม่เปิดให้บริการ เรากำลังเก็บรายละเอียดขั้นสุดท้ายอยู่' },
      trial_opening_soon: { title: 'กำลังจะเปิดให้ทดลองเร็ว ๆ นี้', body: 'เรากำลังจะเปิดให้ทดลองใช้งานเร็ว ๆ นี้ ขอบคุณที่รอนะคะ' },
      closing_soon: { title: 'กำลังจะปิดปรับปรุงเร็ว ๆ นี้', body: 'ส่วนนี้จะปิดให้บริการชั่วคราว เราจะกลับมาให้เร็วที่สุด' },
      trial_closing_soon: { title: 'ช่วงทดลองใช้งานกำลังจะปิด', body: 'ช่วงทดลองใช้งานของส่วนนี้กำลังจะสิ้นสุดลง' },
      custom: { title: 'ประกาศจากระบบ', body: '' },
      blockedFallback: 'ส่วนนี้ของ LITALK ปิดให้บริการชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง',
      dismiss: 'รับทราบ',
      until: 'คาดว่าจะกลับมา',
      from: 'เริ่ม',
      previewing: 'โหมดพรีวิวสำหรับแอดมิน — ประกาศถูกซ่อนไว้เฉพาะเบราว์เซอร์นี้',
    },
  };

  const t = () => COPY[lang()] || COPY.en;

  function surfaces() {
    const raw = document.body.getAttribute('data-service-surface') || '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  /* ---- bypass ---------------------------------------------------------- */
  function bypassToken() {
    const fromUrl = new URLSearchParams(location.search).get('bypass');
    if (fromUrl) {
      try {
        sessionStorage.setItem(BYPASS_KEY, fromUrl);
      } catch (err) {
        /* private mode — the token still works for this request */
      }
      return fromUrl;
    }
    try {
      return sessionStorage.getItem(BYPASS_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  /* ---- dismissal ------------------------------------------------------- */
  // Keyed by notice id and by the times, so editing a live notice re-shows it
  // to someone who already dismissed the earlier wording.
  const dismissKey = (n) => `${n.id}:${n.announceFrom || ''}:${n.startsAt || ''}:${n.endsAt || ''}`;

  function dismissed() {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    } catch (err) {
      return [];
    }
  }

  function remember(notice) {
    try {
      const all = dismissed();
      all.push(dismissKey(notice));
      // Cap it so the list can't grow without bound over years of notices.
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(all.slice(-40)));
    } catch (err) {
      /* nothing to do — it will simply show again */
    }
  }

  /* ---- rendering ------------------------------------------------------- */
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
    // The visitor's own timezone — a Bangkok-fixed string would mislead
    // anyone reading from elsewhere.
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
    h.className = 'svc-card__title';
    h.textContent = title;
    card.appendChild(h);

    if (body) {
      const p = document.createElement('p');
      p.className = 'svc-card__body';
      p.textContent = body;
      card.appendChild(p);
    }

    // The time that actually helps depends on the phase: while blocked you
    // want to know when it is back, beforehand you want to know when it goes.
    const when = blocking ? notice.endsAt : notice.startsAt;
    const label = blocking ? t().until : t().from;
    const formatted = formatTime(when);
    if (formatted) {
      const meta = document.createElement('p');
      meta.className = 'svc-card__meta';
      meta.textContent = `${label}: ${formatted}`;
      card.appendChild(meta);
    }

    if (!blocking && notice.dismissible) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'svc-card__btn';
      btn.textContent = t().dismiss;
      btn.addEventListener('click', () => {
        remember(notice);
        card.closest('.svc-layer').remove();
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
    // Only a block takes the page over; an announcement must not stop
    // someone scrolling the page behind it.
    if (blocking) document.body.classList.add('svc-locked');
  }

  function apply() {
    const mine = surfaces();
    if (!mine.length) return;

    const relevant = state.notices.filter((n) => n.surfaces.some((s) => mine.includes(s)));

    // A block wins over any announcement — showing both would put a
    // dismissible card on top of something that cannot be dismissed.
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

  /* ---- load ------------------------------------------------------------ */
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
    } catch (err) {
      // Fail open — say nothing rather than claim an outage we can't confirm.
      state.notices = [];
    }
    state.ready = true;
    apply();
    document.dispatchEvent(new CustomEvent('litalk:serviceready', { detail: state }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();

  return {
    /** Whether a surface is currently blocked. Returns false until loaded, so
     *  callers never block on an unknown. */
    blocked(surface) {
      return state.notices.some((n) => n.phase === 'blocking' && n.surfaces.includes(surface));
    },
    get ready() {
      return state.ready;
    },
    get notices() {
      return state.notices.slice();
    },
  };
})();
