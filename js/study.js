/* ============================================================
   LITALK — On-demand student dashboard (study.html)
   For self-registered "on demand" learners (any email). Three tabs:
     • หน้าหลัก (home)  — progress on enrolled courses + recommended
     • สิ่งที่ต้องทำ (to-do) — lessons/tests not yet done (renamable)
     • หน้าตัวเอง (me)  — profile, completed & enrolled courses, receipts,
                          account settings
   Depends on js/student-portal.js for the shared Auth0/session plumbing:
   getPortalToken(), resolveAuthedStudentId(), dataApiUrl, escapeHtml(),
   toggleTheme(), logout(), initStudentHamburger(), updateThemeIcons(),
   window.litalkAccountType, and window.litalkMarkdown().
   ============================================================ */

let sdStudentId = null;
const sdState = { data: null };

const TODO_LABEL_KEY = 'litalk_todo_label';
const DEFAULT_TODO_LABEL = 'สิ่งที่ต้องทำ';
const KIND_LABEL = { pretest: 'แบบทดสอบก่อนเรียน', posttest: 'แบบทดสอบหลังเรียน', lesson: 'บทเรียน' };

function todoLabel() {
  try {
    return localStorage.getItem(TODO_LABEL_KEY) || DEFAULT_TODO_LABEL;
  } catch {
    return DEFAULT_TODO_LABEL;
  }
}

async function authedFetch(path, options = {}) {
  const token = await getPortalToken();
  if (!token) throw new Error('unauthenticated');
  const headers = Object.assign({ Authorization: `Bearer ${token}` }, options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(`${dataApiUrl}${path}`, Object.assign({}, options, { headers }));
}

function priceLabel(priceSatang) {
  const n = Number(priceSatang) || 0;
  return n <= 0 ? 'ฟรี' : '฿' + (n / 100).toLocaleString('en-US');
}

function avatarHtml(name, hasAvatar) {
  if (hasAvatar) {
    return `<img class="sd-avatar" src="${dataApiUrl}/portal/${encodeURIComponent(sdStudentId)}/avatar?v=${Date.now()}" alt="">`;
  }
  const initial = (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  return `<div class="sd-avatar sd-avatar--initial">${escapeHtml(initial)}</div>`;
}

/* ---------------- Home ---------------- */

function progressCardHtml(c) {
  return `
    <div class="sd-card">
      <div class="sd-card__head">
        <h3 class="sd-card__title">${escapeHtml(c.title)}</h3>
        <span class="sd-pct">${c.progressPct}%</span>
      </div>
      <div class="sd-bar"><span style="width:${c.progressPct}%"></span></div>
      <div class="sd-card__meta">
        <i class="fas fa-circle-check"></i> ${c.done}/${c.total} รายการ
        ${c.avgScore != null ? ` · <i class="fas fa-star"></i> คะแนนเฉลี่ย ${c.avgScore}%` : ''}
      </div>
      <a class="sd-btn" href="learn?course=${Number(c.courseId)}">
        ${c.progressPct >= 100 ? 'ทบทวน' : 'เรียนต่อ'} <i class="fas fa-arrow-right"></i>
      </a>
    </div>`;
}

function recCardHtml(c) {
  const title = escapeHtml(c.titleTh || c.title || 'คอร์ส');
  const desc = escapeHtml(c.descriptionTh || c.description || '');
  return `
    <div class="sd-rec">
      <div class="sd-rec__body">
        <h4 class="sd-rec__title">${title}</h4>
        ${desc ? `<p class="sd-rec__desc">${desc}</p>` : ''}
        <div class="sd-rec__meta">${Number(c.itemCount) || 0} บทเรียน · ${priceLabel(c.priceSatang)}</div>
      </div>
      <a class="sd-btn sd-btn--ghost" href="learn?course=${Number(c.id)}">ดูคอร์ส</a>
    </div>`;
}

function renderHome() {
  const d = sdState.data;
  const el = document.getElementById('tab-home');
  const enrolled = d.enrolled || [];
  const rec = d.recommended || [];

  const greeting = `<div class="sd-hello">สวัสดี, <strong>${escapeHtml(d.student.name || 'ผู้เรียน')}</strong> 👋</div>`;

  let progress;
  if (!enrolled.length) {
    progress = `
      <div class="sd-empty">
        <i class="fas fa-graduation-cap"></i>
        <p>คุณยังไม่ได้ลงทะเบียนคอร์สใด ๆ</p>
        <a class="sd-btn" href="courses">เลือกคอร์สเรียน</a>
      </div>`;
  } else {
    progress = `<div class="sd-grid">${enrolled.map(progressCardHtml).join('')}</div>`;
  }

  const recSection = rec.length
    ? `<h2 class="sd-section-title"><i class="fas fa-wand-magic-sparkles"></i> คอร์สแนะนำ</h2>
       <div class="sd-rec-list">${rec.map(recCardHtml).join('')}</div>`
    : '';

  el.innerHTML = `
    ${greeting}
    <h2 class="sd-section-title"><i class="fas fa-chart-line"></i> ความคืบหน้าการเรียน</h2>
    ${progress}
    ${recSection}`;
}

/* ---------------- To-do ---------------- */

function todoItemHtml(it) {
  const reason = it.reason === 'not_started' ? 'ยังไม่ได้เริ่ม' : 'ยังไม่ผ่าน';
  const kind = KIND_LABEL[it.kind] || 'บทเรียน';
  const locked = !!it.locked;
  return `
    <div class="sd-todo${locked ? ' is-locked' : ''}">
      <span class="sd-todo__icon"><i class="fas ${it.hasVideo ? 'fa-play' : it.kind === 'lesson' ? 'fa-book-open' : 'fa-clipboard-question'}"></i></span>
      <div class="sd-todo__main">
        <div class="sd-todo__title">${escapeHtml(it.title || kind)}</div>
        <div class="sd-todo__meta">${escapeHtml(it.courseTitle)} · ${kind} · ${reason}</div>
      </div>
      ${locked
        ? '<span class="sd-lock" title="ปลดล็อกเมื่อทำขั้นตอนก่อนหน้าเสร็จ"><i class="fas fa-lock"></i></span>'
        : `<a class="sd-btn sd-btn--sm" href="learn?course=${Number(it.courseId)}">ไปทำ</a>`}
    </div>`;
}

function renderTodo() {
  const d = sdState.data;
  const el = document.getElementById('tab-todo');
  const items = d.todo || [];
  const header = `
    <div class="sd-todo-head">
      <h2 class="sd-section-title" id="todo-title"><i class="fas fa-list-check"></i> <span id="todo-label">${escapeHtml(todoLabel())}</span></h2>
      <button type="button" class="sd-icon-btn" id="todo-rename" title="เปลี่ยนชื่อ"><i class="fas fa-pen"></i></button>
    </div>
    <p class="sd-section-sub">บทเรียนและแบบทดสอบที่ยังไม่ได้เรียนหรือยังไม่ผ่าน</p>`;

  if (!items.length) {
    el.innerHTML = `${header}
      <div class="sd-empty"><i class="fas fa-circle-check"></i><p>เยี่ยมมาก! ไม่มีสิ่งที่ต้องทำค้างอยู่</p></div>`;
  } else {
    el.innerHTML = `${header}<div class="sd-todo-list">${items.map(todoItemHtml).join('')}</div>`;
  }

  const renameBtn = document.getElementById('todo-rename');
  if (renameBtn) {
    renameBtn.addEventListener('click', () => {
      const next = window.prompt('ตั้งชื่อหน้านี้', todoLabel());
      if (next && next.trim()) {
        try { localStorage.setItem(TODO_LABEL_KEY, next.trim().slice(0, 40)); } catch { /* ignore */ }
        document.getElementById('todo-label').textContent = next.trim().slice(0, 40);
        const tab = document.querySelector('[data-tab-label="todo"]');
        if (tab) tab.textContent = next.trim().slice(0, 40);
      }
    });
  }
}

/* ---------------- Me / profile ---------------- */

function receiptRowHtml(r) {
  const date = r.paidDate ? new Date(r.paidDate).toLocaleDateString('th-TH') : '';
  const amount = r.free ? 'ฟรี' : '฿' + Number(r.amount || 0).toLocaleString('en-US');
  const receipt = r.receiptUrl
    ? `<a class="sd-btn sd-btn--ghost sd-btn--sm" href="${escapeHtml(r.receiptUrl)}" target="_blank" rel="noopener">ใบเสร็จ</a>`
    : (r.free ? '' : '<span class="sd-muted sd-btn--sm">—</span>');
  return `
    <div class="sd-receipt">
      <div class="sd-receipt__main">
        <div class="sd-receipt__title">${escapeHtml(r.title)}</div>
        <div class="sd-receipt__meta">${date}</div>
      </div>
      <span class="sd-receipt__amt">${amount}</span>
      ${receipt}
    </div>`;
}

function renderMe() {
  const d = sdState.data;
  const el = document.getElementById('tab-me');
  const s = d.student;
  const completed = d.completed || [];
  const enrolled = d.enrolled || [];
  const receipts = d.receipts || [];

  el.innerHTML = `
    <div class="sd-profile">
      ${avatarHtml(s.name, s.hasAvatar)}
      <div class="sd-profile__info">
        <div class="sd-profile__name" id="me-name">${escapeHtml(s.name || 'ผู้เรียน')}</div>
        <div class="sd-profile__email">${escapeHtml(s.email || '')}</div>
        <div class="sd-profile__stats">
          <span><strong>${completed.length}</strong> คอร์สที่สำเร็จ</span>
          <span><strong>${enrolled.length}</strong> คอร์สที่ลงทะเบียน</span>
        </div>
      </div>
      <div class="sd-profile__actions">
        <button type="button" class="sd-btn sd-btn--ghost sd-btn--sm" id="me-edit-name"><i class="fas fa-pen"></i> แก้ไขชื่อ</button>
        <button type="button" class="sd-btn sd-btn--ghost sd-btn--sm" id="me-edit-photo"><i class="fas fa-camera"></i> เปลี่ยนรูป</button>
        <input type="file" accept="image/*" id="me-photo-input" style="display:none;">
      </div>
    </div>

    <h2 class="sd-section-title"><i class="fas fa-trophy"></i> คอร์สที่เรียนสำเร็จ</h2>
    ${completed.length
      ? `<div class="sd-grid">${completed.map(progressCardHtml).join('')}</div>`
      : '<p class="sd-section-sub">ยังไม่มีคอร์สที่เรียนสำเร็จ — สู้ ๆ นะ!</p>'}

    <h2 class="sd-section-title"><i class="fas fa-receipt"></i> คอร์สที่ลงทะเบียน & ใบเสร็จ</h2>
    ${receipts.length
      ? `<div class="sd-receipts">${receipts.map(receiptRowHtml).join('')}</div>`
      : '<p class="sd-section-sub">ยังไม่มีการลงทะเบียน</p>'}

    <h2 class="sd-section-title"><i class="fas fa-gear"></i> ตั้งค่าบัญชี</h2>
    <div class="sd-settings">
      <div class="sd-setting sd-soon">
        <div>
          <div class="sd-setting__title">เชื่อมบัญชี LITALK <span class="sd-badge sd-badge--soon">เร็ว ๆ นี้</span></div>
          <div class="sd-setting__sub">หากคุณเป็นนักเรียนตัวต่อตัวของ LITALK จะสามารถเชื่อมบัญชีเพื่อเข้าสู่ระบบด้วย LITALK Account หรืออีเมลส่วนตัวได้ — กำลังพัฒนา</div>
        </div>
        <button type="button" class="sd-btn sd-btn--ghost sd-btn--sm" disabled aria-disabled="true"><i class="fas fa-link"></i> เชื่อมบัญชี</button>
      </div>
      <button type="button" class="sd-btn sd-btn--danger" onclick="logout()"><i class="fas fa-arrow-right-from-bracket"></i> ออกจากระบบ</button>
    </div>`;

  wireProfileActions();
}

function wireProfileActions() {
  const editName = document.getElementById('me-edit-name');
  if (editName) {
    editName.addEventListener('click', async () => {
      const current = sdState.data.student.name || '';
      const next = window.prompt('ชื่อที่แสดง', current);
      if (!next || !next.trim() || next.trim() === current) return;
      try {
        const res = await authedFetch(`/portal/${encodeURIComponent(sdStudentId)}/profile`, {
          method: 'PATCH',
          body: JSON.stringify({ name: next.trim() }),
        });
        if (!res.ok) throw new Error('save failed');
        sdState.data.student.name = next.trim();
        document.getElementById('me-name').textContent = next.trim();
      } catch {
        window.alert('บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่');
      }
    });
  }

  const editPhoto = document.getElementById('me-edit-photo');
  const input = document.getElementById('me-photo-input');
  if (editPhoto && input) {
    editPhoto.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { window.alert('ไฟล์รูปใหญ่เกินไป (สูงสุด 5 MB)'); return; }
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await authedFetch(`/portal/${encodeURIComponent(sdStudentId)}/avatar`, { method: 'POST', body: form });
        if (!res.ok) throw new Error('upload failed');
        sdState.data.student.hasAvatar = true;
        renderMe();
      } catch {
        window.alert('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
      }
    });
  }
}

/* ---------------- Tabs ---------------- */

function showTab(name) {
  const tabs = ['home', 'todo', 'me'];
  const active = tabs.includes(name) ? name : 'home';
  tabs.forEach((t) => {
    const sec = document.getElementById(`tab-${t}`);
    if (sec) sec.hidden = t !== active;
  });
  document.querySelectorAll('[data-tab]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-tab') === active);
    if (a.getAttribute('data-tab') === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try { window.history.replaceState({}, '', active === 'home' ? 'study' : `study?tab=${active}`); } catch { /* ignore */ }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.sdShowTab = showTab;

/* ---------------- Boot ---------------- */

window.onload = async () => {
  updateThemeIcons(document.documentElement.getAttribute('data-theme'));

  const studentId = await resolveAuthedStudentId();
  if (!studentId) {
    window.location.replace('student');
    return;
  }
  // Tutored students belong on the classic portal, not here.
  if (window.litalkAccountType && window.litalkAccountType !== 'on_demand') {
    window.location.replace('student');
    return;
  }
  sdStudentId = studentId;

  // If they arrived here right after registering to buy a specific course
  // (public catalogue → learn?course=id → sign-up → provisioned → here),
  // finish that hand-off by opening the course.
  try {
    const pending = localStorage.getItem('litalk_pending_course');
    if (pending) {
      localStorage.removeItem('litalk_pending_course');
      window.location.replace(`learn?course=${encodeURIComponent(pending)}`);
      return;
    }
  } catch { /* ignore */ }

  // 'flex' (not 'block') keeps the .dashboard-page flex column intact so the
  // content fills the height and the footer sits at the bottom with proper
  // spacing, instead of collapsing right under short content.
  document.getElementById('student-dashboard').style.display = 'flex';
  initStudentHamburger();

  // Reflect the (possibly renamed) to-do label in the nav.
  document.querySelectorAll('[data-tab-label="todo"]').forEach((n) => { n.textContent = todoLabel(); });

  const view = document.getElementById('tab-home');
  view.innerHTML = '<div class="skeleton-card"><span class="skeleton-loader skeleton-row short"></span><span class="skeleton-loader skeleton-row"></span></div>';

  try {
    const res = await authedFetch(`/portal/${encodeURIComponent(studentId)}/dashboard`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'load failed');
    sdState.data = data;
    renderHome();
    renderTodo();
    renderMe();
    const tab = new URLSearchParams(window.location.search).get('tab');
    showTab(tab || 'home');
  } catch (err) {
    console.error('study dashboard:', err);
    view.innerHTML = '<div class="sd-empty"><i class="fas fa-triangle-exclamation"></i><p>โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p></div>';
  }
};
