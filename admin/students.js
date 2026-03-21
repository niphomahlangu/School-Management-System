// Students loaded from the database via API
let students = [];

let currentEditingStudentId = null;

// Pagination state
let currentPage = 1;
const pageSize = 10; // students per page

// Generate a temporary password (8 characters: letters + digits)
function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
        pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
}

// Initialize student management on the dedicated students page
document.addEventListener('DOMContentLoaded', () => {
    setupStudentManagement();
    loadCourses();
    loadStudents();
});

// Load courses from server and populate department filters / selects
async function loadCourses() {
    try {
        const resp = await fetch('/api/courses');
        if (!resp.ok) {
            // If unauthorized or server error, keep static options defined in HTML
            console.warn('Could not load courses, using static list');
            return;
        }
        const courses = await resp.json();
        const filterDepartment = document.getElementById('filterDepartment');
        const studentDepartment = document.getElementById('studentDepartment');

        if (!filterDepartment || !studentDepartment) return;

        // Reset options
        filterDepartment.innerHTML = '<option value="">All Departments</option>';
        studentDepartment.innerHTML = '<option value="">Select Department</option>';

        courses.forEach(c => {
            const shortName = (c.shortName || c.courseName || '').trim();
            const label = shortName ? `${shortName} (${c.courseCode})` : `${c.courseName} (${c.courseCode})`;

            // Use full courseName as the value so it matches the server-derived department
            const value = c.courseName || shortName || c.courseCode;

            const opt1 = document.createElement('option');
            opt1.value = value;
            opt1.textContent = label;
            filterDepartment.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = value;
            opt2.textContent = label;
            studentDepartment.appendChild(opt2);
        });
    } catch (err) {
        console.error('Error loading courses:', err);
    }
}

function setupStudentManagement() {
    const addStudentBtn = document.getElementById('addStudentBtn');
    const studentForm = document.getElementById('studentForm');
    const searchStudents = document.getElementById('searchStudents');
    const filterDepartment = document.getElementById('filterDepartment');
    const filterYear = document.getElementById('filterYear');
    const filterStatus = document.getElementById('filterStatus');

    addStudentBtn.addEventListener('click', openAddStudentModal);
    studentForm.addEventListener('submit', handleStudentFormSubmit);
    // Show/hide password entry based on generate checkbox
    const genPw = document.getElementById('generatePassword');
    const pwContainer = document.getElementById('passwordContainer');
    if (genPw) {
        genPw.addEventListener('change', () => {
            if (genPw.checked) pwContainer.style.display = 'none';
            else pwContainer.style.display = 'block';
        });
    }
    searchStudents.addEventListener('input', () => {
        currentPage = 1;
        renderStudentsTable();
    });
    filterDepartment.addEventListener('change', () => {
        currentPage = 1;
        renderStudentsTable();
    });
    filterYear.addEventListener('change', () => {
        currentPage = 1;
        renderStudentsTable();
    });
    filterStatus.addEventListener('change', () => {
        currentPage = 1;
        renderStudentsTable();
    });

    // Close modals when clicking overlay
    document.getElementById('modalOverlay').addEventListener('click', () => {
        closeStudentModal();
        closeViewStudentModal();
    });

    // Auto-generate email preview and username for new students (like users flow)
    const firstNameInput = document.getElementById('studentFirstName');
    const lastNameInput = document.getElementById('studentLastName');
    if (firstNameInput) firstNameInput.addEventListener('input', updateStudentGeneratedEmail);
    if (lastNameInput) lastNameInput.addEventListener('input', updateStudentGeneratedEmail);
}

function updateStudentGeneratedEmail() {
    if (currentEditingStudentId !== null) return; // don't override when editing
    const first = document.getElementById('studentFirstName').value.trim().toLowerCase();
    const emailField = document.getElementById('studentEmail');
    if (first) {
        const domain = (window.EMAIL_DOMAIN || 'myinstitute.co.za');
        emailField.value = `${first}@${domain}`;
    } else {
        emailField.value = '';
    }
}

// Load students from the server
async function loadStudents() {
    try {
        const response = await fetch('/api/admin/students');
        console.log('Status:', response.status);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert('You are not authorized to view students.');
                window.location.replace('/');
                return;
            }
            throw new Error('Failed to load students');
        }
        students = await response.json();
        renderStudentsTable();
    } catch (error) {
        console.error('Error loading students:', error);
        alert('Error loading students from database.');
    }
}



function renderStudentsTable() {
    const searchQuery = document.getElementById('searchStudents').value.toLowerCase();
    const filterDept = document.getElementById('filterDepartment').value;
    const filterYr = document.getElementById('filterYear').value;
    const filterStat = document.getElementById('filterStatus').value;

    // Filter students
    const filteredStudents = students.filter(student => {
        const matchesSearch = !searchQuery || 
            student.studentNumber.toLowerCase().includes(searchQuery) ||
            `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchQuery) ||
            student.email.toLowerCase().includes(searchQuery);
        
        const matchesDept = !filterDept || student.department === filterDept;
        const matchesYear = !filterYr || student.year.toString() === filterYr;
        const matchesStatus = !filterStat || student.status === filterStat;

        return matchesSearch && matchesDept && matchesYear && matchesStatus;
    });

    // Pagination
    const totalPages = Math.ceil(filteredStudents.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';

    if (paginatedStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #666;">No students found</td></tr>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    paginatedStudents.forEach(student => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #e0e0e0';
        row.innerHTML = `
            <td style="padding: 12px; display: none;">${student.id}</td>
            <td style="padding: 12px;">${student.studentNumber}</td>
            <td style="padding: 12px;">${student.firstName} ${student.lastName}</td>
            <td style="padding: 12px;">${student.email}</td>
            <td style="padding: 12px;">${student.department}</td>
            <td style="padding: 12px;">Year ${student.year}</td>
            <td style="padding: 12px;">${student.gpa || 'N/A'}</td>
            <td style="padding: 12px;">
                <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 500; 
                    background: ${getStatusColor(student.status)}; color: ${getStatusTextColor(student.status)};">
                    ${student.status}
                </span>
            </td>
            <td style="padding: 12px; text-align: center; position: relative;">
                <div class="action-dropdown" style="display: inline-block; position: relative;">
                    <button onclick="toggleActionMenu(event, ${student.id})" class="btn btn-sm" style="padding: 0.4rem 0.8rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1.2rem; line-height: 1;">⋮</button>
                    <div id="menu-${student.id}" class="action-menu" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 120px; z-index: 1000; margin-top: 0.25rem;">
                        <button onclick="viewStudent(${student.id}); toggleActionMenu(event, ${student.id})" onmouseover="this.style.backgroundColor='#d1fae5'" onmouseout="this.style.backgroundColor=''" style="display: block; width: 100%; padding: 0.75rem 1rem; text-align: left; border: none; background: none; cursor: pointer; color: #10b981; font-weight: 500; transition: background-color 0.2s;">View</button>
                        <button onclick="openEditStudentModal(${student.id}); toggleActionMenu(event, ${student.id})" onmouseover="this.style.backgroundColor='#dbeafe'" onmouseout="this.style.backgroundColor=''" style="display: block; width: 100%; padding: 0.75rem 1rem; text-align: left; border: none; background: none; cursor: pointer; color: #2563eb; font-weight: 500; transition: background-color 0.2s;">Edit</button>
                            <button onclick="deactivateStudent(${student.id}); toggleActionMenu(event, ${student.id})" onmouseover="this.style.backgroundColor='#fee2e2'" onmouseout="this.style.backgroundColor=''" style="display: block; width: 100%; padding: 0.75rem 1rem; text-align: left; border: none; background: none; cursor: pointer; color: #dc2626; font-weight: 500; transition: background-color 0.2s;">${student.status === 'Active' ? 'Deactivate' : 'Restore'}</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderPagination(totalPages, filteredStudents.length);
}

function getStatusColor(status) {
    switch(status) {
        case 'Active': return '#dcfce7';
        case 'Suspended': return '#fee2e2';
        case 'Graduated': return '#dbeafe';
        default: return '#f3f4f6';
    }
}

function getStatusTextColor(status) {
    switch(status) {
        case 'Active': return '#166534';
        case 'Suspended': return '#991b1b';
        case 'Graduated': return '#1e40af';
        default: return '#374151';
    }
}

function toggleActionMenu(event, studentId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${studentId}`);
    const isOpen = menu.style.display === 'flex';
    
    // Close all other menus
    document.querySelectorAll('.action-menu').forEach(m => {
        m.style.display = 'none';
    });
    
    // Toggle current menu
    menu.style.display = isOpen ? 'none' : 'flex';
    menu.style.flexDirection = 'column';
}

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.action-menu').forEach(menu => {
        menu.style.display = 'none';
    });
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
                Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}
            </span>
            <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
                style="padding: 0.5rem 0.75rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;"
                ${currentPage === 1 ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                Previous
            </button>
    `;

    // Show page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button onclick="changePage(${i})" 
                    style="padding: 0.5rem 0.75rem; border: 1px solid #ddd; background: ${i === currentPage ? '#2563eb' : 'white'}; 
                    color: ${i === currentPage ? 'white' : 'black'}; border-radius: 4px; cursor: pointer;">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span style="padding: 0.5rem;">...</span>';
        }
    }

    html += `
            <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
                style="padding: 0.5rem 0.75rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;"
                ${currentPage === totalPages ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                Next
            </button>
        </div>
    `;

    paginationControls.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(students.length / pageSize);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderStudentsTable();
    }
}

function openAddStudentModal() {
    currentEditingStudentId = null;
    document.getElementById('modalTitle').textContent = 'Add Student';
    document.getElementById('studentForm').reset();
    
    // Set default enrollment date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('studentEnrollmentDate').value = today;
    // Make date fields required for adding a new student
    document.getElementById('studentDOB').required = true;
    document.getElementById('studentEnrollmentDate').required = true;
    // Reset password controls for add
    const genPw = document.getElementById('generatePassword');
    const pwContainer = document.getElementById('passwordContainer');
    if (genPw) { genPw.checked = true; pwContainer.style.display = 'none'; }
    
    showStudentModal();
}

function openEditStudentModal(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    currentEditingStudentId = studentId;
    document.getElementById('modalTitle').textContent = 'Edit Student';

    // Populate form fields
    document.getElementById('studentFirstName').value = student.firstName;
    document.getElementById('studentLastName').value = student.lastName;
    document.getElementById('studentEmail').value = student.email;
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentDOB').value = (student.dateOfBirth || '').split('T')[0];
    document.getElementById('studentAddress').value = student.address || '';
    document.getElementById('studentDepartment').value = student.department;
    document.getElementById('studentYear').value = student.year;
    document.getElementById('studentEnrollmentDate').value = (student.enrollmentDate || '').split('T')[0];
    document.getElementById('studentStatus').value = student.status;
    document.getElementById('emergencyContactName').value = student.emergencyContactName || '';
    document.getElementById('emergencyContactPhone').value = student.emergencyContactPhone || '';

    // When editing, dates shouldn't be mandatory; allow updating other fields only
    document.getElementById('studentDOB').required = false;
    document.getElementById('studentEnrollmentDate').required = false;

    // Hide password controls when editing existing student (no password change by default)
    const genPw = document.getElementById('generatePassword');
    const pwContainer = document.getElementById('passwordContainer');
    if (genPw) { genPw.checked = true; pwContainer.style.display = 'none'; }
    showStudentModal();
}

function showStudentModal() {
    document.getElementById('studentModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function viewStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const detailsContent = document.getElementById('studentDetailsContent');
    detailsContent.innerHTML = `
        <div style="display: grid; gap: 1.5rem;">
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Personal Information</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Student Number:</strong> ${student.studentNumber}</div>
                    <div><strong>Full Name:</strong> ${student.firstName} ${student.lastName}</div>
                    <div><strong>Email:</strong> ${student.email}</div>
                    <div><strong>Phone:</strong> ${student.phone || 'N/A'}</div>
                    <div><strong>Date of Birth:</strong> ${new Date(student.dateOfBirth).toLocaleDateString()}</div>
                    <div><strong>Address:</strong> ${student.address || 'N/A'}</div>
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Academic Information</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Department:</strong> ${student.department}</div>
                    <div><strong>Year Level:</strong> Year ${student.year}</div>
                    <div><strong>Enrollment Date:</strong> ${new Date(student.enrollmentDate).toLocaleDateString()}</div>
                    <div><strong>GPA:</strong> ${student.gpa || 'N/A'}</div>
                    <div><strong>Status:</strong> 
                        <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 500; 
                            background: ${getStatusColor(student.status)}; color: ${getStatusTextColor(student.status)};">
                            ${student.status}
                        </span>
                    </div>
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Emergency Contact</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><strong>Name:</strong> ${student.emergencyContactName || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${student.emergencyContactPhone || 'N/A'}</div>
                </div>
            </div>

            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Enrolled Courses</h3>
                <p style="color: #666;">Course enrollment information will be displayed here.</p>
            </div>

            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem; color: #2563eb;">Academic Performance</h3>
                <p style="color: #666;">Performance history and grades will be displayed here.</p>
            </div>
        </div>
    `;

    document.getElementById('viewStudentModal').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeViewStudentModal() {
    document.getElementById('viewStudentModal').style.display = 'none';
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

async function handleStudentFormSubmit(e) {
    e.preventDefault();

    const studentData = {
        firstName: document.getElementById('studentFirstName').value.trim(),
        lastName: document.getElementById('studentLastName').value.trim(),
        email: document.getElementById('studentEmail').value.trim(),
        phone: document.getElementById('studentPhone').value.trim(),
        dateOfBirth: document.getElementById('studentDOB').value,
        address: document.getElementById('studentAddress').value.trim(),
        department: document.getElementById('studentDepartment').value,
        year: parseInt(document.getElementById('studentYear').value),
        enrollmentDate: document.getElementById('studentEnrollmentDate').value,
        status: document.getElementById('studentStatus').value,
        emergencyContactName: document.getElementById('emergencyContactName').value.trim(),
        emergencyContactPhone: document.getElementById('emergencyContactPhone').value.trim()
    };

    // Only include password when creating a new student (server requires it)
    if (!currentEditingStudentId) {
        const genPw = document.getElementById('generatePassword');
        const pwInput = document.getElementById('studentPassword');
        let password = '';

        if (genPw && genPw.checked) {
            password = generateTempPassword();
        } else if (pwInput) {
            password = pwInput.value.trim();
        }

        if (!password || password.length < 6) {
            alert('Password must be at least 6 characters. Either enter one or allow generation.');
            return;
        }

        studentData.password = password;
    }
    try {
        if (currentEditingStudentId) {
            // Edit existing student
            const response = await fetch(`/api/admin/students/${currentEditingStudentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(studentData)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Error updating student');
            }
            alert('Student updated successfully!');
        } else {
            // Add new student
            // compute username in same format as users flow: first.last (lowercased, spaces -> dots)
            const first = (studentData.firstName || '').trim().toLowerCase();
            const last = (studentData.lastName || '').trim().toLowerCase();
            const sanitizedFirst = first.replace(/\s+/g, '.');
            const sanitizedLast = last.replace(/\s+/g, '.');
            const generatedUsername = sanitizedFirst && sanitizedLast ? `${sanitizedFirst}.${sanitizedLast}` : (sanitizedFirst || sanitizedLast);

            const response = await fetch('/api/admin/students', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ...studentData, username: generatedUsername })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));

                // If email already exists on users table, offer to link records
                if (response.status === 400 && err.message && err.message.toLowerCase().includes('email')) {
                    const confirmLink = confirm(`Email address ${studentData.email} already has a user. Would you like to link those records?`);
                    if (confirmLink) {
                        try {
                            console.log('Attempting to link existing user to new student record with data:', studentData);
                            const linkResp = await fetch('/api/admin/students/link', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    firstName: studentData.firstName,
                                    lastName: studentData.lastName,
                                    email: studentData.email,
                                    phone: studentData.phone,
                                    dateOfBirth: studentData.dateOfBirth,
                                    address: studentData.address,
                                    department: studentData.department,
                                    year: studentData.year,
                                    enrollmentDate: studentData.enrollmentDate,
                                    gpa: studentData.gpa,
                                    status: studentData.status,
                                    emergencyContactName: studentData.emergencyContactName,
                                    emergencyContactPhone: studentData.emergencyContactPhone
                                })
                            });

                            if (!linkResp.ok) {
                                const linkErr = await linkResp.json().catch(() => ({}));
                                throw new Error(linkErr.message || 'Error linking existing user to student');
                            }

                            alert('Existing user linked to new student record successfully.');
                            closeStudentModal();
                            await loadStudents();
                            return;
                        } catch (linkError) {
                            console.error('Error linking existing user:', linkError);
                            alert(linkError.message || 'Failed to link existing user.');
                            return;
                        }
                    }
                }

                throw new Error(err.message || 'Error creating student');
            }

            // Parse server result
            const result = await response.json().catch(() => ({}));

            // If server created successfully, show generated password if we generated one
            if (studentData.password) {
                alert('Student added successfully! Temporary password: ' + studentData.password + '\nPlease communicate this securely to the student.');
            } else {
                alert('Student added successfully!');
            }

            // Attempt to log credentials to CSV via server endpoint
            try {
                await fetch('/api/admin/log-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: result.id, email: result.email, password: studentData.password, role: 'student' })
                });
            } catch (logErr) {
                console.error('Failed to log student credentials to server CSV endpoint:', logErr);
            }
        }

        closeStudentModal();
        await loadStudents();
    } catch (error) {
        console.error('Error saving student:', error);
        alert(error.message || 'Error saving student. This is a demo - student data is not persisted to the database.');
        
        // For demo purposes, add to local array
        if (!currentEditingStudentId) {
            const newStudent = {
                id: students.length + 1,
                studentId: `STU${2024000 + students.length + 1}`,
                ...studentData,
                gpa: '0.00'
            };
            students.push(newStudent);
        } else {
            const index = students.findIndex(s => s.id === currentEditingStudentId);
            if (index !== -1) {
                students[index] = { ...students[index], ...studentData };
            }
        }
        
        closeStudentModal();
        renderStudentsTable();
    }
}

async function deactivateStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const action = student.status === 'Active' ? 'deactivate' : 'restore';
    if (!confirm(`Are you sure you want to ${action} ${student.firstName} ${student.lastName}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/students/${studentId}/status`, {
            method: 'PATCH'
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Error updating student status');
        }

        const data = await response.json();
        alert(`Student ${data.status === 'Archived' ? 'deactivated' : 'restored'} successfully!`);
        await loadStudents();
    } catch (error) {
        console.error('Error updating student status:', error);
        alert('Error updating student status. Please try again.');
    }
}
