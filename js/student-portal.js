/* ============================================================
   LITALK — Student Portal shared logic
   Used by: student.html (overview), student-study-log.html,
   student-payments.html.
   Handles auth/session plumbing, theme, mobile drawer and the
   renderers each portal page composes for its own layout.
   ============================================================ */

// Matches the Worker's AUTH0_AUDIENCE so getTokenSilently() returns a
// JWT the API can verify — required to unlock the student's private
// files and Google Meet links.
const filesApiAudience = 'https://admin.litalkeducation.com/files-api';

// The Auth0 SDK is loaded from CDN on every portal page; guard anyway so
// a failed CDN load degrades to the cookie-only flow instead of crashing.
const auth0Client = (typeof auth0 !== 'undefined')
    ? new auth0.Auth0Client({
        domain: 'auth.litalkeducation.com',
        clientId: 'NmKUxriv62IDG9yQQ3CZqkVp2ujkjdbp',
        // Refresh tokens (with rotation) + a localStorage cache keep
        // getTokenSilently() working in Safari/Firefox and other browsers
        // that block third-party cookies, where the default hidden-iframe
        // flow fails. This is what made the token fetch flaky.
        useRefreshTokens: true,
        useRefreshTokensFallback: true,
        cacheLocation: 'localstorage',
        authorizationParams: { redirect_uri: window.location.href.split('?')[0], audience: filesApiAudience }
    })
    : null;

// Cloudflare Worker API (D1 database) — replaces the old Google Apps
// Script / Google Sheets backend.
const dataApiUrl = 'https://litalk-files-api.n62c5gwghk.workers.dev';

// Best-effort access token for the portal. Present only when the student
// signed in through Auth0 (not the ?id= / cookie shortcut); the API uses
// it to release private data (files, Meet links). Returns null otherwise.
async function getPortalToken() {
    try {
        if (!auth0Client || !(await auth0Client.isAuthenticated())) return null;
        return await auth0Client.getTokenSilently({ authorizationParams: { audience: filesApiAudience } });
    } catch (err) {
        console.warn('Portal token unavailable:', err);
        return null;
    }
}

// Holds the current portal token so file-download handlers can reuse it.
let portalAuthToken = null;

// ---------- Cookie helpers ----------
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax; Secure";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure";
}

// ---------- Session ----------
const login = async () => { await auth0Client.loginWithRedirect(); };

const logout = async () => {
    deleteCookie('student_id');
    const returnTo = window.location.origin + '/student';
    const isAuthenticated = auth0Client ? await auth0Client.isAuthenticated() : false;
    if (isAuthenticated) {
        auth0Client.logout({ logoutParams: { returnTo } });
    } else {
        window.location.href = returnTo;
    }
};

// Resolve the student ID from ?id= (and persist it) or the cookie.
// Returns null when neither is present.
function resolvePortalStudentId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStudentId = urlParams.get('id');
    if (urlStudentId) {
        setCookie('student_id', urlStudentId, 30);
        // Clean the address bar by removing the query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        return urlStudentId;
    }
    return getCookie('student_id');
}

// ---------- Theme ----------
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
}

function updateThemeIcons(theme) {
    const loginIcon = document.getElementById('theme-toggle-icon');
    const dashIcon = document.getElementById('theme-toggle-icon-dash');
    const mobileIcon = document.getElementById('theme-toggle-icon-mobile');
    const mobileText = document.getElementById('theme-text-mobile');

    if (loginIcon) loginIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (dashIcon) dashIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (mobileIcon) mobileIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    if (mobileText) mobileText.innerText = theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด';
}

// ---------- Mobile hamburger drawer ----------
function initStudentHamburger() {
    const hamburger = document.getElementById('nav-hamburger');
    const drawer = document.getElementById('student-mobile-drawer');
    if (!hamburger || !drawer) return;

    // Reset state
    hamburger.classList.remove('open');
    drawer.setAttribute('data-open', 'false');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    // Toggle function
    window.toggleMobileDrawer = (forceClose = false) => {
        const isOpen = forceClose ? false : !hamburger.classList.contains('open');
        hamburger.classList.toggle('open', isOpen);
        drawer.setAttribute('data-open', String(isOpen));
        hamburger.setAttribute('aria-expanded', String(isOpen));
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileDrawer();
    });

    // Close drawer when clicking links
    const drawerLinks = drawer.querySelectorAll('.drawer-link');
    drawerLinks.forEach(link => {
        link.addEventListener('click', () => {
            toggleMobileDrawer(true);
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !drawer.contains(e.target)) {
            if (hamburger.classList.contains('open')) {
                toggleMobileDrawer(true);
            }
        }
    });

    // Close on resize if switching to desktop view
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            toggleMobileDrawer(true);
        }
    });
}

// ---------- Formatting helpers ----------
// Helper function to parse Thai/International dates robustly for sorting
function parseThaiDate(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.trim().split(/[\s/:\-]/);
    if (parts.length >= 3) {
        let day, month, year, hour = 0, minute = 0, second = 0;
        if (parts[2].length === 4) { // DD/MM/YYYY
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
        } else if (parts[0].length === 4) { // YYYY/MM/DD
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
        } else {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? new Date(0) : d;
        }

        if (parts.length >= 5) {
            hour = parseInt(parts[3], 10) || 0;
            minute = parseInt(parts[4], 10) || 0;
        }
        if (parts.length >= 6) {
            second = parseInt(parts[5], 10) || 0;
        }

        // Adjust for Thai Buddhist calendar (BE) if needed
        if (year > 2400) {
            year = year - 543;
        }

        return new Date(year, month, day, hour, minute, second);
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

// The Worker returns plain YYYY-MM-DD dates and numeric amounts;
// format them for display in Thai.
function formatDisplayDate(dateStr) {
    const d = parseThaiDate(dateStr);
    if (!dateStr || d.getTime() === 0) return dateStr || '-';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatBaht(n) {
    if (n === null || n === undefined || n === '') return '-';
    const num = Number(n);
    return isNaN(num) ? String(n) : '฿' + num.toLocaleString('en-US');
}

// booking_time is the start of a fixed 1-hour slot (e.g. "09:00")
function formatTimeRange(timeStr) {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h)) return timeStr;
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(h)}:${pad(m || 0)} - ${pad((h + 1) % 24)}:${pad(m || 0)}`;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
}

function formatFileSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- Data fetching ----------
async function fetchPortalData(studentId) {
    // A token (when the student signed in via Auth0) unlocks private
    // data — files and Google Meet links — server-side.
    portalAuthToken = await getPortalToken();
    const headers = portalAuthToken ? { Authorization: `Bearer ${portalAuthToken}` } : {};
    const response = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(studentId)}`, { method: 'GET', headers });
    return response.json();
}

// ---------- Files ----------
// Downloads via fetch (not a plain link) because the endpoint needs the
// Auth0 Bearer token; the response is turned into a temporary blob URL.
async function downloadPortalFile(studentId, fileId, filename) {
    try {
        const res = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(studentId)}/files/${encodeURIComponent(fileId)}`, {
            headers: portalAuthToken ? { Authorization: `Bearer ${portalAuthToken}` } : {},
        });
        if (!res.ok) throw new Error('download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch {
        alert('ไม่สามารถดาวน์โหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
    }
}

function renderFiles(studentId, files) {
    const section = document.getElementById('section-files');
    const container = document.getElementById('files-container');
    if (!section || !container) return;
    if (!files || files.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';
    container.innerHTML = files.map((f) => {
        const sub = [f.fileType, formatFileSize(f.size), f.uploadedAt ? formatDisplayDate(f.uploadedAt) : '']
            .filter(Boolean).map(escapeHtml).join(' • ');
        const nameArg = JSON.stringify(String(f.filename)).replace(/"/g, '&quot;');
        return `
        <div class="file-item">
            <i class="fas fa-file-lines file-icon"></i>
            <div class="file-meta">
                <div class="file-name">${escapeHtml(f.filename)}</div>
                ${sub ? `<div class="file-sub">${sub}</div>` : ''}
            </div>
            <button type="button" class="btn-table-action"
                onclick="downloadPortalFile(${JSON.stringify(String(studentId)).replace(/"/g, '&quot;')}, ${JSON.stringify(String(f.id)).replace(/"/g, '&quot;')}, ${nameArg})">
                <i class="fas fa-download"></i> ดาวน์โหลด
            </button>
        </div>`;
    }).join('');
}

// ---------- Schedule ----------
function renderSchedule(container, schedule) {
    if (!container) return;
    if (!schedule || schedule.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="far fa-calendar-xmark"></i><p>ยังไม่มีตารางเรียนที่กำลังจะถึงในระบบ</p></div>';
        return;
    }

    // Only render the "join class" column when at least one upcoming
    // session actually has a Meet link (returned to signed-in students only).
    const anyMeet = schedule.some((s) => s.meet);
    let scheduleHtml = `
    <div class="table-wrapper">
        <table class="payment-table">
            <thead>
                <tr>
                    <th><i class="far fa-calendar-alt"></i> วันที่</th>
                    <th><i class="far fa-clock"></i> เวลาเรียน</th>
                    ${anyMeet ? '<th><i class="fas fa-video"></i> ห้องเรียน</th>' : ''}
                </tr>
            </thead>
            <tbody>`;

    schedule.forEach((session, index) => {
        const isNext = index === 0;
        const highlightClass = isNext ? ' class="newest-highlight"' : '';
        const nextBadge = isNext ? ` <span class="schedule-next-badge"><i class="fas fa-arrow-right"></i> ครั้งถัดไป</span>` : '';
        const meetCell = anyMeet
            ? `<td>${session.meet
                ? `<a href="${escapeHtml(session.meet)}" target="_blank" rel="noopener" class="btn-table-action"><i class="fas fa-video"></i> เข้าเรียน</a>`
                : '<span class="text-muted">-</span>'}</td>`
            : '';

        scheduleHtml += `
                <tr${highlightClass}>
                    <td><div class="table-time-cell">${formatDisplayDate(session.date)}${nextBadge}</div></td>
                    <td>${formatTimeRange(session.time)}</td>
                    ${meetCell}
                </tr>`;
    });

    scheduleHtml += `
            </tbody>
        </table>
    </div>`;
    container.innerHTML = scheduleHtml;
}

// ---------- Next class spotlight ----------
// The API returns schedule[] soonest-first with `date` (may be a Thai
// Buddhist-era string), `time` (start of a fixed 1-hour slot) and an
// auth-gated `meet` link.
function getScheduleStart(session) {
    if (!session) return null;
    const d = parseThaiDate(session.date);
    if (d.getTime() === 0) return null;
    const [h, m] = String(session.time || '').split(':').map(Number);
    if (Number.isFinite(h)) d.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
    return d;
}

// Google Calendar template link with floating local times pinned to
// Asia/Bangkok — avoids UTC conversion bugs and works on iOS where
// .ics data URIs are unreliable.
function buildGoogleCalendarUrl(session) {
    const start = getScheduleStart(session);
    if (!start) return null;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const pad = (v) => String(v).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: 'คลาสเรียน LITALK Education',
        dates: `${fmt(start)}/${fmt(end)}`,
        ctz: 'Asia/Bangkok',
        details: session.meet ? `เข้าเรียนผ่าน Google Meet: ${session.meet}` : 'คลาสเรียนกับ LITALK Education',
    });
    if (session.meet) params.set('location', session.meet);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getRelativeDayLabel(date) {
    if (!date) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / 86400000);
    if (diffDays === 0) return 'วันนี้';
    if (diffDays === 1) return 'พรุ่งนี้';
    if (diffDays > 1) return `อีก ${diffDays} วัน`;
    return '';
}

function renderNextClass(container, schedule) {
    if (!container) return;
    if (!schedule || schedule.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    const next = schedule[0];
    const start = getScheduleStart(next);
    const relative = start ? getRelativeDayLabel(start) : '';
    const calendarUrl = buildGoogleCalendarUrl(next);
    // The Meet link is only present for Auth0-authenticated students;
    // cookie/?id= sessions get a hint instead of a dead button.
    const joinAction = next.meet
        ? `<a href="${escapeHtml(next.meet)}" target="_blank" rel="noopener" class="btn-join-class"><i class="fas fa-video"></i> เข้าห้องเรียน</a>`
        : `<span class="next-class-join-hint"><i class="fas fa-lock"></i> เข้าสู่ระบบด้วยบัญชี LITALK เพื่อรับลิงก์เข้าเรียน</span>`;

    container.style.display = '';
    container.innerHTML = `
    <div class="next-class-card">
        <div class="next-class-date-badge">
            <span class="next-class-day">${start ? start.getDate() : '-'}</span>
            <span class="next-class-month">${start ? escapeHtml(start.toLocaleDateString('th-TH', { month: 'short' })) : ''}</span>
        </div>
        <div class="next-class-meta">
            <span class="next-class-title">คลาสเรียนครั้งถัดไป${relative ? ` <span class="next-class-relative">${escapeHtml(relative)}</span>` : ''}</span>
            <span class="next-class-time"><i class="far fa-calendar-alt"></i> ${formatDisplayDate(next.date)} · <i class="far fa-clock"></i> ${formatTimeRange(next.time)}</span>
        </div>
        <div class="next-class-actions">
            ${joinAction}
            ${calendarUrl ? `<a href="${escapeHtml(calendarUrl)}" target="_blank" rel="noopener" class="btn-add-calendar"><i class="far fa-calendar-plus"></i> เพิ่มลงปฏิทิน</a>` : ''}
        </div>
    </div>`;
}

// Mobile floating action button (#fab-join). Markup ships with the LINE
// support link as the fallback; upgrade it once schedule data arrives.
function updateFab(schedule) {
    const fab = document.getElementById('fab-join');
    if (!fab) return;
    const next = schedule && schedule[0];
    if (next && next.meet) {
        fab.href = next.meet;
        fab.target = '_blank';
        fab.rel = 'noopener';
        fab.innerHTML = '<i class="fas fa-video"></i>';
        fab.setAttribute('aria-label', 'เข้าเรียนคลาสถัดไป');
    } else if (schedule && schedule.length > 0) {
        fab.href = 'student#section-schedule';
        fab.removeAttribute('target');
        fab.innerHTML = '<i class="fas fa-calendar-days"></i>';
        fab.setAttribute('aria-label', 'ดูตารางเรียนที่จะถึง');
    }
}

// ---------- Dropdown menus (<details class="menu-dropdown">) ----------
// Native <details> gives keyboard toggling for free; add outside-click
// and Escape-to-close (returning focus to the trigger) plus
// only-one-open-at-a-time behaviour.
function initDropdowns() {
    const dropdowns = document.querySelectorAll('details.menu-dropdown');
    if (!dropdowns.length) return;
    dropdowns.forEach((dd) => {
        dd.addEventListener('toggle', () => {
            if (!dd.open) return;
            dropdowns.forEach((other) => {
                if (other !== dd) other.open = false;
            });
        });
    });
    document.addEventListener('click', (e) => {
        dropdowns.forEach((dd) => {
            if (dd.open && !dd.contains(e.target)) dd.open = false;
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        dropdowns.forEach((dd) => {
            if (!dd.open) return;
            dd.open = false;
            const summary = dd.querySelector('summary');
            if (summary) summary.focus();
        });
    });
}

// ---------- Pending payments ----------
function renderPendingPayments(section, container, pendingPayments) {
    if (!section || !container) return;
    if (!pendingPayments || pendingPayments.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';
    container.innerHTML = pendingPayments.map((link) => `
    <div class="pending-payment-item">
        <div class="pending-payment-info">
            <span class="pending-payment-desc">${escapeHtml(link.description || 'รายการชำระเงิน')}</span>
            <span class="pending-payment-amount">${formatBaht(link.amount)}</span>
        </div>
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener" class="btn-pay-now"><i class="fab fa-stripe-s"></i> ชำระเงิน</a>
    </div>`).join('');
}

// ---------- Study logs ----------
// Renders the study log timeline. Options:
//   limit        — show only the newest N logs (dashboard preview)
//   moreHref     — when limited and there are more logs, append a
//                  "view all" link pointing at the full page
//   groupByMonth — insert a month header whenever the (Thai) month of
//                  the log changes (used by the full study-log page)
// Long feedback is collapsed behind a "read more" toggle so one verbose
// log doesn't force endless scrolling (most useful on mobile).
function renderStudyLogs(container, studyLogs, options = {}) {
    if (!container) return;
    const { limit, moreHref, groupByMonth } = options;

    if (!studyLogs || studyLogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="far fa-folder-open"></i><p>ยังไม่มีบันทึกประวัติการเรียนในระบบ</p></div>';
        return;
    }

    // Sort study logs: newest first
    const logs = [...studyLogs].sort((a, b) => parseThaiDate(b.timestamp) - parseThaiDate(a.timestamp));
    const shown = limit ? logs.slice(0, limit) : logs;

    const monthKey = (log) => {
        const d = parseThaiDate(log.timestamp);
        return d.getTime() === 0 ? 'ไม่ระบุเดือน' : d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    };
    let monthCounts = null;
    if (groupByMonth) {
        monthCounts = new Map();
        shown.forEach((log) => {
            const key = monthKey(log);
            monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
        });
    }
    let currentMonth = null;

    let studyHtml = `<div class="timeline-container">`;
    shown.forEach((log, index) => {
        if (groupByMonth) {
            const key = monthKey(log);
            if (key !== currentMonth) {
                currentMonth = key;
                studyHtml += `
        <div class="timeline-month-header">${escapeHtml(key)} <span class="timeline-month-count">${monthCounts.get(key)} คลาส</span></div>`;
            }
        }
        const hasVideo = log.video && log.video.startsWith('http');
        const videoButton = hasVideo
            ? `<a href="${escapeHtml(log.video)}" target="_blank" rel="noopener" class="timeline-video-btn"><i class="fas fa-play-circle"></i> ดูวิดีโอย้อนหลัง</a>`
            : `<span class="timeline-video-none"><i class="fas fa-video-slash"></i> ไม่มีวิดีโอย้อนหลัง</span>`;

        const isNewest = index === 0;
        const highlightClass = isNewest ? ' newest-highlight' : '';
        const newestBadge = isNewest ? `<span class="latest-badge" style="margin-left: 8px;"><i class="fas fa-star"></i> ล่าสุด</span>` : '';

        studyHtml += `
        <div class="timeline-item">
            <div class="timeline-badge"><i class="fas fa-book-open"></i></div>
            <div class="timeline-card${highlightClass}">
                <div class="timeline-header">
                    <span class="timeline-date"><i class="far fa-calendar-alt"></i> ${formatDisplayDate(log.timestamp)} ${newestBadge}</span>
                    ${hasVideo ? '<span class="status-badge success-badge"><i class="fas fa-video"></i> วิดีโอพร้อมเรียน</span>' : ''}
                </div>
                <div class="timeline-feedback">
                    ${log.feedback ? marked.parse(log.feedback) : '-'}
                </div>
                <div class="timeline-footer">
                    ${videoButton}
                </div>
            </div>
        </div>`;
    });
    studyHtml += `</div>`;

    if (limit && logs.length > shown.length && moreHref) {
        studyHtml += `
        <div class="section-footer-link">
            <a href="${moreHref}"><i class="fas fa-clipboard-list"></i> ดูบันทึกการเรียนทั้งหมด ${logs.length} คลาส <i class="fas fa-arrow-right"></i></a>
        </div>`;
    }

    container.innerHTML = studyHtml;
    applyFeedbackClamp(container);
}

// Collapse feedback blocks taller than the CSS max-height and add a toggle.
function applyFeedbackClamp(container) {
    const CLAMP_HEIGHT = 240; // keep in sync with .timeline-feedback.clamped
    container.querySelectorAll('.timeline-feedback').forEach((el) => {
        if (el.scrollHeight <= CLAMP_HEIGHT + 60) return; // not worth clamping
        el.classList.add('clamped');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'read-more-btn';
        btn.innerHTML = '<i class="fas fa-chevron-down"></i> อ่านเพิ่มเติม';
        btn.addEventListener('click', () => {
            const collapsed = el.classList.toggle('clamped');
            btn.innerHTML = collapsed
                ? '<i class="fas fa-chevron-down"></i> อ่านเพิ่มเติม'
                : '<i class="fas fa-chevron-up"></i> แสดงน้อยลง';
        });
        el.insertAdjacentElement('afterend', btn);
    });
}

// ---------- Payment history ----------
function paymentMethodIcon(method) {
    if (!method) return '<i class="fas fa-credit-card"></i>';
    if (method.includes('โอน')) return '<i class="fas fa-university"></i>';
    if (method.includes('เงินสด')) return '<i class="fas fa-money-bill-wave"></i>';
    if (method.includes('Stripe')) return '<i class="fab fa-stripe-s"></i>';
    return '<i class="fas fa-credit-card"></i>';
}

// Renders payment history as a table (desktop) plus a stacked card list
// that CSS swaps in on small screens where the table is unreadable.
// Options mirror renderStudyLogs: { limit, moreHref }.
function renderPayments(container, payments, options = {}) {
    if (!container) return;
    const { limit, moreHref } = options;

    if (!payments || payments.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="far fa-folder-open"></i><p>ยังไม่มีประวัติการชำระเงินในระบบ</p></div>';
        return;
    }

    // Sort payments: newest first
    const rows = [...payments].sort((a, b) => parseThaiDate(b.timestamp) - parseThaiDate(a.timestamp));
    const shown = limit ? rows.slice(0, limit) : rows;

    let tableHtml = `
    <div class="table-wrapper">
        <table class="payment-table">
            <thead>
                <tr>
                    <th><i class="far fa-clock"></i> วันที่/เวลา</th>
                    <th><i class="fas fa-wallet"></i> ช่องทาง</th>
                    <th><i class="fas fa-coins"></i> ยอดรวม</th>
                    <th><i class="fas fa-file-invoice"></i> หลักฐาน</th>
                </tr>
            </thead>
            <tbody>`;
    let cardsHtml = `<div class="payment-card-list">`;

    shown.forEach((pay, index) => {
        const proofContent = (pay.proof && pay.proof.startsWith('http'))
            ? `<a href="${escapeHtml(pay.proof)}" target="_blank" rel="noopener" class="btn-table-action"><i class="fas fa-receipt"></i> ดูใบเสร็จ</a>`
            : `<span class="text-muted">${escapeHtml(pay.proof || '-')}</span>`;

        const method = pay.method || '';
        const methodIcon = paymentMethodIcon(method);
        const methodBadge = `<span class="payment-method-badge">${methodIcon} ${escapeHtml(method || '-')}</span>`;

        const isNewest = index === 0;
        const newestBadge = isNewest ? ` <span class="latest-badge" style="margin-left: 8px;"><i class="fas fa-star"></i> ล่าสุด</span>` : '';

        tableHtml += `
                <tr${isNewest ? ' class="newest-highlight"' : ''}>
                    <td><div class="table-time-cell">${formatDisplayDate(pay.timestamp)}${newestBadge}</div></td>
                    <td>${methodBadge}</td>
                    <td><span class="payment-amount">${formatBaht(pay.total)}</span></td>
                    <td>${proofContent}</td>
                </tr>`;

        cardsHtml += `
        <div class="payment-card${isNewest ? ' newest-highlight' : ''}">
            <div class="payment-card-top">
                <span class="payment-card-date"><i class="far fa-calendar-alt"></i> ${formatDisplayDate(pay.timestamp)}${newestBadge}</span>
                <span class="payment-card-amount">${formatBaht(pay.total)}</span>
            </div>
            <div class="payment-card-bottom">
                ${methodBadge}
                ${proofContent}
            </div>
        </div>`;
    });

    tableHtml += `
            </tbody>
        </table>
    </div>`;
    cardsHtml += `</div>`;

    let html = `<div class="payment-history-block">${tableHtml}${cardsHtml}</div>`;

    if (limit && rows.length > shown.length && moreHref) {
        html += `
        <div class="section-footer-link">
            <a href="${moreHref}"><i class="fas fa-receipt"></i> ดูประวัติการชำระเงินทั้งหมด ${rows.length} รายการ <i class="fas fa-arrow-right"></i></a>
        </div>`;
    }

    container.innerHTML = html;
}

// ---------- AI chat assistant ----------
// Shared by students and parents alike — the portal has no separate parent
// login, so anyone with the student's portal link reaches this the same way
// they reach the rest of the dashboard (see resolvePortalStudentId).
let aiChatConversationId = null;
let aiChatStudentId = null;
let aiChatBusy = false;

function initAIChatWidget(studentId) {
    aiChatStudentId = studentId;
    const fab = document.getElementById('ai-chat-fab');
    if (fab) fab.style.display = 'flex';

    const messages = document.getElementById('ai-chat-messages');
    const scrollBtn = document.getElementById('ai-chat-scroll-btn');
    if (messages && scrollBtn && !messages.dataset.scrollBtnBound) {
        messages.dataset.scrollBtnBound = '1';
        messages.addEventListener('scroll', () => {
            const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 60;
            scrollBtn.classList.toggle('show', !nearBottom);
        });
    }
}

function toggleAIChat(force) {
    const panel = document.getElementById('ai-chat-panel');
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (open) {
        const input = document.getElementById('ai-chat-input');
        if (input) input.focus();
        const messages = document.getElementById('ai-chat-messages');
        if (messages && !messages.querySelector('.ai-chat-msg, .ai-chat-msg-row')) {
            appendAIChatMessage('assistant', 'สวัสดีค่ะ หนูชื่อน้องลิลลี่ ถามเกี่ยวกับตารางเรียน เครดิตคงเหลือ หรือการชำระเงินของคุณได้เลยค่ะ');
        }
    }
}

function startNewAIChat() {
    aiChatConversationId = null;
    const messages = document.getElementById('ai-chat-messages');
    if (!messages) return;
    messages.querySelectorAll('.ai-chat-msg, .ai-chat-msg-row').forEach((el) => el.remove());
    appendAIChatMessage('assistant', 'สวัสดีค่ะ หนูชื่อน้องลิลลี่ เริ่มการสนทนาใหม่แล้วนะคะ ถามอะไรได้เลย');
}

function scrollAIChatToBottom() {
    const messages = document.getElementById('ai-chat-messages');
    if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
}

// Minimal, safe Markdown-to-HTML for AI replies: escapes HTML first, then
// re-introduces only the small set of patterns LLMs actually use in chat
// answers (bold, italic, inline/fenced code, links, lists, paragraphs).
// Not a full CommonMark parser by design.
function renderChatMarkdown(text) {
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = (s) => escapeHtml(s)
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const codeBlocks = [];
    const withPlaceholders = String(text).replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (_, code) => {
        codeBlocks.push(escapeHtml(code.replace(/\n$/, '')));
        return '\nCODEBLOCK' + (codeBlocks.length - 1) + '\n';
    });

    const out = [];
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<' + list.type + '>' + list.items.map((i) => '<li>' + i + '</li>').join('') + '</' + list.type + '>'); list = null; } };
    for (const rawLine of withPlaceholders.split('\n')) {
        const line = rawLine.trim();
        const codeMatch = line.match(/^CODEBLOCK(\d+)$/);
        const ul = line.match(/^[-*]\s+(.*)$/);
        const ol = line.match(/^\d+\.\s+(.*)$/);
        if (codeMatch) {
            flushPara();
            flushList();
            out.push('<pre><code>' + codeBlocks[Number(codeMatch[1])] + '</code></pre>');
        } else if (ul) {
            flushPara();
            if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
            list.items.push(inline(ul[1]));
        } else if (ol) {
            flushPara();
            if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
            list.items.push(inline(ol[1]));
        } else if (line === '') {
            flushPara();
            flushList();
        } else {
            flushList();
            para.push(inline(line));
        }
    }
    flushPara();
    flushList();

    return out.join('');
}

function appendAIChatMessage(role, text) {
    const messages = document.getElementById('ai-chat-messages');
    const el = document.createElement('div');
    el.className = 'ai-chat-msg ai-chat-msg--' + role;
    if (role === 'assistant') {
        el.innerHTML = renderChatMarkdown(text);
        const row = document.createElement('div');
        row.className = 'ai-chat-msg-row';
        const avatar = document.createElement('span');
        avatar.className = 'ai-chat-msg-avatar';
        avatar.textContent = '🌷';
        row.appendChild(avatar);
        row.appendChild(el);
        messages.appendChild(row);
    } else {
        el.textContent = text;
        messages.appendChild(el);
    }
    messages.scrollTop = messages.scrollHeight;
    return el;
}

async function submitAIChat(event) {
    event.preventDefault();
    if (aiChatBusy || !aiChatStudentId) return false;
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    if (!message) return false;

    appendAIChatMessage('user', message);
    input.value = '';
    aiChatBusy = true;
    document.getElementById('ai-chat-send').disabled = true;
    const pending = appendAIChatMessage('pending', 'กำลังตอบ...');

    try {
        const res = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(aiChatStudentId)}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: aiChatConversationId, message }),
        });
        const data = await res.json().catch(() => ({}));
        pending.remove();
        if (!res.ok || data.status === 'error') {
            appendAIChatMessage('error', data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
            return false;
        }
        aiChatConversationId = data.conversationId;
        appendAIChatMessage('assistant', data.reply || '');
    } catch (err) {
        pending.remove();
        appendAIChatMessage('error', 'เชื่อมต่อระบบ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
        aiChatBusy = false;
        document.getElementById('ai-chat-send').disabled = false;
    }
    return false;
}
