// Users loaded from the database via API
let users = [];

let currentEditingUserId = null;

// Initialize user management on the dedicated users page
document.addEventListener('DOMContentLoaded', () => {
    setupUserManagement();
    loadUsers();

    // Close modal when clicking on the modal overlay
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        //modalOverlay.addEventListener('click', closeUserModal);
    }
});

function setupUserManagement() {
    const addUserBtn = document.getElementById('addUserBtn');
    const userForm = document.getElementById('userForm');
    const searchUsers = document.getElementById('searchUsers');
    const filterStatus = document.getElementById('filterStatus');

    //addUserBtn.addEventListener('click', openAddUserModal);
    //userForm.addEventListener('submit', handleUserFormSubmit);
    searchUsers.addEventListener('input', renderUsersTable);
    filterStatus.addEventListener('change', renderUsersTable);
}

// Load users from the server
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        console.log('Status:', response.status);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert('You are not authorized to view users.');
                window.location.replace('/');
                return;
            }
            throw new Error('Failed to load users');
        }
        users = await response.json();
        console.log('Users:', users);
        renderUsersTable();
    } catch (error) {
        console.error('Error loading users:', error);
        alert('Error loading users. Please try again later.');
    }
}

/* function openAddUserModal() {
    currentEditingUserId = null;
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('passwordLabel').textContent = '*';
    document.getElementById('userPassword').required = true;
    document.getElementById('userForm').reset();
    showUserModal();
} */

/* function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    currentEditingUserId = userId;
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('passwordLabel').textContent = '(leave empty to keep current)';
    document.getElementById('userPassword').required = false;

    document.getElementById('userName').value = user.name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userPassword').value = '';

    showUserModal();
} */

/* function showUserModal() {
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
} */

/* function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
} */

/* async function handleUserFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;
    try {
        if (currentEditingUserId) {
            // Edit existing user
            const response = await fetch(`/api/admin/users/${currentEditingUserId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, role, password })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Error updating user');
            }
        } else {
            // Add new user
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, role, password })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Error creating user');
            }
        }

        closeUserModal();
        await loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        alert(error.message || 'Error saving user. Please try again.');
    }
} */

/* async function deleteUser(userId) {
    if (!confirm('Are you sure you want to permanently delete this user?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Error deleting user');
        }

        await loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        alert(error.message || 'Error deleting user. Please try again.');
    }
} */

/* async function archiveUser(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PATCH'
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Error updating user status');
        }

        await loadUsers();
    } catch (error) {
        console.error('Error updating user status:', error);
        alert(error.message || 'Error updating user status. Please try again.');
    }
} */

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    let filteredUsers = users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchTerm) ||
                            user.email.toLowerCase().includes(searchTerm) ||
                            user.id.toString().includes(searchTerm);
        
        const matchesStatus = !statusFilter || user.is_active.toString() === statusFilter;

        return matchesSearch && matchesStatus;
    });

    tbody.innerHTML = filteredUsers.map(user => `
        <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 12px; text-align: left;">#${user.id}</td>
            <td style="padding: 12px; text-align: left;">${user.username}</td>
            <td style="padding: 12px; text-align: left;">${user.email}</td>
            <td style="padding: 12px; text-align: left;">
                <span style="background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </td>
            <td style="padding: 12px; text-align: left;">
                <span style="background: ${user.is_active === true ? '#c8e6c9' : '#ffccbc'}; color: ${user.is_active === true ? '#2e7d32' : '#d84315'}; padding: 4px 8px; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button onclick="openEditUserModal(${user.id})" style="background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.875rem;">
                        Edit
                    </button>
                    <button onclick="archiveUser(${user.id})" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.875rem;">
                        ${user.is_active ? 'Archive' : 'Restore'}
                    </button>
                    <button onclick="deleteUser(${user.id})" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.875rem;">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 40px; text-align: center; color: #999;">
                    No users found. Try adjusting your search or filters.
                </td>
            </tr>
        `;
    }
}
