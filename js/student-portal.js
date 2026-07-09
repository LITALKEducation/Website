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
//   limit     — show only the newest N logs (dashboard preview)
//   moreHref  — when limited and there are more logs, append a
//               "view all" link pointing at the full page
// Long feedback is collapsed behind a "read more" toggle so one verbose
// log doesn't force endless scrolling (most useful on mobile).
function renderStudyLogs(container, studyLogs, options = {}) {
    if (!container) return;
    const { limit, moreHref } = options;

    if (!studyLogs || studyLogs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="far fa-folder-open"></i><p>ยังไม่มีบันทึกประวัติการเรียนในระบบ</p></div>';
        return;
    }

    // Sort study logs: newest first
    const logs = [...studyLogs].sort((a, b) => parseThaiDate(b.timestamp) - parseThaiDate(a.timestamp));
    const shown = limit ? logs.slice(0, limit) : logs;

    let studyHtml = `<div class="timeline-container">`;
    shown.forEach((log, index) => {
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
