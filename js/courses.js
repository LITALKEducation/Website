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
    const free = (Number(course.priceSatang) || 0) <= 0;
    const meta = [];
    if (Number(course.itemCount) > 0) meta.push(`<i class="fas fa-book-open"></i> ${course.itemCount} ${t('lessons', 'บทเรียน')}`);
    const cover = Number(course.hasCover)
      ? `<div class="course-card__img"><img src="${API}/courses/public/${Number(course.id)}/cover" alt="" loading="lazy"></div>`
      : '';
    return `
      <article class="blog-card course-card">
        <a class="course-card__link" href="courses?id=${Number(course.id)}" aria-label="${title}">
          ${cover}
          <div class="blog-card__body">
            <span class="blog-card__tag">${cat}</span>
            <h3 class="blog-card__title">${title}</h3>
            ${desc ? `<p class="course-card__desc">${desc}</p>` : ''}
            <div class="course-card__meta">${meta.join('')}</div>
          </div>
        </a>
        <div class="course-card__foot">
          <span class="course-price${free ? ' course-price--free' : ''}">${priceLabel(course.priceSatang)}</span>
          <a class="btn btn--primary btn--sm" href="${enrolUrl(course.id)}">
            ${free ? t('Enroll free', 'ลงทะเบียนฟรี') : t('Register', 'ลงทะเบียนเรียน')}
          </a>
        </div>
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
    const free = (Number(course.priceSatang) || 0) <= 0;
    const cover = Number(course.hasCover)
      ? `<div class="course-detail__cover"><img src="${API}/courses/public/${Number(course.id)}/cover" alt=""></div>`
      : '';
    return `
      <a class="course-back" href="courses"><i class="fas fa-arrow-left"></i> ${t('All courses', 'คอร์สทั้งหมด')}</a>
      ${cover}
      <span class="page-hero__label">${course.category ? escapeHtml(course.category) : t('On-demand course', 'คอร์สเรียน On Demand')}</span>
      <h1 class="page-hero__title course-detail__title">${title}</h1>
      ${desc ? `<p class="page-hero__sub">${desc}</p>` : ''}
      <div class="course-buy">
        <span class="course-price course-price--lg${free ? ' course-price--free' : ''}">${priceLabel(course.priceSatang)}</span>
        <a class="btn btn--primary" href="${enrolUrl(course.id)}">
          <i class="fas fa-graduation-cap"></i> ${free ? t('Enroll free', 'ลงทะเบียนฟรี') : t('Register &amp; start', 'ลงทะเบียนเรียน')}
        </a>
      </div>
      ${overview ? `<div class="course-overview">${md(overview)}</div>` : ''}
      <h2 class="course-section-title">${t('What you will learn', 'เนื้อหาในคอร์ส')}</h2>
      ${syllabusHtml(data.items) || `<p class="course-detail__empty">${t('Syllabus coming soon.', 'กำลังจัดเตรียมเนื้อหา')}</p>`}
      <div class="course-buy course-buy--bottom">
        <a class="btn btn--primary btn--lg" href="${enrolUrl(course.id)}">
          <i class="fas fa-graduation-cap"></i> ${free ? t('Enroll free', 'ลงทะเบียนฟรี') : t('Register &amp; start', 'ลงทะเบียนเรียน')}
        </a>
      </div>`;
  }

  return { API, lang, fetchCourses, fetchCourse, cardHtml, detailHtml, escapeHtml, pick, priceLabel };
})();
