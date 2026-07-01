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
   LANGUAGE SWITCHER
   ============================================================ */
(function initLangSwitcher() {
  let currentLang = localStorage.getItem('litalk-lang') || 'en';

  function updateLangPills(animate = true) {
    $$('.lang-switcher.t-tabs').forEach(switcher => {
      const pill = switcher.querySelector('.t-tabs-pill');
      if (!pill) return;

      const activeBtn = switcher.querySelector('.lang-btn.active');
      if (!activeBtn) return;

      if (!animate) {
        const prev = pill.style.transition;
        pill.style.transition = 'none';
        pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
        pill.style.width = `${activeBtn.offsetWidth}px`;
        void pill.offsetWidth;
        pill.style.transition = prev;
      } else {
        pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
        pill.style.width = `${activeBtn.offsetWidth}px`;
      }
    });
  }

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

    // Update all lang buttons
    $$('.lang-btn').forEach(btn => {
      const target = btn.getAttribute('data-lang-target');
      const isActive = target === lang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Animate switcher pills to the active buttons
    updateLangPills(true);
  }

  // Attach click handlers to all lang buttons
  $$('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang-target');
      if (lang && lang !== currentLang) {
        applyLang(lang);
      }
    });
  });

  // Apply saved / default lang on load
  applyLang(currentLang);

  // Measure pills initial position once layout has settled
  requestAnimationFrame(() => updateLangPills(false));
  window.addEventListener('resize', () => updateLangPills(false));
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const originalText = submitBtn.textContent;
    submitBtn.textContent = '...';
    submitBtn.disabled = true;

    // Simulate submission (replace with real endpoint)
    await new Promise(resolve => setTimeout(resolve, 1200));

    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    submitBtn.textContent = lang === 'th' ? 'ส่งแล้ว ✓' : 'Sent ✓';
    submitBtn.style.background = '#1F1F1F';

    setTimeout(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      submitBtn.style.background = '';
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
