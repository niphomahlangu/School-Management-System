// Lecturers loaded from the database via API
let lecturers = [];
let allCourses = [];

let currentEditingLecturerId = null;

// Pagination state
let currentPage = 1;
const pageSize = 10;

// Generate a temporary password (8 characters: letters + digits)
function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
        pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
}

document.addEventListener('DOMContentLoaded', () => {
    setupLecturerManagement();
    loadCourses();
    loadLecturers();
});

// ─── Data Loading ────────────────────────────────────────────────────────────

async function loadCourses() {
    try {
        const resp = await fetch('/api/courses');
        if (!resp.ok) return;
        allCourses = await resp.json();

        const filterCourse = document.getElementById('filterCourse');
        filterCourse.innerHTML = '<option value="">All Courses</option>';
        allCourses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.courseId || c.courseCode;
            opt.textContent = c.shortName ? `${c.shortName} (${c.courseCode})` : c.courseName;
            filterCourse.appendChild(opt);
        });

        renderCourseCheckboxes([]);
    } catch (err) {
        console.error('Error loading courses:', err);
    }
}

function renderCourseCheckboxes(selectedIds) {
    const container = document.getElementById('coursesCheckboxContainer');
    if (!allCourses || allCourses.length === 0) {
        container.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No courses available.</p>';
        return;
    }
    container.innerHTML = allCourses.map(c => {
        const label = c.shortName ? `${c.shortName} (${c.courseCode})` : c.courseName;
        const checked = selectedIds.includes(c.courseId) ? 'checked' : '';
        return `
        <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; cursor: pointer;">
            <input type="checkbox" name="courseAssign" value="${c.courseId}" ${checked}>
            <span>${label}</span>
        </label>`;
    }).join('');
}



async function loadLecturers() {
    try {
        const response = await fetch('/api/admin/lecturers');
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert('You are not authorized to view lecturers.');
                window.location.replace('/');
                return;
            }
            throw new Error('Failed to load lecturers');
        }
        lecturers = await response.json();
        renderLecturersTable();
    } catch (error) {
        console.error('Error loading lecturers:', error);
        alert('Error loading lecturers from database.');
    }
}

// ─── Table Rendering ─────────────────────────────────────────────────────────

function renderLecturersTable() {
    const searchQuery = document.getElementById('searchLecturers').value.toLowerCase();
    const filterCourse = document.getElementById('filterCourse').value;
    const filterStat = document.getElementById('filterStatus').value;

    const filtered = lecturers.filter(l => {
        const fullName = `${l.firstName} ${l.lastName}`.toLowerCase();
        const matchesSearch = !searchQuery ||
            fullName.includes(searchQuery) ||
            l.email.toLowerCase().includes(searchQuery);
        const matchesCourse = !filterCourse || (l.courseIds && l.courseIds.includes(Number(filterCourse)));
        const matchesStat = filterStat === '' || String(l.isActive) === filterStat;
        return matchesSearch && matchesCourse && matchesStat;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paged = filtered.slice(startIndex, startIndex + pageSize);

    const tbody = document.getElementById('lecturersTableBody');
    tbody.innerHTML = '';

    if (paged.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #666;">No lecturers found</td></tr>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    paged.forEach(lecturer => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e0e0e0';

        const tag = (text, bg, color) =>
            `<span style="display:inline-block;background:${bg};color:${color};border-radius:10px;padding:0.15rem 0.5rem;font-size:0.78rem;margin:0.1rem;">${text}</span>`;

        const coursesHtml = lecturer.courses
            ? lecturer.courses.split(',').map(c => tag(c.trim(), '#ede9fe', '#5b21b6')).join(' ')
            : '<span style="color:#999;">None</span>';

        const deptsHtml = lecturer.departmentNames
            ? lecturer.departmentNames.split(',').map(d => tag(d.trim(), '#fef9c3', '#92400e')).join(' ')
            : '<span style="color:#999;">—</span>';

        const modulesHtml = lecturer.modules
            ? lecturer.modules.split(',').map(m => tag(m.trim(), '#dbeafe', '#1e40af')).join(' ')
            : '<span style="color:#999;">—</span>';

        const isActive = lecturer.isActive === 1 || lecturer.isActive === true;
        const statusBg = isActive ? '#dcfce7' : '#fee2e2';
        const statusColor = isActive ? '#166534' : '#991b1b';
        const statusLabel = isActive ? 'Active' : 'Inactive';

        row.innerHTML = `
            <td style="padding: 12px; display: none;">${lecturer.lecturerId}</td>
            <td style="padding: 12px;">${lecturer.firstName} ${lecturer.lastName}</td>
            <td style="padding: 12px;">${lecturer.email}</td>
            <td style="padding: 12px;">${coursesHtml}</td>
            <td style="padding: 12px;">${deptsHtml}</td>
            <td style="padding: 12px;">${modulesHtml}</td>
            <td style="padding: 12px;">
                <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 500;
                    background: ${statusBg}; color: ${statusColor};">
                    ${statusLabel}
                </span>
            </td>
            <td style="padding: 12px; text-align: center; position: relative;">
                <div class="action-dropdown" style="display: inline-block; position: relative;">
                    <button onclick="toggleActionMenu(event, ${lecturer.lecturerId})" class="btn btn-sm" style="padding: 0.4rem 0.8rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1.2rem; line-height: 1;">&#8942;</button>
                    <div id="menu-${lecturer.lecturerId}" class="action-menu" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 120px; z-index: 1000; margin-top: 0.25rem;">
                        <button onclick="viewLecturer(${lecturer.lecturerId}); toggleActionMenu(event, ${lecturer.lecturerId})" onmouseover="this.style.backgroundColor='#d1fae5'" onmouseout="this.style.backgroundColor=''" style="display: block; width: 100%; padding: 0.75rem 1rem; text-align: left; border: none; background: none; cursor: pointer; color: #10b981; font-weight: 500;">View</button>
                        <button onclick="openEditLecturerModal(${lecturer.lecturerId}); toggleActionMenu(event, ${lecturer.lecturerId})" onmouseover="this.style.backgroundColor='#dbeafe'" onmouseout="this.style.backgroundColor=''" style="display: block; width: 100%; padding: 0.75rem 1rem; text-align: left; border: none; background: none; cursor: pointer; color: #2563eb; font-weight: 500;">Edit</button>
                        <button onclick="toggleLecturerStatus(${lecturer.lecturerId}); toggleActionMenu(event, ${lecturer.lecturerId})" onmouseover="this.style.backgroundColor='#fee2e2'" onmouseout="this.style.backgroundColor=''" style="display: block; width: 100%; padding: 0.75rem 1rem; text-align: left; border: none; background: none; cursor: pointer; color: #dc2626; font-weight: 500;">${isActive ? 'Deactivate' : 'Restore'}</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderPagination(totalPages, filtered.length);
}

function toggleActionMenu(event, lecturerId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${lecturerId}`);
    const isOpen = menu.style.display === 'flex';
    document.querySelectorAll('.action-menu').forEach(m => { m.style.display = 'none'; });
    menu.style.display = isOpen ? 'none' : 'flex';
    menu.style.flexDirection = 'column';
}

document.addEventListener('click', () => {
    document.querySelectorAll('.action-menu').forEach(m => { m.style.display = 'none'; });
});

function renderPagination(totalPages, totalItems) {
    const paginationControls = document.getElementById('paginationControls');
    if (totalPages <= 1) {
        paginationControls.innerHTML = '';
        return;
    }

    let html = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="margin-right: 1rem; color: #666; font-size: 0.9rem;">
                Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}
            </span>
            <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
                style="padding: 0.5rem 0.75rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
                Previous
            </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button onclick="changePage(${i})"
                    style="padding: 0.5rem 0.75rem; border: 1px solid #ddd;
                    background: ${i === currentPage ? '#2563eb' : 'white'};
                    color: ${i === currentPage ? 'white' : 'black'}; border-radius: 4px; cursor: pointer;">
                    ${i}
                </button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span style="padding: 0.5rem;">...</span>';
        }
    }

    html += `
            <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
                style="padding: 0.5rem 0.75rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">
                Next
            </button>
        </div>
    `;
    paginationControls.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(lecturers.length / pageSize);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderLecturersTable();
    }
}

// ─── Setup Event Listeners ────────────────────────────────────────────────────

function setupLecturerManagement() {
    document.getElementById('addLecturerBtn').addEventListener('click', openAddLecturerModal);
    document.getElementById('lecturerForm').addEventListener('submit', handleLecturerFormSubmit);

    const genPw = document.getElementById('generatePassword');
    const pwContainer = document.getElementById('passwordContainer');
    genPw.addEventListener('change', () => {
        pwContainer.style.display = genPw.checked ? 'none' : 'block';
    });

    document.getElementById('searchLecturers').addEventListener('input', () => { currentPage = 1; renderLecturersTable(); });
    document.getElementById('filterCourse').addEventListener('change', () => { currentPage = 1; renderLecturersTable(); });
    document.getElementById('filterStatus').addEventListener('change', () => { currentPage = 1; renderLecturersTable(); });

    document.getElementById('modalOverlay').addEventListener('click', () => {
        closeLecturerModal();
        closeViewLecturerModal();
    });

    document.getElementById('lecturerFirstName').addEventListener('input', updateLecturerGeneratedEmail);
    document.getElementById('lecturerLastName').addEventListener('input', updateLecturerGeneratedEmail);
}

function updateLecturerGeneratedEmail() {
    if (currentEditingLecturerId !== null) return;
    const first = document.getElementById('lecturerFirstName').value.trim().toLowerCase();
    const emailField = document.getElementById('lecturerEmail');
    if (first) {
        const domain = (window.EMAIL_DOMAIN || 'myinstitute.co.za');
        emailField.value = `${first}@${domain}`;
    } else {
        emailField.value = '';
    }
}

// ─── Modal Open/Close ─────────────────────────────────────────────────────────

function openAddLecturerModal() {
    currentEditingLecturerId = null;
    document.getElementById('modalTitle').textContent = 'Add Lecturer';
    document.getElementById('lecturerForm').reset();
    document.getElementById('generatePassword').checked = true;
    document.getElementById('passwordContainer').style.display = 'none';
    renderCourseCheckboxes([]);
    showLecturerModal();
}

async function openEditLecturerModal(lecturerId) {
    const lecturer = lecturers.find(l => l.lecturerId === lecturerId);
    if (!lecturer) return;

    currentEditingLecturerId = lecturerId;
    document.getElementById('modalTitle').textContent = 'Edit Lecturer';

    document.getElementById('lecturerFirstName').value = lecturer.firstName;
    document.getElementById('lecturerLastName').value = lecturer.lastName;
    document.getElementById('lecturerEmail').value = lecturer.email;
    document.getElementById('lecturerPhone').value = lecturer.phone || '';

    // Hide password section when editing
    document.getElementById('generatePassword').checked = true;
    document.getElementById('passwordContainer').style.display = 'none';

    // Pre-check courses already assigned to this lecturer
    renderCourseCheckboxes(lecturer.courseIds || []);

    showLecturerModal();
}

function showLecturerModal() {
    document.getElementById('lecturerModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeLecturerModal() {
    document.getElementById('lecturerModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function viewLecturer(lecturerId) {
    const lecturer = lecturers.find(l => l.lecturerId === lecturerId);
    if (!lecturer) return;

    const coursesList = lecturer.courses
        ? lecturer.courses.split(',').map(c => c.trim()).filter(Boolean)
        : [];
    const coursesHtml = coursesList.length
        ? coursesList.map(c => `<span style="display: inline-block; background:#dbeafe; color:#1e40af; border-radius:10px; padding:0.2rem 0.6rem; font-size:0.85rem; margin:0.2rem;">${c}</span>`).join(' ')
        : '<span style="color:#999;">None assigned</span>';

    const deptsList = lecturer.departmentNames
        ? lecturer.departmentNames.split(',').map(d => d.trim()).filter(Boolean)
        : [];
    const deptsHtml = deptsList.length
        ? deptsList.map(d => `<span style="display: inline-block; background:#fef9c3; color:#854d0e; border-radius:10px; padding:0.2rem 0.6rem; font-size:0.85rem; margin:0.2rem;">${d}</span>`).join(' ')
        : '<span style="color:#999;">None</span>';

    const modulesList = lecturer.modules
        ? lecturer.modules.split(',').map(m => m.trim()).filter(Boolean)
        : [];
    const modulesHtml = modulesList.length
        ? modulesList.map(m => `<span style="display: inline-block; background:#dcfce7; color:#166534; border-radius:10px; padding:0.2rem 0.6rem; font-size:0.85rem; margin:0.2rem;">${m}</span>`).join(' ')
        : '<span style="color:#999;">None assigned</span>';

    const isActive = lecturer.isActive === 1 || lecturer.isActive === true;

    document.getElementById('lecturerDetailsContent').innerHTML = `
        <div style="display: grid; gap: 1.5rem;">
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Personal Information</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Full Name:</strong> ${lecturer.firstName} ${lecturer.lastName}</div>
                    <div><strong>Email:</strong> ${lecturer.email}</div>
                    <div><strong>Phone:</strong> ${lecturer.phone || 'N/A'}</div>
                    <div><strong>Status:</strong>
                        <span style="padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem; font-weight: 500;
                            background: ${isActive ? '#dcfce7' : '#fee2e2'}; color: ${isActive ? '#166534' : '#991b1b'};">
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Academic Assignment</h3>
                <div style="margin-bottom: 0.75rem;"><strong>Courses:</strong><div style="margin-top: 0.5rem;">${coursesHtml}</div></div>
                <div style="margin-bottom: 0.75rem;"><strong>Departments:</strong><div style="margin-top: 0.5rem;">${deptsHtml}</div></div>
                <div><strong>Modules:</strong><div style="margin-top: 0.5rem;">${modulesHtml}</div></div>
            </div>
        </div>
    `;

    document.getElementById('viewLecturerModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeViewLecturerModal() {
    document.getElementById('viewLecturerModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ─── Form Submit ──────────────────────────────────────────────────────────────

async function handleLecturerFormSubmit(e) {
    e.preventDefault();

    const selectedCourses = Array.from(
        document.querySelectorAll('input[name="courseAssign"]:checked')
    ).map(cb => parseInt(cb.value));

    const lecturerData = {
        firstName: document.getElementById('lecturerFirstName').value.trim(),
        lastName: document.getElementById('lecturerLastName').value.trim(),
        email: document.getElementById('lecturerEmail').value.trim(),
        phone: document.getElementById('lecturerPhone').value.trim(),
        courseIds: selectedCourses
    };

    if (!currentEditingLecturerId) {
        const genPw = document.getElementById('generatePassword');
        const pwInput = document.getElementById('lecturerPassword');
        let password = '';

        if (genPw && genPw.checked) {
            password = generateTempPassword();
        } else if (pwInput) {
            password = pwInput.value.trim();
        }

        if (!password || password.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        lecturerData.password = password;

        const first = lecturerData.firstName.toLowerCase().replace(/\s+/g, '.');
        const last = lecturerData.lastName.toLowerCase().replace(/\s+/g, '.');
        lecturerData.username = first && last ? `${first}.${last}` : (first || last);
    }

    try {
        let response;
        if (currentEditingLecturerId) {
            response = await fetch(`/api/admin/lecturers/${currentEditingLecturerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lecturerData)
            });
        } else {
            response = await fetch('/api/admin/lecturers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lecturerData)
            });
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Error saving lecturer');
        }

        const result = await response.json().catch(() => ({}));

        if (!currentEditingLecturerId && lecturerData.password) {
            alert(`Lecturer added successfully!\nTemporary password: ${lecturerData.password}\nPlease communicate this securely.`);
            try {
                await fetch('/api/admin/log-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: result.id, email: result.email, password: lecturerData.password, role: 'lecturer' })
                });
            } catch (logErr) {
                console.error('Failed to log lecturer credentials:', logErr);
            }
        } else {
            alert('Lecturer updated successfully!');
        }

        closeLecturerModal();
        await loadLecturers();
    } catch (error) {
        console.error('Error saving lecturer:', error);
        alert(error.message || 'Error saving lecturer. Please try again.');
    }
}

// ─── Toggle Status ────────────────────────────────────────────────────────────

async function toggleLecturerStatus(lecturerId) {
    const lecturer = lecturers.find(l => l.lecturerId === lecturerId);
    if (!lecturer) return;

    const isActive = lecturer.isActive === 1 || lecturer.isActive === true;
    const action = isActive ? 'deactivate' : 'restore';
    if (!confirm(`Are you sure you want to ${action} ${lecturer.firstName} ${lecturer.lastName}?`)) return;

    try {
        const response = await fetch(`/api/admin/lecturers/${lecturerId}/status`, { method: 'PATCH' });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Error updating lecturer status');
        }
        const data = await response.json();
        alert(`Lecturer ${data.isActive ? 'restored' : 'deactivated'} successfully!`);
        await loadLecturers();
    } catch (error) {
        console.error('Error updating lecturer status:', error);
        alert('Error updating lecturer status. Please try again.');
    }
}
