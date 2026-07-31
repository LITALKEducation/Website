/**
 * LITALK Education — student-plus.js
 * The LITALK+ page inside the student portal (student-plus.html).
 *
 * This is the only page where membership can be both SEEN and BOUGHT: a
 * subscription attaches to a student id, and this page has one. /litalk-plus
 * is the public pitch and cannot check out; /learn shows the badge but is
 * about lessons. Everything about the membership itself lives here.
 *
 * Nothing here grants anything. Checkout hands off to Stripe and the webhook
 * writes the membership — which is also why coming back from a successful
 * payment polls rather than trusting the redirect: the webhook is a separate
 * delivery and can land after the visitor does.
 *
 * Prices come from GET /plus/public, never from the markup, so a price edited
 * in the Stripe dashboard cannot leave the page advertising the old one.
 */

'use strict';

/* eslint-disable no-unused-vars */

const PLUS_PLAN_LABEL = {
  monthly: 'รายเดือน',
  term: 'รายเทอม',
  yearly: 'รายปี',
};

let plusStudentId = null;
let plusState = { plus: null, prices: [] };

function plusMoney(satang, currency) {
  const major = (Number(satang) || 0) / 100;
  const n = Math.round(major).toLocaleString('th-TH');
  return (currency || 'thb').toLowerCase() === 'thb' ? `฿${n}` : `${n} ${String(currency).toUpperCase()}`;
}

// How many months one payment covers — the term plan is month × 5, not its
// own interval, so this cannot be read off `interval` alone.
function plusMonths(price) {
  return price.interval === 'year' ? 12 * (price.intervalCount || 1) : price.intervalCount || 1;
}

function plusPeriodText(price) {
  const m = plusMonths(price);
  if (price.interval === 'year' && (price.intervalCount || 1) === 1) return 'ต่อปี';
  if (m === 1) return 'ต่อเดือน';
  return `ทุก ${m} เดือน`;
}

function plusDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ---------------- Status ---------------- */

function renderPlusStatus() {
  const el = document.getElementById('plus-status');
  const chip = document.getElementById('plus-status-chip');
  if (!el) return;

  const plus = plusState.plus;
  if (!plus) {
    chip.innerText = 'ไม่ทราบสถานะ';
    el.innerHTML = '<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>โหลดสถานะสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p></div>';
    // Status unknown means we do not know whether they already pay, so nothing
    // is offered — this one fails closed.
    renderPlusPlans(false);
    return;
  }

  if (plus.member) {
    const sub = plus.subscription || {};
    const plan = PLUS_PLAN_LABEL[sub.plan] || sub.plan || '';
    const until = plusDate(sub.currentPeriodEnd);
    chip.innerText = 'สมาชิก LITALK+';
    // A cancelled membership still runs to the end of the paid period, so it
    // says when access ends rather than when it renews. Telling someone who
    // has cancelled that they "renew" on that date would be wrong twice over.
    const line = sub.cancelAtPeriodEnd
      ? `<p class="pp-card__note"><i class="fas fa-circle-info"></i> ยกเลิกไว้แล้ว ใช้ได้ถึง <strong>${escapeHtml(until)}</strong></p>`
      : until
        ? `<p class="pp-card__note"><i class="fas fa-rotate"></i> ต่ออายุอัตโนมัติ ${escapeHtml(until)}</p>`
        : '';
    el.innerHTML = `
      <div class="pp-card pp-card--member">
        <span class="pp-card__badge"><i class="fas fa-star"></i> สมาชิก LITALK+</span>
        ${plan ? `<p class="pp-card__plan">แพ็กเกจ${escapeHtml(plan)}</p>` : ''}
        ${line}
        <button type="button" class="btn-primary" onclick="openPlusPortal()"><i class="fas fa-gear"></i> จัดการสมาชิก</button>
        <p class="pp-card__fine">เปลี่ยนบัตร ดูใบเสร็จ และยกเลิก ทำได้ในหน้าจัดการของ Stripe</p>
      </div>`;
    // A member is not shown the plan cards — there is nothing to buy, and
    // changing plan goes through the Stripe portal above.
    renderPlusPlans(false);
    return;
  }

  const chat = plus.chat || {};
  const remaining = Number(chat.remaining);
  const quota = Number.isFinite(remaining)
    ? `<p class="pp-card__note"><i class="fas fa-comments"></i> ถามน้องลิลลี่ได้อีก ${remaining} จาก ${Number(chat.dailyLimit) || 0} คำถามวันนี้</p>`
    : '';
  chip.innerText = 'ผู้ใช้ฟรี';
  el.innerHTML = `
    <div class="pp-card">
      <span class="pp-card__badge pp-card__badge--free">ผู้ใช้ฟรี</span>
      <p class="pp-card__plan">บทเรียนในบล็อกและแบบฝึกหัดท้ายบทใช้ได้ตามปกติ</p>
      ${quota}
    </div>`;
  renderPlusPlans(true);
}

/* ---------------- Plans ---------------- */

// Only ever called for someone who could actually buy. Hiding the section
// while leaving three "สมัคร" buttons in the DOM would put a live checkout one
// stray CSS rule away from a member who already pays.
function renderPlusPlans(show) {
  const grid = document.getElementById('plus-plans');
  const section = document.getElementById('plus-plans-section');
  if (!grid) return;
  const prices = show ? plusState.prices : [];
  if (!prices.length) {
    grid.innerHTML = '';
    if (section) section.hidden = true;
    return;
  }

  // "คุ้มที่สุด" is measured against the cheapest per month rather than assumed
  // to be the yearly plan, and suppressed when there is only one plan.
  const cheapest = Math.min(...prices.map((p) => p.amount / plusMonths(p)));
  const order = { monthly: 0, term: 1, yearly: 2 };
  const sorted = [...prices].sort((a, b) => (order[a.plan] ?? 9) - (order[b.plan] ?? 9));

  grid.innerHTML = sorted
    .map((p) => {
      const perMonth = p.amount / plusMonths(p);
      const best = sorted.length > 1 && Math.round(perMonth) <= Math.round(cheapest);
      // A derived average, rounded to whole baht and labelled as one — nobody
      // is ever billed ฿159.80.
      const avg =
        plusMonths(p) > 1
          ? `<span class="pp-plan__note">เฉลี่ย ${plusMoney(Math.round(perMonth / 100) * 100, p.currency)} ต่อเดือน</span>`
          : '<span class="pp-plan__note"></span>';
      return `
        <article class="pp-plan${best ? ' pp-plan--best' : ''}">
          ${best ? '<span class="pp-plan__flag">คุ้มที่สุด</span>' : ''}
          <span class="pp-plan__name">${escapeHtml(PLUS_PLAN_LABEL[p.plan] || p.plan)}</span>
          <span class="pp-plan__price">${plusMoney(p.amount, p.currency)}</span>
          <span class="pp-plan__period">${escapeHtml(plusPeriodText(p))}</span>
          ${avg}
          <button type="button" class="btn-primary pp-plan__cta" onclick="startPlusSubscription('${escapeHtml(p.plan)}')">สมัคร</button>
        </article>`;
    })
    .join('');
  if (section) section.hidden = false;
}

/* ---------------- Actions ---------------- */

async function startPlusSubscription(plan) {
  const buttons = [...document.querySelectorAll('.pp-plan__cta')];
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(plusStudentId)}/plus/checkout`, {
      method: 'POST',
      body: JSON.stringify({ plan, returnUrl: window.location.href.split('?')[0] }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    if (data.member) {
      // Already subscribed in another tab or on another device.
      await loadPlusState();
      return;
    }
    window.alert(data.message || 'เปิดหน้าสมัครสมาชิกไม่สำเร็จ');
  } catch (err) {
    console.error('startPlusSubscription:', err);
    window.alert('เปิดหน้าสมัครสมาชิกไม่สำเร็จ');
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

// Change card, cancel, resume, receipts — all of it is Stripe's hosted portal
// rather than a second billing UI built here.
async function openPlusPortal() {
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(plusStudentId)}/plus/manage`, {
      method: 'POST',
      body: JSON.stringify({ returnUrl: window.location.href.split('?')[0] }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    window.alert(data.message || 'เปิดหน้าจัดการสมาชิกไม่สำเร็จ');
  } catch (err) {
    console.error('openPlusPortal:', err);
    window.alert('เปิดหน้าจัดการสมาชิกไม่สำเร็จ');
  }
}

/* ---------------- Load ---------------- */

async function loadPlusState() {
  const [plus, pub] = await Promise.all([
    authedFetch(`/portal/${encodeURIComponent(plusStudentId)}/plus`)
      .then((r) => r.json().catch(() => null))
      .catch(() => null),
    // Public, so it is a plain fetch. A failure here costs the plan cards, not
    // the status above it.
    fetch('https://istudent.litalkeducation.com/plus/public')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  plusState.plus = plus && plus.status === 'success' ? plus : null;
  plusState.prices =
    pub && pub.available && Array.isArray(pub.prices) ? pub.prices.filter((p) => p && Number(p.amount) > 0) : [];
  renderPlusStatus();
  return !!(plusState.plus && plusState.plus.member);
}

// Coming back from a successful Stripe checkout. The membership is written by
// the webhook, a separate delivery that can land after this redirect, so poll
// briefly rather than telling a paying member they are not one. Gives up
// quietly — the badge appears on the next load either way.
async function settlePlusAfterCheckout() {
  const el = document.getElementById('plus-status');
  if (el) el.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>กำลังยืนยันการสมัครสมาชิก...</p></div>';
  for (let i = 0; i < 6; i += 1) {
    if (await loadPlusState()) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  renderPlusStatus();
}

async function initStudentPlus(studentId) {
  plusStudentId = studentId;
  const params = new URLSearchParams(window.location.search);
  const returning = params.get('plus') === '1';
  const wanted = params.get('subscribe');

  if (returning) {
    await settlePlusAfterCheckout();
    return;
  }

  const member = await loadPlusState();

  // ?subscribe=<plan> — arriving from a plan card on the public /litalk-plus
  // page. The plan is still validated server-side; this only saves the second
  // click. Cleared from the URL before it is acted on, so a refresh after an
  // abandoned checkout does not start another one.
  if (wanted && !member && plusState.prices.some((p) => p.plan === wanted)) {
    params.delete('subscribe');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    startPlusSubscription(wanted);
  }
}
