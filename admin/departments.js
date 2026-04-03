let departments = [];
let currentEditingDeptId = null;
let currentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
    loadDepartments();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('addDepartmentBtn').addEventListener('click', openAddDeptModal);
    document.getElementById('deptForm').addEventListener('submit', handleDeptFormSubmit);
    document.getElementById('searchDepartments').addEventListener('input', () => { currentPage = 1; renderTable(); });
    document.getElementById('modalOverlay').addEventListener('click', () => {
        closeDeptModal();
        closeViewDeptModal();
    });
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadDepartments() {
    try {
        const resp = await fetch('/api/admin/departments');
        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                window.location.replace('/');
                return;
            }
            throw new Error('Failed to load departments');
        }
        departments = await resp.json();
        renderTable();
    } catch (err) {
        console.error('Error loading departments:', err);
        alert('Error loading departments from database.');
    }
}

// ─── Table Rendering ──────────────────────────────────────────────────────────

function renderTable() {
    const search = document.getElementById('searchDepartments').value.toLowerCase();

    const filtered = departments.filter(d =>
        !search ||
        d.departmentName.toLowerCase().includes(search) ||
        d.departmentCode.toLowerCase().includes(search)
    );

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const tbody = document.getElementById('departmentsTableBody');
    tbody.innerHTML = '';

    if (paged.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#666;">No departments found</td></tr>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    paged.forEach(dept => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e0e0e0';
        row.innerHTML = `
            <td style="padding:12px;font-family:monospace;font-size:0.9rem;">${dept.departmentCode}</td>
            <td style="padding:12px;font-weight:500;">${dept.departmentName}</td>
            <td style="padding:12px;text-align:center;">
                <span style="background:#dbeafe;color:#1e40af;border-radius:10px;padding:0.15rem 0.6rem;font-size:0.8rem;">
                    ${dept.courseCount} course${dept.courseCount !== 1 ? 's' : ''}
                </span>
            </td>
            <td style="padding:12px;text-align:center;position:relative;">
                <div class="action-dropdown" style="display:inline-block;position:relative;">
                    <button onclick="toggleActionMenu(event,${dept.departmentId})" class="btn btn-sm"
                        style="padding:0.4rem 0.8rem;background:#6b7280;color:white;border:none;border-radius:4px;cursor:pointer;font-size:1.2rem;line-height:1;">&#8942;</button>
                    <div id="menu-${dept.departmentId}" class="action-menu"
                        style="display:none;position:absolute;right:0;top:100%;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);min-width:120px;z-index:1000;margin-top:0.25rem;">
                        <button onclick="viewDept(${dept.departmentId});toggleActionMenu(event,${dept.departmentId})"
                            onmouseover="this.style.backgroundColor='#d1fae5'" onmouseout="this.style.backgroundColor=''"
                            style="display:block;width:100%;padding:0.75rem 1rem;text-align:left;border:none;background:none;cursor:pointer;color:#10b981;font-weight:500;">View</button>
                        <button onclick="openEditDeptModal(${dept.departmentId});toggleActionMenu(event,${dept.departmentId})"
                            onmouseover="this.style.backgroundColor='#dbeafe'" onmouseout="this.style.backgroundColor=''"
                            style="display:block;width:100%;padding:0.75rem 1rem;text-align:left;border:none;background:none;cursor:pointer;color:#2563eb;font-weight:500;">Edit</button>
                        <button onclick="deleteDept(${dept.departmentId});toggleActionMenu(event,${dept.departmentId})"
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

function toggleActionMenu(event, deptId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${deptId}`);
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
    const totalPages = Math.ceil(departments.length / pageSize);
    if (page >= 1 && page <= totalPages) { currentPage = page; renderTable(); }
}

// ─── Department Modal ─────────────────────────────────────────────────────────

function openAddDeptModal() {
    currentEditingDeptId = null;
    document.getElementById('deptModalTitle').textContent = 'Add Department';
    document.getElementById('deptForm').reset();
    showModal('deptModal');
}

function openEditDeptModal(deptId) {
    const dept = departments.find(d => d.departmentId === deptId);
    if (!dept) return;
    currentEditingDeptId = deptId;
    document.getElementById('deptModalTitle').textContent = 'Edit Department';
    document.getElementById('deptCode').value = dept.departmentCode;
    document.getElementById('deptName').value = dept.departmentName;
    showModal('deptModal');
}

function closeDeptModal() {
    hideModal('deptModal');
}

async function handleDeptFormSubmit(e) {
    e.preventDefault();
    const payload = {
        departmentCode: document.getElementById('deptCode').value.trim(),
        departmentName: document.getElementById('deptName').value.trim()
    };

    try {
        const url = currentEditingDeptId
            ? `/api/admin/departments/${currentEditingDeptId}`
            : '/api/admin/departments';
        const method = currentEditingDeptId ? 'PUT' : 'POST';
        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error saving department');
        }
        closeDeptModal();
        await loadDepartments();
    } catch (err) {
        alert(err.message || 'Error saving department. Please try again.');
    }
}

async function deleteDept(deptId) {
    const dept = departments.find(d => d.departmentId === deptId);
    if (!confirm(`Delete department "${dept?.departmentName}"?\nCourses linked to this department will have their department cleared.`)) return;
    try {
        const resp = await fetch(`/api/admin/departments/${deptId}`, { method: 'DELETE' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error deleting department');
        }
        await loadDepartments();
    } catch (err) {
        alert(err.message || 'Error deleting department.');
    }
}

// ─── View Department Modal ────────────────────────────────────────────────────

function viewDept(deptId) {
    const dept = departments.find(d => d.departmentId === deptId);
    if (!dept) return;

    document.getElementById('viewDeptContent').innerHTML = `
        <div style="background:#f8f9fa;padding:1.5rem;border-radius:8px;">
            <h3 style="margin-bottom:1rem;color:#2563eb;">Department Information</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div><strong>Code:</strong> <span style="font-family:monospace;">${dept.departmentCode}</span></div>
                <div><strong>Courses:</strong> ${dept.courseCount}</div>
                <div style="grid-column:1/-1;"><strong>Name:</strong> ${dept.departmentName}</div>
            </div>
        </div>
    `;
    showModal('viewDeptModal');
}

function closeViewDeptModal() {
    hideModal('viewDeptModal');
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────

function showModal(id) {
    document.getElementById(id).style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function hideModal(id) {
    document.getElementById(id).style.display = 'none';
    const anyOpen = ['deptModal', 'viewDeptModal']
        .some(m => document.getElementById(m).style.display === 'flex');
    if (!anyOpen) {
        document.getElementById('modalOverlay').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}
