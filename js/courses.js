/**
 * LITALK Education — courses.js
 * Public on-demand course catalogue (courses.html): promotion + syllabus,
 * no login required. Enrolment itself happens in the student portal, so the
 * "register" CTA hands off to the learn page (which prompts login, then opens
 * the course to buy / enrol for free).
 *
 * Courses are authored in the LITALK admin console and served by the same
 * Cloudflare Worker that powers the student portal.
 */

'use strict';

window.LitalkCourses = (function () {
  const API = 'https://istudent.litalkeducation.com';

  const lang = () =>
    typeof window.litalkGetLang === 'function'
      ? window.litalkGetLang()
      : document.documentElement.getAttribute('data-lang') || 'en';

  const t = (en, th) => (lang() === 'th' ? th : en);

  /* ---------- API ---------- */

  async function fetchCourses() {
    const res = await fetch(`${API}/courses/public`);
    if (!res.ok) throw new Error(`Courses API responded ${res.status}`);
    const data = await res.json();
    return data.courses || [];
  }

  async function fetchCourse(id) {
    const res = await fetch(`${API}/courses/public/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Courses API responded ${res.status}`);
    return res.json();
  }

  /* ---------- helpers ---------- */

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Bilingual field with fallback to the other language.
  function pick(obj, field) {
    const th = obj[`${field}Th`];
    const en = obj[field];
    return lang() === 'th' ? th || en || '' : en || th || '';
  }

  function priceLabel(priceSatang) {
    const n = Number(priceSatang) || 0;
    if (n <= 0) return t('Free', 'ฟรี');
    return '฿' + (n / 100).toLocaleString('en-US');
  }

  // A course is "on sale" when it carries a discount price below its list price.
  function onSale(course) {
    const p = Number(course.priceSatang) || 0;
    const d = course.discountSatang;
    return d != null && Number(d) < p;
  }

  function discountPct(course) {
    const p = Number(course.priceSatang) || 0;
    if (!onSale(course) || p <= 0) return 0;
    return Math.round((1 - (Number(course.discountSatang) || 0) / p) * 100);
  }

  // Price block: struck-through original + sale price when on sale, otherwise a
  // single price. `lg` scales it for the detail hero.
  function priceHtml(course, lg) {
    const cls = lg ? ' course-price--lg' : '';
    if (onSale(course)) {
      const sale = Number(course.discountSatang) || 0;
      return (
        `<span class="course-price course-price--was">${priceLabel(course.priceSatang)}</span>` +
        `<span class="course-price${cls}${sale <= 0 ? ' course-price--free' : ''}">${priceLabel(sale)}</span>` +
        `<span class="course-sale-badge">-${discountPct(course)}%</span>`
      );
    }
    const free = (Number(course.priceSatang) || 0) <= 0;
    return `<span class="course-price${cls}${free ? ' course-price--free' : ''}">${priceLabel(course.priceSatang)}</span>`;
  }

  function plusBadge(course) {
    return Number(course.includedInPlus)
      ? `<span class="course-plus-badge">LITALK+</span>`
      : '';
  }

  /* ---------- "coming soon" ---------- */

  // A course is "coming soon" when its launch time is set and still in the
  // future — visible in the catalogue, but not yet open for enrollment.
  function isComingSoon(course) {
    const iso = course && course.availableAt;
    if (!iso) return false;
    const ts = new Date(iso).getTime();
    return !Number.isNaN(ts) && ts > Date.now();
  }

  function fmtOpenDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(lang() === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  // A compact remaining-time string, e.g. "3 วัน 4 ชม." / "3d 4h".
  function countdownText(iso) {
    const diff = new Date(iso).getTime() - Date.now();
    if (!(diff > 0)) return t('Opening…', 'กำลังเปิด…');
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d} ${t('d', 'วัน')} ${h} ${t('h', 'ชม.')}`;
    if (h > 0) return `${h} ${t('h', 'ชม.')} ${m} ${t('m', 'นาที')}`;
    if (m > 0) return `${m} ${t('m', 'นาที')} ${sec} ${t('s', 'วิ')}`;
    return `${sec} ${t('s', 'วินาที')}`;
  }

  // A live-updating countdown span (the ticker below refreshes it each second).
  function countdownHtml(iso) {
    return `<span class="course-countdown" data-countdown-to="${escapeHtml(iso)}">${countdownText(iso)}</span>`;
  }

  // Where "register / start" sends the visitor: the portal learn page, opening
  // this course straight away (after login).
  function enrolUrl(id) {
    return `learn?course=${encodeURIComponent(id)}`;
  }

  function md(text) {
    if (!text) return '';
    if (window.marked) {
      try { return window.marked.parse ? window.marked.parse(text) : window.marked(text); } catch (e) { /* fall through */ }
    }
    return typeof window.litalkMarkdown === 'function' ? window.litalkMarkdown(text) : escapeHtml(text);
  }

  /* ---------- rendering ---------- */

  function cardHtml(course) {
    const title = escapeHtml(pick(course, 'title')) || t('Course', 'คอร์ส');
    const desc = escapeHtml(pick(course, 'description'));
    const cat = course.category ? escapeHtml(course.category) : t('Course', 'คอร์ส');
    const free = onSale(course) ? (Number(course.discountSatang) || 0) <= 0 : (Number(course.priceSatang) || 0) <= 0;
    const meta = [];
    if (Number(course.itemCount) > 0) meta.push(`<i class="fas fa-book-open"></i> ${course.itemCount} ${t('lessons', 'บทเรียน')}`);
    const soon = isComingSoon(course);
    const hasCover = Number(course.hasCover);
    // Status flag: overlaid on the cover image when there is one, otherwise
    // shown inline at the top of the body so it never lands on the category/
    // title of a cover-less card.
    const overlayFlag = soon
      ? `<span class="course-card__soon"><i class="fas fa-clock"></i> ${t('Coming soon', 'เร็ว ๆ นี้')}</span>`
      : onSale(course) ? `<span class="course-card__sale">-${discountPct(course)}%</span>` : '';
    const inlineFlag = soon
      ? `<span class="course-soon-badge"><i class="fas fa-clock"></i> ${t('Coming soon', 'เร็ว ๆ นี้')}</span>`
      : onSale(course) ? `<span class="course-sale-badge">-${discountPct(course)}%</span>` : '';
    const coverBlock = hasCover
      ? `<div class="course-card__img"><img src="${API}/courses/public/${Number(course.id)}/cover" alt="" loading="lazy">${overlayFlag}</div>`
      : '';
    const bodyFlags = !hasCover && inlineFlag ? `<div class="course-card__flags">${inlineFlag}</div>` : '';
    const foot = soon
      ? `<span class="course-countdown-lbl"><i class="fas fa-hourglass-half"></i> ${t('Opens in', 'เปิดใน')} ${countdownHtml(course.availableAt)}</span>
         <span class="btn btn--primary btn--sm btn--soon" aria-disabled="true">${t('Coming soon', 'เร็ว ๆ นี้')}</span>`
      : `<span class="course-price-wrap">${priceHtml(course)}</span>
         <a class="btn btn--primary btn--sm" href="${enrolUrl(course.id)}">
           ${free ? t('Enroll free', 'ลงทะเบียนฟรี') : t('Register', 'ลงทะเบียนเรียน')}
         </a>`;
    return `
      <article class="blog-card course-card${soon ? ' course-card--soon' : ''}">
        <a class="course-card__link" href="courses?id=${Number(course.id)}" aria-label="${title}">
          ${coverBlock}
          <div class="blog-card__body">
            ${bodyFlags}
            <span class="blog-card__tag">${cat}</span>${plusBadge(course)}
            <h3 class="blog-card__title">${title}</h3>
            ${desc ? `<p class="course-card__desc">${desc}</p>` : ''}
            <div class="course-card__meta">${meta.join('')}</div>
          </div>
        </a>
        <div class="course-card__foot">${foot}</div>
      </article>`;
  }

  const KIND_LABEL = {
    pretest: () => t('Pre-test', 'แบบทดสอบก่อนเรียน'),
    posttest: () => t('Post-test', 'แบบทดสอบหลังเรียน'),
    lesson: () => t('Lesson', 'บทเรียน'),
  };

  function syllabusHtml(items) {
    if (!items || !items.length) return '';
    const rows = items
      .map((it, i) => {
        const label = (KIND_LABEL[it.kind] || KIND_LABEL.lesson)();
        const title = escapeHtml(pick(it, 'title')) || label;
        const bits = [];
        if (Number(it.hasVideo)) bits.push(`<i class="fas fa-video"></i> ${t('video', 'วีดีโอ')}`);
        if (Number(it.questionCount) > 0) bits.push(`<i class="fas fa-circle-question"></i> ${it.questionCount} ${t('questions', 'ข้อ')}`);
        return `
          <li class="course-syl__item">
            <span class="course-syl__num">${i + 1}</span>
            <div class="course-syl__main">
              <span class="course-syl__title">${title}</span>
              <span class="course-syl__kind">${label}${bits.length ? ' · ' + bits.join(' · ') : ''}</span>
            </div>
          </li>`;
      })
      .join('');
    return `<ol class="course-syl">${rows}</ol>`;
  }

  function detailHtml(data) {
    const course = data.course;
    const title = escapeHtml(pick(course, 'title'));
    const desc = escapeHtml(pick(course, 'description'));
    const overview = pick(course, 'overview');
    const free = onSale(course) ? (Number(course.discountSatang) || 0) <= 0 : (Number(course.priceSatang) || 0) <= 0;
    const cover = Number(course.hasCover)
      ? `<div class="course-detail__cover"><img src="${API}/courses/public/${Number(course.id)}/cover" alt=""></div>`
      : '';
    const soon = isComingSoon(course);
    const saleNote = !soon && onSale(course)
      ? `<p class="course-detail__sale"><i class="fas fa-tags"></i> ${t('Limited-time offer', 'ราคาโปรโมชันช่วงเวลาจำกัด')} · ${t('save', 'ลด')} ${discountPct(course)}%</p>`
      : '';
    // Prominent countdown panel shown instead of the price + buy button while
    // the course is still in "coming soon" mode.
    const soonPanel = soon
      ? `<div class="course-soon">
           <span class="course-soon__badge"><i class="fas fa-clock"></i> ${t('Coming soon', 'เร็ว ๆ นี้')}</span>
           <div class="course-soon__count" data-countdown-to="${escapeHtml(course.availableAt)}">${countdownText(course.availableAt)}</div>
           <p class="course-soon__date">${t('Enrollment opens', 'เปิดให้ลงทะเบียน')} ${fmtOpenDate(course.availableAt)}</p>
           <span class="btn btn--primary btn--soon" aria-disabled="true"><i class="fas fa-hourglass-half"></i> ${t('Not open yet', 'ยังไม่เปิดให้ลงทะเบียน')}</span>
         </div>`
      : '';
    const buyTop = soon
      ? soonPanel
      : `<div class="course-buy">
           <span class="course-price-wrap course-price-wrap--lg">${priceHtml(course, true)}</span>
           <a class="btn btn--primary" href="${enrolUrl(course.id)}">
             <i class="fas fa-graduation-cap"></i> ${free ? t('Enroll free', 'ลงทะเบียนฟรี') : t('Register &amp; start', 'ลงทะเบียนเรียน')}
           </a>
         </div>`;
    const buyBottom = soon
      ? `<div class="course-buy course-buy--bottom">
           <span class="btn btn--primary btn--lg btn--soon" aria-disabled="true"><i class="fas fa-clock"></i> ${t('Opens in', 'เปิดใน')} ${countdownHtml(course.availableAt)}</span>
         </div>`
      : `<div class="course-buy course-buy--bottom">
           <a class="btn btn--primary btn--lg" href="${enrolUrl(course.id)}">
             <i class="fas fa-graduation-cap"></i> ${free ? t('Enroll free', 'ลงทะเบียนฟรี') : t('Register &amp; start', 'ลงทะเบียนเรียน')}
           </a>
         </div>`;
    return `
      <a class="course-back" href="courses"><i class="fas fa-arrow-left"></i> ${t('All courses', 'คอร์สทั้งหมด')}</a>
      ${cover}
      <span class="page-hero__label">${course.category ? escapeHtml(course.category) : t('On-demand course', 'คอร์สเรียน On Demand')}</span>${Number(course.includedInPlus) ? ` ${plusBadge(course)}` : ''}
      <h1 class="page-hero__title course-detail__title">${title}</h1>
      ${desc ? `<p class="page-hero__sub">${desc}</p>` : ''}
      ${saleNote}
      ${buyTop}
      ${overview ? `<div class="course-overview">${md(overview)}</div>` : ''}
      <h2 class="course-section-title">${t('What you will learn', 'เนื้อหาในคอร์ส')}</h2>
      ${syllabusHtml(data.items) || `<p class="course-detail__empty">${t('Syllabus coming soon.', 'กำลังจัดเตรียมเนื้อหา')}</p>`}
      ${buyBottom}`;
  }

  // Live countdown ticker: refresh every [data-countdown-to] element each
  // second, wherever a card or detail put one in the DOM. When one reaches its
  // launch time, reload once so the course flips from "coming soon" to open.
  if (typeof document !== 'undefined') {
    let reloading = false;
    setInterval(() => {
      const els = document.querySelectorAll('[data-countdown-to]');
      if (!els.length) return;
      let anyExpired = false;
      els.forEach((el) => {
        const iso = el.getAttribute('data-countdown-to');
        if (new Date(iso).getTime() - Date.now() <= 0) anyExpired = true;
        el.textContent = countdownText(iso);
      });
      if (anyExpired && !reloading) {
        reloading = true;
        setTimeout(() => window.location.reload(), 1500);
      }
    }, 1000);
  }

  return {
    API, lang, t, fetchCourses, fetchCourse, cardHtml, detailHtml, escapeHtml, pick,
    priceLabel, priceHtml, onSale, discountPct, plusBadge, enrolUrl, isComingSoon, countdownText, fmtOpenDate,
  };
})();
