'use strict';

(function initUnifiedSiteNav() {
  const existingHeader = document.querySelector('header');
  if (!existingHeader || document.body?.dataset?.serviceSurface === 'portal') return;

  // TCAS Fortune owns its reading language state. Preserve its original
  // language button as an invisible bridge so the unified site toggle can
  // trigger the same application logic without duplicating fortune state.
  const fortuneLang = document.getElementById('fortune-lang');
  if (fortuneLang) {
    const bridge = document.createElement('div');
    bridge.hidden = true;
    bridge.setAttribute('aria-hidden', 'true');
    bridge.appendChild(fortuneLang);
    document.body.appendChild(bridge);
  }

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const active = path.startsWith('/courses') ? 'courses'
    : path.startsWith('/plus') ? 'plus'
      : path.startsWith('/programs') ? 'programs'
        : path.startsWith('/about') ? 'about'
          : path.startsWith('/ask') ? 'ask'
            : path.startsWith('/blog') ? 'blog'
              : '';

  const link = (key, href, en, th) =>
    `<li><a href="${href}" class="nav__link${active === key ? ' nav__link--active' : ''}" data-en="${en}" data-th="${th}">${en}</a></li>`;
  const drawerLink = (key, href, en, th) =>
    `<a href="${href}" class="nav__link${active === key ? ' nav__link--active' : ''}" data-en="${en}" data-th="${th}">${en}</a>`;

  const header = document.createElement('header');
  header.setAttribute('role', 'banner');
  header.innerHTML = `
    <nav class="nav" id="main-nav" aria-label="Main navigation">
      <div class="container">
        <div class="nav__inner">
          <a href="/" class="nav__logo" aria-label="LITALK Home">
            <img src="/img/LITALK-Black.png" alt="LITALK Education" class="theme-invertable" width="170" height="28">
          </a>
          <ul class="nav__links" role="list">
            ${link('courses', '/courses', 'Online Learning', 'เรียนออนไลน์')}
            ${link('plus', '/plus', 'LITALK+', 'LITALK+')}
            ${link('programs', '/programs', '1-on-1 Tutoring', 'เรียนตัวต่อตัว')}
            ${link('about', '/about', 'About', 'เกี่ยวกับเรา')}
            ${link('ask', '/ask', 'Ask', 'ถามคำศัพท์')}
            ${link('blog', '/blog', 'Blog', 'บทความ')}
          </ul>
          <div class="nav__actions">
            <button class="lang-toggle" data-active="en" type="button" aria-label="Switch language / เปลี่ยนภาษา" title="EN / ไทย">
              <span class="lang-toggle__thumb" aria-hidden="true"></span>
              <span class="lang-toggle__opt active" data-opt="en">EN</span>
              <span class="lang-toggle__opt" data-opt="th">ไทย</span>
            </button>
            <div class="login-menu">
              <button class="login-menu__btn" type="button" aria-haspopup="true" aria-expanded="false">
                <i class="fas fa-user" aria-hidden="true" style="font-size:11px"></i>
                <span data-en="Log in" data-th="เข้าสู่ระบบ">Log in</span>
                <i class="fas fa-chevron-down" aria-hidden="true"></i>
              </button>
              <div class="login-menu__panel" role="menu" aria-label="Login options">
                <a href="/portal/student" class="login-menu__item" role="menuitem">
                  <span class="login-menu__item-icon" aria-hidden="true"><i class="fas fa-user-graduate"></i></span>
                  <span><strong class="login-menu__item-title" data-en="Student &amp; Parent" data-th="นักเรียนและผู้ปกครอง">Student &amp; Parent</strong><span class="login-menu__item-sub" data-en="Study log, schedule &amp; payments" data-th="บันทึกการเรียน ตารางเรียน และการชำระเงิน">Study log, schedule &amp; payments</span></span>
                </a>
                <a href="https://admin.litalkeducation.com" class="login-menu__item" role="menuitem" target="_blank" rel="noopener noreferrer">
                  <span class="login-menu__item-icon" aria-hidden="true"><i class="fas fa-chalkboard-user"></i></span>
                  <span><strong class="login-menu__item-title" data-en="Teacher &amp; Staff" data-th="ครูและเจ้าหน้าที่">Teacher &amp; Staff</strong><span class="login-menu__item-sub" data-en="Teaching admin console" data-th="ระบบจัดการการสอน">Teaching admin console</span></span>
                </a>
              </div>
            </div>
            <a href="/#contact" class="btn btn--primary btn--sm" data-en="Start Learning" data-th="เริ่มเรียน">Start Learning</a>
          </div>
          <button class="nav__hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobile-drawer"><span></span><span></span><span></span></button>
        </div>
      </div>
      <div class="nav__drawer" id="mobile-drawer" role="navigation" aria-label="Mobile navigation">
        ${drawerLink('courses', '/courses', 'Online Learning', 'เรียนออนไลน์')}
        ${drawerLink('plus', '/plus', 'LITALK+', 'LITALK+')}
        ${drawerLink('programs', '/programs', '1-on-1 Tutoring', 'เรียนตัวต่อตัว')}
        ${drawerLink('about', '/about', 'About', 'เกี่ยวกับเรา')}
        ${drawerLink('ask', '/ask', 'Ask', 'ถามคำศัพท์')}
        ${drawerLink('blog', '/blog', 'Blog', 'บทความ')}
        <div class="nav__actions">
          <button class="lang-toggle" data-active="en" type="button" aria-label="Switch language / เปลี่ยนภาษา" title="EN / ไทย">
            <span class="lang-toggle__thumb" aria-hidden="true"></span><span class="lang-toggle__opt active" data-opt="en">EN</span><span class="lang-toggle__opt" data-opt="th">ไทย</span>
          </button>
          <a href="/#contact" class="btn btn--primary btn--sm nav__drawer-cta" data-en="Start Learning" data-th="เริ่มเรียน">Start Learning</a>
          <div class="nav__drawer-login-label" data-en="Log in" data-th="เข้าสู่ระบบ">Log in</div>
          <a href="/portal/student" class="login-menu__item"><span class="login-menu__item-icon" aria-hidden="true"><i class="fas fa-user-graduate"></i></span><span><strong class="login-menu__item-title" data-en="Student &amp; Parent" data-th="นักเรียนและผู้ปกครอง">Student &amp; Parent</strong><span class="login-menu__item-sub" data-en="Study log, schedule &amp; payments" data-th="บันทึกการเรียน ตารางเรียน และการชำระเงิน">Study log, schedule &amp; payments</span></span></a>
          <a href="https://admin.litalkeducation.com" class="login-menu__item" target="_blank" rel="noopener noreferrer"><span class="login-menu__item-icon" aria-hidden="true"><i class="fas fa-chalkboard-user"></i></span><span><strong class="login-menu__item-title" data-en="Teacher &amp; Staff" data-th="ครูและเจ้าหน้าที่">Teacher &amp; Staff</strong><span class="login-menu__item-sub" data-en="Teaching admin console" data-th="ระบบจัดการการสอน">Teaching admin console</span></span></a>
        </div>
      </div>
    </nav>`;
  existingHeader.replaceWith(header);

  const nav = header.querySelector('#main-nav');
  const hamburger = header.querySelector('#hamburger');
  const drawer = header.querySelector('#mobile-drawer');

  const closeDrawer = () => {
    hamburger.classList.remove('open');
    drawer.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  hamburger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = hamburger.classList.toggle('open');
    drawer.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeDrawer));
  document.addEventListener('click', (event) => {
    if (!hamburger.contains(event.target) && !drawer.contains(event.target)) closeDrawer();
  });
  window.addEventListener('resize', () => { if (innerWidth > 768) closeDrawer(); }, { passive: true });

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
      if (!menu.contains(event.target)) { menu.classList.remove('open'); button?.setAttribute('aria-expanded', 'false'); }
    });
  });

  function setToggleVisuals(lang) {
    header.querySelectorAll('.lang-toggle').forEach((toggle) => {
      toggle.dataset.active = lang;
      toggle.querySelectorAll('.lang-toggle__opt').forEach((opt) => opt.classList.toggle('active', opt.dataset.opt === lang));
    });
  }

  function applyLanguage(lang) {
    document.documentElement.lang = lang === 'th' ? 'th' : 'en';
    document.documentElement.dataset.lang = lang;
    try { localStorage.setItem('litalk-lang', lang); } catch (_error) {}
    document.querySelectorAll('[data-en][data-th]').forEach((node) => {
      const value = node.getAttribute(`data-${lang}`);
      if (value != null) node.textContent = value;
    });
    document.querySelectorAll('[data-en-placeholder][data-th-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', node.getAttribute(`data-${lang}-placeholder`) || '');
    });
    setToggleVisuals(lang);
    document.dispatchEvent(new CustomEvent('litalk:langchange', { detail: { lang } }));
  }

  const currentLang = () => {
    if (typeof window.litalkGetLang === 'function') return window.litalkGetLang();
    return document.documentElement.dataset.lang || (localStorage.getItem('litalk-lang') || 'en');
  };

  header.querySelectorAll('.lang-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const bridge = document.getElementById('fortune-lang');
      if (bridge) {
        bridge.click();
        queueMicrotask(() => setToggleVisuals(document.documentElement.dataset.lang || 'th'));
        return;
      }
      const next = currentLang() === 'th' ? 'en' : 'th';
      applyLanguage(next);
    });
  });

  setToggleVisuals(currentLang());
  document.addEventListener('litalk:langchange', (event) => setToggleVisuals(event.detail?.lang || currentLang()));
})();
