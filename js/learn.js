/* ============================================================
   LITALK — Student learning & testing (แบบทดสอบและบทเรียน)
   Powers learn.html. Depends on js/student-portal.js (loaded
   first) for the shared Auth0/session plumbing: getPortalToken(),
   resolveAuthedStudentId(), dataApiUrl, escapeHtml(), toggleTheme(),
   logout(), initStudentHamburger(), updateThemeIcons(), and
   window.litalkMarkdown() from js/markdown.js.
   ============================================================ */

// Filled in once the signed-in student is resolved (window.onload below).
let learnStudentId = null;

// The whole page is one <div id="learn-view">; the list and the quiz-taking
// screen are just two things it renders, so a tiny bit of view state avoids a
// second HTML page and a full reload between them.
const learnState = {
  courses: [],
  quizzes: [],
  current: null, // { quiz, questions, prior }
  startedAt: null,
  // When a quiz is opened from inside a course, "back" returns to that course
  // instead of the home list.
  returnCourseId: null,
};

const TF_LABEL = { true: 'จริง (True)', false: 'เท็จ (False)' };

/* ---------------- On-device auto-save ----------------
   While a student is taking a quiz their answers are kept on THIS device
   only (localStorage) — nothing touches the cloud until they press "ส่งคำตอบ",
   at which point the attempt is graded and stored server-side. This means a
   refresh, an accidental tab close, or a flaky connection never loses
   in-progress work, and half-finished answers never leave the device. */

// Namespaced per student + quiz so two students sharing a browser, or the same
// student across different quizzes, never collide.
function draftKey(quizId) {
  return `litalk_quiz_draft_${learnStudentId || 'anon'}_${quizId}`;
}

function saveDraft(quizId, answers) {
  try {
    localStorage.setItem(draftKey(quizId), JSON.stringify({ answers, savedAt: Date.now() }));
  } catch (err) {
    // Private-mode / quota errors: auto-save is best-effort, never fatal.
    console.warn('saveDraft failed:', err);
  }
}

function readDraft(quizId) {
  try {
    const raw = localStorage.getItem(draftKey(quizId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft(quizId) {
  try {
    localStorage.removeItem(draftKey(quizId));
  } catch {
    /* ignore */
  }
}

// Write the answer a stored draft holds back into the freshly rendered form.
function applyAnswer(q, value) {
  const name = `q_${q.id}`;
  if (q.type === 'single') {
    const el = document.querySelector(`input[name="${name}"][value="${Number(value)}"]`);
    if (el) el.checked = true;
  } else if (q.type === 'multiple') {
    (Array.isArray(value) ? value : []).forEach((v) => {
      const el = document.querySelector(`input[name="${name}"][value="${Number(v)}"]`);
      if (el) el.checked = true;
    });
  } else if (q.type === 'truefalse') {
    if (value === true || value === false) {
      const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
      if (el) el.checked = true;
    }
  } else {
    const el = document.querySelector(`input[name="${name}"]`);
    if (el && value != null) el.value = value;
  }
}

function autosaveStamp(ts) {
  const el = document.getElementById('learn-autosave');
  if (!el) return;
  const t = ts ? new Date(ts) : new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  el.innerHTML = `<i class="fas fa-cloud-arrow-down"></i> บันทึกบนอุปกรณ์แล้ว ${hh}:${mm}`;
}

function mdToHtml(text) {
  if (!text) return '';
  return typeof window.litalkMarkdown === 'function' ? window.litalkMarkdown(text) : escapeHtml(text);
}

async function authedFetch(path, options = {}) {
  const token = await getPortalToken();
  if (!token) throw new Error('unauthenticated');
  const headers = Object.assign({ Authorization: `Bearer ${token}` }, options.headers || {});
  if (options.body) headers['Content-Type'] = 'application/json';
  return fetch(`${dataApiUrl}${path}`, Object.assign({}, options, { headers }));
}

/* ---------------- List view ---------------- */

function quizCardHtml(q) {
  const title = escapeHtml(q.titleTh || q.title || 'แบบทดสอบ');
  const desc = escapeHtml(q.descriptionTh || q.description || '');
  const attempts = Number(q.attempts) || 0;
  const passed = Number(q.passed) === 1;
  const best = q.bestScore != null ? Number(q.bestScore) : null;
  const canRetake = Number(q.allowRetake) === 1 || attempts === 0;

  const meta = [];
  if (Number(q.questionCount) > 0) meta.push(`<i class="fas fa-circle-question"></i> ${q.questionCount} ข้อ`);
  if (Number(q.hasLesson)) meta.push('<i class="fas fa-book-open"></i> มีบทเรียน');
  if (q.timeLimitMin) meta.push(`<i class="fas fa-clock"></i> ${q.timeLimitMin} นาที`);
  if (Number(q.passScore) > 0) meta.push(`<i class="fas fa-flag-checkered"></i> ผ่าน ${q.passScore}%`);

  let statusChip = '';
  if (attempts > 0) {
    statusChip = passed
      ? '<span class="learn-chip learn-chip--pass"><i class="fas fa-circle-check"></i> ผ่านแล้ว</span>'
      : '<span class="learn-chip learn-chip--try"><i class="fas fa-rotate"></i> ทำแล้ว ลองอีกครั้ง</span>';
  }

  const btnLabel = attempts > 0 ? (canRetake ? 'ทำอีกครั้ง' : 'ดูบทเรียน') : Number(q.questionCount) > 0 ? 'เริ่มทำแบบทดสอบ' : 'เริ่มเรียน';

  return `
    <article class="learn-card">
      <div class="learn-card__body">
        <div class="learn-card__head">
          <h3 class="learn-card__title">${title}</h3>
          ${statusChip}
        </div>
        ${desc ? `<p class="learn-card__desc">${desc}</p>` : ''}
        <div class="learn-card__meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
        ${best != null ? `<div class="learn-card__best">คะแนนสูงสุดที่เคยทำ: <strong>${best}</strong> คะแนน</div>` : ''}
      </div>
      <div class="learn-card__foot">
        <button type="button" class="btn-learn-primary" onclick="openQuiz(${Number(q.id)})">
          ${btnLabel} <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </article>`;
}

// ฿ price string from satang, or "ฟรี" for a free course.
function priceLabel(priceSatang) {
  const n = Number(priceSatang) || 0;
  if (n <= 0) return 'ฟรี';
  return `฿${(n / 100).toLocaleString('th-TH')}`;
}

function courseCardHtml(c) {
  const title = escapeHtml(c.titleTh || c.title || 'คอร์สเรียน');
  const desc = escapeHtml(c.descriptionTh || c.description || '');
  const enrolled = Number(c.enrolled) === 1;
  const meta = [];
  if (Number(c.itemCount) > 0) meta.push(`<i class="fas fa-book-open"></i> ${c.itemCount} บทเรียน`);
  meta.push(`<i class="fas fa-tag"></i> ${priceLabel(c.priceSatang)}`);

  const chip = enrolled ? '<span class="learn-chip learn-chip--pass"><i class="fas fa-circle-check"></i> ลงทะเบียนแล้ว</span>' : '';
  const btn = enrolled
    ? `<button type="button" class="btn-learn-primary" onclick="openCourse(${Number(c.id)})">เข้าเรียน <i class="fas fa-arrow-right"></i></button>`
    : `<button type="button" class="btn-learn-primary" onclick="openCourse(${Number(c.id)})">
         ${Number(c.priceSatang) > 0 ? 'ดูรายละเอียด / ซื้อคอร์ส' : 'ดูรายละเอียด'} <i class="fas fa-arrow-right"></i>
       </button>`;

  return `
    <article class="learn-card learn-card--course">
      <div class="learn-card__body">
        <div class="learn-card__head">
          <h3 class="learn-card__title">${title}</h3>
          ${chip}
        </div>
        ${desc ? `<p class="learn-card__desc">${desc}</p>` : ''}
        <div class="learn-card__meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
      </div>
      <div class="learn-card__foot">
        <span class="learn-price">${priceLabel(c.priceSatang)}</span>
        ${btn}
      </div>
    </article>`;
}

function renderHome() {
  const view = document.getElementById('learn-view');
  const courses = learnState.courses;
  const quizzes = learnState.quizzes;

  if (!courses.length && !quizzes.length) {
    view.innerHTML = `
      <div class="learn-empty">
        <i class="fas fa-clipboard-list"></i>
        <p>ยังไม่มีคอร์ส บทเรียน หรือแบบทดสอบในขณะนี้</p>
        <span>เมื่อครูเผยแพร่เนื้อหา จะปรากฏที่นี่ให้คุณเรียนได้ทันที</span>
      </div>`;
    return;
  }

  let html = '';
  if (courses.length) {
    html += `<h2 class="learn-section-title"><i class="fas fa-graduation-cap"></i> คอร์สเรียน</h2>
      <div class="learn-grid">${courses.map(courseCardHtml).join('')}</div>`;
  }
  if (quizzes.length) {
    html += `<h2 class="learn-section-title" style="margin-top:26px;"><i class="fas fa-clipboard-question"></i> แบบทดสอบฟรี</h2>
      <div class="learn-grid">${quizzes.map(quizCardHtml).join('')}</div>`;
  }
  view.innerHTML = html;
}

async function loadHome() {
  const view = document.getElementById('learn-view');
  view.innerHTML = '<div class="skeleton-card"><span class="skeleton-loader skeleton-row short"></span><span class="skeleton-loader skeleton-row"></span></div>';
  try {
    const sid = encodeURIComponent(learnStudentId);
    const [coursesRes, quizzesRes] = await Promise.all([
      authedFetch(`/portal/${sid}/courses`).then((r) => r.json().catch(() => ({}))),
      authedFetch(`/portal/${sid}/quizzes`).then((r) => r.json().catch(() => ({}))),
    ]);
    learnState.courses = coursesRes.courses || [];
    learnState.quizzes = quizzesRes.quizzes || [];
    renderHome();
  } catch (err) {
    console.error('loadHome:', err);
    view.innerHTML = `<div class="learn-empty"><i class="fas fa-triangle-exclamation"></i><p>โหลดรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p></div>`;
  }
}

/* ---------------- Course detail + purchase ---------------- */

async function openCourse(courseId) {
  const view = document.getElementById('learn-view');
  view.innerHTML = '<div class="skeleton-card"><span class="skeleton-loader skeleton-row short"></span><span class="skeleton-loader skeleton-row"></span><span class="skeleton-loader skeleton-row medium"></span></div>';
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(learnStudentId)}/courses/${encodeURIComponent(courseId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'load failed');
    renderCourse(data.course, data.enrolled, data.items || []);
  } catch (err) {
    console.error('openCourse:', err);
    view.innerHTML = `<div class="learn-empty"><i class="fas fa-triangle-exclamation"></i><p>เปิดคอร์สไม่สำเร็จ</p><button type="button" class="btn-learn-primary" onclick="backHome()">กลับไปยังรายการ</button></div>`;
  }
}

function renderCourse(course, enrolled, items) {
  const view = document.getElementById('learn-view');
  const title = escapeHtml(course.titleTh || course.title);
  const overview = course.overviewTh || course.overview;
  const price = Number(course.priceSatang) || 0;

  const itemsHtml = items
    .map((it, i) => {
      const t = escapeHtml(it.titleTh || it.title || `บทเรียนที่ ${i + 1}`);
      const passed = Number(it.passed) === 1;
      const badge = passed ? '<span class="learn-chip learn-chip--pass"><i class="fas fa-circle-check"></i> ผ่านแล้ว</span>' : '';
      const right = enrolled
        ? `<button type="button" class="btn-learn-primary" style="padding:8px 14px;" onclick="openQuiz(${Number(it.id)}, ${Number(course.id)})">เริ่มเรียน <i class="fas fa-arrow-right"></i></button>`
        : '<span class="learn-lock"><i class="fas fa-lock"></i></span>';
      return `
        <div class="learn-course-item">
          <div class="learn-course-item__num">${i + 1}</div>
          <div class="learn-course-item__main">
            <div class="learn-course-item__title">${t} ${badge}</div>
            <div class="learn-course-item__meta">${Number(it.questionCount) > 0 ? `${it.questionCount} ข้อ` : ''}${Number(it.hasLesson) ? ' · มีบทเรียน' : ''}</div>
          </div>
          ${right}
        </div>`;
    })
    .join('');

  const buyBar = enrolled
    ? ''
    : `<div class="learn-buy-bar">
         <div class="learn-buy-bar__price">${priceLabel(price)}</div>
         <button type="button" class="btn-learn-primary" id="learn-buy-btn" onclick="buyCourse(${Number(course.id)})">
           <i class="fas fa-cart-shopping"></i> ${price > 0 ? 'ซื้อคอร์สนี้' : 'ลงทะเบียนฟรี'}
         </button>
       </div>
       ${price > 0 ? '<p class="learn-buy-note"><i class="fas fa-shield-halved"></i> ชำระเงินอย่างปลอดภัยผ่าน Stripe · หลังชำระเงินจะเข้าเรียนได้ทันที</p>' : ''}`;

  view.innerHTML = `
    <div class="learn-detail">
      <button type="button" class="btn-learn-back" onclick="backHome()"><i class="fas fa-arrow-left"></i> กลับไปยังรายการ</button>
      <h1 class="learn-detail__title">${title}</h1>
      ${course.descriptionTh || course.description ? `<p class="learn-detail__desc">${escapeHtml(course.descriptionTh || course.description)}</p>` : ''}
      ${buyBar}
      ${overview ? `<section class="learn-lesson"><div class="learn-lesson__content">${mdToHtml(overview)}</div></section>` : ''}
      <h2 class="learn-section-title" style="margin-top:22px;"><i class="fas fa-list-ol"></i> บทเรียนในคอร์ส (${items.length})</h2>
      <div class="learn-course-items">${itemsHtml || '<p class="learn-detail__desc">ยังไม่มีบทเรียนในคอร์สนี้</p>'}</div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function buyCourse(courseId) {
  const btn = document.getElementById('learn-buy-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังดำเนินการ...';
  }
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(learnStudentId)}/courses/${encodeURIComponent(courseId)}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ returnUrl: window.location.origin + '/learn?paid=1' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'ไม่สามารถดำเนินการได้');
    if (data.url) {
      // Paid course — off to Stripe checkout. Enrollment is granted by the
      // webhook on payment; the return URL brings them back to this page.
      window.location.href = data.url;
      return;
    }
    if (data.enrolled) {
      // Free course (or already enrolled) — refresh into the course.
      openCourse(courseId);
    }
  } catch (err) {
    console.error('buyCourse:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-cart-shopping"></i> ลองอีกครั้ง';
    }
    window.alert(err.message || 'ไม่สามารถดำเนินการชำระเงินได้ กรุณาลองใหม่');
  }
}

function backHome() {
  learnState.current = null;
  learnState.returnCourseId = null;
  loadHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- Quiz / take view ---------------- */

function questionFieldHtml(q, i) {
  const prompt = escapeHtml(q.prompt);
  const name = `q_${q.id}`;
  let body = '';

  if (q.type === 'single' || q.type === 'multiple') {
    const inputType = q.type === 'single' ? 'radio' : 'checkbox';
    body = (q.options || [])
      .map(
        (opt, idx) => `
        <label class="learn-option">
          <input type="${inputType}" name="${name}" value="${idx}">
          <span>${escapeHtml(opt)}</span>
        </label>`,
      )
      .join('');
  } else if (q.type === 'truefalse') {
    body = ['true', 'false']
      .map(
        (val) => `
        <label class="learn-option">
          <input type="radio" name="${name}" value="${val}">
          <span>${TF_LABEL[val]}</span>
        </label>`,
      )
      .join('');
  } else {
    body = `<input type="text" class="learn-short-input" name="${name}" placeholder="พิมพ์คำตอบของคุณ" autocomplete="off">`;
  }

  return `
    <div class="learn-question" id="qwrap_${q.id}" data-qid="${q.id}" data-type="${q.type}">
      <div class="learn-question__head">
        <span class="learn-question__num">${i + 1}</span>
        <p class="learn-question__prompt">${prompt}</p>
        <span class="learn-question__points">${q.points} คะแนน</span>
      </div>
      <div class="learn-question__body">${body}</div>
      <div class="learn-question__feedback" id="fb_${q.id}"></div>
    </div>`;
}

function renderQuiz() {
  const { quiz, questions, prior } = learnState.current;
  const view = document.getElementById('learn-view');
  const title = escapeHtml(quiz.titleTh || quiz.title);
  const lesson = quiz.lessonTh || quiz.lesson;
  const canAttempt = prior && prior.canAttempt;
  const hasQuestions = questions.length > 0;

  const lessonHtml = lesson
    ? `<section class="learn-lesson">
         <h2 class="learn-section-title"><i class="fas fa-book-open"></i> บทเรียน</h2>
         <div class="learn-lesson__content">${mdToHtml(lesson)}</div>
       </section>`
    : '';

  let quizHtml = '';
  if (hasQuestions) {
    if (canAttempt) {
      quizHtml = `
        <section class="learn-quiz">
          <h2 class="learn-section-title"><i class="fas fa-pen-to-square"></i> แบบทดสอบ</h2>
          <form id="learn-form">${questions.map(questionFieldHtml).join('')}</form>
          <div class="learn-submit-bar">
            <button type="button" class="btn-learn-primary" onclick="submitQuiz()">
              <i class="fas fa-paper-plane"></i> ส่งคำตอบ
            </button>
            <span class="learn-autosave" id="learn-autosave"></span>
          </div>
          <div id="learn-result"></div>
        </section>`;
    } else {
      quizHtml = `
        <section class="learn-quiz">
          <div class="learn-note"><i class="fas fa-circle-info"></i> แบบทดสอบนี้ทำได้เพียงครั้งเดียว และคุณได้ทำไปแล้ว
          ${prior && prior.bestScore != null ? `(คะแนน ${prior.bestScore})` : ''}</div>
        </section>`;
    }
  }

  view.innerHTML = `
    <div class="learn-detail">
      <button type="button" class="btn-learn-back" onclick="backToList()"><i class="fas fa-arrow-left"></i> กลับไปยังรายการ</button>
      <h1 class="learn-detail__title">${title}</h1>
      ${quiz.descriptionTh || quiz.description ? `<p class="learn-detail__desc">${escapeHtml(quiz.descriptionTh || quiz.description)}</p>` : ''}
      ${lessonHtml}
      ${quizHtml}
    </div>`;

  // Restore any on-device draft into the form, then keep saving on every
  // change (debounced) until the attempt is submitted.
  const form = document.getElementById('learn-form');
  if (form && hasQuestions && canAttempt) {
    const draft = readDraft(quiz.id);
    if (draft && draft.answers) {
      questions.forEach((q) => applyAnswer(q, draft.answers[q.id]));
      autosaveStamp(draft.savedAt);
    }
    let timer = null;
    const persist = () => {
      const answers = {};
      questions.forEach((q) => {
        answers[q.id] = collectAnswer(q);
      });
      saveDraft(quiz.id, answers);
      autosaveStamp();
    };
    form.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(persist, 400);
    });
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// fromCourseId (optional): when a quiz is opened from inside a course, "back"
// returns to that course rather than the home list.
async function openQuiz(quizId, fromCourseId) {
  learnState.returnCourseId = fromCourseId != null ? Number(fromCourseId) : null;
  const view = document.getElementById('learn-view');
  view.innerHTML = '<div class="skeleton-card"><span class="skeleton-loader skeleton-row short"></span><span class="skeleton-loader skeleton-row"></span><span class="skeleton-loader skeleton-row medium"></span></div>';
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(learnStudentId)}/quizzes/${encodeURIComponent(quizId)}`);
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.locked) {
      // Belongs to a paid course the student hasn't enrolled in — send them to
      // the course to buy it.
      if (data.courseId) {
        openCourse(data.courseId);
        return;
      }
      throw new Error(data.message || 'ต้องลงทะเบียนคอร์สก่อน');
    }
    if (!res.ok) throw new Error(data.message || 'load failed');
    learnState.current = { quiz: data.quiz, questions: data.questions || [], prior: data.prior || { canAttempt: true } };
    learnState.startedAt = new Date().toISOString();
    renderQuiz();
  } catch (err) {
    console.error('openQuiz:', err);
    view.innerHTML = `<div class="learn-empty"><i class="fas fa-triangle-exclamation"></i><p>เปิดแบบทดสอบไม่สำเร็จ</p><button type="button" class="btn-learn-primary" onclick="backToList()">กลับไปยังรายการ</button></div>`;
  }
}

// Read the answer the student gave for one question straight from the DOM,
// in the shape the Worker's grader expects per type.
function collectAnswer(q) {
  const name = `q_${q.id}`;
  if (q.type === 'single') {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? Number(el.value) : null;
  }
  if (q.type === 'multiple') {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => Number(el.value));
  }
  if (q.type === 'truefalse') {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value === 'true' : null;
  }
  const el = document.querySelector(`input[name="${name}"]`);
  return el ? el.value : '';
}

async function submitQuiz() {
  const { quiz, questions } = learnState.current;
  const answers = {};
  let unanswered = 0;
  questions.forEach((q) => {
    const a = collectAnswer(q);
    answers[q.id] = a;
    const empty = a === null || a === '' || (Array.isArray(a) && a.length === 0);
    if (empty) unanswered += 1;
  });

  if (unanswered > 0) {
    const proceed = window.confirm(`ยังมีคำถามที่ยังไม่ได้ตอบ ${unanswered} ข้อ ต้องการส่งคำตอบเลยหรือไม่?`);
    if (!proceed) return;
  }

  const btn = document.querySelector('.learn-submit-bar .btn-learn-primary');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตรวจ...';
  }

  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(learnStudentId)}/quizzes/${encodeURIComponent(quiz.id)}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ answers, startedAt: learnState.startedAt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'ส่งคำตอบไม่สำเร็จ');
    // Uploaded to the cloud successfully — the on-device draft is now
    // redundant, so drop it (a retake starts a fresh draft).
    clearDraft(quiz.id);
    showResult(data);
  } catch (err) {
    console.error('submitQuiz:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> ส่งคำตอบ';
    }
    window.alert(err.message || 'ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่');
  }
}

function showResult(result) {
  const { questions } = learnState.current;
  const byId = {};
  (result.breakdown || []).forEach((b) => {
    byId[b.id] = b;
  });

  // Annotate each question in place with correct/incorrect + explanation.
  if (result.showAnswers) {
    questions.forEach((q) => {
      const b = byId[q.id];
      const wrap = document.getElementById(`qwrap_${q.id}`);
      const fb = document.getElementById(`fb_${q.id}`);
      if (!wrap || !b) return;
      wrap.classList.add(b.correct ? 'is-correct' : 'is-wrong');
      let msg = b.correct
        ? '<i class="fas fa-circle-check"></i> ถูกต้อง'
        : '<i class="fas fa-circle-xmark"></i> ยังไม่ถูก';
      if (!b.correct && b.correctAnswer != null) {
        msg += ` · เฉลย: ${escapeHtml(formatCorrect(q, b.correctAnswer))}`;
      }
      if (b.explanation) msg += `<div class="learn-explain">${mdToHtml(b.explanation)}</div>`;
      if (fb) fb.innerHTML = msg;
    });
  }

  // Lock the form after submitting.
  document.querySelectorAll('#learn-form input').forEach((el) => {
    el.disabled = true;
  });
  const bar = document.querySelector('.learn-submit-bar');
  if (bar) bar.remove();

  const passClass = result.passed ? 'learn-result--pass' : 'learn-result--fail';
  const canRetake = learnState.current.quiz.allowRetake === 1;
  const box = document.getElementById('learn-result');
  if (box) {
    box.innerHTML = `
      <div class="learn-result ${passClass}">
        <div class="learn-result__score">${result.score} / ${result.maxScore}</div>
        <div class="learn-result__percent">${result.percent}%</div>
        <div class="learn-result__verdict">${result.passed ? '<i class="fas fa-trophy"></i> ผ่านเกณฑ์!' : '<i class="fas fa-face-thinking"></i> ยังไม่ผ่านเกณฑ์'}</div>
        <div class="learn-result__actions">
          ${canRetake ? '<button type="button" class="btn-learn-primary" onclick="openQuiz(' + Number(learnState.current.quiz.id) + ')"><i class="fas fa-rotate-right"></i> ทำอีกครั้ง</button>' : ''}
          <button type="button" class="btn-learn-ghost" onclick="backToList()">กลับไปยังรายการ</button>
        </div>
      </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Human-readable form of the correct answer for the feedback line.
function formatCorrect(q, correct) {
  if (q.type === 'single') return q.options[correct] != null ? q.options[correct] : String(correct);
  if (q.type === 'multiple') return (Array.isArray(correct) ? correct : []).map((i) => q.options[i]).filter(Boolean).join(', ');
  if (q.type === 'truefalse') return TF_LABEL[String(correct)] || String(correct);
  return Array.isArray(correct) ? correct.join(' / ') : String(correct);
}

function backToList() {
  learnState.current = null;
  // Returning from a course quiz goes back to that course; otherwise home.
  if (learnState.returnCourseId != null) {
    const courseId = learnState.returnCourseId;
    learnState.returnCourseId = null;
    openCourse(courseId);
    return;
  }
  loadHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Expose the handlers referenced by inline onclick (learn.js is a classic
// script, so these are already global, but assigning explicitly documents
// the surface and survives future bundling).
window.openQuiz = openQuiz;
window.submitQuiz = submitQuiz;
window.backToList = backToList;
window.openCourse = openCourse;
window.buyCourse = buyCourse;
window.backHome = backHome;

/* ---------------- Boot ---------------- */

window.onload = async () => {
  updateThemeIcons(document.documentElement.getAttribute('data-theme'));

  const studentId = await resolveAuthedStudentId();
  if (!studentId) {
    // Not signed in — the portal entry page handles login.
    window.location.replace('student');
    return;
  }
  learnStudentId = studentId;

  document.getElementById('student-dashboard').style.display = 'block';
  initStudentHamburger();
  if (typeof initAIChatWidget === 'function') initAIChatWidget(studentId);

  // Coming back from a successful Stripe checkout: enrollment is granted by
  // the webhook, which may land a moment after the redirect, so tell the
  // student and reload shortly after.
  const params = new URLSearchParams(window.location.search);
  if (params.get('paid') === '1') {
    window.history.replaceState({}, '', 'learn');
    if (typeof window.litalkToast === 'function') window.litalkToast('ชำระเงินสำเร็จ! กำลังปลดล็อกคอร์สให้คุณ');
    setTimeout(loadHome, 2500);
  }

  loadHome();
};
