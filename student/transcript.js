function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAverage(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '—';
    }
    return `${Number(value).toFixed(2)}%`;
}

const transcriptStatus = document.getElementById('transcriptStatus');
const transcriptContent = document.getElementById('transcriptContent');

function renderCourse(course) {
    const modulesMarkup = course.modules.map((moduleEntry) => `
        <tr>
            <td>
                <span class="module-code">${esc(moduleEntry.moduleCode || 'MOD')}</span>
                ${esc(moduleEntry.moduleName || 'Unnamed module')}
            </td>
            <td>${moduleEntry.gradedTaskCount}</td>
            <td><span class="average-pill">${formatAverage(moduleEntry.average)}</span></td>
        </tr>
    `).join('');

    return `
        <section class="course-section">
            <div class="course-header">
                <div>
                    <h3>${esc(course.courseName || 'Course')}</h3>
                    <p>Transcript generated from graded submissions recorded against your module tasks.</p>
                </div>
                <div class="overall-average">
                    <span>Overall Course Average</span>
                    <strong>${formatAverage(course.overallAverage)}</strong>
                </div>
            </div>

            <div class="summary-grid">
                <div class="summary-card">
                    <span>Graded Modules</span>
                    <strong>${course.gradedModuleCount}</strong>
                </div>
                <div class="summary-card">
                    <span>Graded Tasks</span>
                    <strong>${course.totalGradedTasks}</strong>
                </div>
            </div>

            <div class="transcript-table-wrapper">
                <table class="transcript-table">
                    <thead>
                        <tr>
                            <th>Module</th>
                            <th>Graded Tasks</th>
                            <th>Average</th>
                        </tr>
                    </thead>
                    <tbody>${modulesMarkup}</tbody>
                </table>
            </div>
        </section>
    `;
}

async function loadTranscript() {
    transcriptStatus.textContent = 'Loading transcript…';
    transcriptStatus.style.display = 'block';
    transcriptContent.style.display = 'none';
    transcriptContent.innerHTML = '';

    try {
        const response = await fetch('/api/student/transcript');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        const courses = Array.isArray(data.courses) ? data.courses : [];
        if (!courses.length) {
            transcriptStatus.textContent = 'No graded task submissions are available yet, so your transcript cannot be calculated.';
            return;
        }

        transcriptContent.innerHTML = courses.map(renderCourse).join('');
        transcriptStatus.style.display = 'none';
        transcriptContent.style.display = 'block';
    } catch (error) {
        console.error('Failed to load transcript:', error);
        transcriptStatus.textContent = 'Failed to load transcript. Please refresh the page.';
    }
}

loadTranscript();