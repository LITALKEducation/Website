'use strict';

(function initSiteStandards() {
  const LANG_KEY = 'litalk-lang';
  const VALID_LANGS = new Set(['en', 'th']);
  const surfaces = (document.body?.dataset?.serviceSurface || '').split(',').map((value) => value.trim()).filter(Boolean);
  const oldHeader = document.querySelector('header');
  if (!oldHeader || surfaces.includes('portal')) return;

  if (!document.querySelector('link[data-litalk-menu]')) {
    const menuStyles = document.createElement('link');
    menuStyles.rel = 'stylesheet';
    menuStyles.href = '/css/menu.css?v=20260826d';
    menuStyles.dataset.litalkMenu = 'shared';
    document.head.appendChild(menuStyles);
  }

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

  const learningActive = ['courses', 'plus', 'programs', 'ask'].includes(active);

  const langToggle = `
    <button class="lang-toggle" data-active="en" type="button" aria-label="Switch language / เปลี่ยนภาษา" title="EN / ไทย">
      <span class="lang-toggle__thumb" aria-hidden="true"></span>
      <span class="lang-toggle__opt active" data-opt="en">EN</span>
      <span class="lang-toggle__opt" data-opt="th">ไทย</span>
    </button>`;

  const menuItem = (key, href, icon, en, th, subEn, subTh) => `
    <a href="${href}" class="nav-menu__item${active === key ? ' is-active' : ''}" role="menuitem"${active === key ? ' aria-current="page"' : ''}>
      <span class="nav-menu__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
      <span class="nav-menu__copy">
        <strong data-en="${en}" data-th="${th}">${en}</strong>
        <small data-en="${subEn}" data-th="${subTh}">${subEn}</small>
      </span>
    </a>`;

  const learningItems = [
    menuItem('courses', '/courses', 'fa-laptop', 'Online Learning', 'เรียนออนไลน์', 'Self-paced lessons and courses', 'บทเรียนและคอร์สเรียนด้วยตนเอง'),
    menuItem('programs', '/programs', 'fa-comments', '1-on-1 Tutoring', 'เรียนตัวต่อตัว', 'Personal English tutoring', 'เรียนภาษาอังกฤษแบบส่วนตัว'),
    menuItem('plus', '/plus', 'fa-plus', 'LITALK+', 'LITALK+', 'Premium learning membership', 'สมาชิกการเรียนรู้แบบพรีเมียม'),
    menuItem('ask', '/ask', 'fa-wand-magic-sparkles', 'Ask LITALK', 'ถาม LITALK', 'Ask English questions with AI', 'ถามคำถามภาษาอังกฤษด้วย AI'),
  ].join('');

  const desktopGroup = (id, en, th, isActive, items) => `
    <li class="nav-menu${isActive ? ' nav-menu--active' : ''}">
      <button class="nav-menu__trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="nav-menu-${id}">
        <span data-en="${en}" data-th="${th}">${en}</span>
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      </button>
      <div class="nav-menu__panel" id="nav-menu-${id}" role="menu" aria-label="${en}">${items}</div>
    </li>`;

  const mobileItem = (key, href, en, th) => `
    <a href="${href}" class="nav-mobile-group__link${active === key ? ' is-active' : ''}"${active === key ? ' aria-current="page"' : ''} data-en="${en}" data-th="${th}">${en}</a>`;

  const mobileGroup = (id, en, th, isActive, items) => `
    <div class="nav-mobile-group${isActive ? ' is-active' : ''}">
      <button class="nav-mobile-group__trigger" type="button" aria-expanded="${isActive ? 'true' : 'false'}" aria-controls="mobile-group-${id}">
        <span data-en="${en}" data-th="${th}">${en}</span>
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      </button>
      <div class="nav-mobile-group__panel${isActive ? ' open' : ''}" id="mobile-group-${id}">${items}</div>
    </div>`;

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
    <div class="nav__backdrop" aria-hidden="true"></div>
    <nav class="nav" id="main-nav" aria-label="Main navigation">
      <div class="container"><div class="nav__inner">
        <a href="/" class="nav__logo" aria-label="LITALK Home"><img src="/img/LITALK-Black.png" alt="LITALK Education" class="theme-invertable" width="170" height="28"></a>
        <ul class="nav__links" role="list">
          ${desktopGroup('learning', 'Learning', 'การเรียน', learningActive, learningItems)}
          <li><a href="/about" class="nav__link${active === 'about' ? ' nav__link--active' : ''}" data-en="About" data-th="เกี่ยวกับเรา"${active === 'about' ? ' aria-current="page"' : ''}>About</a></li>
          <li><a href="/blog" class="nav__link${active === 'blog' ? ' nav__link--active' : ''}" data-en="Blog" data-th="บทความ"${active === 'blog' ? ' aria-current="page"' : ''}>Blog</a></li>
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
        ${mobileGroup('learning', 'Learning', 'การเรียน', learningActive, [
          mobileItem('courses', '/courses', 'Online Learning', 'เรียนออนไลน์'),
          mobileItem('programs', '/programs', '1-on-1 Tutoring', 'เรียนตัวต่อตัว'),
          mobileItem('plus', '/plus', 'LITALK+', 'LITALK+'),
          mobileItem('ask', '/ask', 'Ask LITALK', 'ถาม LITALK'),
        ].join(''))}
        <a href="/about" class="nav__link${active === 'about' ? ' nav__link--active' : ''}" data-en="About" data-th="เกี่ยวกับเรา"${active === 'about' ? ' aria-current="page"' : ''}>About</a>
        <a href="/blog" class="nav__link${active === 'blog' ? ' nav__link--active' : ''}" data-en="Blog" data-th="บทความ"${active === 'blog' ? ' aria-current="page"' : ''}>Blog</a>
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
  const backdrop = header.querySelector('.nav__backdrop');

  const closeDesktopMenus = (except = null) => {
    header.querySelectorAll('.nav-menu.open').forEach((menu) => {
      if (menu === except) return;
      menu.classList.remove('open');
      menu.querySelector('.nav-menu__trigger')?.setAttribute('aria-expanded', 'false');
    });
  };

  header.querySelectorAll('.nav-menu').forEach((menu) => {
    const trigger = menu.querySelector('.nav-menu__trigger');
    trigger?.addEventListener('click', (event) => {
      event.stopPropagation();
      const opening = !menu.classList.contains('open');
      closeDesktopMenus(menu);
      menu.classList.toggle('open', opening);
      trigger.setAttribute('aria-expanded', String(opening));
    });
  });

  header.querySelectorAll('.nav-mobile-group').forEach((group) => {
    const trigger = group.querySelector('.nav-mobile-group__trigger');
    const panel = group.querySelector('.nav-mobile-group__panel');
    trigger?.addEventListener('click', () => {
      const opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      trigger.setAttribute('aria-expanded', String(opening));
    });
  });

  function closeDrawer() {
    hamburger.classList.remove('open');
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-drawer-open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = hamburger.classList.toggle('open');
    drawer.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-drawer-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  backdrop.addEventListener('click', closeDrawer);
  drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeDrawer));

  document.addEventListener('click', (event) => {
    closeDesktopMenus();
    if (!hamburger.contains(event.target) && !drawer.contains(event.target)) closeDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDesktopMenus();
      closeDrawer();
    }
  });
  addEventListener('resize', () => { if (innerWidth > 768) closeDrawer(); }, { passive: true });

  const updateSticky = () => nav.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', updateSticky, { passive: true });
  updateSticky();

  header.querySelectorAll('.login-menu').forEach((menu) => {
    const button = menu.querySelector('.login-menu__btn');
    button?.addEventListener('click', (event) => {
      event.stopPropagation();
      closeDesktopMenus();
      const open = menu.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target)) {
        menu.classList.remove('open');
        button?.setAttribute('aria-expanded', 'false');
      }
    });
  });

  function normalizeLang(value) { return VALID_LANGS.has(value) ? value : 'en'; }
  function getLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      return normalizeLang(stored || document.documentElement.dataset.lang || 'en');
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
  window.LITALK_UI = Object.freeze({ getLang, setLang, closeDrawer, closeDesktopMenus });

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