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

// Submit modal refs
const modalBackdrop    = document.getElementById('submitModalBackdrop');
const submitModalTitle = document.getElementById('submitModalTitle');
const submitFileInput  = document.getElementById('submitFileInput');
const submitFileName   = document.getElementById('submitFileName');
const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
const cancelSubmitBtn  = document.getElementById('cancelSubmitBtn');
const modalFeedback    = document.getElementById('modalFeedback');

let activeTaskId = null;

// ─── Modal helpers ────────────────────────────────────────────────────────────

function openSubmitModal(taskId, taskTitle) {
    activeTaskId = taskId;
    submitModalTitle.textContent = `Submit: ${taskTitle}`;
    submitFileInput.value = '';
    submitFileName.textContent = 'No file chosen';
    modalFeedback.style.display = 'none';
    confirmSubmitBtn.disabled = false;
    confirmSubmitBtn.textContent = 'Submit';
    modalBackdrop.classList.add('open');
}

function closeSubmitModal() {
    modalBackdrop.classList.remove('open');
    activeTaskId = null;
}

function showModalFeedback(msg, type = 'success') {
    modalFeedback.textContent    = msg;
    modalFeedback.className      = type;
    modalFeedback.style.display  = 'block';
}

cancelSubmitBtn.addEventListener('click', closeSubmitModal);
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeSubmitModal();
});

submitFileInput.addEventListener('change', () => {
    submitFileName.textContent = submitFileInput.files.length
        ? submitFileInput.files[0].name
        : 'No file chosen';
});

// ─── Submit handler ───────────────────────────────────────────────────────────

confirmSubmitBtn.addEventListener('click', async () => {
    if (!submitFileInput.files.length) {
        showModalFeedback('Please choose a file to submit.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('submissionFile', submitFileInput.files[0]);

    confirmSubmitBtn.disabled     = true;
    confirmSubmitBtn.textContent  = 'Submitting…';
    modalFeedback.style.display   = 'none';

    try {
        const res  = await fetch(`/api/student/tasks/${activeTaskId}/submit`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok) {
            showModalFeedback(data.message || 'Submission failed.', 'error');
            return;
        }

        showModalFeedback('Submitted successfully!', 'success');
        setTimeout(() => {
            closeSubmitModal();
            loadTasks();
        }, 1200);

    } catch (err) {
        console.error('Submit error:', err);
        showModalFeedback('An unexpected error occurred.', 'error');
    } finally {
        confirmSubmitBtn.disabled    = false;
        confirmSubmitBtn.textContent = 'Submit';
    }
});

// ─── Load tasks ───────────────────────────────────────────────────────────────

async function loadTasks() {
    tasksStatus.textContent    = 'Loading tasks…';
    tasksStatus.style.display  = 'block';
    tasksWrapper.style.display = 'none';
    tasksBody.innerHTML        = '';

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
                ? `<button class="btn-icon download" data-task-id="${t.taskId}"><i class="fa-solid fa-download" aria-hidden="true"></i> Download</button>`
                : `<span class="no-file">No file</span>`;

            // Submission status
            let statusCell, gradeCell, actionCell;
            if (t.result !== null && t.result !== undefined) {
                statusCell = `<span class="badge-graded">Graded</span>`;
                gradeCell  = `<strong>${esc(t.result)}</strong>`;
                actionCell = `<button class="btn-resubmit open-submit"
                                  data-task-id="${t.taskId}"
                                  data-task-title="${esc(t.taskTitle)}">Re-submit</button>`;
            } else if (t.submissionId) {
                statusCell = `<span class="badge-submitted">Submitted</span>`;
                gradeCell  = `<span style="color:#9ca3af;font-size:0.82rem">Pending</span>`;
                actionCell = `<button class="btn-resubmit open-submit"
                                  data-task-id="${t.taskId}"
                                  data-task-title="${esc(t.taskTitle)}">Re-submit</button>`;
            } else {
                statusCell = `<span class="badge-pending">Not submitted</span>`;
                gradeCell  = `<span style="color:#9ca3af;font-size:0.82rem">—</span>`;
                actionCell = `<button class="btn-submit open-submit"
                                  data-task-id="${t.taskId}"
                                  data-task-title="${esc(t.taskTitle)}">Submit</button>`;
            }

            tr.innerHTML = `
                <td>${esc(t.taskTitle)}</td>
                <td><span class="badge-module">${esc(t.moduleCode)}</span> ${esc(t.moduleName)}</td>
                <td>${fmtDate(t.dueDate)}${overdueBadge}</td>
                <td>${fileCell}</td>
                <td>${statusCell}</td>
                <td>${gradeCell}</td>
                <td>${actionCell}</td>
            `;
            tasksBody.appendChild(tr);
        });

    } catch (err) {
        console.error('Failed to load tasks:', err);
        tasksStatus.textContent = 'Failed to load tasks. Please refresh the page.';
    }
}

// ─── Event delegation ─────────────────────────────────────────────────────────

tasksBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.classList.contains('download')) {
        window.location.href = `/api/student/tasks/${btn.dataset.taskId}/file`;
        return;
    }

    if (btn.classList.contains('open-submit')) {
        openSubmitModal(btn.dataset.taskId, btn.dataset.taskTitle);
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadTasks();
