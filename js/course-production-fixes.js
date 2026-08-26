'use strict';

(function installCourseProductionFixes() {
  if (!location.pathname.startsWith('/courses')) return;

  let refreshToken = 0;

  function normalizeRoutes(root = document) {
    root.querySelectorAll('a.course-card__link').forEach((link) => {
      const url = new URL(link.getAttribute('href') || '', location.href);
      const id = url.searchParams.get('id');
      if (id) link.href = `/courses?id=${encodeURIComponent(id)}`;
    });
    root.querySelectorAll('a.course-back').forEach((link) => { link.href = '/courses'; });
    root.querySelectorAll('a[href^="learn?course="]').forEach((link) => {
      const raw = link.getAttribute('href') || '';
      link.href = `/${raw}`;
    });
  }

  async function refreshDynamicCourseContent() {
    if (!window.LitalkCourses) return;
    const token = ++refreshToken;
    const id = new URLSearchParams(location.search).get('id');
    const grid = document.getElementById('course-grid');
    const detail = document.getElementById('course-detail-inner');

    try {
      if (id && detail) {
        const data = await window.LitalkCourses.fetchCourse(id);
        if (token !== refreshToken || !data?.course) return;
        detail.innerHTML = window.LitalkCourses.detailHtml(data);
        normalizeRoutes(detail);
        return;
      }
      if (grid) {
        const courses = await window.LitalkCourses.fetchCourses();
        if (token !== refreshToken) return;
        grid.innerHTML = courses.map(window.LitalkCourses.cardHtml).join('');
        const empty = document.getElementById('course-empty');
        if (empty) empty.hidden = courses.length > 0;
        normalizeRoutes(grid);
      }
    } catch (error) {
      console.warn('courses: language refresh failed', error);
    }
  }

  document.addEventListener('litalk:langchange', refreshDynamicCourseContent);
  document.addEventListener('DOMContentLoaded', () => {
    queueMicrotask(() => normalizeRoutes());
    setTimeout(() => normalizeRoutes(), 0);
  });
}());
