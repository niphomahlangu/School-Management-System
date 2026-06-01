function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('en-ZA', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(parts[0], parts[1] - 1, parts[2]));
}

function fmtTime(timeStr) {
    if (!timeStr) return '—';
    const parts = timeStr.split(':').map(Number);
    const value = new Date();
    value.setHours(parts[0], parts[1], 0, 0);
    return new Intl.DateTimeFormat('en-ZA', {
        hour: 'numeric', minute: '2-digit'
    }).format(value);
}

function todayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function weekStart(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekDay = date.getDay();
    const delta = weekDay === 0 ? -6 : 1 - weekDay;
    date.setDate(date.getDate() + delta);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekLabel(mondayStr, index) {
    const [year, month, day] = mondayStr.split('-').map(Number);
    const monday = new Date(year, month - 1, day);
    const friday = new Date(year, month - 1, day + 4);
    const formatter = new Intl.DateTimeFormat('en-ZA', { month: 'short', day: 'numeric' });
    return `Week ${index + 1} - ${formatter.format(monday)} to ${formatter.format(friday)}`;
}

function attendanceState(session) {
    if (session.markedAt === null || session.markedAt === undefined) {
        return { className: 'pending', label: 'Pending' };
    }
    return session.attended
        ? { className: 'present', label: 'Present' }
        : { className: 'absent', label: 'Absent' };
}

const scheduleStatus = document.getElementById('scheduleStatus');
const scheduleContent = document.getElementById('scheduleContent');
const totalSessions = document.getElementById('totalSessions');
const upcomingSessions = document.getElementById('upcomingSessions');
const lecturerCount = document.getElementById('lecturerCount');
const weekFilter = document.getElementById('weekFilter');
const searchFilter = document.getElementById('searchFilter');

let allSessions = [];
let orderedWeeks = [];

function buildWeekOptions(sessions) {
    const seen = new Set();
    orderedWeeks = [];
    weekFilter.innerHTML = '<option value="">All weeks</option>';

    sessions.forEach((session) => {
        const key = weekStart(session.sessionDate);
        if (!seen.has(key)) {
            seen.add(key);
            orderedWeeks.push(key);
        }
    });

    orderedWeeks.sort();
    orderedWeeks.forEach((entry, index) => {
        const option = document.createElement('option');
        option.value = entry;
        option.textContent = weekLabel(entry, index);
        weekFilter.appendChild(option);
    });
}

function updateSummary(sessions) {
    const today = todayString();
    totalSessions.textContent = String(sessions.length);
    upcomingSessions.textContent = String(sessions.filter((session) => session.sessionDate >= today).length);
    lecturerCount.textContent = String(new Set(sessions.map((session) => session.lecturerName || 'TBA')).size);
}

function groupedHtml(sessions) {
    const sessionsByWeek = new Map();
    const today = todayString();

    sessions.forEach((session) => {
        const key = weekStart(session.sessionDate);
        const current = sessionsByWeek.get(key) || [];
        current.push(session);
        sessionsByWeek.set(key, current);
    });

    return Array.from(sessionsByWeek.keys()).sort().map((key) => {
        const rows = (sessionsByWeek.get(key) || []).sort((left, right) => {
            const leftKey = `${left.sessionDate} ${left.startTime}`;
            const rightKey = `${right.sessionDate} ${right.startTime}`;
            return leftKey.localeCompare(rightKey);
        });

        const body = rows.map((session) => {
            const state = attendanceState(session);
            const isToday = session.sessionDate === today;

            return `
                <tr>
                    <td>${esc(fmtDate(session.sessionDate))}${isToday ? ' <span class="today-badge">TODAY</span>' : ''}</td>
                    <td style="white-space:nowrap;">${esc(fmtTime(session.startTime))} - ${esc(fmtTime(session.endTime))}</td>
                    <td>
                        <div class="module-name">${esc(session.moduleName || 'Unnamed module')}</div>
                        <span class="module-code">${esc(session.moduleCode || 'MOD')}</span>
                    </td>
                    <td>${esc(session.lecturerName || 'TBA')}</td>
                    <td>${esc(session.courseNames || '—')}</td>
                    <td>${esc(session.venue || 'TBA')}</td>
                    <td>${esc(session.notes || '—')}</td>
                    <td><span class="status-pill ${state.className}">${state.label}</span></td>
                </tr>
            `;
        }).join('');

        return `
            <section>
                <div class="week-heading">${esc(weekLabel(key, orderedWeeks.indexOf(key)))}</div>
                <div style="overflow-x:auto;">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Module</th>
                                <th>Lecturer</th>
                                <th>Course</th>
                                <th>Venue</th>
                                <th>Notes</th>
                                <th>Attendance</th>
                            </tr>
                        </thead>
                        <tbody>${body}</tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');
}

function renderSchedule() {
    const weekValue = weekFilter.value;
    const searchValue = searchFilter.value.trim().toLowerCase();

    const filtered = allSessions.filter((session) => {
        const matchesWeek = !weekValue || weekStart(session.sessionDate) === weekValue;
        if (!matchesWeek) {
            return false;
        }

        if (!searchValue) {
            return true;
        }

        const haystack = [
            session.moduleName,
            session.moduleCode,
            session.lecturerName,
            session.courseNames,
            session.venue,
            session.notes
        ].join(' ').toLowerCase();

        return haystack.includes(searchValue);
    });

    updateSummary(filtered);

    if (!filtered.length) {
        scheduleContent.style.display = 'none';
        scheduleContent.innerHTML = '';
        scheduleStatus.style.display = 'block';
        scheduleStatus.textContent = allSessions.length
            ? 'No timetable entries match the current filter.'
            : 'No timetable entries are linked to your student account yet.';
        return;
    }

    scheduleStatus.style.display = 'none';
    scheduleContent.style.display = 'block';
    scheduleContent.innerHTML = groupedHtml(filtered);
}

async function loadSchedule() {
    scheduleStatus.style.display = 'block';
    scheduleStatus.textContent = 'Loading timetable…';
    scheduleContent.style.display = 'none';
    scheduleContent.innerHTML = '';

    try {
        const response = await fetch('/api/student/schedule');
        const sessions = await response.json();

        if (!response.ok) {
            throw new Error(sessions.message || `HTTP ${response.status}`);
        }

        allSessions = Array.isArray(sessions) ? sessions : [];
        buildWeekOptions(allSessions);
        renderSchedule();
    } catch (error) {
        console.error('Failed to load schedule:', error);
        scheduleStatus.style.display = 'block';
        scheduleStatus.textContent = 'Failed to load the timetable. Please refresh the page.';
        scheduleContent.style.display = 'none';
    }
}

weekFilter.addEventListener('change', renderSchedule);
searchFilter.addEventListener('input', renderSchedule);

loadSchedule();