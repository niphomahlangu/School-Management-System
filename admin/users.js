// Users loaded from the database via API
let users = [];

let currentEditingUserId = null;

// Pagination state
let currentPage = 1;
const pageSize = 10; // users per page

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
    const userName = document.getElementById('userName');
    const userSurname = document.getElementById('userSurname');

    addUserBtn.addEventListener('click', openAddUserModal);
    userForm.addEventListener('submit', handleUserFormSubmit);
    searchUsers.addEventListener('input', () => {
        currentPage = 1;
        renderUsersTable();
    });
    filterStatus.addEventListener('change', () => {
        currentPage = 1;
        renderUsersTable();
    });
    
    // Auto-generate email as user types name
    userName.addEventListener('input', updateGeneratedEmail);
    userSurname.addEventListener('input', updateGeneratedEmail);

    // Generate password button (and utility)
    const genBtn = document.getElementById('generatePasswordBtn');
    if (genBtn) {
        genBtn.addEventListener('click', () => {
            const pw = generateTempPassword();
            const pwField = document.getElementById('userPassword');
            if (pwField) pwField.value = pw;
        });
    }
}

// Generate a temporary password (8 characters: letters + digits)
function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
        pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
}

function updateGeneratedEmail() {
    // Only auto-generate email when adding a new user, not when editing
    if (currentEditingUserId !== null) {
        return;
    }
    
    const name = document.getElementById('userName').value.trim().toLowerCase();
    const emailField = document.getElementById('userEmail');
    
    if (name) {
        // Preview email (actual email might have a number if duplicate)
        emailField.value = `${name}@myinstitute.co.za`;
    } else {
        emailField.value = '';
    }
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

function openAddUserModal() {
    currentEditingUserId = null;
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('passwordLabel').textContent = '*';
    document.getElementById('userPassword').required = true;
    document.getElementById('userForm').reset();
    document.getElementById('userEmail').value = '';
    
    // Make email editable for new users
    const emailField = document.getElementById('userEmail');
    emailField.readOnly = false;
    emailField.style.backgroundColor = 'white';
    emailField.style.borderColor = '#ddd';
    emailField.style.color = 'inherit';

    // Auto-generate a temporary password for new users
    const pwField = document.getElementById('userPassword');
    if (pwField) {
        pwField.value = generateTempPassword();
    }
    
    showUserModal();
}

function openEditUserModal(userId) {
    const user = users.find(u => u.id === userId);

    console.log('Editing user:', user);
    if (!user) return;

    currentEditingUserId = userId;
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('passwordLabel').textContent = '(leave empty to keep current)';
    document.getElementById('userPassword').required = false;

    // Populate name/surname from stored fields if available, otherwise split username
    let firstName = user.first_name || '';
    let lastName = user.last_name || '';
    console.log('First name:', firstName, 'Last name:', lastName);

    if (!firstName && user.username) {
        // split on common separators (space, dot, underscore, hyphen)
        const parts = user.username.split(/[\s._-]+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
    }
    document.getElementById('userName').value = firstName;
    document.getElementById('userSurname').value = lastName;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userPassword').value = '';

    // Make email read-only for existing users (cannot be changed)
    const emailField = document.getElementById('userEmail');
    emailField.readOnly = true;
    emailField.style.backgroundColor = '#f5f5f5';
    emailField.style.borderColor = '#e8e8e8';
    emailField.style.color = '#666';

    showUserModal();
}

function showUserModal() {
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

async function handleUserFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('userName').value.trim();
    const surname = document.getElementById('userSurname').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;
    
    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        if (currentEditingUserId) {
            // Edit existing user - send name/surname/role and optional password. Email is not changed here.
            const response = await fetch(`/api/admin/users/${currentEditingUserId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, surname, role, password })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Error updating user');
            }
            alert('User updated successfully!');
        } else {
            // Add new user with provided email
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // For new users include generated username (or admin-provided), email and names
                body: JSON.stringify({ username: `${name.toLowerCase()}.${surname.toLowerCase()}`, email, name, surname, role, password })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Error creating user');
            }
            
            const result = await response.json();
            alert(`User created successfully!\nEmail: ${result.email}\nPassword: ${password}`);            

            // Attempt to log credentials to CSV via server endpoint
            try {
                await fetch('/api/admin/log-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: result.id, email: result.email, password, role })
                });
            } catch (logErr) {
                console.error('Failed to log credentials to server CSV endpoint:', logErr);
            }
        }

        closeUserModal();
        await loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        alert(error.message || 'Error saving user. Please try again.');
    }
}

async function archiveUser(userId) {
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
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    let filteredUsers = users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchTerm) ||
                            user.email.toLowerCase().includes(searchTerm) ||
                            user.id.toString().includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = !!user.is_active;
        } else if (statusFilter === 'archived') {
            matchesStatus = !user.is_active;
        }

        return matchesSearch && matchesStatus;
    });

    const totalItems = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = paginatedUsers.map(user => `
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
                <span style="background: ${user.is_active ? '#c8e6c9' : '#ffccbc'}; color: ${user.is_active ? '#2e7d32' : '#d84315'}; padding: 4px 8px; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
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

    renderPaginationControls(totalItems);
}

function renderPaginationControls(totalItems) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    container.innerHTML = '';

    if (totalItems === 0) {
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'flex-end';
    wrapper.style.gap = '8px';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.style.padding = '6px 12px';
    prevBtn.style.border = '1px solid #ddd';
    prevBtn.style.background = '#f5f5f5';
    prevBtn.style.borderRadius = '4px';
    prevBtn.style.cursor = 'pointer';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderUsersTable();
        }
    };

    const infoSpan = document.createElement('span');
    infoSpan.textContent = `Page ${currentPage} of ${totalPages}`;
    infoSpan.style.fontSize = '0.9rem';
    infoSpan.style.color = '#555';

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.style.padding = '6px 12px';
    nextBtn.style.border = '1px solid #ddd';
    nextBtn.style.background = '#f5f5f5';
    nextBtn.style.borderRadius = '4px';
    nextBtn.style.cursor = 'pointer';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderUsersTable();
        }
    };

    wrapper.appendChild(prevBtn);
    wrapper.appendChild(infoSpan);
    wrapper.appendChild(nextBtn);

    container.appendChild(wrapper);
}
