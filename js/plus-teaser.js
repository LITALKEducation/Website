/**
 * LITALK Education — plus-teaser.js
 * The LITALK+ card that appears on the home page and on /courses.
 *
 * Both pages ship the card in its coming-soon state and this only ever
 * UPGRADES it, so a slow call, a failed call or an unconfigured Stripe leaves
 * the safe version on screen rather than a call to action that leads to a 503.
 * Launching is then a Stripe dashboard edit — no HTML changes.
 *
 * One file for two pages on purpose. The reveal used to live inline in
 * courses.html; a second copy on the home page is how the two would end up
 * describing the same membership differently.
 *
 * The card itself does not sell anything — it hands off to /plus,
 * which is the page that carries the plans and the prices.
 */

'use strict';

(function () {
  const API = 'https://istudent.litalkeducation.com';

  const isTh = () =>
    (typeof window.litalkGetLang === 'function'
      ? window.litalkGetLang()
      : document.documentElement.getAttribute('data-lang') || 'en') === 'th';

  // Set both translations AND the visible text. main.js applies data-en/data-th
  // on load and on the language switch, but it does not watch for attributes
  // changed afterwards — so writing only the attributes would leave the old
  // words on screen until someone toggled the language.
  function say(el, en, th) {
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-th', th);
    el.textContent = isTh() ? th : en;
  }

  async function reveal() {
    const soon = document.getElementById('plus-soon');
    const cta = document.getElementById('plus-cta');
    const note = document.getElementById('plus-note');
    if (!soon || !cta) return;

    let available = false;
    try {
      const res = await fetch(`${API}/plus/public`);
      available = res.ok && (await res.json()).available === true;
    } catch (err) {
      console.warn('plus: availability check failed', err);
    }
    if (!available) return;

    soon.hidden = true;
    cta.removeAttribute('aria-disabled');
    cta.removeAttribute('tabindex');
    cta.style.pointerEvents = '';
    cta.style.opacity = '';
    say(cta, 'See plans and pricing', 'ดูแพ็กเกจและราคา');
    say(
      note,
      'Three plans — monthly, per term or yearly. Cancel any time.',
      'มีสามแพ็กเกจ — รายเดือน รายเทอม และรายปี · ยกเลิกได้ทุกเมื่อ',
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal);
  else reveal();
})();
