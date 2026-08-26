'use strict';

(function initSiteStandards() {
  const LANG_KEY = 'litalk-lang';
  const VALID_LANGS = new Set(['en', 'th']);
  const oldHeader = document.querySelector('header');
  if (!oldHeader || document.body?.dataset?.serviceSurface === 'portal') return;

  /* Temporary compatibility bridge for feature code that still owns an
     internal language handler. It is never shown to users; all visible
     controls use the shared .lang-toggle component. */
  const legacyFortuneLang = document.getElementById('fortune-lang');
  if (legacyFortuneLang) {
    legacyFortuneLang.className = 'lang-toggle lang-toggle--bridge';
    const holder = document.createElement('div');
    holder.hidden = true;
    holder.setAttribute('aria-hidden', 'true');
    holder.appendChild(legacyFortuneLang);
    document.body.appendChild(holder);
  }

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const active = path.startsWith('/courses') ? 'courses'
    : path.startsWith('/plus') ? 'plus'
      : path.startsWith('/programs') ? 'programs'
        : path.startsWith('/about') ? 'about'
          : path.startsWith('/ask') ? 'ask'
            : path.startsWith('/blog') ? 'blog'
              : '';

  const desktopLink = (key, href, en, th) =>
    `<li><a href="${href}" class="nav__link${active === key ? ' nav__link--active' : ''}" data-en="${en}" data-th="${th}"${active === key ? ' aria-current="page"' : ''}>${en}</a></li>`;
  const mobileLink = (key, href, en, th) =>
    `<a href="${href}" class="nav__link${active === key ? ' nav__link--active' : ''}" data-en="${en}" data-th="${th}"${active === key ? ' aria-current="page"' : ''}>${en}</a>`;

  const langToggle = `
    <button class="lang-toggle" data-active="en" type="button" aria-label="Switch language / เปลี่ยนภาษา" title="EN / ไทย">
      <span class="lang-toggle__thumb" aria-hidden="true"></span>
      <span class="lang-toggle__opt active" data-opt="en">EN</span>
      <span class="lang-toggle__opt" data-opt="th">ไทย</span>
    </button>`;

  const studentLogin = `
    <a href="/portal/student" class="login-menu__item" role="menuitem">
      <span class="login-menu__item-icon" aria-hidden="true"><i class="fas fa-user-graduate"></i></span>
      <span><strong class="login-menu__item-title" data-en="Student &amp; Parent" data-th="นักเรียนและผู้ปกครอง">Student &amp; Parent</strong><span class="login-menu__item-sub" data-en="Study log, schedule &amp; payments" data-th="บันทึกการเรียน ตารางเรียน และการชำระเงิน">Study log, schedule &amp; payments</span></span>
    </a>`;
  const staffLogin = `
    <a href="https://admin.litalkeducation.com" class="login-menu__item" role="menuitem" target="_blank" rel="noopener noreferrer">
      <span class="login-menu__item-icon" aria-hidden="true"><i class="fas fa-chalkboard-user"></i></span>
      <span><strong class="login-menu__item-title" data-en="Teacher &amp; Staff" data-th="ครูและเจ้าหน้าที่">Teacher &amp; Staff</strong><span class="login-menu__item-sub" data-en="Teaching admin console" data-th="ระบบจัดการการสอน">Teaching admin console</span></span>
    </a>`;

  const header = document.createElement('header');
  header.setAttribute('role', 'banner');
  header.innerHTML = `
    <nav class="nav" id="main-nav" aria-label="Main navigation">
      <div class="container"><div class="nav__inner">
        <a href="/" class="nav__logo" aria-label="LITALK Home"><img src="/img/LITALK-Black.png" alt="LITALK Education" class="theme-invertable" width="170" height="28"></a>
        <ul class="nav__links" role="list">
          ${desktopLink('courses', '/courses', 'Online Learning', 'เรียนออนไลน์')}
          ${desktopLink('plus', '/plus', 'LITALK+', 'LITALK+')}
          ${desktopLink('programs', '/programs', '1-on-1 Tutoring', 'เรียนตัวต่อตัว')}
          ${desktopLink('about', '/about', 'About', 'เกี่ยวกับเรา')}
          ${desktopLink('ask', '/ask', 'Ask', 'ถามศัพท์')}
          ${desktopLink('blog', '/blog', 'Blog', 'บทความ')}
        </ul>
        <div class="nav__actions">
          ${langToggle}
          <div class="login-menu">
            <button class="login-menu__btn" type="button" aria-haspopup="menu" aria-expanded="false"><i class="fas fa-user" aria-hidden="true" style="font-size:11px"></i><span data-en="Log in" data-th="เข้าสู่ระบบ">Log in</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
            <div class="login-menu__panel" role="menu" aria-label="Login options">${studentLogin}${staffLogin}</div>
          </div>
          <a href="/#contact" class="btn btn--primary btn--sm" data-en="Start Learning" data-th="เริ่มเรียน">Start Learning</a>
        </div>
        <button class="nav__hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobile-drawer"><span></span><span></span><span></span></button>
      </div></div>
      <div class="nav__drawer" id="mobile-drawer" role="navigation" aria-label="Mobile navigation">
        ${mobileLink('courses', '/courses', 'Online Learning', 'เรียนออนไลน์')}
        ${mobileLink('plus', '/plus', 'LITALK+', 'LITALK+')}
        ${mobileLink('programs', '/programs', '1-on-1 Tutoring', 'เรียนตัวต่อตัว')}
        ${mobileLink('about', '/about', 'About', 'เกี่ยวกับเรา')}
        ${mobileLink('ask', '/ask', 'Ask', 'ถามศัพท์')}
        ${mobileLink('blog', '/blog', 'Blog', 'บทความ')}
        <div class="nav__actions">
          ${langToggle}
          <a href="/#contact" class="btn btn--primary btn--sm nav__drawer-cta" data-en="Start Learning" data-th="เริ่มเรียน">Start Learning</a>
          <div class="nav__drawer-login-label" data-en="Log in" data-th="เข้าสู่ระบบ">Log in</div>
          ${studentLogin}${staffLogin}
        </div>
      </div>
    </nav>`;
  oldHeader.replaceWith(header);

  const nav = header.querySelector('#main-nav');
  const hamburger = header.querySelector('#hamburger');
  const drawer = header.querySelector('#mobile-drawer');

  function closeDrawer() {
    hamburger.classList.remove('open');
    drawer.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = hamburger.classList.toggle('open');
    drawer.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeDrawer));
  document.addEventListener('click', (event) => {
    if (!hamburger.contains(event.target) && !drawer.contains(event.target)) closeDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });
  addEventListener('resize', () => { if (innerWidth > 768) closeDrawer(); }, { passive: true });

  const updateSticky = () => nav.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', updateSticky, { passive: true });
  updateSticky();

  header.querySelectorAll('.login-menu').forEach((menu) => {
    const button = menu.querySelector('.login-menu__btn');
    button?.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = menu.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) {
        menu.classList.remove('open');
        button?.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        menu.classList.remove('open');
        button?.setAttribute('aria-expanded', 'false');
      }
    });
  });

  function normalizeLang(value) {
    return VALID_LANGS.has(value) ? value : 'en';
  }
  function getLang() {
    try {
      return normalizeLang(document.documentElement.dataset.lang || localStorage.getItem(LANG_KEY) || 'en');
    } catch (_error) {
      return normalizeLang(document.documentElement.dataset.lang || 'en');
    }
  }
  function updateToggleVisuals(lang) {
    document.querySelectorAll('.lang-toggle:not(.lang-toggle--bridge)').forEach((toggle) => {
      toggle.dataset.active = lang;
      toggle.querySelectorAll('.lang-toggle__opt').forEach((opt) => opt.classList.toggle('active', opt.dataset.opt === lang));
    });
  }
  function renderLocalizedAttributes(lang) {
    document.querySelectorAll('[data-en][data-th]').forEach((node) => {
      const value = node.getAttribute(`data-${lang}`);
      if (value != null) node.textContent = value;
    });
    document.querySelectorAll('[data-en-placeholder][data-th-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', node.getAttribute(`data-${lang}-placeholder`) || '');
    });
  }
  function setLang(value, options = {}) {
    const lang = normalizeLang(value);
    document.documentElement.lang = lang === 'th' ? 'th' : 'en';
    document.documentElement.dataset.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (_error) {}
    renderLocalizedAttributes(lang);
    updateToggleVisuals(lang);
    if (!options.silent) document.dispatchEvent(new CustomEvent('litalk:langchange', { detail: { lang } }));
    return lang;
  }

  window.litalkGetLang = getLang;
  window.litalkSetLang = setLang;
  window.LITALK_UI = Object.freeze({ getLang, setLang, closeDrawer });

  header.querySelectorAll('.lang-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const bridge = document.getElementById('fortune-lang');
      if (bridge) {
        bridge.click();
        queueMicrotask(() => {
          const lang = getLang();
          renderLocalizedAttributes(lang);
          updateToggleVisuals(lang);
          document.dispatchEvent(new CustomEvent('litalk:langchange', { detail: { lang } }));
        });
        return;
      }
      setLang(getLang() === 'th' ? 'en' : 'th');
    });
  });

  setLang(getLang(), { silent: true });
  document.addEventListener('litalk:langchange', (event) => {
    const lang = normalizeLang(event.detail?.lang || getLang());
    renderLocalizedAttributes(lang);
    updateToggleVisuals(lang);
  });
})();