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
  quizzes: [],
  current: null, // { quiz, questions, prior }
  startedAt: null,
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

function renderList() {
  const view = document.getElementById('learn-view');
  const quizzes = learnState.quizzes;
  if (!quizzes.length) {
    view.innerHTML = `
      <div class="learn-empty">
        <i class="fas fa-clipboard-list"></i>
        <p>ยังไม่มีบทเรียนหรือแบบทดสอบในขณะนี้</p>
        <span>เมื่อครูเผยแพร่แบบทดสอบ จะปรากฏที่นี่ให้คุณทำได้ทันที</span>
      </div>`;
    return;
  }
  view.innerHTML = `<div class="learn-grid">${quizzes.map(quizCardHtml).join('')}</div>`;
}

async function loadQuizzes() {
  const view = document.getElementById('learn-view');
  view.innerHTML = '<div class="skeleton-card"><span class="skeleton-loader skeleton-row short"></span><span class="skeleton-loader skeleton-row"></span></div>';
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(learnStudentId)}/quizzes`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'load failed');
    learnState.quizzes = data.quizzes || [];
    renderList();
  } catch (err) {
    console.error('loadQuizzes:', err);
    view.innerHTML = `<div class="learn-empty"><i class="fas fa-triangle-exclamation"></i><p>โหลดรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p></div>`;
  }
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

async function openQuiz(quizId) {
  const view = document.getElementById('learn-view');
  view.innerHTML = '<div class="skeleton-card"><span class="skeleton-loader skeleton-row short"></span><span class="skeleton-loader skeleton-row"></span><span class="skeleton-loader skeleton-row medium"></span></div>';
  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(learnStudentId)}/quizzes/${encodeURIComponent(quizId)}`);
    const data = await res.json().catch(() => ({}));
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
  renderList();
  loadQuizzes();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Expose the handlers referenced by inline onclick (learn.js is a classic
// script, so these are already global, but assigning explicitly documents
// the surface and survives future bundling).
window.openQuiz = openQuiz;
window.submitQuiz = submitQuiz;
window.backToList = backToList;

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

  loadQuizzes();
};
