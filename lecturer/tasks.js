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

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const taskForm       = document.getElementById('taskForm');
const submitBtn      = document.getElementById('submitBtn');
const resetBtn       = document.getElementById('resetBtn');
const formFeedback   = document.getElementById('formFeedback');
const moduleSelect   = document.getElementById('moduleId');
const fileInput      = document.getElementById('taskFile');
const fileNameSpan   = document.getElementById('fileName');
const tasksStatus    = document.getElementById('tasksStatus');
const tasksWrapper   = document.getElementById('tasksTableWrapper');
const tasksBody      = document.getElementById('tasksBody');

// ─── Show feedback banner ─────────────────────────────────────────────────────

function showFeedback(msg, type = 'success') {
    formFeedback.textContent = msg;
    formFeedback.className   = type;
    formFeedback.style.display = 'block';
    if (type === 'success') {
        setTimeout(() => { formFeedback.style.display = 'none'; }, 4000);
    }
}

// ─── Load modules into dropdown ───────────────────────────────────────────────

async function loadModules() {
    try {
        const res = await fetch('/api/lecturer/modules');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const modules = await res.json();

        modules.forEach(m => {
            const opt = document.createElement('option');
            opt.value       = m.moduleId;
            opt.textContent = `${m.moduleCode} – ${m.moduleName}`;
            moduleSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load modules:', err);
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = 'Could not load modules';
        moduleSelect.appendChild(opt);
    }
}

// ─── Load tasks table ─────────────────────────────────────────────────────────

async function loadTasks() {
    tasksStatus.textContent  = 'Loading tasks…';
    tasksStatus.style.display = 'block';
    tasksWrapper.style.display = 'none';
    tasksBody.innerHTML = '';

    try {
        const res = await fetch('/api/lecturer/tasks');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tasks = await res.json();

        if (!tasks.length) {
            tasksStatus.textContent = 'No tasks created yet. Use the form above to add one.';
            return;
        }

        tasksStatus.style.display = 'none';
        tasksWrapper.style.display = 'block';

        tasks.forEach(t => {
            const tr = document.createElement('tr');
            tr.dataset.taskId = t.taskId;

            const fileCell = t.filePath
                ? `<button class="btn-icon download" title="Download file" data-task-id="${t.taskId}">⬇ Download</button>`
                : `<span class="no-file">No file</span>`;

            tr.innerHTML = `
                <td>${esc(t.taskTitle)}</td>
                <td><span class="badge-module">${esc(t.moduleCode)}</span> ${esc(t.moduleName)}</td>
                <td>${fmtDate(t.dueDate)}</td>
                <td>${fileCell}</td>
                <td>
                    <button class="btn-icon view-subs" title="View submissions"
                        data-task-id="${t.taskId}"
                        data-task-title="${esc(t.taskTitle)}">📥 Submissions</button>
                </td>
                <td>
                    <button class="btn-icon delete" title="Delete task" data-task-id="${t.taskId}">🗑 Delete</button>
                </td>
            `;
            tasksBody.appendChild(tr);
        });

    } catch (err) {
        console.error('Failed to load tasks:', err);
        tasksStatus.textContent = 'Failed to load tasks. Please refresh the page.';
    }
}

// ─── File input label ─────────────────────────────────────────────────────────

fileInput.addEventListener('change', () => {
    fileNameSpan.textContent = fileInput.files.length
        ? fileInput.files[0].name
        : 'No file chosen';
});

// ─── Form submission ──────────────────────────────────────────────────────────

taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formFeedback.style.display = 'none';

    const taskTitle   = document.getElementById('taskTitle').value.trim();
    const moduleId    = moduleSelect.value;
    const dueDate     = document.getElementById('dueDate').value;
    const description = document.getElementById('taskDescription').value.trim();

    if (!taskTitle) { showFeedback('Please enter a task title.', 'error'); return; }
    if (!moduleId)  { showFeedback('Please select a module.', 'error'); return; }
    if (!dueDate)   { showFeedback('Please select a due date.', 'error'); return; }

    const formData = new FormData();
    formData.append('taskTitle',       taskTitle);
    formData.append('moduleId',        moduleId);
    formData.append('dueDate',         dueDate);
    formData.append('taskDescription', description);
    if (fileInput.files[0]) {
        formData.append('taskFile', fileInput.files[0]);
    }

    submitBtn.disabled   = true;
    submitBtn.textContent = 'Uploading…';

    try {
        const res = await fetch('/api/lecturer/tasks', {
            method: 'POST',
            body: formData   // Do NOT set Content-Type; browser sets it with boundary
        });
        const data = await res.json();

        if (!res.ok) {
            showFeedback(data.message || 'Failed to create task.', 'error');
            return;
        }

        showFeedback('Task created successfully!', 'success');
        taskForm.reset();
        fileNameSpan.textContent = 'No file chosen';
        await loadTasks();

    } catch (err) {
        console.error('Error creating task:', err);
        showFeedback('An unexpected error occurred. Please try again.', 'error');
    } finally {
        submitBtn.disabled   = false;
        submitBtn.textContent = 'Upload Task';
    }
});

// ─── Reset button ─────────────────────────────────────────────────────────────

resetBtn.addEventListener('click', () => {
    taskForm.reset();
    fileNameSpan.textContent   = 'No file chosen';
    formFeedback.style.display = 'none';
});

// ─── Submissions panel ────────────────────────────────────────────────────────

const subsPanel        = document.getElementById('subsPanel');
const subsPanelTitle   = document.getElementById('subsPanelTitle');
const subsStatus       = document.getElementById('subsStatus');
const subsTableWrapper = document.getElementById('subsTableWrapper');
const subsBody         = document.getElementById('subsBody');
const closeSubsPanel   = document.getElementById('closeSubsPanel');

closeSubsPanel.addEventListener('click', () => {
    subsPanel.classList.remove('open');
});

async function loadSubmissions(taskId, taskTitle) {
    subsPanelTitle.textContent    = `Submissions — ${taskTitle}`;
    subsStatus.textContent        = 'Loading submissions…';
    subsStatus.style.display      = 'block';
    subsTableWrapper.style.display = 'none';
    subsBody.innerHTML            = '';
    subsPanel.classList.add('open');
    subsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetch(`/api/lecturer/tasks/${taskId}/submissions`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const subs = await res.json();

        if (!subs.length) {
            subsStatus.textContent = 'No submissions yet for this task.';
            return;
        }

        subsStatus.style.display       = 'none';
        subsTableWrapper.style.display = 'block';

        subs.forEach(s => {
            const tr = document.createElement('tr');

            const submittedAt = s.submittedAt
                ? new Date(s.submittedAt).toLocaleString('en-ZA', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })
                : '—';

            const currentGrade = s.result !== null && s.result !== undefined ? esc(s.result) : '';

            tr.innerHTML = `
                <td>${esc(s.last_name)}, ${esc(s.first_name)}</td>
                <td>${esc(s.studentNumber)}</td>
                <td>${submittedAt}</td>
                <td>
                    <button class="btn-icon download sub-download"
                        data-sub-id="${s.submissionId}"
                        title="Download submission">⬇ Download</button>
                </td>
                <td>
                    <div class="grade-form">
                        <input class="grade-input" type="text"
                            placeholder="e.g. 85% or A"
                            maxlength="50"
                            value="${currentGrade}"
                            data-sub-id="${s.submissionId}">
                        <button class="btn-save-grade"
                            data-sub-id="${s.submissionId}">Save</button>
                        <span class="grade-saved" id="saved-${s.submissionId}">✓ Saved</span>
                    </div>
                </td>
            `;
            subsBody.appendChild(tr);
        });

    } catch (err) {
        console.error('Failed to load submissions:', err);
        subsStatus.textContent = 'Failed to load submissions. Please try again.';
    }
}

// ─── Submissions panel event delegation ──────────────────────────────────────

subsBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const subId = btn.dataset.subId;

    if (btn.classList.contains('sub-download')) {
        window.location.href = `/api/lecturer/submissions/${subId}/file`;
        return;
    }

    if (btn.classList.contains('btn-save-grade')) {
        const row    = btn.closest('tr');
        const input  = row.querySelector(`.grade-input[data-sub-id="${subId}"]`);
        const saved  = document.getElementById(`saved-${subId}`);
        const grade  = input.value.trim();

        if (!grade) { alert('Please enter a grade or result before saving.'); return; }

        btn.disabled    = true;
        btn.textContent = 'Saving…';

        try {
            const res  = await fetch(`/api/lecturer/submissions/${subId}/grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result: grade })
            });
            const data = await res.json();
            if (!res.ok) { alert(data.message || 'Could not save grade.'); return; }
            saved.style.display = 'inline';
            setTimeout(() => { saved.style.display = 'none'; }, 3000);
        } catch (err) {
            console.error('Grade save error:', err);
            alert('An error occurred while saving the grade.');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Save';
        }
    }
});

// ─── Delete / download via event delegation ───────────────────────────────────

tasksBody.addEventListener('click', async (e) => {
    const btn    = e.target.closest('button');
    if (!btn) return;
    const taskId = btn.dataset.taskId;

    if (btn.classList.contains('delete')) {
        if (!confirm('Delete this task? This cannot be undone.')) return;

        btn.disabled = true;
        try {
            const res  = await fetch(`/api/lecturer/tasks/${taskId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) { alert(data.message || 'Delete failed.'); return; }
            subsPanel.classList.remove('open');
            await loadTasks();
        } catch (err) {
            console.error('Delete error:', err);
            alert('An error occurred while deleting the task.');
        } finally {
            btn.disabled = false;
        }
    }

    if (btn.classList.contains('download')) {
        window.location.href = `/api/lecturer/tasks/${taskId}/file`;
    }

    if (btn.classList.contains('view-subs')) {
        loadSubmissions(taskId, btn.dataset.taskTitle);
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadModules();
loadTasks();
