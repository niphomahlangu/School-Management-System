# School Management System

This project is a role-based school management web application built with Express, MySQL, and static HTML/CSS/JavaScript pages. It supports three user roles:

- `admin`: manages users, students, lecturers, courses, modules, and departments
- `lecturer`: views assigned modules, teaching schedule, attendance, tasks, submissions, and grading
- `student`: views schedule, enrolled modules, tasks, submissions, and transcript results

The application is served by a single Node.js process in `server.js`, with frontend pages grouped by role under `admin/`, `lecturer/`, `student/`, and `login/`.

## Tech Stack

- Node.js
- Express 5
- MySQL via `mysql2`
- Session authentication via `express-session`
- Password hashing via `bcrypt`
- File uploads via `multer`
- Vanilla HTML, CSS, and JavaScript on the frontend

## Repository Layout

```text
.
|-- admin/                  # Admin pages and page-specific scripts
|-- lecturer/               # Lecturer pages and page-specific scripts
|-- login/                  # Login page assets
|-- student/                # Student pages and page-specific scripts
|-- shared/                 # Shared layout CSS and dashboard behavior
|-- uploads/
|   |-- submissions/        # Student-uploaded submission files
|   `-- tasks/              # Lecturer-uploaded task files
|-- created_user_credentials.csv
|-- package.json
|-- server.js
```

## How The App Works

### Authentication flow

1. The root route `/` serves the login page from `login/index.html`.
2. The login form posts JSON to `POST /login`.
3. The server validates the email and password, checks the `users` table, and compares the submitted password with the stored `password_hash` using `bcrypt`.
4. On success, the server stores these session fields:
   - `userId`
   - `userEmail`
   - `userName`
   - `userRole`
5. The frontend redirects the user to one of these protected dashboard routes:
   - `/admin`
   - `/student`
   - `/lecturer`

### Authorization model

The server uses middleware in `server.js` to protect routes:

- `isAuthenticated`: checks whether a session exists
- `hasRole(...roles)`: restricts routes to one or more roles
- `noCache`: disables client-side caching for protected pages

### Frontend structure

Each role has static HTML pages and matching JS files. Shared layout behaviors such as sidebar toggling, profile display, user loading, and logout are handled in `shared/main.js`.

## Setup

## Prerequisites

- Node.js 18+
- MySQL 8+
- An existing MySQL database schema containing the core tables used by `server.js`

You will need a database that already contains at least the base tables below, or you must create them yourself before running the app:

- `users`
- `students`
- `lecturers`
- `courses`
- `modules`
- `course_modules`
- `student_courses`
- `lecturer_courses`
- `tasks`
- `task_submissions` or equivalent submission table expected by the code
- `student_attendance` or equivalent attendance table expected by the code
- `departments`
- `lecturer_sessions`

### Install dependencies

```bash
npm install
```

### Required environment variables

Create a `.env` file in the project root with these values:

```env
PORT=3000
PASSWORD=your_mysql_password
DATABASE=my_database
SESSION_SECRET=replace-with-a-random-secret
EMAIL_DOMAIN=myinstitute.co.za
```

Notes:

- `PASSWORD` is the MySQL password used by the hardcoded `root` database user.
- `DATABASE` must match the schema name you want to connect to.
- Many SQL queries in `server.js` explicitly reference `my_database.<table>`. In practice, the schema name used by the code should match the schema name in those queries unless you refactor them.
- `EMAIL_DOMAIN` is used when the admin creates a user without entering an email address.

### Start the application

There is no npm start script defined in `package.json`, so run the server directly:

```bash
node server.js
```

The server starts on:

```text
http://localhost:3000
```

or the port configured in `PORT`.

## Role-Based Features

## Login

Files:

- `login/index.html`
- `login/login.css`
- `login/login.js`

Behavior:

- client-side validation for email format and password length
- submits credentials to `POST /login`
- displays server validation errors inline
- redirects to the appropriate dashboard on success

## Admin Area

Files:

- `admin/index.html`
- `admin/users.html` + `admin/users.js`
- `admin/students.html` + `admin/students.js`
- `admin/lecturers.html` + `admin/lecturers.js`
- `admin/courses.html` + `admin/courses.js`
- `admin/departments.html` + `admin/departments.js`

### Admin dashboard

The admin landing page displays summary counts for:

- students
- lecturers
- courses
- departments

Data source:

- `GET /api/admin/stats`

### User management

The admin user screen manages generic system users.

Capabilities:

- list all users
- create users with generated or explicit email addresses
- update user details and role
- toggle user active/archived state
- log newly created credentials to `created_user_credentials.csv`

API routes:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status`
- `POST /api/admin/log-credentials`

### Student management

The student screen manages student profile records linked to entries in `users`.

Capabilities:

- list students with joined course information
- create a new user + student record
- link an existing user to a new student record
- update student profile details
- assign or replace course enrollment via `student_courses`
- delete student and linked user record
- toggle student status and linked user `is_active`

API routes:

- `GET /api/admin/students`
- `POST /api/admin/students`
- `POST /api/admin/students/link`
- `PUT /api/admin/students/:id`
- `DELETE /api/admin/students/:id`
- `PATCH /api/admin/students/:id/status`

### Lecturer management

The lecturer screen manages lecturer records and their course assignments.

Capabilities:

- list lecturers with course, department, and module rollups
- create a new lecturer user and lecturer row
- assign one or more courses through `lecturer_courses`
- update lecturer details and course assignments
- toggle lecturer active status via linked user record

API routes:

- `GET /api/admin/lecturers`
- `POST /api/admin/lecturers`
- `PUT /api/admin/lecturers/:id`
- `PATCH /api/admin/lecturers/:id/status`

### Courses and modules

The admin courses screen manages both courses and course-to-module relationships.

Capabilities:

- list courses with department and module summaries
- create, update, and delete courses
- list standalone modules
- create new modules
- link existing modules to courses
- unlink modules from courses

API routes:

- `GET /api/courses`
- `GET /api/admin/courses`
- `POST /api/admin/courses`
- `PUT /api/admin/courses/:id`
- `DELETE /api/admin/courses/:id`
- `GET /api/admin/modules`
- `POST /api/admin/modules`
- `PUT /api/admin/modules/:id`
- `POST /api/admin/courses/:id/modules`
- `DELETE /api/admin/courses/:courseId/modules/:moduleId`

### Departments

The departments screen manages academic departments and their course associations.

Capabilities:

- list departments with course counts
- create departments
- update departments
- delete departments
- retrieve modules indirectly linked to a department through courses

API routes:

- `GET /api/departments`
- `GET /api/departments/:id/modules`
- `GET /api/admin/departments`
- `POST /api/admin/departments`
- `PUT /api/admin/departments/:id`
- `DELETE /api/admin/departments/:id`

## Lecturer Area

Files:

- `lecturer/index.html`
- `lecturer/modules.html` + `lecturer/modules.js`
- `lecturer/attendance.html` + `lecturer/attendance.js`
- `lecturer/schedule.html` + `lecturer/schedule.js`
- `lecturer/tasks.html` + `lecturer/tasks.js`

### Lecturer dashboard

The lecturer dashboard is a navigation entry point to:

- assigned courses/modules
- attendance marking
- class schedule
- tasks and grading

### Lecturer modules overview

The modules page loads an overview of assigned courses and modules.

API routes used by lecturer pages:

- `GET /api/lecturer/modules`
- `GET /api/lecturer/modules-overview`

### Lecturer schedule

The schedule page shows the logged-in lecturer's timetable with:

- session date
- start and end time
- venue
- notes
- module information
- related course names

API route:

- `GET /api/lecturer/schedule`

### Lecturer attendance

The attendance flow is session-driven.

Capabilities:

- load lecturer schedule and choose a session
- fetch enrolled students for that session
- mark attendance
- save attendance back to the server

API routes:

- `GET /api/lecturer/attendance/:sessionId`
- `POST /api/lecturer/attendance/:sessionId`

### Lecturer tasks and grading

The tasks page is the lecturer's assignment-management workspace.

Capabilities:

- create tasks for assigned modules
- optionally upload a task file
- list created tasks
- download uploaded task files
- open submission lists for each task
- download submitted student work
- save grades or textual results
- delete tasks

API routes:

- `GET /api/lecturer/tasks`
- `POST /api/lecturer/tasks`
- `DELETE /api/lecturer/tasks/:taskId`
- `GET /api/lecturer/tasks/:taskId/file`
- `GET /api/lecturer/tasks/:taskId/submissions`
- `GET /api/lecturer/submissions/:submissionId/file`
- `PUT /api/lecturer/submissions/:submissionId/grade`

## Student Area

Files:

- `student/index.html`
- `student/schedule.html` + `student/schedule.js`
- `student/modules.html` + `student/modules.js`
- `student/tasks.html` + `student/tasks.js`
- `student/transcript.html` + `student/transcript.js`

### Student dashboard

The student dashboard links to schedule, modules, tasks, and transcript pages.

Protected student routes served by the backend:

- `/student`
- `/student/schedule`
- `/student/modules`
- `/student/tasks`
- `/student/transcript`

### Student schedule

The schedule page presents the logged-in student's scheduled sessions.

API route:

- `GET /api/student/schedule`

### Student modules

The modules page shows modules derived from the student's enrolled courses.

API route:

- `GET /api/student/modules`

### Student tasks and submission flow

The tasks page supports both task review and assignment submission.

Capabilities:

- list tasks for the student's modules
- show due dates and overdue status
- download task attachments
- upload a submission file through a modal form
- re-submit work after an earlier submission
- display grade/result status when available

API routes:

- `GET /api/student/tasks`
- `POST /api/student/tasks/:taskId/submit`
- `GET /api/student/tasks/:taskId/file`
- `GET /api/student/submissions/:submissionId/file`

### Student transcript

The transcript page loads academic outcomes for the logged-in student.

API route:

- `GET /api/student/transcript`

## Static and Legacy Routes

### Static assets

These directories are served statically:

- `/login` -> `login/`
- `/admin` -> `admin/`
- `/student` -> `student/`
- `/lecturer` -> `lecturer/`
- `/shared` -> `shared/`

### Route notes

- `/admin`, `/student`, and `/lecturer` are protected server routes that send the dashboard HTML files.
- `/admin/dashboard`, `/student/dashboard`, and `/lecturer/dashboard` are legacy routes that redirect to the newer dashboard paths.
- `/home` is a legacy authenticated route that redirects based on session role.

## File Uploads

The app stores uploads on disk under `uploads/`.

### Task attachments

- stored in `uploads/tasks/`
- uploaded by lecturers
- maximum size: 10 MB

### Student submissions

- stored in `uploads/submissions/`
- uploaded by students
- maximum size: 20 MB

### Allowed file types

The current upload whitelist allows:

- PDF
- Microsoft Word
- Microsoft PowerPoint
- plain text
- JPEG
- PNG

Uploaded filenames are sanitized and prefixed with a timestamp.

## Important Implementation Notes

### Hardcoded schema references

Many queries explicitly use `my_database.<table>` instead of relying only on the configured connection database. If you use a different database name, some queries may fail until those references are updated.

### Credentials CSV

The admin area writes created credentials to `created_user_credentials.csv`, including plaintext passwords. This may be useful for development or demos, but it is not appropriate for production environments.

### Session configuration

Sessions are currently configured with:

- `secure: false`
- a fallback development secret

That is acceptable for local development only. Use HTTPS and a strong secret before deploying publicly.

### No automated tests

There is currently no test suite or documented validation command in the repository.

### No npm scripts

`package.json` currently defines dependencies only. Common convenience scripts such as `start`, `dev`, or `test` are not present.

## Known Gaps And Risks

- The repository does not include one complete SQL schema for every table referenced by `server.js`.
- Some queries use fully-qualified `my_database` table names, which reduces portability.
- The credentials CSV stores sensitive information in plaintext.
- There are no automated tests, linting scripts, or migration tooling.
- The server combines all routes in a single large `server.js`, which makes future maintenance harder as the codebase grows.

## Recommended Next Improvements

1. Add a full schema dump or migrations for all required tables.
2. Add npm scripts such as `start`, `dev`, and `test`.
3. Split `server.js` into route modules by area: auth, admin, lecturer, and student.
4. Replace plaintext credential logging with a safer admin onboarding flow.
5. Add automated tests for login, role protection, CRUD flows, and file upload limits.
