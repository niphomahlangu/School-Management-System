let courses = [];
let allDepartments = [];
let allModules = [];

let currentEditingCourseId = null;
let currentModulesCourseId = null;

let currentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
    loadDepartments();
    loadAllModules();
    loadCourses();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('addCourseBtn').addEventListener('click', openAddCourseModal);
    document.getElementById('courseForm').addEventListener('submit', handleCourseFormSubmit);
    document.getElementById('searchCourses').addEventListener('input', () => { currentPage = 1; renderTable(); });
    document.getElementById('filterDepartment').addEventListener('change', () => { currentPage = 1; renderTable(); });
    document.getElementById('modalOverlay').addEventListener('click', () => {
        closeCourseModal();
        closeModulesModal();
        closeViewCourseModal();
    });
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadDepartments() {
    try {
        const resp = await fetch('/api/admin/departments');
        if (!resp.ok) return;
        allDepartments = await resp.json();
        populateDepartmentDropdowns();
    } catch (err) {
        console.error('Error loading departments:', err);
    }
}

async function loadAllModules() {
    try {
        const resp = await fetch('/api/admin/modules');
        if (!resp.ok) return;
        allModules = await resp.json();
    } catch (err) {
        console.error('Error loading modules:', err);
    }
}

async function loadCourses() {
    try {
        const resp = await fetch('/api/admin/courses');
        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                window.location.replace('/');
                return;
            }
            throw new Error('Failed to load courses');
        }
        courses = await resp.json();
        renderTable();
    } catch (err) {
        console.error('Error loading courses:', err);
        alert('Error loading courses from database.');
    }
}

function populateDepartmentDropdowns() {
    // Filter bar
    const filterSel = document.getElementById('filterDepartment');
    filterSel.innerHTML = '<option value="">All Departments</option>';
    allDepartments.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.departmentId;
        opt.textContent = d.departmentName;
        filterSel.appendChild(opt);
    });

    // Form dropdown
    const formSel = document.getElementById('courseDepartment');
    formSel.innerHTML = '<option value="">— No Department —</option>';
    allDepartments.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.departmentId;
        opt.textContent = `${d.departmentName} (${d.departmentCode})`;
        formSel.appendChild(opt);
    });
}

// ─── Table Rendering ──────────────────────────────────────────────────────────

function renderTable() {
    const search = document.getElementById('searchCourses').value.toLowerCase();
    const deptFilter = document.getElementById('filterDepartment').value;

    const filtered = courses.filter(c => {
        const matchSearch = !search ||
            c.courseName.toLowerCase().includes(search) ||
            c.courseCode.toLowerCase().includes(search);
        const matchDept = !deptFilter || String(c.departmentId) === deptFilter;
        return matchSearch && matchDept;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const tbody = document.getElementById('coursesTableBody');
    tbody.innerHTML = '';

    if (paged.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#666;">No courses found</td></tr>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    paged.forEach(course => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e0e0e0';

        const moduleCount = course.moduleIds ? course.moduleIds.length : 0;
        const deptLabel = course.departmentName
            ? `<span style="background:#fef9c3;color:#92400e;border-radius:10px;padding:0.15rem 0.6rem;font-size:0.8rem;">${course.departmentName}</span>`
            : '<span style="color:#999;">—</span>';

        row.innerHTML = `
            <td style="padding:12px;font-family:monospace;font-size:0.9rem;">${course.courseCode}</td>
            <td style="padding:12px;font-weight:500;">${course.courseName}</td>
            <td style="padding:12px;">${deptLabel}</td>
            <td style="padding:12px;">
                <span style="background:#dbeafe;color:#1e40af;border-radius:10px;padding:0.15rem 0.6rem;font-size:0.8rem;cursor:pointer;"
                    onclick="openModulesModal(${course.courseId})">
                    ${moduleCount} module${moduleCount !== 1 ? 's' : ''}
                </span>
            </td>
            <td style="padding:12px;text-align:center;position:relative;">
                <div class="action-dropdown" style="display:inline-block;position:relative;">
                    <button onclick="toggleActionMenu(event,${course.courseId})" class="btn btn-sm"
                        style="padding:0.4rem 0.8rem;background:#6b7280;color:white;border:none;border-radius:4px;cursor:pointer;font-size:1.2rem;line-height:1;">&#8942;</button>
                    <div id="menu-${course.courseId}" class="action-menu"
                        style="display:none;position:absolute;right:0;top:100%;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);min-width:130px;z-index:1000;margin-top:0.25rem;">
                        <button onclick="viewCourse(${course.courseId});toggleActionMenu(event,${course.courseId})"
                            onmouseover="this.style.backgroundColor='#d1fae5'" onmouseout="this.style.backgroundColor=''"
                            style="display:block;width:100%;padding:0.75rem 1rem;text-align:left;border:none;background:none;cursor:pointer;color:#10b981;font-weight:500;">View</button>
                        <button onclick="openEditCourseModal(${course.courseId});toggleActionMenu(event,${course.courseId})"
                            onmouseover="this.style.backgroundColor='#dbeafe'" onmouseout="this.style.backgroundColor=''"
                            style="display:block;width:100%;padding:0.75rem 1rem;text-align:left;border:none;background:none;cursor:pointer;color:#2563eb;font-weight:500;">Edit</button>
                        <button onclick="openModulesModal(${course.courseId});toggleActionMenu(event,${course.courseId})"
                            onmouseover="this.style.backgroundColor='#ede9fe'" onmouseout="this.style.backgroundColor=''"
                            style="display:block;width:100%;padding:0.75rem 1rem;text-align:left;border:none;background:none;cursor:pointer;color:#7c3aed;font-weight:500;">Modules</button>
                        <button onclick="deleteCourse(${course.courseId});toggleActionMenu(event,${course.courseId})"
                            onmouseover="this.style.backgroundColor='#fee2e2'" onmouseout="this.style.backgroundColor=''"
                            style="display:block;width:100%;padding:0.75rem 1rem;text-align:left;border:none;background:none;cursor:pointer;color:#dc2626;font-weight:500;">Delete</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderPagination(totalPages, filtered.length);
}

function toggleActionMenu(event, courseId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${courseId}`);
    const isOpen = menu.style.display === 'flex';
    document.querySelectorAll('.action-menu').forEach(m => { m.style.display = 'none'; });
    menu.style.display = isOpen ? 'none' : 'flex';
    menu.style.flexDirection = 'column';
}

document.addEventListener('click', () => {
    document.querySelectorAll('.action-menu').forEach(m => { m.style.display = 'none'; });
});

function renderPagination(totalPages, totalItems) {
    const el = document.getElementById('paginationControls');
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    let html = `<div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="margin-right:1rem;color:#666;font-size:0.9rem;">
            Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}
        </span>
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
            style="padding:0.5rem 0.75rem;border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;">Previous</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button onclick="changePage(${i})"
                style="padding:0.5rem 0.75rem;border:1px solid #ddd;background:${i === currentPage ? '#2563eb' : 'white'};color:${i === currentPage ? 'white' : 'black'};border-radius:4px;cursor:pointer;">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span style="padding:0.5rem;">...</span>';
        }
    }

    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
        style="padding:0.5rem 0.75rem;border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;">Next</button></div>`;
    el.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(courses.length / pageSize);
    if (page >= 1 && page <= totalPages) { currentPage = page; renderTable(); }
}

// ─── Course Modal ─────────────────────────────────────────────────────────────

function openAddCourseModal() {
    currentEditingCourseId = null;
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseForm').reset();
    showModal('courseModal');
}

function openEditCourseModal(courseId) {
    const course = courses.find(c => c.courseId === courseId);
    if (!course) return;
    currentEditingCourseId = courseId;
    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseCode').value = course.courseCode;
    document.getElementById('courseName').value = course.courseName;
    document.getElementById('courseDepartment').value = course.departmentId || '';
    showModal('courseModal');
}

function closeCourseModal() {
    hideModal('courseModal');
}

async function handleCourseFormSubmit(e) {
    e.preventDefault();
    const payload = {
        courseCode: document.getElementById('courseCode').value.trim(),
        courseName: document.getElementById('courseName').value.trim(),
        departmentId: document.getElementById('courseDepartment').value || null
    };

    try {
        const url = currentEditingCourseId
            ? `/api/admin/courses/${currentEditingCourseId}`
            : '/api/admin/courses';
        const method = currentEditingCourseId ? 'PUT' : 'POST';
        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error saving course');
        }
        closeCourseModal();
        await loadCourses();
        await loadDepartments();
    } catch (err) {
        alert(err.message || 'Error saving course. Please try again.');
    }
}

async function deleteCourse(courseId) {
    const course = courses.find(c => c.courseId === courseId);
    if (!confirm(`Delete course "${course?.courseName}"?\nThis will also remove all module, lecturer, and student enrolment links for this course.`)) return;
    try {
        const resp = await fetch(`/api/admin/courses/${courseId}`, { method: 'DELETE' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error deleting course');
        }
        await loadCourses();
    } catch (err) {
        alert(err.message || 'Error deleting course.');
    }
}

// ─── View Course Modal ────────────────────────────────────────────────────────

function viewCourse(courseId) {
    const course = courses.find(c => c.courseId === courseId);
    if (!course) return;

    const modulesHtml = course.moduleNames && course.moduleNames.length
        ? course.moduleNames.map((name, i) =>
            `<span style="display:inline-block;background:#dbeafe;color:#1e40af;border-radius:10px;padding:0.2rem 0.6rem;font-size:0.85rem;margin:0.2rem;">${course.moduleCodes[i]} — ${name}</span>`
          ).join(' ')
        : '<span style="color:#999;">No modules assigned</span>';

    document.getElementById('viewCourseContent').innerHTML = `
        <div style="display:grid;gap:1.5rem;">
            <div style="background:#f8f9fa;padding:1.5rem;border-radius:8px;">
                <h3 style="margin-bottom:1rem;color:#2563eb;">Course Information</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div><strong>Code:</strong> <span style="font-family:monospace;">${course.courseCode}</span></div>
                    <div><strong>Department:</strong> ${course.departmentName || '—'}</div>
                    <div style="grid-column:1/-1;"><strong>Full Name:</strong> ${course.courseName}</div>
                </div>
            </div>
            <div style="background:#f8f9fa;padding:1.5rem;border-radius:8px;">
                <h3 style="margin-bottom:1rem;color:#2563eb;">Modules (${course.moduleIds.length})</h3>
                <div>${modulesHtml}</div>
            </div>
        </div>
    `;
    showModal('viewCourseModal');
}

function closeViewCourseModal() {
    hideModal('viewCourseModal');
}

// ─── Modules Modal ────────────────────────────────────────────────────────────

async function openModulesModal(courseId) {
    const course = courses.find(c => c.courseId === courseId);
    if (!course) return;
    currentModulesCourseId = courseId;

    document.getElementById('modulesModalTitle').textContent = `Modules — ${course.courseCode}`;
    document.getElementById('modulesModalSubtitle').textContent = course.courseName;

    await loadAllModules();
    renderAssignedModules(course);
    populateExistingModulesDropdown(course);

    document.getElementById('newModuleCode').value = '';
    document.getElementById('newModuleName').value = '';

    showModal('modulesModal');
}

function renderAssignedModules(course) {
    const container = document.getElementById('assignedModulesList');
    if (!course.moduleIds || course.moduleIds.length === 0) {
        container.innerHTML = '<p style="color:#999;padding:0.5rem;font-size:0.9rem;">No modules assigned yet.</p>';
        return;
    }
    container.innerHTML = course.moduleIds.map((mid, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;border-bottom:1px solid #f0f0f0;">
            <span>
                <span style="font-family:monospace;font-size:0.85rem;color:#6b7280;">${course.moduleCodes[i]}</span>
                &nbsp;${course.moduleNames[i]}
            </span>
            <button onclick="unlinkModule(${mid})"
                style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.1rem;padding:0 0.25rem;"
                title="Remove from course">&times;</button>
        </div>
    `).join('');
}

function populateExistingModulesDropdown(course) {
    const sel = document.getElementById('existingModuleSelect');
    sel.innerHTML = '<option value="">Select a module...</option>';
    allModules
        .filter(m => !course.moduleIds.includes(m.moduleId))
        .forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.moduleId;
            opt.textContent = `${m.moduleCode} — ${m.moduleName}`;
            sel.appendChild(opt);
        });
}

async function linkExistingModule() {
    const moduleId = parseInt(document.getElementById('existingModuleSelect').value);
    if (!moduleId) { alert('Please select a module.'); return; }

    try {
        const resp = await fetch(`/api/admin/courses/${currentModulesCourseId}/modules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleId })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error linking module');
        }
        await loadCourses();
        const updated = courses.find(c => c.courseId === currentModulesCourseId);
        renderAssignedModules(updated);
        populateExistingModulesDropdown(updated);
    } catch (err) {
        alert(err.message || 'Error linking module.');
    }
}

async function createAndLinkModule() {
    const moduleCode = document.getElementById('newModuleCode').value.trim();
    const moduleName = document.getElementById('newModuleName').value.trim();
    if (!moduleCode || !moduleName) { alert('Both module code and name are required.'); return; }

    try {
        const resp = await fetch('/api/admin/modules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleCode, moduleName, courseId: currentModulesCourseId })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error creating module');
        }
        document.getElementById('newModuleCode').value = '';
        document.getElementById('newModuleName').value = '';
        await loadAllModules();
        await loadCourses();
        const updated = courses.find(c => c.courseId === currentModulesCourseId);
        renderAssignedModules(updated);
        populateExistingModulesDropdown(updated);
    } catch (err) {
        alert(err.message || 'Error creating module.');
    }
}

async function unlinkModule(moduleId) {
    if (!confirm('Remove this module from the course?')) return;
    try {
        const resp = await fetch(`/api/admin/courses/${currentModulesCourseId}/modules/${moduleId}`, { method: 'DELETE' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error removing module');
        }
        await loadCourses();
        const updated = courses.find(c => c.courseId === currentModulesCourseId);
        renderAssignedModules(updated);
        populateExistingModulesDropdown(updated);
    } catch (err) {
        alert(err.message || 'Error removing module.');
    }
}

function closeModulesModal() {
    currentModulesCourseId = null;
    hideModal('modulesModal');
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

function showModal(id) {
    document.getElementById(id).style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function hideModal(id) {
    document.getElementById(id).style.display = 'none';
    // Only hide overlay if no other modal is open
    const anyOpen = ['courseModal', 'modulesModal', 'viewCourseModal']
        .some(m => document.getElementById(m).style.display === 'flex');
    if (!anyOpen) {
        document.getElementById('modalOverlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}
