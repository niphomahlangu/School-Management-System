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
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('en-ZA', {
        day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(y, m - 1, d));
}

function isOverdue(dateStr) {
    if (!dateStr) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const tasksStatus  = document.getElementById('tasksStatus');
const tasksWrapper = document.getElementById('tasksTableWrapper');
const tasksBody    = document.getElementById('tasksBody');

// ─── Load tasks ───────────────────────────────────────────────────────────────

async function loadTasks() {
    tasksStatus.textContent   = 'Loading tasks…';
    tasksStatus.style.display = 'block';
    tasksWrapper.style.display = 'none';
    tasksBody.innerHTML = '';

    try {
        const res = await fetch('/api/student/tasks');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tasks = await res.json();

        if (!tasks.length) {
            tasksStatus.textContent = 'No tasks have been assigned to your modules yet.';
            return;
        }

        tasksStatus.style.display  = 'none';
        tasksWrapper.style.display = 'block';

        tasks.forEach(t => {
            const tr = document.createElement('tr');
            tr.dataset.taskId = t.taskId;

            const overdueBadge = isOverdue(t.dueDate)
                ? `<span class="badge-overdue">Overdue</span>`
                : '';

            const fileCell = t.filePath
                ? `<button class="btn-icon download" data-task-id="${t.taskId}">⬇ Download</button>`
                : `<span class="no-file">No file</span>`;

            tr.innerHTML = `
                <td>${esc(t.taskTitle)}</td>
                <td><span class="badge-module">${esc(t.moduleCode)}</span> ${esc(t.moduleName)}</td>
                <td>${fmtDate(t.dueDate)}${overdueBadge}</td>
                <td>${fileCell}</td>
            `;
            tasksBody.appendChild(tr);
        });

    } catch (err) {
        console.error('Failed to load tasks:', err);
        tasksStatus.textContent = 'Failed to load tasks. Please refresh the page.';
    }
}

// ─── Download via event delegation ────────────────────────────────────────────

tasksBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button.download');
    if (!btn) return;
    window.location.href = `/api/student/tasks/${btn.dataset.taskId}/file`;
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadTasks();
