function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const modulesStatus = document.getElementById('modulesStatus');
const modulesContent = document.getElementById('modulesContent');
const courseCount = document.getElementById('courseCount');
const moduleCount = document.getElementById('moduleCount');
const sessionCount = document.getElementById('sessionCount');

function renderCourse(course) {
    const modules = course.modules || [];
    const body = modules.length
        ? modules.map((moduleEntry) => `
            <tr>
                <td>
                    <span class="module-code">${esc(moduleEntry.moduleCode || 'MOD')}</span>
                    ${esc(moduleEntry.moduleName || 'Unnamed module')}
                </td>
                <td>${moduleEntry.sessionCount || 0}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="2">No modules have been linked to this course yet.</td>
            </tr>
        `;

    return `
        <section class="course-section">
            <div class="course-header">
                <div>
                    <h3 class="course-title">${esc(course.courseName || 'Course')}</h3>
                    <p class="course-meta">
                        <span class="course-code">${esc(course.courseCode || 'COURSE')}</span>
                        ${course.moduleCount || 0} modules linked to this assignment.
                    </p>
                </div>
                <span class="session-pill">${course.sessionCount || 0} sessions</span>
            </div>

            <div style="overflow-x:auto;">
                <table class="modules-table">
                    <thead>
                        <tr>
                            <th>Module</th>
                            <th>Scheduled Sessions</th>
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
        </section>
    `;
}

async function loadModulesOverview() {
    modulesStatus.textContent = 'Loading your course assignments…';
    modulesStatus.style.display = 'block';
    modulesContent.style.display = 'none';
    modulesContent.innerHTML = '';

    try {
        const response = await fetch('/api/lecturer/modules-overview');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        const courses = Array.isArray(data.courses) ? data.courses : [];
        const totalModules = courses.reduce((sum, course) => sum + (course.moduleCount || 0), 0);
        const totalSessions = courses.reduce((sum, course) => sum + (course.sessionCount || 0), 0);

        courseCount.textContent = String(courses.length);
        moduleCount.textContent = String(totalModules);
        sessionCount.textContent = String(totalSessions);

        if (!courses.length) {
            modulesStatus.textContent = 'No courses are assigned to your lecturer account yet.';
            return;
        }

        modulesContent.innerHTML = courses.map(renderCourse).join('');
        modulesStatus.style.display = 'none';
        modulesContent.style.display = 'block';
    } catch (error) {
        console.error('Failed to load lecturer modules overview:', error);
        modulesStatus.textContent = 'Failed to load your assigned courses. Please refresh the page.';
    }
}

loadModulesOverview();