/**
 * LITALK Education — home-courses.js
 * Fills the "On-demand courses" promo strip on the home page (index.html)
 * with a few published courses from the public catalogue API, favouring
 * whatever is currently on sale so discounted courses get pride of place.
 *
 * Rendering (cards, price / sale / LITALK+ badges) is reused from
 * js/LitalkCourses (courses.js) so the promo tracks the /courses catalogue
 * exactly. The section stays hidden until at least one course loads, so a
 * fresh site never shows an empty strip.
 */

'use strict';

(function () {
  const MAX_CARDS = 3;
  let loaded = []; // keep the raw courses so we can re-render on language flip

  function render(section, grid) {
    // cardHtml() is language-aware at call time, so re-run it on each render.
    grid.innerHTML = loaded.map((c) => window.LitalkCourses.cardHtml(c)).join('');
    section.hidden = false;
  }

  async function init() {
    const section = document.getElementById('courses-promo');
    const grid = document.getElementById('home-courses-grid');
    if (!section || !grid || !window.LitalkCourses) return;

    try {
      const courses = await window.LitalkCourses.fetchCourses();
      // API already returns on-sale first, then newest — take the top few.
      loaded = (courses || []).slice(0, MAX_CARDS);
      if (loaded.length === 0) return; // nothing published yet — stay hidden
      render(section, grid);
    } catch (err) {
      // Network/API failure — leave the section hidden, home page unaffected.
      console.warn('home-courses: could not load courses', err);
    }
  }

  // Re-render on the language toggle so card copy follows EN/TH.
  document.addEventListener('litalk:langchange', () => {
    const section = document.getElementById('courses-promo');
    const grid = document.getElementById('home-courses-grid');
    if (section && grid && loaded.length) render(section, grid);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
