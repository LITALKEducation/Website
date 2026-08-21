/**
 * LITALK Education — plus.js
 * The LITALK+ membership page (plus.html).
 *
 * Prices are never written into the markup. They come from GET /plus/public,
 * which reads them from Stripe — a number typed into the HTML could advertise
 * a price the checkout would not honour, and the two would drift the first
 * time anyone changed one in the dashboard.
 *
 * The page ships in its coming-soon state and this only ever UPGRADES it, so a
 * slow call, a failed call or an unconfigured Stripe all leave the safe
 * version on screen rather than a button that cannot work. Launching is then
 * a Stripe dashboard edit: price the plans and the page turns itself on.
 *
 * Buying happens in the student portal, which is where the learner's identity
 * is — this page hands off to /portal/student/plus rather than starting a checkout of its
 * own, since a subscription has to be attached to a student id. The chosen
 * plan rides along as ?subscribe=<plan> and /portal/student/plus starts that checkout on
 * arrival, so choosing a plan and paying for it stay one motion even though
 * they happen on two pages.
 */

'use strict';

(function () {
  const API = 'https://istudent.litalkeducation.com';

  const lang = () =>
    typeof window.litalkGetLang === 'function'
      ? window.litalkGetLang()
      : document.documentElement.getAttribute('data-lang') || 'en';
  const isTh = () => lang() === 'th';
  const t = (en, th) => (isTh() ? th : en);

  // Set both translations AND the visible text. main.js applies data-en/data-th
  // on load and on the language switch, but it does not watch for attributes
  // changed afterwards — and it keeps applyLang inside its own closure, so it
  // cannot be re-run from here either.
  function say(el, en, th) {
    if (!el) return;
    el.setAttribute('data-en', en);
    el.setAttribute('data-th', th);
    el.textContent = isTh() ? th : en;
  }

  // Satang → the way a price is written in each language.
  function money(amount, currency) {
    const major = (Number(amount) || 0) / 100;
    const rounded = Number.isInteger(major) ? major : Number(major.toFixed(2));
    const n = rounded.toLocaleString(isTh() ? 'th-TH' : 'en-US');
    return (currency || 'thb').toLowerCase() === 'thb' ? `฿${n}` : `${n} ${String(currency).toUpperCase()}`;
  }

  const PLAN_LABEL = {
    monthly: ['Monthly', 'รายเดือน'],
    term: ['Per term', 'รายเทอม'],
    yearly: ['Yearly', 'รายปี'],
  };

  // How long one payment covers, in months — used for the per-month figure.
  function months(price) {
    return price.interval === 'year' ? 12 * (price.intervalCount || 1) : price.intervalCount || 1;
  }

  function periodText(price) {
    const m = months(price);
    if (price.interval === 'year' && (price.intervalCount || 1) === 1) return t('per year', 'ต่อปี');
    if (m === 1) return t('per month', 'ต่อเดือน');
    return t(`every ${m} months`, `ทุก ${m} เดือน`);
  }

  function planCard(price, cheapestPerMonth) {
    const [en, th] = PLAN_LABEL[price.plan] || [price.plan, price.plan];
    const perMonth = price.amount / months(price);
    // Only the genuinely cheapest per month is flagged, and only when there is
    // something to compare it against — a "best value" badge on the only plan
    // would be noise.
    const best = cheapestPerMonth != null && Math.round(perMonth) <= Math.round(cheapestPerMonth);
    // A derived average, not a charged amount — rounded to whole baht and
    // labelled as an average, because "฿159.8 per month" reads like a price
    // someone could pay and nobody is ever billed that.
    const perMonthLine =
      months(price) > 1
        ? `<span class="plus-plan__note">${t('avg', 'เฉลี่ย')} ${money(Math.round(perMonth / 100) * 100, price.currency)} ${t('per month', 'ต่อเดือน')}</span>`
        : '<span class="plus-plan__note"></span>';
    return `
      <article class="plus-plan${best ? ' plus-plan--best' : ''}">
        ${best ? `<span class="plus-plan__flag">${t('Best value', 'คุ้มที่สุด')}</span>` : ''}
        <span class="plus-plan__name">${t(en, th)}</span>
        <span class="plus-plan__price">${money(price.amount, price.currency)}</span>
        <span class="plus-plan__period">${periodText(price)}</span>
        ${perMonthLine}
        <a class="btn btn--primary plus-plan__cta" href="portal/student/plus?subscribe=${encodeURIComponent(price.plan)}">${t('Start LITALK+', 'สมัคร LITALK+')}</a>
      </article>`;
  }

  async function render() {
    const grid = document.getElementById('plus-plans');
    const soon = document.getElementById('plus-soon');
    const foot = document.getElementById('plus-plans-foot');
    if (!grid) return;

    let data = null;
    try {
      const res = await fetch(`${API}/plus/public`);
      if (res.ok) data = await res.json();
    } catch (err) {
      console.warn('plus: availability check failed', err);
    }

    const prices = (data && data.available && Array.isArray(data.prices) ? data.prices : []).filter(
      (p) => p && Number(p.amount) > 0,
    );
    if (!prices.length) {
      // Still coming soon. Replace the skeletons — they are a loading state,
      // and leaving them shimmering forever would read as broken.
      grid.innerHTML = '';
      grid.hidden = true;
      return;
    }

    // Cheapest per month across the plans, so "best value" is measured rather
    // than assumed to be the yearly one.
    const cheapest = Math.min(...prices.map((p) => p.amount / months(p)));
    const order = { monthly: 0, term: 1, yearly: 2 };
    prices.sort((a, b) => (order[a.plan] ?? 9) - (order[b.plan] ?? 9));

    grid.innerHTML = prices.map((p) => planCard(p, cheapest)).join('');
    grid.hidden = false;
    if (soon) soon.hidden = true;
    say(
      foot,
      'Sign in to start. Cancel any time — you keep access to the end of the period you have paid for.',
      'เข้าสู่ระบบเพื่อเริ่มใช้งาน · ยกเลิกได้ทุกเมื่อ และยังใช้ได้จนจบรอบที่ชำระไว้แล้ว',
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
