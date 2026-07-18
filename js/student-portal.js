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
// Script / Google Sheets backend. Served on the litalkeducation.com
// custom domain rather than the raw workers.dev subdomain.
const dataApiUrl = 'https://istudent.litalkeducation.com';

// Auth0's hidden-iframe silent auth can hang indefinitely instead of
// rejecting — notably in the LINE/Facebook in-app browser and other
// WebViews that restrict third-party storage. Without a timeout, awaiting
// it would block the portal data fetch forever, so race it against a
// deadline and fall back to the unauthenticated path when it's exceeded.
function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// TEMPORARY — captures why the last getPortalToken() call failed, since the
// server-side debug (debugPortalAuth) can only ever see "hasToken: false"
// when this happens: no Authorization header ever gets sent, so the actual
// Auth0 SDK error (timeout, invalid_grant, missing_refresh_token, …) never
// reaches the Worker at all. Surfaced on the portal error card. Remove
// alongside debugPortalAuth once the live incident is resolved.
let lastPortalTokenError = null;

// Best-effort access token for the portal — present only when the student
// has a live Auth0 session (the only way into the portal now). Every
// GET /portal/:studentId call needs this to prove ownership. Returns null
// otherwise.
async function getPortalToken() {
    lastPortalTokenError = null;
    try {
        if (!auth0Client) {
            lastPortalTokenError = 'auth0Client not initialized (SDK failed to load?)';
            return null;
        }
        const isAuthed = await withTimeout(auth0Client.isAuthenticated(), 8000, 'isAuthenticated timed out');
        if (!isAuthed) {
            lastPortalTokenError = 'isAuthenticated() returned false';
            return null;
        }
        // 12s, not the old 5s: a refresh-token exchange on a slow mobile
        // connection routinely blew the shorter deadline, which showed up as
        // "logged in but no Meet link / files" — the token was simply
        // abandoned mid-flight.
        return await withTimeout(
            auth0Client.getTokenSilently({ authorizationParams: { audience: filesApiAudience } }),
            12000,
            'getTokenSilently timed out'
        );
    } catch (err) {
        lastPortalTokenError = (err && (err.error || err.message))
            ? `${err.error || ''} ${err.error_description || err.message || ''}`.trim()
            : String(err);
        console.warn('Portal token unavailable:', err);
        return null;
    }
}

// Asks the Worker which student this Auth0 token belongs to. The old
// client-side guess (login email's local part) silently broke for accounts
// whose email doesn't follow the <id>@domain convention — the server
// resolves by email AND by Auth0 sub against students.auth0_user_id.
async function resolveStudentIdFromToken(token) {
    if (!token) return null;
    try {
        const res = await fetch(`${dataApiUrl}/portal/whoami`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.studentId) return data.studentId;
    } catch (err) {
        console.warn('whoami failed:', err);
    }
    return null;
}

// Clear failure state for "signed in but the id resolves to no student"
// (or the portal fetch failed) — instead of an error string stuffed into
// the name slot with everything else stuck as skeletons forever.
// debug is the TEMPORARY diagnostic field from GET /portal/:studentId's 401
// response (see debugPortalAuth in the Worker) — shown inline so reporting
// the live "logged in but no data" incident doesn't need devtools. Remove
// this param along with debugPortalAuth once that's fixed for good.
function renderPortalDataError(message, debug) {
    const name = document.getElementById('display-name');
    if (name) name.innerText = '—';
    const main = document.getElementById('main-content');
    if (!main || document.getElementById('portal-error-card')) return;
    const card = document.createElement('section');
    card.id = 'portal-error-card';
    card.className = 'content-section portal-error-card';
    const debugBlock = debug
        ? `<pre style="margin-top:12px;padding:10px;background:var(--bg-tertiary);border-radius:8px;font-size:11px;overflow-x:auto;user-select:all;">${escapeHtml(JSON.stringify(debug, null, 2))}</pre>`
        : '';
    card.innerHTML = `
        <h2 class="section-title"><i class="fas fa-triangle-exclamation"></i> ไม่สามารถแสดงข้อมูลได้</h2>
        <p class="section-sub">${escapeHtml(message || 'เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล กรุณาลองใหม่อีกครั้ง')}</p>
        <div class="portal-error-actions">
            <button type="button" class="btn-table-action" onclick="logout()"><i class="fas fa-arrow-right-from-bracket"></i> ออกจากระบบแล้วเข้าสู่ระบบใหม่</button>
            <a class="btn-table-action" href="https://lin.ee/n4zLBXa" target="_blank" rel="noopener"><i class="fab fa-line"></i> ติดต่อแอดมินทาง LINE</a>
        </div>
        ${debugBlock}`;
    const tabs = main.querySelector('.portal-tabs');
    if (tabs && tabs.nextSibling) {
        main.insertBefore(card, tabs.nextSibling);
    } else {
        main.insertBefore(card, main.firstChild);
    }
}

// Holds the current portal token so file-download handlers can reuse it.
let portalAuthToken = null;

// Basic profile info cached from the last fetchPortalData call, so the
// profile-edit modal can pre-fill without a second round-trip.
let currentPortalInfo = null;

// ---------- Cookie helpers ----------
// Only used to clean up the old ?id=-shortcut cookie on logout (see below) —
// nothing writes student_id anymore.
function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure";
}

// ---------- Session ----------
const login = async () => { await auth0Client.loginWithRedirect(); };

const logout = async () => {
    deleteCookie('student_id'); // clears any leftover cookie from the retired ?id= shortcut
    const returnTo = window.location.origin + '/student';
    const isAuthenticated = auth0Client ? await auth0Client.isAuthenticated() : false;
    if (isAuthenticated) {
        auth0Client.logout({ logoutParams: { returnTo } });
    } else {
        window.location.href = returnTo;
    }
};

// Resolves the signed-in student's id purely from the live Auth0 session.
// The old ?id=-in-the-URL / cookie shortcut let anyone who knew (or
// guessed) a student id read their portal data — payments, study logs —
// without ever logging in; the server now rejects those requests outright
// (GET /portal/:studentId requires a matching token), so every portal page
// must resolve identity this way. Returns null when there's no session.
async function resolveAuthedStudentId() {
    portalAuthToken = await getPortalToken();
    if (!portalAuthToken) return null;
    let studentId = await resolveStudentIdFromToken(portalAuthToken);
    if (!studentId) {
        const user = await auth0Client.getUser().catch(() => null);
        if (user && user.email) studentId = user.email.split('@')[0];
    }
    return studentId;
}

// ---------- Theme ----------
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
}

// Automatic dark mode: while the user hasn't picked a theme manually, keep
// following the OS setting live (the initial value comes from the inline
// head script on each portal page).
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('theme')) return;
    const theme = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcons(theme);
});

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

// Opaque check-in code cache (see the Worker's students.checkin_code /
// migrations/0017_checkin_code.sql). Reveals nothing about the student on
// its own — only a server-side lookup resolves it — so, unlike the real
// student id, it's safe to leave sitting in localStorage on a shared or
// lost device. checkin.html (a separate standalone page) reads this same
// key to auto-fill event self-check-in.
const CHECKIN_CODE_STORAGE_KEY = 'litalk_checkin_code';

// ---------- Data fetching ----------
async function fetchPortalData(studentId) {
    // A token (when the student signed in via Auth0) unlocks private
    // data — files and Google Meet links — server-side.
    portalAuthToken = await getPortalToken();
    const headers = portalAuthToken ? { Authorization: `Bearer ${portalAuthToken}` } : {};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(studentId)}`, {
            method: 'GET', headers, signal: controller.signal,
        });
        const result = await response.json();
        if (result.status === 'success') {
            const info = result.data.info;
            const credit = Number(info.creditBalance);
            const hasUpcoming = Array.isArray(result.data.schedule) && result.data.schedule.length > 0;
            currentPortalInfo = {
                studentId,
                name: info.name || '',
                nickname: info.nickname || '',
                course: info.course && info.course !== '-' ? info.course : '',
                email: info.email || '',
                hasAvatar: !!info.hasAvatar,
                checkinCode: info.checkinCode || '',
                // Mirrors the hero membership-badge logic: out of hours only
                // when there's neither leftover credit nor anything upcoming.
                membershipActive: Number.isFinite(credit) ? (credit > 0 || hasUpcoming) : null,
            };
            if (info.checkinCode) {
                try { localStorage.setItem(CHECKIN_CODE_STORAGE_KEY, info.checkinCode); } catch { /* private mode etc. — auto-fill just won't work */ }
            }
        } else if (lastPortalTokenError) {
            // TEMPORARY — see lastPortalTokenError above. The server's debug
            // only ever sees "hasToken: false" here; this is the actual
            // client-side reason no token was sent in the first place.
            result.debug = Object.assign({ clientTokenError: lastPortalTokenError }, result.debug);
        }
        updateProfileNavButton();
        updateIdCardButton();
        return result;
    } finally {
        clearTimeout(timer);
    }
}

// Shows the nav "edit profile" entry point only once a real Auth0 session
// (and its data) has loaded.
function updateProfileNavButton() {
    document.querySelectorAll('.btn-edit-profile-header').forEach((btn) => {
        btn.style.display = (portalAuthToken && currentPortalInfo) ? '' : 'none';
    });
}

// Same gating as the profile-edit button — the digital ID card's QR links
// to the admin's student-verification screen and (when authed) shows the
// student's email, so it only makes sense for a proven Auth0 session.
function updateIdCardButton() {
    document.querySelectorAll('.btn-id-card-header').forEach((btn) => {
        btn.style.display = (portalAuthToken && currentPortalInfo) ? '' : 'none';
    });
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

// ---------- Calendar sync (docs/UX-REDESIGN.md phase 4) ----------
// The Worker serves /portal/:id/calendar.ics — a subscribe-able feed of the
// student's booked classes. webcal:// opens the native "subscribe" flow on
// Apple/most calendar apps; Google Calendar takes the same URL via ?cid=.
function initCalendarSync(studentId) {
    const row = document.getElementById('calendar-sync');
    if (!row) return;
    const icsUrl = `${dataApiUrl}/portal/${encodeURIComponent(studentId)}/calendar.ics`;
    const webcal = icsUrl.replace(/^https:/, 'webcal:');
    const g = document.getElementById('cal-sync-google');
    const w = document.getElementById('cal-sync-webcal');
    if (g) g.href = 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(webcal);
    if (w) w.href = webcal;
    row.dataset.icsUrl = icsUrl;
    row.style.display = '';
}

async function copyCalendarLink(btn) {
    const row = document.getElementById('calendar-sync');
    if (!row || !row.dataset.icsUrl) return;
    try {
        await navigator.clipboard.writeText(row.dataset.icsUrl);
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> คัดลอกแล้ว';
            setTimeout(() => { btn.innerHTML = orig; }, 1600);
        }
    } catch {
        alert('คัดลอกไม่สำเร็จ ลิงก์คือ: ' + row.dataset.icsUrl);
    }
}

// ---------- Learning progress (docs/UX-REDESIGN.md phase 4) ----------
// Everything here derives from the portal payload the page already fetched
// (study logs, upcoming schedule, credit balance) — no extra API calls.

// Consecutive weeks (Mon-based) with at least one class, counting back from
// this week. The current week not having a class yet does NOT break the
// streak — the student may simply not have reached their slot yet.
function computeWeekStreak(studyLogs) {
    const WEEK = 7 * 86400000;
    const weekKey = (date) => {
        const t = new Date(date);
        t.setHours(0, 0, 0, 0);
        t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
        return t.getTime();
    };
    const weeks = new Set(
        (studyLogs || [])
            .map((l) => parseThaiDate(l.timestamp))
            .filter((d) => d.getTime() !== 0)
            .map(weekKey)
    );
    if (!weeks.size) return 0;
    let cursor = weekKey(new Date());
    if (!weeks.has(cursor)) cursor -= WEEK;
    let streak = 0;
    while (weeks.has(cursor)) {
        streak++;
        cursor -= WEEK;
    }
    return streak;
}

function renderLearningProgress(section, container, { studyLogs, upcoming, credit }) {
    if (!section || !container) return;
    const done = (studyLogs || []).length;
    const total = done + upcoming + credit;
    if (total <= 0) {
        // Brand-new student with nothing booked yet — an empty progress ring
        // would just be discouraging noise.
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    const pct = Math.min(100, Math.round((done / total) * 100));
    const streak = computeWeekStreak(studyLogs);

    // Progress ring: single-value SVG donut. The adjacent facts carry the
    // real numbers, so the ring is a summary, never the only encoding.
    const r = 50;
    const c = 2 * Math.PI * r;
    const ring = `
        <svg viewBox="0 0 120 120" class="progress-ring" role="img" aria-label="เรียนแล้ว ${done} จาก ${total} ชั่วโมง (${pct}%)">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border-color)" stroke-width="10"></circle>
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--brand-primary)" stroke-width="10"
                stroke-linecap="round" stroke-dasharray="${(pct / 100) * c} ${c}"
                transform="rotate(-90 60 60)"></circle>
            <text x="60" y="57" text-anchor="middle" font-size="24" font-weight="700" style="fill: var(--text-primary);">${pct}%</text>
            <text x="60" y="76" text-anchor="middle" font-size="10.5" style="fill: var(--text-muted);">เรียนแล้ว</text>
        </svg>`;

    const facts = `
        <div class="progress-facts">
            <div class="progress-fact"><i class="fas fa-circle-check"></i><div><b>${done.toLocaleString('en-US')} ชม.</b><span>เรียนไปแล้ว</span></div></div>
            <div class="progress-fact"><i class="fas fa-hourglass-half"></i><div><b>${(upcoming + credit).toLocaleString('en-US')} ชม.</b><span>เหลือในแผนการเรียน</span></div></div>
            <div class="progress-fact"><i class="fas fa-fire"></i><div><b>${streak > 0 ? `${streak} สัปดาห์` : '—'}</b><span>เรียนต่อเนื่อง</span></div></div>
        </div>`;

    const milestones = [
        { icon: 'fa-flag-checkered', label: 'คลาสแรก', earned: done >= 1, hint: 'เรียนคลาสแรกให้สำเร็จ' },
        { icon: 'fa-star', label: '10 คลาส', earned: done >= 10, hint: `อีก ${Math.max(0, 10 - done)} คลาส` },
        { icon: 'fa-medal', label: '25 คลาส', earned: done >= 25, hint: `อีก ${Math.max(0, 25 - done)} คลาส` },
        { icon: 'fa-trophy', label: '50 คลาส', earned: done >= 50, hint: `อีก ${Math.max(0, 50 - done)} คลาส` },
        { icon: 'fa-crown', label: '100 คลาส', earned: done >= 100, hint: `อีก ${Math.max(0, 100 - done)} คลาส` },
        { icon: 'fa-fire', label: 'ต่อเนื่อง 4 สัปดาห์', earned: streak >= 4, hint: streak > 0 ? `ตอนนี้ ${streak} สัปดาห์ติดกัน` : 'เรียนติดต่อกันทุกสัปดาห์' },
    ];
    const badges = `
        <div class="badge-grid">
            ${milestones.map((m) => `
            <div class="badge-item ${m.earned ? 'earned' : 'locked'}" title="${escapeHtml(m.earned ? 'ปลดล็อกแล้ว' : m.hint)}">
                <span class="badge-icon"><i class="fas ${m.icon}"></i></span>
                <span class="badge-label">${escapeHtml(m.label)}</span>
                <span class="badge-state">${m.earned ? 'ปลดล็อกแล้ว' : escapeHtml(m.hint)}</span>
            </div>`).join('')}
        </div>`;

    container.innerHTML = `
        <div class="progress-layout">
            <div class="progress-ring-wrap">${ring}</div>
            ${facts}
        </div>
        ${badges}`;
}

// ---------- Teacher(s) ----------
// Whoever the admin assigned to this student via the visibility/access
// screen (teacher_students). Phone numbers link out to tel:; the avatar is
// proxied through a route scoped to this exact student (see worker/README).
function renderTeachers(section, container, studentId, teachers) {
    if (!section || !container) return;
    if (!teachers || teachers.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';
    container.innerHTML = `<div class="teacher-card-list">${teachers.map((t) => {
        const avatarUrl = t.hasAvatar
            ? `${dataApiUrl}/portal/${encodeURIComponent(studentId)}/teacher-avatar/${encodeURIComponent(t.identity)}`
            : null;
        const initial = String(t.name || '-').trim().charAt(0).toUpperCase() || '?';
        return `
        <div class="teacher-card">
            ${avatarUrl
                ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(t.name)}" class="teacher-avatar">`
                : `<div class="teacher-avatar-fallback">${escapeHtml(initial)}</div>`}
            <div class="teacher-info">
                <div class="teacher-name">${escapeHtml(t.name || '-')}</div>
                ${t.title ? `<div class="teacher-title">${escapeHtml(t.title)}</div>` : ''}
                ${t.phone ? `<a href="tel:${escapeHtml(t.phone)}" class="teacher-phone"><i class="fas fa-phone"></i> ${escapeHtml(t.phone)}</a>` : ''}
            </div>
        </div>`;
    }).join('')}</div>`;
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
    // meet can still be unset if the class doesn't have a Meet link yet.
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

// ---------- Profile self-edit (nickname + photo) ----------
// Auth0-signed-in students only (see updateProfileNavButton) — the
// PATCH/POST/DELETE endpoints are gated server-side by the same ownership
// check (portalTokenMatchesStudent).
let profileAvatarRemoved = false;
let profileAvatarFile = null;

function openProfileModal() {
    if (!currentPortalInfo) return;
    const overlay = document.getElementById('profileModalOverlay');
    const avatar = document.getElementById('profileModalAvatar');
    const idEl = document.getElementById('profileModalStudentId');
    const nicknameInput = document.getElementById('profileInputNickname');
    const errorEl = document.getElementById('profileModalAvatarError');
    if (!overlay || !avatar || !nicknameInput) return;

    profileAvatarRemoved = false;
    profileAvatarFile = null;
    const fileInput = document.getElementById('profileUploadInput');
    if (fileInput) fileInput.value = '';
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

    avatar.src = currentPortalInfo.hasAvatar
        ? `${dataApiUrl}/portal/${encodeURIComponent(currentPortalInfo.studentId)}/avatar?v=${Date.now()}`
        : 'img/LITALK-Icon.png';
    idEl.textContent = currentPortalInfo.studentId;
    nicknameInput.value = currentPortalInfo.nickname || '';

    overlay.classList.add('open');
}

function closeProfileModal() {
    const overlay = document.getElementById('profileModalOverlay');
    if (overlay) overlay.classList.remove('open');
}

// ---------- Digital student ID card ----------
// Renders a wallet-style card from the same info the dashboard already has
// (no extra fetch) plus a rotating QR (POST /portal/:id/id-card-token,
// 2-minute TTL) that front-desk staff scan at scan.html — camera, a
// keyboard-emulating barcode scanner, or a registered NFC card all resolve
// to the same token server-side — to toggle campus check-in/out. The QR
// mints fresh every ~100s while the card stays open, so a photo of the
// screen is only useful for a couple of minutes, not a permanent stand-in
// for the card.
const ID_CARD_QR_REFRESH_MS = 100_000; // refresh before the server's 2-min TTL
let idCardQrTimer = null;
let idCardQrCountdownTimer = null;
let idCardQrExpiresAt = 0;

function openIdCardModal() {
    if (!currentPortalInfo) return;
    const overlay = document.getElementById('idCardModalOverlay');
    if (!overlay) return;

    const avatar = document.getElementById('idCardAvatar');
    const avatarFallback = document.getElementById('idCardAvatarFallback');
    if (currentPortalInfo.hasAvatar) {
        avatar.src = `${dataApiUrl}/portal/${encodeURIComponent(currentPortalInfo.studentId)}/avatar?v=${Date.now()}`;
        avatar.style.display = '';
        avatarFallback.hidden = true;
    } else {
        avatar.style.display = 'none';
        const initial = String(currentPortalInfo.nickname || currentPortalInfo.name || currentPortalInfo.studentId).trim().charAt(0);
        avatarFallback.innerText = initial ? initial.toUpperCase() : '';
        avatarFallback.hidden = false;
    }

    document.getElementById('idCardName').textContent = currentPortalInfo.name || currentPortalInfo.studentId;
    document.getElementById('idCardNickname').textContent = currentPortalInfo.nickname ? `(${currentPortalInfo.nickname})` : '';
    document.getElementById('idCardId').textContent = currentPortalInfo.studentId;

    const courseRow = document.getElementById('idCardCourseRow');
    if (currentPortalInfo.course) {
        document.getElementById('idCardCourse').textContent = currentPortalInfo.course;
        courseRow.hidden = false;
    } else {
        courseRow.hidden = true;
    }

    const emailRow = document.getElementById('idCardEmailRow');
    if (currentPortalInfo.email) {
        document.getElementById('idCardEmail').textContent = currentPortalInfo.email;
        emailRow.hidden = false;
    } else {
        emailRow.hidden = true;
    }

    const statusEl = document.getElementById('idCardStatus');
    if (currentPortalInfo.membershipActive === true) {
        statusEl.className = 'idcard-status idcard-status-active';
        statusEl.innerHTML = '<i class="fas fa-circle-check"></i> สมาชิกที่ใช้งานอยู่';
    } else if (currentPortalInfo.membershipActive === false) {
        statusEl.className = 'idcard-status idcard-status-inactive';
        statusEl.innerHTML = '<i class="fas fa-hourglass-end"></i> หมดชั่วโมงเรียน';
    } else {
        statusEl.className = 'idcard-status';
        statusEl.innerHTML = '-';
    }

    const checkinCodeEl = document.getElementById('idCardCheckinCode');
    if (checkinCodeEl) {
        checkinCodeEl.textContent = currentPortalInfo.checkinCode
            ? currentPortalInfo.checkinCode.replace(/(.{4})(.{4})/, '$1 $2')
            : '-';
    }

    refreshIdCardQr();
    if (idCardQrTimer) clearInterval(idCardQrTimer);
    idCardQrTimer = setInterval(refreshIdCardQr, ID_CARD_QR_REFRESH_MS);
    if (idCardQrCountdownTimer) clearInterval(idCardQrCountdownTimer);
    idCardQrCountdownTimer = setInterval(updateIdCardQrCountdown, 1000);

    overlay.classList.add('open');
}

// Mints a fresh check-in token and redraws the QR. Called on open and then
// on a timer while the card stays open.
async function refreshIdCardQr() {
    const qrHolder = document.getElementById('idCardQr');
    if (!qrHolder || !currentPortalInfo || !portalAuthToken) return;

    try {
        const res = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(currentPortalInfo.studentId)}/id-card-token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${portalAuthToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (data.status !== 'success' || !data.token) throw new Error(data.message || 'mint failed');

        idCardQrExpiresAt = Date.parse(data.expiresAt) || (Date.now() + 120000);
        qrHolder.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            // Render well above the on-screen 168px size and scale down via
            // CSS. qrcodejs draws each module as a canvas fillRect; at a
            // low pixel size the module edges land on fractional pixels and
            // get anti-aliased into a soft gray band, which is a big enough
            // fraction of a small module that camera QR decoders can't
            // threshold it reliably. Rendering large keeps that blur a
            // negligible fraction of each module once downscaled.
            new QRCode(qrHolder, { text: data.token, width: 400, height: 400, correctLevel: QRCode.CorrectLevel.M });
            // qrcodejs draws to an off-screen <canvas> and displays a
            // separate <img> (canvas.toDataURL()) with the canvas hidden —
            // the <img> is what's actually visible, so that's what needs
            // the CSS scale-down. querySelector('img, canvas') is a
            // selector LIST — it returns whichever matches first in
            // document order, not list order, and the canvas is always
            // appended first, so img must be selected explicitly.
            const rendered = qrHolder.querySelector('img') || qrHolder.querySelector('canvas');
            if (rendered) { rendered.style.width = '100%'; rendered.style.height = '100%'; }
        } else {
            // QR library blocked/unloaded — the token is still readable/typeable.
            qrHolder.innerHTML = `<div class="idcard-qr-fallback">${escapeHtml(data.token)}</div>`;
        }
        updateIdCardQrCountdown();
    } catch (err) {
        console.warn('refreshIdCardQr failed:', err);
        qrHolder.innerHTML = `<div class="idcard-qr-fallback idcard-qr-error"><i class="fas fa-triangle-exclamation"></i> ออก QR ไม่สำเร็จ<br>ลองปิดแล้วเปิดบัตรใหม่</div>`;
    }
}

function updateIdCardQrCountdown() {
    const el = document.getElementById('idCardQrCountdown');
    if (!el) return;
    const secondsLeft = Math.max(0, Math.round((idCardQrExpiresAt - Date.now()) / 1000));
    el.textContent = `รีเฟรชอัตโนมัติใน ${secondsLeft} วิ`;
}

function closeIdCardModal() {
    const overlay = document.getElementById('idCardModalOverlay');
    if (overlay) overlay.classList.remove('open');
    if (idCardQrTimer) { clearInterval(idCardQrTimer); idCardQrTimer = null; }
    if (idCardQrCountdownTimer) { clearInterval(idCardQrCountdownTimer); idCardQrCountdownTimer = null; }
}

function previewProfileImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const errorEl = document.getElementById('profileModalAvatarError');
    if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

    if (!file.type.startsWith('image/')) {
        if (errorEl) { errorEl.textContent = 'กรุณาเลือกไฟล์รูปภาพ'; errorEl.style.display = 'block'; }
        event.target.value = '';
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        if (errorEl) { errorEl.textContent = 'ขนาดไฟล์เกิน 5MB'; errorEl.style.display = 'block'; }
        event.target.value = '';
        return;
    }

    profileAvatarRemoved = false;
    profileAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const avatar = document.getElementById('profileModalAvatar');
        if (avatar) avatar.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeProfileImage() {
    profileAvatarFile = null;
    profileAvatarRemoved = true;
    const avatar = document.getElementById('profileModalAvatar');
    const fileInput = document.getElementById('profileUploadInput');
    if (avatar) avatar.src = 'img/LITALK-Icon.png';
    if (fileInput) fileInput.value = '';
}

async function saveProfileData() {
    if (!currentPortalInfo || !portalAuthToken) return;
    const saveBtn = document.querySelector('.profile-btn-save');
    const nicknameInput = document.getElementById('profileInputNickname');
    if (!saveBtn || !nicknameInput) return;
    const origLabel = saveBtn.innerHTML;

    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
    saveBtn.disabled = true;

    try {
        const headers = { Authorization: `Bearer ${portalAuthToken}` };
        const studentId = currentPortalInfo.studentId;

        const profileRes = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(studentId)}/profile`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname: nicknameInput.value.trim() }),
        });
        const profileData = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok || profileData.status === 'error') {
            throw new Error(profileData.message || 'บันทึกชื่อเล่นไม่สำเร็จ');
        }

        if (profileAvatarFile) {
            const form = new FormData();
            form.append('file', profileAvatarFile);
            const avatarRes = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(studentId)}/avatar`, {
                method: 'POST', headers, body: form,
            });
            const avatarData = await avatarRes.json().catch(() => ({}));
            if (!avatarRes.ok || avatarData.status === 'error') {
                throw new Error(avatarData.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
            }
        } else if (profileAvatarRemoved) {
            const avatarRes = await fetch(`${dataApiUrl}/portal/${encodeURIComponent(studentId)}/avatar`, {
                method: 'DELETE', headers,
            });
            const avatarData = await avatarRes.json().catch(() => ({}));
            if (!avatarRes.ok || avatarData.status === 'error') {
                throw new Error(avatarData.message || 'ลบรูปภาพไม่สำเร็จ');
            }
        }

        closeProfileModal();
        // Reflect the change immediately without a full page reload.
        currentPortalInfo.nickname = nicknameInput.value.trim();
        currentPortalInfo.hasAvatar = profileAvatarRemoved ? false : (profileAvatarFile ? true : currentPortalInfo.hasAvatar);
        const nicknameDisplay = document.getElementById('display-nickname');
        if (nicknameDisplay) nicknameDisplay.innerText = currentPortalInfo.nickname;
        const avatarEl = document.getElementById('display-avatar');
        const avatarFallbackEl = document.getElementById('display-avatar-fallback');
        if (avatarEl && avatarFallbackEl) {
            if (currentPortalInfo.hasAvatar) {
                avatarEl.src = `${dataApiUrl}/portal/${encodeURIComponent(studentId)}/avatar?v=${Date.now()}`;
                avatarEl.style.display = '';
                avatarFallbackEl.hidden = true;
            } else {
                avatarEl.style.display = 'none';
                avatarFallbackEl.hidden = false;
            }
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        saveBtn.innerHTML = origLabel;
        saveBtn.disabled = false;
    }
}

// ---------- AI chat assistant ----------
// Shared by students and parents alike — the portal has no separate parent
// login, so whoever holds the student's Auth0 credentials reaches this the
// same way they reach the rest of the dashboard.
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
    // On phones the panel is a full-screen popup (see student-portal.css),
    // so freeze the page behind it while it's open.
    if (window.matchMedia('(max-width: 768px)').matches) {
        document.body.style.overflow = open ? 'hidden' : '';
    }
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
