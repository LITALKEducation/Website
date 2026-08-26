/**
 * LITALK Education — main.js
 * Handles: Sticky nav, mobile drawer, language switcher,
 * scroll animations, FAQ accordion, testimonial carousel,
 * contact form, newsletter.
 */

'use strict';

/* ============================================================
   UTILITY
   ============================================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   STICKY NAV
   ============================================================ */
(function initStickyNav() {
  const nav = $('#main-nav');
  if (!nav) return;

  const handler = () => {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handler, { passive: true });
  handler(); // run on load
})();

/* ============================================================
   MOBILE HAMBURGER / DRAWER
   ============================================================ */
(function initHamburger() {
  const hamburger = $('#hamburger');
  const drawer = $('#mobile-drawer');
  if (!hamburger || !drawer) return;

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    drawer.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close on drawer link click
  $$('a', drawer).forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      drawer.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !drawer.contains(e.target)) {
      hamburger.classList.remove('open');
      drawer.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
})();

/* ============================================================
   LANGUAGE TOGGLE — one switch that flips EN ⇄ TH
   ============================================================ */
(function initLangToggle() {
  let currentLang = localStorage.getItem('litalk-lang') || 'en';

  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'th' ? 'th' : 'en');
    localStorage.setItem('litalk-lang', lang);

    // Swap all text nodes using data-en / data-th attributes
    $$('[data-en]').forEach(el => {
      const text = el.getAttribute(`data-${lang}`);
      if (text) el.textContent = text;
    });

    // Swap placeholders separately
    $$('[data-en-placeholder]').forEach(el => {
      const ph = el.getAttribute(`data-${lang}-placeholder`);
      if (ph) el.setAttribute('placeholder', ph);
    });

    // Slide every toggle's thumb to the active side
    $$('.lang-toggle').forEach(toggle => {
      toggle.setAttribute('data-active', lang);
      $$('.lang-toggle__opt', toggle).forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-opt') === lang);
      });
    });

    // Let dynamically rendered content (e.g. blog cards) follow along
    document.dispatchEvent(new CustomEvent('litalk:langchange', { detail: { lang } }));
  }

  // One click flips to the other language
  $$('.lang-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      applyLang(currentLang === 'en' ? 'th' : 'en');
    });
  });

  window.litalkGetLang = () => currentLang;

  // Apply saved / default lang on load
  applyLang(currentLang);
})();

/* ============================================================
   LOGIN MENU (nav dropdown)
   ============================================================ */
(function initLoginMenu() {
  $$('.login-menu').forEach(menu => {
    const btn = $('.login-menu__btn', menu);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });
})();

/* ============================================================
   SCROLL ANIMATIONS (IntersectionObserver)
   ============================================================ */
(function initScrollAnimations() {
  if (prefersReducedMotion) {
    // Show all elements immediately
    $$('.animate').forEach(el => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  $$('.animate').forEach(el => observer.observe(el));
})();

/* ============================================================
   FAQ ACCORDION
   ============================================================ */
(function initFAQ() {
  $$('.faq-item').forEach(item => {
    const btn = $('.faq-item__btn', item);
    const body = $('.faq-item__body', item);
    if (!btn || !body) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.toggle('open');

      // Accessibility & Transitions.dev state
      btn.setAttribute('aria-expanded', String(isOpen));
      item.setAttribute('data-open', String(isOpen));

      if (isOpen) {
        body.removeAttribute('hidden');
      } else {
        // Wait for transition before hiding
        body.addEventListener('transitionend', () => {
          if (!item.classList.contains('open')) body.setAttribute('hidden', '');
        }, { once: true });
      }

      // Close other items (optional: remove for multi-open)
      $$('.faq-item').forEach(other => {
        if (other !== item && other.classList.contains('open')) {
          other.classList.remove('open');
          other.setAttribute('data-open', 'false');
          const otherBtn = $('.faq-item__btn', other);
          const otherBody = $('.faq-item__body', other);
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          if (otherBody) {
            otherBody.addEventListener('transitionend', () => {
              if (!other.classList.contains('open')) otherBody.setAttribute('hidden', '');
            }, { once: true });
          }
        }
      });
    });
  });
})();

/* ============================================================
   TESTIMONIAL CAROUSEL
   ============================================================ */
(function initCarousel() {
  const track = $('#testimonials-track');
  const dotsContainer = $('#carousel-dots');
  const prevBtn = $('#carousel-prev');
  const nextBtn = $('#carousel-next');

  if (!track || !dotsContainer || !prevBtn || !nextBtn) return;

  const cards = $$('.testimonial-card', track);
  const total = cards.length;
  let current = 0;
  let startX = 0;
  let isDragging = false;
  let autoPlayTimer = null;

  // Determine visible cards based on viewport
  function getVisible() {
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  }

  function getMaxIndex() {
    return Math.max(0, total - getVisible());
  }

  // Build dots
  function buildDots() {
    dotsContainer.innerHTML = '';
    const max = getMaxIndex() + 1;
    for (let i = 0; i < max; i++) {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === current ? ' active' : '');
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.setAttribute('role', 'tab');
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    }
  }

  function updateDots() {
    $$('.carousel-dot', dotsContainer).forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
    });
  }

  function getCardWidth() {
    const gap = 24;
    const visible = getVisible();
    const totalGap = gap * (visible - 1);
    return (track.parentElement.offsetWidth - totalGap) / visible;
  }

  function goTo(index) {
    const max = getMaxIndex();
    current = Math.max(0, Math.min(index, max));
    const cardWidth = getCardWidth();
    const offset = current * (cardWidth + 24);

    if (prefersReducedMotion) {
      track.style.transition = 'none';
    } else {
      track.style.transition = 'transform 300ms ease';
    }
    track.style.transform = `translateX(-${offset}px)`;
    updateDots();

    // Update button states
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current >= max;
  }

  function next() {
    goTo(current + 1 > getMaxIndex() ? 0 : current + 1);
  }

  function prev() {
    goTo(current - 1 < 0 ? getMaxIndex() : current - 1);
  }

  // Set card widths dynamically
  function setCardWidths() {
    const cardWidth = getCardWidth();
    cards.forEach(card => {
      card.style.flex = `0 0 ${cardWidth}px`;
    });
    goTo(current);
  }

  // Touch / drag support
  track.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  track.addEventListener('touchend', e => {
    if (!isDragging) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    isDragging = false;
  });

  // Mouse drag
  track.addEventListener('mousedown', e => {
    startX = e.clientX;
    isDragging = true;
    track.style.cursor = 'grabbing';
  });

  document.addEventListener('mouseup', e => {
    if (!isDragging) return;
    const diff = startX - e.clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    isDragging = false;
    track.style.cursor = '';
  });

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // Autoplay
  function startAutoPlay() {
    if (prefersReducedMotion) return;
    autoPlayTimer = setInterval(next, 5000);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) clearInterval(autoPlayTimer);
  }

  track.addEventListener('mouseenter', stopAutoPlay);
  track.addEventListener('mouseleave', startAutoPlay);

  // Keyboard navigation
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // Init + resize
  buildDots();
  setCardWidths();
  startAutoPlay();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildDots();
      setCardWidths();
    }, 150);
  });
})();

/* ============================================================
   CONTACT FORM
   ============================================================ */
(function initContactForm() {
  const form = $('#contact-form');
  const submitBtn = $('#contact-submit');
  if (!form || !submitBtn) return;

  const CONTACT_EMAIL = 'support@litalkeducation.com';

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!form.reportValidity()) return;

    const originalText = submitBtn.textContent;
    const lang = document.documentElement.getAttribute('data-lang') || 'en';

    const name = $('#form-name').value.trim();
    const email = $('#form-email').value.trim();
    const program = $('#form-program').value.trim();
    const message = $('#form-message').value.trim();

    const subject = lang === 'th'
      ? `สอบถามข้อมูลจาก ${name}`
      : `Inquiry from ${name}`;

    const bodyLines = lang === 'th'
      ? [`ชื่อ: ${name}`, `อีเมล: ${email}`, program && `หลักสูตรที่สนใจ: ${program}`]
      : [`Name: ${name}`, `Email: ${email}`, program && `Program Interest: ${program}`];

    const body = bodyLines.filter(Boolean).concat('', message).join('\n');
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;

    submitBtn.textContent = lang === 'th' ? 'เปิดโปรแกรมอีเมล ✓' : 'Opening email ✓';
    submitBtn.disabled = true;

    setTimeout(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      form.reset();
    }, 3000);
  });
})();

/* ============================================================
   NEWSLETTER FORM
   ============================================================ */
(function initNewsletter() {
  const form = $('#newsletter-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type="submit"]', form);
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 1000));

    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    btn.textContent = lang === 'th' ? 'สมัครแล้ว ✓' : 'Done ✓';

    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      form.reset();
    }, 3000);
  });
})();

/* ============================================================
   SMOOTH SCROLL for anchor links
   ============================================================ */
(function initSmoothScroll() {
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();

      const navHeight = 68;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;

      window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  });
})();

/* ============================================================
   LAZY IMAGE LOADING (native + polyfill fallback)
   ============================================================ */
(function initLazyLoad() {
  if ('loading' in HTMLImageElement.prototype) return; // native support

  const lazyImages = $$('img[loading="lazy"]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src || img.src;
        observer.unobserve(img);
      }
    });
  });

  lazyImages.forEach(img => observer.observe(img));
})();

/* ============================================================
   CARD HOVER TILT
   ============================================================ */
(function initCardTilt() {
  const tilts = $$('.t-tilt');
  if (tilts.length === 0) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX = 8; // Peak tilt in degrees for premium minimal look

  tilts.forEach(tilt => {
    const card = tilt.querySelector('.t-tilt-card');
    if (!card) return;

    function reset() {
      tilt.classList.remove('is-hover');
      card.classList.remove('is-tilting');
      card.style.setProperty('--tilt-rx', '0deg');
      card.style.setProperty('--tilt-ry', '0deg');
    }

    function track(e) {
      if (reduce.matches) return;
      const r = tilt.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      
      tilt.classList.add('is-hover');
      card.classList.add('is-tilting');
      
      card.style.setProperty('--tilt-ry', ((px - 0.5) * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-rx', ((0.5 - py) * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--tilt-gy', (py * 100).toFixed(1) + '%');
    }

    tilt.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') {
        try { tilt.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    tilt.addEventListener('pointermove', track);
    tilt.addEventListener('pointerup', reset);
    tilt.addEventListener('pointercancel', reset);
    tilt.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') reset();
    });
  });
})();

/* ============================================================
   AI CHAT: SHARED VISITOR + CONSENT STATE
   Used by the floating site assistant below and by the /ask
   vocabulary page (js/ask.js), which load in that order. One
   definition so the two can't disagree about whether someone has
   accepted, and so the terms version lives in a single place.
   ============================================================ */
window.litalkChat = (function initChatConsentState() {
  const API = 'https://istudent.litalkeducation.com';

  // Bump when the chat terms change and everyone is asked again. Must match
  // CHAT_TERMS_VERSION in the worker, which enforces the same gate
  // server-side — clearing localStorage is not a way around it.
  const TERMS_VERSION = '2026-07-27';
  const CONSENT_KEY = 'litalk_chat_terms_accepted';

  // Random, identity-free key: it exists only so the server can rate-limit
  // per browser. It is not tied to any person or account.
  function getVisitorId() {
    let id = localStorage.getItem('litalk_visitor_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('litalk_visitor_id', id);
    }
    return id;
  }

  const hasConsent = () => localStorage.getItem(CONSENT_KEY) === TERMS_VERSION;

  function rememberConsent() {
    localStorage.setItem(CONSENT_KEY, TERMS_VERSION);
    // Recorded server-side too, so the acceptance survives the visitor
    // clearing their browser and exists as a record the school holds.
    // Fire-and-forget: the chat endpoints re-record it on the next message
    // if this call never lands, so a failure here costs nothing.
    const lang = typeof window.litalkGetLang === 'function' ? window.litalkGetLang() : 'en';
    fetch(`${API}/chat/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), lang }),
    }).catch(() => {});
  }

  return { API, TERMS_VERSION, CONSENT_KEY, getVisitorId, hasConsent, rememberConsent };
})();

/* ============================================================
   AI CHAT WIDGET (general assistant — home/programs/about)
   Answers general questions about LITALK Education; not tied to any
   specific student account. Rate-limited server-side by a random
   visitorId persisted in localStorage (identity-free, just an
   abuse-prevention key).
   ============================================================ */
(function initGeneralAIChat() {
  const fab = document.getElementById('ai-chat-fab');
  if (!fab) return; // page doesn't include the widget markup

  const dataApiUrl = 'https://istudent.litalkeducation.com';

  // Static widget text follows the SITE's language toggle (window.litalkGetLang,
  // set by initLangToggle above) — not the AI's own reply, which separately
  // and correctly auto-detects whatever language the user types in.
  const STRINGS = {
    en: {
      newChat: 'Start new conversation',
      close: 'Close',
      scrollLatest: 'Scroll to latest',
      send: 'Send',
      greeting: "Hi! I'm Nong Lilly. Ask me anything about LITALK Education. (For questions about your own account, please sign in at the student portal.)",
      newChatMsg: 'Started a new conversation — ask away!',
      pending: 'Thinking...',
      genericError: 'Something went wrong. Please try again.',
      connError: "Couldn't reach the AI assistant. Please try again.",
      consentTitle: 'Before you start',
      consentBody:
        'Nong Lilly is an AI assistant. Replies are generated automatically and can be wrong, so please confirm anything important with our staff. Your messages are stored so we can improve the service and handle enquiries.',
      consentNote: 'Please don’t send passwords, ID numbers, or payment details in this chat.',
      consentLinks: 'By continuing you agree to our',
      consentTerms: 'AI Chat Terms of Use',
      consentAnd: 'and',
      consentPrivacy: 'AI Chat Privacy Notice',
      consentAccept: 'Accept and start chatting',
      consentDecline: 'Not now',
    },
    th: {
      newChat: 'เริ่มการสนทนาใหม่',
      close: 'ปิด',
      scrollLatest: 'เลื่อนไปข้อความล่าสุด',
      send: 'ส่ง',
      greeting: 'สวัสดีค่ะ หนูชื่อน้องลิลลี่ ถามเกี่ยวกับ LITALK Education ได้เลยค่ะ (ถ้าถามเรื่องบัญชีของคุณเอง กรุณาเข้าสู่ระบบที่พอร์ทัลนักเรียนนะคะ)',
      newChatMsg: 'เริ่มการสนทนาใหม่แล้วนะคะ ถามอะไรได้เลย',
      pending: 'กำลังตอบ...',
      genericError: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      connError: 'เชื่อมต่อระบบ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      consentTitle: 'ก่อนเริ่มใช้งาน',
      consentBody:
        'น้องลิลลี่เป็นผู้ช่วย AI คำตอบสร้างขึ้นโดยอัตโนมัติและอาจคลาดเคลื่อนได้ กรุณาตรวจสอบเรื่องสำคัญกับเจ้าหน้าที่อีกครั้ง ข้อความที่คุณพิมพ์จะถูกจัดเก็บไว้เพื่อพัฒนาบริการและติดตามคำถาม',
      consentNote: 'กรุณาอย่าส่งรหัสผ่าน เลขบัตรประชาชน หรือข้อมูลการชำระเงินในแชทนี้',
      consentLinks: 'การใช้งานต่อถือว่าคุณยอมรับ',
      consentTerms: 'ข้อกำหนดการใช้แชท AI',
      consentAnd: 'และ',
      consentPrivacy: 'ประกาศความเป็นส่วนตัวสำหรับแชท AI',
      consentAccept: 'ยอมรับและเริ่มแชท',
      consentDecline: 'ไว้ก่อน',
    },
  };
  const t = (key) => (STRINGS[typeof window.litalkGetLang === 'function' ? window.litalkGetLang() : 'en'] || STRINGS.en)[key];

  // data-en/data-th (name, status, placeholder) are already handled by
  // initLangToggle's own sweep above; aria-label/title aren't part of that
  // convention, so sync those two here instead.
  function syncStaticLang() {
    const newChatBtn = document.getElementById('ai-chat-newchat-btn');
    const closeBtn = document.getElementById('ai-chat-close-btn');
    const scrollBtn = document.getElementById('ai-chat-scroll-btn');
    const sendBtn = document.getElementById('ai-chat-send');
    if (newChatBtn) { newChatBtn.setAttribute('aria-label', t('newChat')); newChatBtn.setAttribute('title', t('newChat')); }
    if (closeBtn) { closeBtn.setAttribute('aria-label', t('close')); closeBtn.setAttribute('title', t('close')); }
    if (scrollBtn) { scrollBtn.setAttribute('aria-label', t('scrollLatest')); scrollBtn.setAttribute('title', t('scrollLatest')); }
    if (sendBtn) { sendBtn.setAttribute('aria-label', t('send')); sendBtn.setAttribute('title', t('send')); }
  }
  syncStaticLang();
  document.addEventListener('litalk:langchange', syncStaticLang);

  const { getVisitorId, hasConsent, rememberConsent, TERMS_VERSION: CHAT_TERMS_VERSION, CONSENT_KEY } = window.litalkChat;

  let conversationId = null;
  let busy = false;
  // The in-progress typewriter, so a new question can cut the previous
  // answer short instead of leaving two replies animating at once.
  let typing = null;

  function buildConsentGate() {
    const panel = document.getElementById('ai-chat-panel');
    if (!panel || panel.querySelector('.ai-chat-consent')) return panel && panel.querySelector('.ai-chat-consent');

    const gate = document.createElement('div');
    gate.className = 'ai-chat-consent';
    gate.innerHTML = `
      <div class="ai-chat-consent__inner">
        <div class="ai-chat-consent__icon"><i class="fas fa-message"></i></div>
        <h3 class="ai-chat-consent__title"></h3>
        <p class="ai-chat-consent__body"></p>
        <p class="ai-chat-consent__note"><i class="fas fa-circle-info"></i> <span></span></p>
        <p class="ai-chat-consent__links">
          <span class="ai-chat-consent__links-lead"></span>
          <a class="ai-chat-consent__terms" href="/ai-terms" target="_blank" rel="noopener"></a>
          <span class="ai-chat-consent__and"></span>
          <a class="ai-chat-consent__privacy" href="/ai-privacy" target="_blank" rel="noopener"></a>
        </p>
        <button type="button" class="ai-chat-consent__accept"></button>
        <button type="button" class="ai-chat-consent__decline"></button>
      </div>`;
    panel.appendChild(gate);

    gate.querySelector('.ai-chat-consent__accept').addEventListener('click', () => {
      rememberConsent();
      hideConsentGate();
      const input = document.getElementById('ai-chat-input');
      if (input) input.focus();
      const messages = document.getElementById('ai-chat-messages');
      if (messages && !messages.querySelector('.ai-chat-msg, .ai-chat-msg-row')) {
        appendMessage('assistant', t('greeting'));
      }
    });
    gate.querySelector('.ai-chat-consent__decline').addEventListener('click', () => toggleChat(false));
    return gate;
  }

  function syncConsentLang() {
    const gate = document.querySelector('.ai-chat-consent');
    if (!gate) return;
    gate.querySelector('.ai-chat-consent__title').textContent = t('consentTitle');
    gate.querySelector('.ai-chat-consent__body').textContent = t('consentBody');
    gate.querySelector('.ai-chat-consent__note span').textContent = t('consentNote');
    gate.querySelector('.ai-chat-consent__links-lead').textContent = t('consentLinks');
    gate.querySelector('.ai-chat-consent__terms').textContent = t('consentTerms');
    gate.querySelector('.ai-chat-consent__and').textContent = t('consentAnd');
    gate.querySelector('.ai-chat-consent__privacy').textContent = t('consentPrivacy');
    gate.querySelector('.ai-chat-consent__accept').textContent = t('consentAccept');
    gate.querySelector('.ai-chat-consent__decline').textContent = t('consentDecline');
  }
  document.addEventListener('litalk:langchange', syncConsentLang);

  function showConsentGate() {
    const gate = buildConsentGate();
    if (!gate) return;
    syncConsentLang();
    gate.classList.add('show');
    // The composer stays visible behind the gate but must not be usable,
    // and must not be reachable by Tab either.
    const form = document.getElementById('ai-chat-form');
    if (form) form.setAttribute('inert', '');
    requestAnimationFrame(() => gate.querySelector('.ai-chat-consent__accept').focus());
  }

  function hideConsentGate() {
    const gate = document.querySelector('.ai-chat-consent');
    if (gate) gate.classList.remove('show');
    const form = document.getElementById('ai-chat-form');
    if (form) form.removeAttribute('inert');
  }

  function toggleChat(force) {
    const panel = document.getElementById('ai-chat-panel');
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (window.matchMedia('(max-width: 480px)').matches) {
      document.body.style.overflow = open ? 'hidden' : '';
    }
    if (open) {
      if (!hasConsent()) {
        showConsentGate();
        return;
      }
      const input = document.getElementById('ai-chat-input');
      if (input) input.focus();
      const messages = document.getElementById('ai-chat-messages');
      if (messages && !messages.querySelector('.ai-chat-msg, .ai-chat-msg-row')) {
        appendMessage('assistant', t('greeting'));
      }
    }
  }

  function startNewChat() {
    if (typing) typing.finish();
    conversationId = null;
    const messages = document.getElementById('ai-chat-messages');
    if (!messages) return;
    messages.querySelectorAll('.ai-chat-msg, .ai-chat-msg-row').forEach((el) => el.remove());
    appendMessage('assistant', t('newChatMsg'));
  }

  function scrollToBottom() {
    const messages = document.getElementById('ai-chat-messages');
    if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }

  // Markdown rendering lives in js/markdown.js, shared with the /ask page
  // and the student portal so all three render the same subset.
  const renderMarkdown = (text) => window.litalkMarkdown(text);

  function appendMessage(role, text) {
    const messages = document.getElementById('ai-chat-messages');
    if (!messages) return null;
    const el = document.createElement('div');
    el.className = 'ai-chat-msg ai-chat-msg--' + role;
    if (role === 'assistant') {
      const row = document.createElement('div');
      row.className = 'ai-chat-msg-row';
      const avatar = document.createElement('span');
      avatar.className = 'ai-chat-msg-avatar';
      avatar.textContent = '🌷';
      row.appendChild(avatar);
      row.appendChild(el);
      messages.appendChild(row);
      // Typed out rather than dropped in whole — see litalkTypewriter.
      typing = window.litalkTypewriter(el, renderMarkdown(text), {
        onTick: () => {
          messages.scrollTop = messages.scrollHeight;
        },
        onDone: () => {
          typing = null;
        },
      });
    } else {
      el.textContent = text;
      messages.appendChild(el);
    }
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  async function submitChat(event) {
    event.preventDefault();
    if (busy) return false;
    const input = document.getElementById('ai-chat-input');
    if (!input) return false;
    const message = input.value.trim();
    if (!message) return false;

    if (typing) typing.finish();
    appendMessage('user', message);
    input.value = '';
    busy = true;
    const sendBtn = document.getElementById('ai-chat-send');
    if (sendBtn) sendBtn.disabled = true;
    const pending = appendMessage('pending', t('pending'));

    try {
      const lang = typeof window.litalkGetLang === 'function' ? window.litalkGetLang() : 'en';
      const res = await fetch(`${dataApiUrl}/chat/general`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          visitorId: getVisitorId(),
          lang,
          termsVersion: hasConsent() ? CHAT_TERMS_VERSION : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (pending) pending.remove();
      if (!res.ok || data.status === 'error') {
        // The server rejects messages from a visitor with no consent on
        // record — including after the terms are revised, which is how a
        // returning visitor gets re-prompted rather than just erroring.
        if (data.needsConsent) {
          localStorage.removeItem(CONSENT_KEY);
          showConsentGate();
          return false;
        }
        appendMessage('error', data.message || t('genericError'));
        return false;
      }
      conversationId = data.conversationId;
      appendMessage('assistant', data.reply || '');
    } catch (err) {
      if (pending) pending.remove();
      appendMessage('error', t('connError'));
    } finally {
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
    }
    return false;
  }

  // A notice can close the assistant without closing the page it sits on,
  // so the fab follows the chat_site surface rather than the page's own.
  // Hidden rather than left to fail on send: a button that only reveals it
  // is unavailable after you have typed a question is worse than no button.
  function syncServiceState() {
    const blocked = window.litalkService && window.litalkService.blocked('chat_site');
    fab.style.display = blocked ? 'none' : 'flex';
    if (blocked) toggleChat(false);
  }
  document.addEventListener('litalk:serviceready', syncServiceState);

  fab.style.display = 'flex';
  window.toggleAIChat = toggleChat;
  window.startNewAIChat = startNewChat;
  window.scrollAIChatToBottom = scrollToBottom;
  window.submitAIChat = submitChat;

  const messages = document.getElementById('ai-chat-messages');
  const scrollBtn = document.getElementById('ai-chat-scroll-btn');
  if (messages && scrollBtn) {
    messages.addEventListener('scroll', () => {
      const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
      scrollBtn.classList.toggle('show', !nearBottom);
    });
  }
})();
