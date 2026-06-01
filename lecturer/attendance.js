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

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const sessionSelect   = document.getElementById('sessionSelect');
const sessionInfoBar  = document.getElementById('sessionInfoBar');
const attendancePanel = document.getElementById('attendancePanel');
const attendanceBody  = document.getElementById('attendanceBody');
const attendanceStatus = document.getElementById('attendanceStatus');
const emptyState      = document.getElementById('emptyState');
const selectAllChk    = document.getElementById('selectAll');
const presentCountEl  = document.getElementById('presentCount');
const saveBtn         = document.getElementById('saveBtn');
const statusMsg       = document.getElementById('statusMsg');

// ─── State ────────────────────────────────────────────────────────────────────

let currentSessionId = null;

// ─── Populate session dropdown ────────────────────────────────────────────────

async function loadSessions() {
    try {
        const res = await fetch('/api/lecturer/schedule');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const sessions = await res.json();

        if (!sessions.length) {
            sessionSelect.disabled = true;
            attendanceStatus.textContent = 'No sessions found for your account.';
            return;
        }

        sessions.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sessionId;
            opt.textContent = `${fmtDate(s.sessionDate)}  |  ${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}  |  ${s.moduleCode} – ${s.moduleName}`;
            sessionSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Error loading sessions:', err);
        attendanceStatus.textContent = 'Failed to load sessions. Please refresh the page.';
    }
}

// ─── Update present count badge ───────────────────────────────────────────────

function updatePresentCount() {
    const checkboxes = attendanceBody.querySelectorAll('input[type="checkbox"]');
    const total   = checkboxes.length;
    const present = Array.from(checkboxes).filter(c => c.checked).length;
    presentCountEl.innerHTML = `<strong>${present}</strong> of ${total} students marked present`;

    // Sync select-all state
    selectAllChk.checked       = total > 0 && present === total;
    selectAllChk.indeterminate = present > 0 && present < total;
}

// ─── Render attendance table ──────────────────────────────────────────────────

function renderAttendance(students) {
    attendanceBody.innerHTML = '';

    students.forEach(s => {
        const tr = document.createElement('tr');
        if (s.attended) tr.classList.add('row-present');

        tr.innerHTML = `
            <td>${esc(s.lastName)}, ${esc(s.firstName)}</td>
            <td>${esc(s.studentNumber || '—')}</td>
            <td class="checkbox-cell">
                <input type="checkbox" data-student-id="${s.studentId}"
                    ${s.attended ? 'checked' : ''}
                    aria-label="Mark ${esc(s.firstName)} ${esc(s.lastName)} present">
            </td>
        `;

        // Toggle row highlight on checkbox change
        const chk = tr.querySelector('input[type="checkbox"]');
        chk.addEventListener('change', () => {
            tr.classList.toggle('row-present', chk.checked);
            updatePresentCount();
            statusMsg.textContent = '';
            statusMsg.className   = '';
        });

        attendanceBody.appendChild(tr);
    });

    updatePresentCount();
}

// ─── Load attendance for selected session ─────────────────────────────────────

async function loadAttendance(sessionId) {
    attendancePanel.hidden = true;
    emptyState.hidden      = true;
    sessionInfoBar.hidden  = true;
    statusMsg.textContent  = '';
    statusMsg.className    = '';
    attendanceStatus.textContent = 'Loading students…';

    try {
        const res = await fetch(`/api/lecturer/attendance/${encodeURIComponent(sessionId)}`);

        if (res.status === 404) {
            attendanceStatus.textContent = '';
            emptyState.hidden = false;
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        attendanceStatus.textContent = '';

        // Populate session info pills
        const { session, students } = data;
        sessionInfoBar.innerHTML = `
            <span class="info-pill"><i class="fa-solid fa-calendar-day" aria-hidden="true"></i> ${esc(fmtDate(session.sessionDate))}</span>
            <span class="info-pill"><i class="fa-solid fa-clock" aria-hidden="true"></i> ${esc(fmtTime(session.startTime))} – ${esc(fmtTime(session.endTime))}</span>
            <span class="info-pill"><i class="fa-solid fa-book-open" aria-hidden="true"></i> ${esc(session.moduleCode)} – ${esc(session.moduleName)}</span>
            ${session.venue ? `<span class="info-pill"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(session.venue)}</span>` : ''}
        `;
        sessionInfoBar.hidden = false;

        renderAttendance(students);
        attendancePanel.hidden = false;
        saveBtn.disabled = false;

    } catch (err) {
        console.error('Error loading attendance:', err);
        attendanceStatus.textContent = 'Failed to load attendance. Please try again.';
    }
}

// ─── Save attendance ──────────────────────────────────────────────────────────

async function saveAttendance() {
    if (!currentSessionId) return;

    const checkboxes  = attendanceBody.querySelectorAll('input[type="checkbox"]');
    const attendedIds = Array.from(checkboxes)
        .filter(c => c.checked)
        .map(c => parseInt(c.dataset.studentId, 10));

    saveBtn.disabled          = true;
    statusMsg.textContent     = 'Saving…';
    statusMsg.className       = '';

    try {
        const res = await fetch(`/api/lecturer/attendance/${encodeURIComponent(currentSessionId)}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ attendedIds })
        });

        const json = await res.json();

        if (!res.ok) {
            statusMsg.textContent = json.message || 'Error saving attendance.';
            statusMsg.className   = 'msg-error';
        } else {
            statusMsg.textContent = `Register saved — ${attendedIds.length} student${attendedIds.length !== 1 ? 's' : ''} marked present.`;
            statusMsg.className   = 'msg-success';
        }
    } catch (err) {
        console.error('Error saving attendance:', err);
        statusMsg.textContent = 'Network error. Please try again.';
        statusMsg.className   = 'msg-error';
    } finally {
        saveBtn.disabled = false;
    }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

sessionSelect.addEventListener('change', () => {
    const val = sessionSelect.value;
    if (!val) {
        currentSessionId = null;
        attendancePanel.hidden = true;
        emptyState.hidden      = true;
        sessionInfoBar.hidden  = true;
        attendanceStatus.textContent = '';
        saveBtn.disabled = true;
        return;
    }
    currentSessionId = parseInt(val, 10);
    loadAttendance(currentSessionId);
});

selectAllChk.addEventListener('change', () => {
    const checkboxes = attendanceBody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(chk => {
        chk.checked = selectAllChk.checked;
        chk.closest('tr').classList.toggle('row-present', selectAllChk.checked);
    });
    updatePresentCount();
    statusMsg.textContent = '';
    statusMsg.className   = '';
});

saveBtn.addEventListener('click', saveAttendance);

// ─── Init ─────────────────────────────────────────────────────────────────────

saveBtn.disabled = true;
loadSessions();
