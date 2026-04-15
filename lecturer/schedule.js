// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fmtDate(dateStr) {
    // dateStr is 'YYYY-MM-DD' — parse as local midnight to avoid UTC shift
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
    }).format(new Date(y, m - 1, d));
}

function fmtTime(timeStr) {
    const [h, min] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
}

// Return 'YYYY-MM-DD' string for today in local time
function todayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Return Monday of the ISO week containing `dateStr`
function weekStart(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();                       // 0 = Sun
    const diff = day === 0 ? -6 : 1 - day;          // shift to Monday
    date.setDate(date.getDate() + diff);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekLabel(mondayStr, index) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const mon = new Date(y, m - 1, d);
    const fri = new Date(y, m - 1, d + 4);
    const fmt = (dt) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dt);
    return `Week ${index + 1} — ${fmt(mon)} to ${fmt(fri)}`;
}

// ─── State ────────────────────────────────────────────────────────────────────

let allSessions = [];

// ─── Rendering ────────────────────────────────────────────────────────────────

function buildWeekOptions(sessions) {
    const weekFilter = document.getElementById('weekFilter');
    const seen = new Set();
    const weeks = [];

    sessions.forEach(s => {
        const ws = weekStart(s.sessionDate);
        if (!seen.has(ws)) { seen.add(ws); weeks.push(ws); }
    });

    weeks.sort();
    weeks.forEach((ws, i) => {
        const opt = document.createElement('option');
        opt.value = ws;
        opt.textContent = weekLabel(ws, i);
        // Pre-select the current week if it's in range
        if (ws === weekStart(todayStr())) opt.defaultSelected = true;
        weekFilter.appendChild(opt);
    });
}

function renderSchedule() {
    const selectedWeek = document.getElementById('weekFilter').value;
    const search = document.getElementById('searchFilter').value.toLowerCase().trim();
    const today = todayStr();

    const status  = document.getElementById('scheduleStatus');
    const content = document.getElementById('scheduleContent');

    // Filter
    let filtered = allSessions.filter(s => {
        if (selectedWeek && weekStart(s.sessionDate) !== selectedWeek) return false;
        if (search) {
            const haystack = `${s.moduleName} ${s.moduleCode} ${s.venue} ${s.courseNames}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    if (!filtered.length) {
        status.textContent = allSessions.length
            ? 'No sessions match the current filter.'
            : 'No sessions found for your account.';
        content.innerHTML = '';
        return;
    }

    status.textContent = '';

    // Group by date
    const byDate = {};
    filtered.forEach(s => {
        if (!byDate[s.sessionDate]) byDate[s.sessionDate] = [];
        byDate[s.sessionDate].push(s);
    });

    // Group dates by week
    const byWeek = {};
    Object.keys(byDate).sort().forEach(date => {
        const ws = weekStart(date);
        if (!byWeek[ws]) byWeek[ws] = [];
        byWeek[ws].push(date);
    });

    const weekStarts = Object.keys(byWeek).sort();
    let weekIndex = 0;
    // If we're pre-selecting, calculate the offset index properly
    const weekFilter = document.getElementById('weekFilter');
    const opts = Array.from(weekFilter.options).filter(o => o.value).map(o => o.value);

    let html = '';

    weekStarts.forEach(ws => {
        const idx = opts.indexOf(ws);
        html += `<div class="week-heading">${esc(weekLabel(ws, idx >= 0 ? idx : weekIndex))}</div>`;
        weekIndex++;

        html += `<div style="overflow-x:auto; margin-bottom:1rem;">
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Module</th>
                        <th>Course</th>
                        <th>Venue</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>`;

        byWeek[ws].forEach(date => {
            byDate[date].forEach(s => {
                const isToday = s.sessionDate === today;
                html += `
                    <tr>
                        <td>
                            ${esc(fmtDate(s.sessionDate))}
                            ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
                        </td>
                        <td style="white-space:nowrap;">${esc(fmtTime(s.startTime))} – ${esc(fmtTime(s.endTime))}</td>
                        <td>
                            <div class="module-name">${esc(s.moduleName)}</div>
                            <div class="module-code">${esc(s.moduleCode)}</div>
                        </td>
                        <td>${esc(s.courseNames || '—')}</td>
                        <td>${esc(s.venue || 'TBA')}</td>
                        <td style="color:#6b7280; font-size:0.9rem;">${esc(s.notes || '—')}</td>
                    </tr>`;
            });
        });

        html += `</tbody></table></div>`;
    });

    content.innerHTML = html;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadSchedule() {
    try {
        const res = await fetch('/api/lecturer/schedule');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allSessions = await res.json();

        document.getElementById('totalCount').textContent = String(allSessions.length);
        buildWeekOptions(allSessions);
        renderSchedule();
    } catch (err) {
        console.error('Error loading schedule:', err);
        document.getElementById('scheduleStatus').textContent =
            'Unable to load the class schedule. Please try refreshing the page.';
    }
}

document.getElementById('weekFilter').addEventListener('change', renderSchedule);
document.getElementById('searchFilter').addEventListener('input', renderSchedule);

loadSchedule();
