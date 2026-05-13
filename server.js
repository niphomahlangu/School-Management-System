const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// Parse URL-encoded bodies (for login form data)
app.use(express.urlencoded({ extended: true }));
// Parse JSON bodies
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Connect to the database
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to MySQL database!');
  }
});

// Serve static assets from specific directories
app.use('/login', express.static(path.join(__dirname, 'login')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/student', express.static(path.join(__dirname, 'student')));
app.use('/lecturer', express.static(path.join(__dirname, 'lecturer')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// Serve uploaded task files (authenticated access only - handled via API route)
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'tasks');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage config for task files
const taskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const ALLOWED_TASK_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg',
  'image/png'
]);
const uploadTaskFile = multer({
  storage: taskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TASK_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, Word, PowerPoint, plain text, JPEG, PNG.'));
    }
  }
});

// Multer storage for student submission files
const SUBMISSIONS_DIR = path.join(__dirname, 'uploads', 'submissions');
if (!fs.existsSync(SUBMISSIONS_DIR)) {
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
}
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SUBMISSIONS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const uploadSubmissionFile = multer({
  storage: submissionStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TASK_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, Word, PowerPoint, plain text, JPEG, PNG.'));
    }
  }
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/');
}

// Middleware to check if user has specific role
function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.redirect('/');
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
}

// Middleware to prevent caching of protected pages
function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// Route to serve the login page first
app.get('/', (req, res) => {
  // If already logged in, redirect based on role
  if (req.session && req.session.userId) {
    const role = req.session.userRole;
    if (role === 'admin') {
      return res.redirect('/admin');
    } else if (role === 'student') {
      return res.redirect('/student');
    } else if (role === 'lecturer') {
      return res.redirect('/lecturer');
    }
  }
  res.sendFile(path.join(__dirname, 'login', 'index.html'));
});

// Handle login form submission
app.post('/login', (req, res) => {
  
  const { email, password } = req.body;

  // Server-side validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Email format validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  // Password length validation
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  // Query to get the user by email
  connection.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    async (err, results) => {
      if (err) {
        console.error('Error during authentication:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
      } else if (results.length > 0) {
        // Compare the provided password with the stored hash
        const match = await bcrypt.compare(password, results[0].password_hash);
        
        if (match) {
          // Create session with role
          req.session.userId = results[0].id;
          req.session.userEmail = results[0].email;
          req.session.userName = results[0].name || results[0].email.split('@')[0];
          req.session.userRole = results[0].role;
          
          // Determine redirect URL based on role
          let redirectUrl = '/';
          if (results[0].role === 'admin') {
            redirectUrl = '/admin';
          } else if (results[0].role === 'student') {
            redirectUrl = '/student';
          } else if (results[0].role === 'lecturer') {
            redirectUrl = '/lecturer';
          }
          
          // When successful, send success response
          return res.status(200).json({ 
            success: true, 
            redirectUrl: redirectUrl,
            message: 'Login successful'
          });
        } else {
          return res.status(401).json({ message: 'Invalid email or password' });
        }
      } else {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    }
  );
});

// API endpoint to get user session data
app.get('/api/user', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      userName: req.session.userName,
      userEmail: req.session.userEmail,
      userRole: req.session.userRole
    });
  }
  res.status(401).json({ authenticated: false });
});

// GET schedule for the currently logged-in lecturer
app.get('/api/lecturer/schedule', noCache, hasRole('lecturer'), (req, res) => {
  const query = `
    SELECT
      ls.sessionId,
      DATE_FORMAT(ls.sessionDate, '%Y-%m-%d')  AS sessionDate,
      TIME_FORMAT(ls.startTime, '%H:%i')        AS startTime,
      TIME_FORMAT(ls.endTime,   '%H:%i')        AS endTime,
      COALESCE(ls.venue, '')                    AS venue,
      COALESCE(ls.notes, '')                    AS notes,
      m.moduleId,
      m.moduleCode,
      m.moduleName,
      COALESCE(
        GROUP_CONCAT(DISTINCT c.courseName ORDER BY c.courseName SEPARATOR ', '),
        ''
      ) AS courseNames
    FROM my_database.lecturer_sessions ls
    JOIN  my_database.lecturers l  ON l.lecturerId = ls.lecturerId
    JOIN  my_database.modules   m  ON m.moduleId   = ls.moduleId
    LEFT JOIN my_database.lecturer_courses lc ON lc.lecturerId = l.lecturerId
    LEFT JOIN my_database.course_modules   cm
          ON cm.moduleId = ls.moduleId AND cm.courseId = lc.courseId
    LEFT JOIN my_database.courses c ON c.courseId = cm.courseId
    WHERE l.user_id = ?
    GROUP BY
      ls.sessionId,
      ls.sessionDate, ls.startTime, ls.endTime,
      ls.venue, ls.notes,
      m.moduleId, m.moduleCode, m.moduleName
    ORDER BY ls.sessionDate ASC, ls.startTime ASC
  `;

  connection.query(query, [req.session.userId], (err, results) => {
    if (err) {
      console.error('Error fetching lecturer schedule:', err);
      return res.status(500).json({ message: 'Error fetching schedule' });
    }
    res.json(results);
  });
});

// =========================
// Lecturer Attendance API
// =========================

// GET attendance list for a specific session (must belong to this lecturer)
app.get('/api/lecturer/attendance/:sessionId', noCache, hasRole('lecturer'), (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ message: 'Invalid session ID' });
  }

  const query = `
    SELECT
      sa.id          AS attendanceId,
      sa.studentId,
      sa.attended,
      sa.markedAt,
      u.first_name,
      u.last_name,
      s.studentNumber,
      DATE_FORMAT(ls.sessionDate, '%Y-%m-%d')  AS sessionDate,
      TIME_FORMAT(ls.startTime,   '%H:%i')     AS startTime,
      TIME_FORMAT(ls.endTime,     '%H:%i')     AS endTime,
      COALESCE(ls.venue, '')                   AS venue,
      m.moduleName,
      m.moduleCode
    FROM   my_database.session_attendance sa
    JOIN   my_database.lecturer_sessions ls ON ls.sessionId  = sa.sessionId
    JOIN   my_database.lecturers         l  ON l.lecturerId  = ls.lecturerId
    JOIN   my_database.students          s  ON s.studentId   = sa.studentId
    JOIN   my_database.users             u  ON u.id          = s.user_id
    JOIN   my_database.modules           m  ON m.moduleId    = ls.moduleId
    WHERE  sa.sessionId = ?
      AND  l.user_id    = ?
    ORDER BY u.last_name ASC, u.first_name ASC
  `;

  connection.query(query, [sessionId, req.session.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching attendance:', err);
      return res.status(500).json({ message: 'Error fetching attendance' });
    }
    if (!rows.length) {
      return res.status(404).json({ message: 'Session not found or no students enrolled' });
    }

    const first = rows[0];
    res.json({
      session: {
        sessionId,
        sessionDate: first.sessionDate,
        startTime:   first.startTime,
        endTime:     first.endTime,
        venue:       first.venue,
        moduleName:  first.moduleName,
        moduleCode:  first.moduleCode
      },
      students: rows.map(r => ({
        attendanceId:  r.attendanceId,
        studentId:     r.studentId,
        studentNumber: r.studentNumber,
        firstName:     r.first_name,
        lastName:      r.last_name,
        attended:      r.attended,
        markedAt:      r.markedAt
      }))
    });
  });
});

// POST save/update attendance for a session
app.post('/api/lecturer/attendance/:sessionId', noCache, hasRole('lecturer'), (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ message: 'Invalid session ID' });
  }

  const { attendedIds } = req.body;
  if (!Array.isArray(attendedIds)) {
    return res.status(400).json({ message: 'attendedIds must be an array' });
  }

  // All IDs must be positive integers
  if (attendedIds.some(id => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ message: 'attendedIds contains invalid values' });
  }

  // Verify session belongs to this lecturer
  const verifyQuery = `
    SELECT ls.sessionId
    FROM   my_database.lecturer_sessions ls
    JOIN   my_database.lecturers l ON l.lecturerId = ls.lecturerId
    WHERE  ls.sessionId = ? AND l.user_id = ?
  `;

  connection.query(verifyQuery, [sessionId, req.session.userId], (err, rows) => {
    if (err) {
      console.error('Error verifying session:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!rows.length) {
      return res.status(403).json({ message: 'Session not found or access denied' });
    }

    // Step 1: mark everyone absent
    connection.query(
      `UPDATE my_database.session_attendance SET attended = 0, markedAt = NOW() WHERE sessionId = ?`,
      [sessionId],
      (err2) => {
        if (err2) {
          console.error('Error resetting attendance:', err2);
          return res.status(500).json({ message: 'Error saving attendance' });
        }

        // Step 2: mark present students (skip if nobody selected)
        if (!attendedIds.length) {
          return res.json({ message: 'Attendance saved', present: 0 });
        }

        connection.query(
          `UPDATE my_database.session_attendance SET attended = 1 WHERE sessionId = ? AND studentId IN (?)`,
          [sessionId, attendedIds],
          (err3, result) => {
            if (err3) {
              console.error('Error marking attendance:', err3);
              return res.status(500).json({ message: 'Error saving attendance' });
            }
            res.json({ message: 'Attendance saved', present: result.affectedRows });
          }
        );
      }
    );
  });
});

// =========================
// Lecturer Tasks API
// =========================

// GET all tasks created by this lecturer
app.get('/api/lecturer/tasks', noCache, hasRole('lecturer'), (req, res) => {
  const query = `
    SELECT
      t.taskId,
      t.taskTitle,
      t.taskDescription,
      DATE_FORMAT(t.dueDate, '%Y-%m-%d') AS dueDate,
      t.moduleId,
      COALESCE(m.moduleName, '') AS moduleName,
      COALESCE(m.moduleCode, '') AS moduleCode,
      t.filePath
    FROM   my_database.tasks t
    JOIN   my_database.lecturers l ON l.lecturerId = t.lecturerId
    LEFT JOIN my_database.modules m ON m.moduleId = t.moduleId
    WHERE  l.user_id = ?
    ORDER BY t.dueDate DESC, t.taskId DESC
  `;
  connection.query(query, [req.session.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      return res.status(500).json({ message: 'Error fetching tasks' });
    }
    res.json(rows);
  });
});

// GET modules assigned to the logged-in lecturer (for the task form dropdown)
app.get('/api/lecturer/modules', noCache, hasRole('lecturer'), (req, res) => {
  const query = `
    SELECT DISTINCT m.moduleId, m.moduleCode, m.moduleName
    FROM   my_database.lecturer_sessions ls
    JOIN   my_database.lecturers l ON l.lecturerId = ls.lecturerId
    JOIN   my_database.modules   m ON m.moduleId   = ls.moduleId
    WHERE  l.user_id = ?
    ORDER BY m.moduleName ASC
  `;
  connection.query(query, [req.session.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching lecturer modules:', err);
      return res.status(500).json({ message: 'Error fetching modules' });
    }
    res.json(rows);
  });
});

// POST create a new task (with optional file upload)
app.post('/api/lecturer/tasks', noCache, hasRole('lecturer'), (req, res) => {
  uploadTaskFile.single('taskFile')(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message });
    }

    const { taskTitle, taskDescription, dueDate, moduleId } = req.body;

    if (!taskTitle || !taskTitle.trim()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Task title is required' });
    }
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'A valid due date is required' });
    }
    const parsedModuleId = parseInt(moduleId, 10);
    if (!Number.isInteger(parsedModuleId) || parsedModuleId <= 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'A valid module is required' });
    }

    const filePath = req.file
      ? path.join('uploads', 'tasks', req.file.filename).replace(/\\/g, '/')
      : null;

    // Resolve lecturerId from session user
    connection.query(
      'SELECT lecturerId FROM my_database.lecturers WHERE user_id = ?',
      [req.session.userId],
      (err, rows) => {
        if (err || !rows.length) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(500).json({ message: 'Could not resolve lecturer record' });
        }
        const lecturerId = rows[0].lecturerId;

        const insertQuery = `
          INSERT INTO my_database.tasks (taskTitle, taskDescription, dueDate, moduleId, lecturerId, filePath)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        connection.query(
          insertQuery,
          [taskTitle.trim(), taskDescription ? taskDescription.trim() : null, dueDate, parsedModuleId, lecturerId, filePath],
          (err2, result) => {
            if (err2) {
              console.error('Error inserting task:', err2);
              if (req.file) fs.unlinkSync(req.file.path);
              return res.status(500).json({ message: 'Error creating task' });
            }
            res.status(201).json({ message: 'Task created', taskId: result.insertId, filePath });
          }
        );
      }
    );
  });
});

// DELETE a task (lecturer can only delete their own tasks)
app.delete('/api/lecturer/tasks/:taskId', noCache, hasRole('lecturer'), (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  // Verify ownership before deleting
  const ownerQuery = `
    SELECT t.taskId, t.filePath
    FROM   my_database.tasks t
    JOIN   my_database.lecturers l ON l.lecturerId = t.lecturerId
    WHERE  t.taskId = ? AND l.user_id = ?
  `;
  connection.query(ownerQuery, [taskId, req.session.userId], (err, rows) => {
    if (err) {
      console.error('Error verifying task ownership:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (!rows.length) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    const existingFilePath = rows[0].filePath;

    connection.query('DELETE FROM my_database.tasks WHERE taskId = ?', [taskId], (err2) => {
      if (err2) {
        console.error('Error deleting task:', err2);
        return res.status(500).json({ message: 'Error deleting task' });
      }
      // Remove the file from disk if it exists
      if (existingFilePath) {
        const absPath = path.join(__dirname, existingFilePath);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      }
      res.json({ message: 'Task deleted' });
    });
  });
});

// GET download/view an uploaded task file (lecturer only, must own the task)
app.get('/api/lecturer/tasks/:taskId/file', noCache, hasRole('lecturer'), (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  const query = `
    SELECT t.filePath
    FROM   my_database.tasks t
    JOIN   my_database.lecturers l ON l.lecturerId = t.lecturerId
    WHERE  t.taskId = ? AND l.user_id = ?
  `;
  connection.query(query, [taskId, req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    if (!rows.length || !rows[0].filePath) {
      return res.status(404).json({ message: 'File not found' });
    }
    const absPath = path.join(__dirname, rows[0].filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    res.download(absPath);
  });
});

// =========================
// Lecturer Submissions API
// =========================

// GET all submissions for a specific task (lecturer must own the task)
app.get('/api/lecturer/tasks/:taskId/submissions', noCache, hasRole('lecturer'), (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  // Verify task belongs to this lecturer
  const ownerCheck = `
    SELECT t.taskId FROM my_database.tasks t
    JOIN   my_database.lecturers l ON l.lecturerId = t.lecturerId
    WHERE  t.taskId = ? AND l.user_id = ?
  `;
  connection.query(ownerCheck, [taskId, req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    if (!rows.length) return res.status(403).json({ message: 'Task not found or access denied' });

    const subsQuery = `
      SELECT
        ts.submissionId,
        ts.filePath,
        ts.submittedAt,
        ts.result,
        s.studentId,
        s.studentNumber,
        u.first_name,
        u.last_name
      FROM   my_database.task_submissions ts
      JOIN   my_database.students s ON s.studentId = ts.studentId
      JOIN   my_database.users    u ON u.id         = s.user_id
      WHERE  ts.taskId = ?
      ORDER BY u.last_name ASC, u.first_name ASC
    `;
    connection.query(subsQuery, [taskId], (err2, subs) => {
      if (err2) return res.status(500).json({ message: 'Error fetching submissions' });
      res.json(subs);
    });
  });
});

// GET download a student's submission file (lecturer must own the task)
app.get('/api/lecturer/submissions/:submissionId/file', noCache, hasRole('lecturer'), (req, res) => {
  const submissionId = parseInt(req.params.submissionId, 10);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return res.status(400).json({ message: 'Invalid submission ID' });
  }

  const query = `
    SELECT ts.filePath
    FROM   my_database.task_submissions ts
    JOIN   my_database.tasks      t  ON t.taskId     = ts.taskId
    JOIN   my_database.lecturers  l  ON l.lecturerId = t.lecturerId
    WHERE  ts.submissionId = ? AND l.user_id = ?
  `;
  connection.query(query, [submissionId, req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    if (!rows.length || !rows[0].filePath) return res.status(404).json({ message: 'File not found' });
    const absPath = path.join(__dirname, rows[0].filePath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ message: 'File not found on server' });
    res.download(absPath);
  });
});

// PUT grade/mark a submission (lecturer must own the parent task)
app.put('/api/lecturer/submissions/:submissionId/grade', noCache, hasRole('lecturer'), (req, res) => {
  const submissionId = parseInt(req.params.submissionId, 10);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return res.status(400).json({ message: 'Invalid submission ID' });
  }

  const { result } = req.body;
  if (result === undefined || result === null || String(result).trim() === '') {
    return res.status(400).json({ message: 'A grade/result value is required' });
  }
  const resultStr = String(result).trim();
  if (resultStr.length > 50) {
    return res.status(400).json({ message: 'Grade value is too long (max 50 characters)' });
  }

  // Verify lecturer owns the task linked to this submission
  const verifyQuery = `
    SELECT ts.submissionId
    FROM   my_database.task_submissions ts
    JOIN   my_database.tasks     t ON t.taskId     = ts.taskId
    JOIN   my_database.lecturers l ON l.lecturerId = t.lecturerId
    WHERE  ts.submissionId = ? AND l.user_id = ?
  `;
  connection.query(verifyQuery, [submissionId, req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    if (!rows.length) return res.status(403).json({ message: 'Submission not found or access denied' });

    connection.query(
      'UPDATE my_database.task_submissions SET result = ? WHERE submissionId = ?',
      [resultStr, submissionId],
      (err2) => {
        if (err2) return res.status(500).json({ message: 'Error saving grade' });
        res.json({ message: 'Grade saved' });
      }
    );
  });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Role-based dashboard routes
app.get('/admin', noCache, hasRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/student', noCache, hasRole('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'student', 'index.html'));
});

app.get('/student/tasks', noCache, hasRole('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'student', 'tasks.html'));
});

// GET tasks for the modules the logged-in student is enrolled in (includes submission status)
app.get('/api/student/tasks', noCache, hasRole('student'), (req, res) => {
  const query = `
    SELECT DISTINCT
      t.taskId,
      t.taskTitle,
      t.taskDescription,
      DATE_FORMAT(t.dueDate, '%Y-%m-%d') AS dueDate,
      COALESCE(m.moduleName, '') AS moduleName,
      COALESCE(m.moduleCode, '') AS moduleCode,
      t.filePath,
      ts.submissionId,
      ts.filePath        AS submissionFilePath,
      ts.submittedAt,
      ts.result
    FROM   my_database.tasks t
    JOIN   my_database.modules         m  ON m.moduleId  = t.moduleId
    JOIN   my_database.course_modules  cm ON cm.moduleId = t.moduleId
    JOIN   my_database.student_courses sc ON sc.courseId = cm.courseId
    JOIN   my_database.students        s  ON s.studentId = sc.studentId
    LEFT JOIN my_database.task_submissions ts
           ON ts.taskId = t.taskId AND ts.studentId = s.studentId
    WHERE  s.user_id = ?
    ORDER BY dueDate DESC, t.taskId DESC
  `;
  connection.query(query, [req.session.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching student tasks:', err);
      return res.status(500).json({ message: 'Error fetching tasks' });
    }
    res.json(rows);
  });
});

// POST submit a task (student uploads their work)
app.post('/api/student/tasks/:taskId/submit', noCache, hasRole('student'), (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  uploadSubmissionFile.single('submissionFile')(req, res, (uploadErr) => {
    if (uploadErr) return res.status(400).json({ message: uploadErr.message });
    if (!req.file)  return res.status(400).json({ message: 'A submission file is required' });

    // Resolve studentId and verify the task belongs to an enrolled module
    const resolveQuery = `
      SELECT DISTINCT s.studentId
      FROM   my_database.students        s
      JOIN   my_database.student_courses sc ON sc.studentId = s.studentId
      JOIN   my_database.course_modules  cm ON cm.courseId  = sc.courseId
      JOIN   my_database.tasks           t  ON t.moduleId   = cm.moduleId
      WHERE  s.user_id = ? AND t.taskId = ?
    `;
    connection.query(resolveQuery, [req.session.userId, taskId], (err, rows) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ message: 'Internal server error' });
      }
      if (!rows.length) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Task not found or not assigned to you' });
      }

      const studentId  = rows[0].studentId;
      const filePath   = path.join('uploads', 'submissions', req.file.filename).replace(/\\/g, '/');

      // Upsert: update existing submission or insert new one
      const checkQuery = 'SELECT submissionId, filePath FROM my_database.task_submissions WHERE taskId = ? AND studentId = ?';
      connection.query(checkQuery, [taskId, studentId], (err2, existing) => {
        if (err2) {
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ message: 'Internal server error' });
        }

        if (existing.length) {
          // Remove old file from disk if it exists
          if (existing[0].filePath) {
            const oldAbs = path.join(__dirname, existing[0].filePath);
            if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
          }
          connection.query(
            'UPDATE my_database.task_submissions SET filePath = ?, submittedAt = NOW(), result = NULL WHERE submissionId = ?',
            [filePath, existing[0].submissionId],
            (err3) => {
              if (err3) return res.status(500).json({ message: 'Error updating submission' });
              res.json({ message: 'Submission updated', submissionId: existing[0].submissionId });
            }
          );
        } else {
          connection.query(
            'INSERT INTO my_database.task_submissions (taskId, studentId, filePath, submittedAt) VALUES (?, ?, ?, NOW())',
            [taskId, studentId, filePath],
            (err3, result) => {
              if (err3) return res.status(500).json({ message: 'Error saving submission' });
              res.status(201).json({ message: 'Submission saved', submissionId: result.insertId });
            }
          );
        }
      });
    });
  });
});

// GET download a student's own submission file
app.get('/api/student/submissions/:submissionId/file', noCache, hasRole('student'), (req, res) => {
  const submissionId = parseInt(req.params.submissionId, 10);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return res.status(400).json({ message: 'Invalid submission ID' });
  }

  const query = `
    SELECT ts.filePath
    FROM   my_database.task_submissions ts
    JOIN   my_database.students s ON s.studentId = ts.studentId
    WHERE  ts.submissionId = ? AND s.user_id = ?
  `;
  connection.query(query, [submissionId, req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    if (!rows.length || !rows[0].filePath) return res.status(404).json({ message: 'File not found' });
    const absPath = path.join(__dirname, rows[0].filePath);
    if (!fs.existsSync(absPath)) return res.status(404).json({ message: 'File not found on server' });
    res.download(absPath);
  });
});

// GET download a task file (student must be enrolled in the relevant course)
app.get('/api/student/tasks/:taskId/file', noCache, hasRole('student'), (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  const query = `
    SELECT DISTINCT t.filePath
    FROM   my_database.tasks t
    JOIN   my_database.course_modules  cm ON cm.moduleId = t.moduleId
    JOIN   my_database.student_courses sc ON sc.courseId = cm.courseId
    JOIN   my_database.students        s  ON s.studentId = sc.studentId
    WHERE  t.taskId = ? AND s.user_id = ?
  `;
  connection.query(query, [taskId, req.session.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    if (!rows.length || !rows[0].filePath) {
      return res.status(404).json({ message: 'File not found' });
    }
    const absPath = path.join(__dirname, rows[0].filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    res.download(absPath);
  });
});

app.get('/lecturer', noCache, hasRole('lecturer'), (req, res) => {
  res.sendFile(path.join(__dirname, 'lecturer', 'index.html'));
});

// Legacy routes for backward compatibility
app.get('/admin/dashboard', noCache, hasRole('admin'), (req, res) => {
  res.redirect('/admin');
});

app.get('/student/dashboard', noCache, hasRole('student'), (req, res) => {
  res.redirect('/student');
});

app.get('/lecturer/dashboard', noCache, hasRole('lecturer'), (req, res) => {
  res.redirect('/lecturer');
});

// Legacy route for backward compatibility (redirects based on role)
app.get('/home', noCache, isAuthenticated, (req, res) => {
  const role = req.session.userRole;
  if (role === 'admin') {
    return res.redirect('/admin');
  } else if (role === 'student') {
    return res.redirect('/student');
  } else if (role === 'lecturer') {
    return res.redirect('/lecturer');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================
// Admin Users Management API
// =========================

// Get all users (admin only)
app.get('/api/admin/users', noCache, hasRole('admin'), (req, res) => {
  const query = 'SELECT id, username, email, first_name, last_name, role, is_active FROM my_database.users';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Error fetching users' });
    }
    
    // Ensure first_name and last_name are present, fallback to parsing username if needed
    const processedResults = results.map(user => {
      if (!user.first_name || !user.last_name) {
        const nameParts = (user.username || '').split(' ');
        return {
          ...user,
          first_name: user.first_name || nameParts[0] || '',
          last_name: user.last_name || nameParts[1] || ''
        };
      }
      return user;
    });
    
    res.json(processedResults);
  });
});

// Create a new user (admin only)
app.post('/api/admin/users', noCache, hasRole('admin'), async (req, res) => {
  try {
    let { username, email, name, surname, role, password } = req.body;

    console.log('Received user creation request:', req.body);

    if (!name || !surname || !role || !password) {
      return res.status(400).json({ message: 'Name, surname, role and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // If no email provided, generate one from name with domain from environment variable
    if (!email || email.trim() === '') {
      const emailDomain = process.env.EMAIL_DOMAIN || 'myinstitute.co.za';
      let baseEmail = `${name.toLowerCase()}@${emailDomain}`;
      email = baseEmail;
      
      // Check if email already exists and add random 2-digit number if needed
      let emailExists = true;
      let attempts = 0;
      const maxAttempts = 100;
      
      while (emailExists && attempts < maxAttempts) {
        const checkQuery = 'SELECT id FROM users WHERE email = ?';
        const emailCheckResult = await new Promise((resolve, reject) => {
          connection.query(checkQuery, [email], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
        
        if (emailCheckResult.length === 0) {
          emailExists = false;
        } else {
          // Generate random 2-digit number (10-99)
          const randomNum = Math.floor(Math.random() * 90) + 10;
          email = `${name.toLowerCase()}${randomNum}@${emailDomain}`;
          attempts++;
        }
      }
      
      if (emailExists) {
        return res.status(500).json({ message: 'Unable to generate unique email. Please try again.' });
      }
    } else {
      // Validate provided email format
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email address' });
      }
      
      // Check if email already exists
      const checkQuery = 'SELECT id FROM users WHERE email = ?';
      const emailCheckResult = await new Promise((resolve, reject) => {
        connection.query(checkQuery, [email], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (emailCheckResult.length > 0) {
        return res.status(400).json({ message: 'Email already exists. Please use a different email.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertQuery = 'INSERT INTO my_database.users (username, email, password_hash, first_name, last_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [username, email, passwordHash, name, surname, role, true];

    connection.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('Error creating user:', err);
        return res.status(500).json({ message: 'Error creating user' });
      }
      // Respond with created user info (CSV logging handled by separate endpoint)
      res.status(201).json({
        id: result.insertId,
        username,
        email,
        role,
        is_active: true
      });
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Separate endpoint to log credentials to CSV (admin only)
app.post('/api/admin/log-credentials', (req, res) => {
  // Prefer returning JSON errors instead of redirects so client fetch sees meaningful status codes
  try {
    // Basic session/role check without triggering redirects
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { id, email, password, role } = req.body;
    console.log('Received credentials to log:', { id, email: email ? '[redacted]' : null, role });
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const csvPath = path.join(__dirname, 'created_user_credentials.csv');
    if (!fs.existsSync(csvPath)) {
      fs.writeFileSync(csvPath, 'id,email,password,role,created_at\n', { encoding: 'utf8' });
    }

    const safeEmail = (email || '').replace(/"/g, '""');
    const safePassword = (password || '').replace(/"/g, '""');
    const csvLine = `${id || ''},"${safeEmail}","${safePassword}",${role || ''},"${new Date().toISOString()}"\n`;

    fs.appendFile(csvPath, csvLine, (err) => {
      if (err) {
        console.error('Error appending credentials to CSV:', err);
        return res.status(500).json({ message: 'Error writing CSV' });
      }
      console.log('Appended credentials to', csvPath);
      res.json({ message: 'Logged credentials' });
    });
  } catch (err) {
    console.error('CSV logging error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update an existing user (admin only)
app.put('/api/admin/users/:id', noCache, hasRole('admin'), async (req, res) => {
  const userId = req.params.id;
  const { username, role, password, name, surname } = req.body;

  // Require role and name/surname for updates. Username is optional.
  if (!role || !name || !surname) {
    return res.status(400).json({ message: 'Role, name and surname are required' });
  }

  try {
    // Build update query. Prefer updating username only if provided.
    let updateQuery;
    const values = [];

    if (username && username.trim() !== '') {
      updateQuery = 'UPDATE my_database.users SET username = ?, first_name = ?, last_name = ?, role = ?';
      values.push(username, name, surname, role);
    } else {
      updateQuery = 'UPDATE my_database.users SET first_name = ?, last_name = ?, role = ?';
      values.push(name, surname, role);
    }

    if (password && password.length >= 6) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateQuery += ', password_hash = ?';
      values.push(passwordHash);
    }

    updateQuery += ' WHERE id = ?';
    values.push(userId);

    connection.query(updateQuery, values, (err, result) => {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).json({ message: 'Error updating user' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ message: 'User updated successfully' });
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Archive / restore a user (toggle status) (admin only)
app.patch('/api/admin/users/:id/status', noCache, hasRole('admin'), (req, res) => {
  const userId = req.params.id;

  // Toggle status between 'active' and 'archived'
  const selectQuery = 'SELECT is_active FROM my_database.users WHERE id = ?';

  connection.query(selectQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user status:', err);
      return res.status(500).json({ message: 'Error updating user status' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentStatus = results[0].is_active ? 'active' : 'archived';
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived';

    const updateQuery = 'UPDATE my_database.users SET is_active = ? WHERE id = ?';
    connection.query(updateQuery, [newStatus === 'active', userId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating user status:', updateErr);
        return res.status(500).json({ message: 'Error updating user status' });
      }
      res.json({ message: 'User status updated', status: newStatus });
    });
  });
});

// =========================
// Admin Students Management API
// =========================

// Get all students (admin only)
app.get('/api/admin/students', noCache, hasRole('admin'), (req, res) => {
  // Derive course from enrolled courses (student_courses -> courses). Returns comma-separated course names.
  const query = `
    SELECT 
      s.studentId,
      s.studentNumber,
      s.user_id,
      s.dateOfBirth,
      s.phone,
      s.address,
      GROUP_CONCAT(DISTINCT c.courseName SEPARATOR ', ') AS course,
      s.year,
      s.enrollmentDate,
      s.gpa,
      s.status,
      s.emergencyContactName,
      s.emergencyContactPhone,
      u.id,
      u.first_name,
      u.last_name,
      u.email
    FROM my_database.students s
    LEFT JOIN my_database.student_courses sc ON sc.studentId = s.studentId
    LEFT JOIN my_database.courses c ON sc.courseId = c.courseId
    JOIN my_database.users u ON s.user_id = u.id
    GROUP BY s.studentId
    ORDER BY s.studentId DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching students:', err);
      return res.status(500).json({ message: 'Error fetching students' });
    }
    
    // Format results to match the frontend expectations
    const formattedResults = results.map(student => ({
      id: student.studentId,
      studentNumber: student.studentNumber,
      firstName: student.first_name,
      lastName: student.last_name,
      email: student.email,
      phone: student.phone,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      course: student.course,
      year: student.year,
      enrollmentDate: student.enrollmentDate,
      gpa: student.gpa,
      status: student.status,
      emergencyContactName: student.emergencyContactName,
      emergencyContactPhone: student.emergencyContactPhone
    }));

    
    res.json(formattedResults);
  });
});

// Create a new student (admin only)
app.post('/api/admin/students', noCache, hasRole('admin'), async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      dateOfBirth, 
      address, 
      course, 
      year, 
      enrollmentDate, 
      gpa, 
      status, 
      emergencyContactName, 
      emergencyContactPhone,
      password,
      username: providedUsername
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !dateOfBirth || !password) {
      return res.status(400).json({ message: 'First name, last name, email, date of birth, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const emailCheckQuery = 'SELECT id FROM users WHERE email = ?';
    const emailCheckResult = await new Promise((resolve, reject) => {
      connection.query(emailCheckQuery, [email], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (emailCheckResult.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Prefer provided username (from client) otherwise derive from email
    const username = providedUsername && providedUsername.trim() !== '' ? providedUsername : email.split('@')[0];

    // Insert user first
    const insertUserQuery = 'INSERT INTO my_database.users (username, email, password_hash, first_name, last_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)';
    
    const userId = await new Promise((resolve, reject) => {
      connection.query(insertUserQuery, [username, email, passwordHash, firstName, lastName, 'student', true], (err, result) => {
        if (err) reject(err);
        else resolve(result.insertId);
      });
    });

    // Generate student number
    const studentNumber = `STU${2024000 + userId}`;

    // Insert student record (department removed; will be derived from student_courses)
    const insertStudentQuery = `
      INSERT INTO my_database.students (
        user_id,
        studentNumber,
        dateOfBirth,
        phone,
        address,
        year,
        enrollmentDate,
        gpa,
        status,
        emergencyContactName,
        emergencyContactPhone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const studentInsertResult = await new Promise((resolve, reject) => {
      connection.query(insertStudentQuery, [
        userId,
        studentNumber,
        dateOfBirth,
        phone || null,
        address || null,
        year || 1,
        enrollmentDate || null,
        gpa || null,
        status || 'Active',
        emergencyContactName || null,
        emergencyContactPhone || null
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const studentId = studentInsertResult.insertId;

    // Enroll the new student in the selected course
    if (course) {
      const courseRows = await new Promise((resolve, reject) => {
        connection.query(
          'SELECT courseId FROM my_database.courses WHERE courseName = ?',
          [course],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (courseRows.length > 0) {
        await new Promise((resolve, reject) => {
          connection.query(
            'INSERT IGNORE INTO my_database.student_courses (studentId, courseId) VALUES (?, ?)',
            [studentId, courseRows[0].courseId],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });
      }
    }

    res.status(201).json({
      id: userId,
      studentId: studentId,
      firstName,
      lastName,
      email,
      status: 'Success'
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ message: 'Error creating student' });
  }
});

// Link an existing user (by email) to a new student record (admin only)
app.post('/api/admin/students/link', noCache, hasRole('admin'), async (req, res) => {
  try {
    console.log('Received request to link student to existing user:', req.body);
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      course,
      year,
      enrollmentDate,
      gpa,
      status,
      emergencyContactName,
      emergencyContactPhone
    } = req.body;

    if (!email || !firstName || !lastName || !dateOfBirth) {
      return res.status(400).json({ message: 'Email, first name, last name and date of birth are required to link' });
    }

    // Find existing user by email
    const findUserQuery = 'SELECT id FROM users WHERE email = ?';
    const userResult = await new Promise((resolve, reject) => {
      connection.query(findUserQuery, [email], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (userResult.length === 0) {
      return res.status(404).json({ message: 'User with that email not found' });
    }

    const userId = userResult[0].id;

    // Check if a student record already exists for this user
    const checkStudentQuery = 'SELECT studentId FROM students WHERE user_id = ?';
    const studentExists = await new Promise((resolve, reject) => {
      connection.query(checkStudentQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (studentExists.length > 0) {
      return res.status(400).json({ message: 'A student record is already linked to that user' });
    }

    // Generate student number
    const studentNumber = `STU${2024000 + userId}`;

    // Insert student record linking to existing user (department removed)
    const insertStudentQuery = `
      INSERT INTO my_database.students (
        user_id,
        studentNumber,
        dateOfBirth,
        phone,
        address,
        year,
        enrollmentDate,
        gpa,
        status,
        emergencyContactName,
        emergencyContactPhone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await new Promise((resolve, reject) => {
      connection.query(insertStudentQuery, [
        userId,
        studentNumber,
        dateOfBirth,
        phone || null,
        address || null,
        year || 1,
        enrollmentDate || null,
        gpa || null,
        status || 'Active',
        emergencyContactName || null,
        emergencyContactPhone || null
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.status(201).json({ message: 'Linked student to existing user', id: userId, studentNumber });
  } catch (error) {
    console.error('Error linking student to user:', error);
    res.status(500).json({ message: 'Error linking student to user' });
  }
});

// Update an existing student (admin only)
app.put('/api/admin/students/:id', noCache, hasRole('admin'), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      dateOfBirth, 
      address, 
      course, 
      year, 
      enrollmentDate, 
      gpa, 
      status, 
      emergencyContactName, 
      emergencyContactPhone 
    } = req.body;

    // Resolve the user_id from the students table using studentId
    const studentRows = await new Promise((resolve, reject) => {
      connection.query(
        'SELECT studentId, user_id FROM my_database.students WHERE studentId = ?',
        [studentId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const userId = studentRows[0].user_id;

    // Update user information
    const updateUserQuery = 'UPDATE my_database.users SET first_name = ?, last_name = ?, email = ? WHERE id = ?';
    
    await new Promise((resolve, reject) => {
      connection.query(updateUserQuery, [firstName, lastName, email, userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Update student information (department removed; derive from student_courses)
    const updateStudentQuery = `
      UPDATE my_database.students 
      SET dateOfBirth = ?, phone = ?, address = ?, year = ?, 
          enrollmentDate = ?, gpa = ?, status = ?, emergencyContactName = ?, emergencyContactPhone = ?
      WHERE studentId = ?
    `;

    await new Promise((resolve, reject) => {
      connection.query(updateStudentQuery, [
        dateOfBirth || null,
        phone || null,
        address || null,
        year || 1,
        enrollmentDate || null,
        gpa || null,
        status || 'Active',
        emergencyContactName || null,
        emergencyContactPhone || null,
        studentId
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Update student_courses if a course was selected
    if (course) {
      const courseRows = await new Promise((resolve, reject) => {
        connection.query(
          'SELECT courseId FROM my_database.courses WHERE courseName = ?',
          [course],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (courseRows.length > 0) {
        // Replace existing course assignments with the newly selected one
        await new Promise((resolve, reject) => {
          connection.query(
            'DELETE FROM my_database.student_courses WHERE studentId = ?',
            [studentId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        await new Promise((resolve, reject) => {
          connection.query(
            'INSERT INTO my_database.student_courses (studentId, courseId) VALUES (?, ?)',
            [studentId, courseRows[0].courseId],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });
      }
    }

    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Error updating student' });
  }
});

// Delete a student (admin only)
app.delete('/api/admin/students/:id', noCache, hasRole('admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Delete student record first
    const deleteStudentQuery = 'DELETE FROM my_database.students WHERE user_id = ?';
    await new Promise((resolve, reject) => {
      connection.query(deleteStudentQuery, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Delete user record
    const deleteUserQuery = 'DELETE FROM my_database.users WHERE id = ?';
    await new Promise((resolve, reject) => {
      connection.query(deleteUserQuery, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Error deleting student' });
  }
});

// Archive / restore a student and corresponding user (admin only)
app.patch('/api/admin/students/:id/status', noCache, hasRole('admin'), (req, res) => {
  const studentId = req.params.id;

  // Fetch current student status and the linked user id
  const selectQuery = 'SELECT status, user_id FROM my_database.students WHERE studentId = ?';

  connection.query(selectQuery, [studentId], (err, results) => {
    if (err) {
      console.error('Error fetching student status:', err);
      return res.status(500).json({ message: 'Error updating student status' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const currentStatus = results[0].status || 'Active';
    const newStatus = currentStatus === 'Archived' ? 'Active' : 'Archived';
    const newIsActive = newStatus === 'Active';
    const linkedUserId = results[0].user_id;

    // Update both student status and users.is_active
    const updateStudentQuery = 'UPDATE my_database.students SET status = ? WHERE studentId = ?';
    connection.query(updateStudentQuery, [newStatus, studentId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating student status:', updateErr);
        return res.status(500).json({ message: 'Error updating student status' });
      }

      const updateUserQuery = 'UPDATE my_database.users SET is_active = ? WHERE id = ?';
      connection.query(updateUserQuery, [newIsActive, linkedUserId], (userErr) => {
        if (userErr) {
          console.error('Error updating linked user status:', userErr);
          return res.status(500).json({ message: 'Error updating linked user status' });
        }
        res.json({ message: 'Student and user status updated', status: newStatus });
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// ─── Dashboard Stats API ──────────────────────────────────────────────────────

app.get('/api/admin/stats', noCache, hasRole('admin'), (req, res) => {
  const queries = {
    students: 'SELECT COUNT(*) AS count FROM my_database.students',
    lecturers: 'SELECT COUNT(*) AS count FROM my_database.lecturers',
    courses: 'SELECT COUNT(*) AS count FROM my_database.courses',
    departments: 'SELECT COUNT(*) AS count FROM my_database.departments'
  };

  const results = {};
  const keys = Object.keys(queries);
  let completed = 0;

  keys.forEach(key => {
    connection.query(queries[key], (err, rows) => {
      if (err) {
        console.error(`Error fetching ${key} count:`, err);
        results[key] = 0;
      } else {
        results[key] = rows[0].count;
      }
      completed++;
      if (completed === keys.length) {
        res.json(results);
      }
    });
  });
});

// ─── Lecturer APIs ────────────────────────────────────────────────────────────

// GET all lecturers with their assigned courses, departments and modules
app.get('/api/admin/lecturers', noCache, hasRole('admin'), (req, res) => {
  const query = `
    SELECT
      l.lecturerId,
      l.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.is_active,
      GROUP_CONCAT(DISTINCT c.courseId ORDER BY c.courseId SEPARATOR ',') AS courseIds,
      GROUP_CONCAT(DISTINCT c.courseName ORDER BY c.courseName SEPARATOR ', ') AS courses,
      GROUP_CONCAT(DISTINCT d.departmentId ORDER BY d.departmentId SEPARATOR ',') AS departmentIds,
      GROUP_CONCAT(DISTINCT d.departmentName ORDER BY d.departmentName SEPARATOR ', ') AS departmentNames,
      GROUP_CONCAT(DISTINCT m.moduleName ORDER BY m.moduleName SEPARATOR ', ') AS modules,
      GROUP_CONCAT(DISTINCT m.moduleId ORDER BY m.moduleId SEPARATOR ',') AS moduleIds
    FROM my_database.lecturers l
    JOIN my_database.users u ON u.id = l.user_id
    LEFT JOIN my_database.lecturer_courses lc ON lc.lecturerId = l.lecturerId
    LEFT JOIN my_database.courses c ON c.courseId = lc.courseId
    LEFT JOIN my_database.departments d ON d.departmentId = c.departmentId
    LEFT JOIN my_database.course_modules cm ON cm.courseId = c.courseId
    LEFT JOIN my_database.modules m ON m.moduleId = cm.moduleId
    GROUP BY l.lecturerId
    ORDER BY l.lecturerId DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching lecturers:', err);
      return res.status(500).json({ message: 'Error fetching lecturers' });
    }

    const formatted = results.map(row => ({
      lecturerId: row.lecturerId,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      isActive: row.is_active,
      courseIds: row.courseIds ? row.courseIds.split(',').map(Number) : [],
      courses: row.courses || '',
      departmentNames: row.departmentNames || '',
      modules: row.modules || '',
      moduleIds: row.moduleIds ? row.moduleIds.split(',').map(Number) : []
    }));

    res.json(formatted);
  });
});

// POST create a new lecturer (creates user + lecturers row + optional course assignments)
app.post('/api/admin/lecturers', noCache, hasRole('admin'), async (req, res) => {
  console.log('Received request to create lecturer:', req.body);

  const { firstName, lastName, email, username, password, courseIds } = req.body;  

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'firstName, lastName, email and password are required' });
  }

  const bcrypt = require('bcrypt');

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const generatedUsername = username || `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, '.');

    const insertUser = `
      INSERT INTO my_database.users (username, email, first_name, last_name, role, password_hash, is_active)
      VALUES (?, ?, ?, ?, 'lecturer', ?, 1)
    `;
    connection.query(insertUser, [generatedUsername, email, firstName, lastName, hashedPassword], (err, userResult) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Email or username already exists' });
        }
        console.error('Error creating lecturer user:', err);
        return res.status(500).json({ message: 'Error creating lecturer' });
      }

      const newUserId = userResult.insertId;

      connection.query(
        'INSERT INTO my_database.lecturers (email, user_id) VALUES (?, ?)',
        [email, newUserId],
        (err2, lecturerResult) => {
          if (err2) {
            console.error('Error inserting into lecturers:', err2);
            return res.status(500).json({ message: 'User created but failed to create lecturer record' });
          }

          const newLecturerId = lecturerResult.insertId;

          // Assign courses via lecturer_courses
          if (courseIds && courseIds.length > 0) {
            const values = courseIds.map(cid => [newLecturerId, cid]);
            connection.query(
              'INSERT IGNORE INTO my_database.lecturer_courses (lecturerId, courseId) VALUES ?',
              [values],
              (err3) => {
                if (err3) console.error('Error assigning courses to lecturer:', err3);
                res.status(201).json({ message: 'Lecturer created successfully', id: newLecturerId, email });
              }
            );
          } else {
            res.status(201).json({ message: 'Lecturer created successfully', id: newLecturerId, email });
          }
        }
      );
    });
  } catch (err) {
    console.error('Error hashing password:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT update a lecturer
app.put('/api/admin/lecturers/:id', noCache, hasRole('admin'), (req, res) => {
  const lecturerId = req.params.id;
  const { firstName, lastName, email, courseIds } = req.body;

  // Update users table
  const updateUser = `
    UPDATE my_database.users u
    JOIN my_database.lecturers l ON l.user_id = u.id
    SET u.first_name = ?, u.last_name = ?, u.email = ?
    WHERE l.lecturerId = ?
  `;
  connection.query(updateUser, [firstName, lastName, email, lecturerId], (err) => {
    if (err) {
      console.error('Error updating lecturer user:', err);
      return res.status(500).json({ message: 'Error updating lecturer' });
    }

    // Replace course assignments
    connection.query(
      'DELETE FROM my_database.lecturer_courses WHERE lecturerId = ?',
      [lecturerId],
      (delErr) => {
        if (delErr) {
          console.error('Error clearing lecturer courses:', delErr);
          return res.status(500).json({ message: 'Lecturer updated but failed to update course assignments' });
        }

        if (courseIds && courseIds.length > 0) {
          const values = courseIds.map(cid => [lecturerId, cid]);
          connection.query(
            'INSERT IGNORE INTO my_database.lecturer_courses (lecturerId, courseId) VALUES ?',
            [values],
            (insErr) => {
              if (insErr) {
                console.error('Error inserting lecturer courses:', insErr);
                return res.status(500).json({ message: 'Lecturer updated but failed to assign courses' });
              }
              res.json({ message: 'Lecturer updated successfully' });
            }
          );
        } else {
          res.json({ message: 'Lecturer updated successfully' });
        }
      }
    );
  });
});

// PATCH toggle lecturer active status
app.patch('/api/admin/lecturers/:id/status', noCache, hasRole('admin'), (req, res) => {
  const lecturerId = req.params.id;

  const selectQuery = `
    SELECT u.is_active, u.id AS userId
    FROM my_database.lecturers l
    JOIN my_database.users u ON u.id = l.user_id
    WHERE l.lecturerId = ?
  `;

  connection.query(selectQuery, [lecturerId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Lecturer not found' });
    }

    const newIsActive = results[0].is_active ? 0 : 1;
    connection.query(
      'UPDATE my_database.users SET is_active = ? WHERE id = ?',
      [newIsActive, results[0].userId],
      (updateErr) => {
        if (updateErr) {
          console.error('Error toggling lecturer status:', updateErr);
          return res.status(500).json({ message: 'Error updating lecturer status' });
        }
        res.json({ message: 'Lecturer status updated', isActive: newIsActive });
      }
    );
  });
});

// GET all departments
app.get('/api/departments', noCache, hasRole('admin'), (req, res) => {
  connection.query(
    'SELECT departmentId, departmentCode, departmentName FROM my_database.departments ORDER BY departmentName',
    (err, results) => {
      if (err) {
        console.error('Error fetching departments:', err);
        return res.status(500).json({ message: 'Error fetching departments' });
      }
      res.json(results);
    }
  );
});

// GET modules for a specific department (via courses that belong to the department)
app.get('/api/departments/:id/modules', noCache, hasRole('admin'), (req, res) => {
  const departmentId = req.params.id;
  const query = `
    SELECT DISTINCT m.moduleId, m.moduleCode, m.moduleName
    FROM my_database.modules m
    JOIN my_database.course_modules cm ON cm.moduleId = m.moduleId
    JOIN my_database.courses c ON c.courseId = cm.courseId
    WHERE c.departmentId = ?
    ORDER BY m.moduleName
  `;
  connection.query(query, [departmentId], (err, results) => {
    if (err) {
      console.error('Error fetching department modules:', err);
      return res.status(500).json({ message: 'Error fetching modules' });
    }
    res.json(results);
  });
});

// ─── Courses API ──────────────────────────────────────────────────────────────

// API: Get courses (majors) - returns code, full name and shortName for UI
app.get('/api/courses', noCache, hasRole('admin'), (req, res) => {
  const query = `
    SELECT courseId, courseCode, courseName,
      TRIM(SUBSTRING_INDEX(courseName, ':', -1)) AS shortName
    FROM my_database.courses
    ORDER BY shortName
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching courses:', err);
      return res.status(500).json({ message: 'Error fetching courses' });
    }
    res.json(results);
  });
});

// ─── Admin Courses CRUD ───────────────────────────────────────────────────────

// GET all courses with department and module info
app.get('/api/admin/courses', noCache, hasRole('admin'), (req, res) => {
  const query = `
    SELECT
      c.courseId,
      c.courseCode,
      c.courseName,
      TRIM(SUBSTRING_INDEX(c.courseName, ':', -1)) AS shortName,
      c.departmentId,
      d.departmentName,
      d.departmentCode,
      GROUP_CONCAT(DISTINCT m.moduleId ORDER BY m.moduleId SEPARATOR ',') AS moduleIds,
      GROUP_CONCAT(DISTINCT m.moduleName ORDER BY m.moduleName SEPARATOR '||') AS moduleNames,
      GROUP_CONCAT(DISTINCT m.moduleCode ORDER BY m.moduleName SEPARATOR '||') AS moduleCodes
    FROM my_database.courses c
    LEFT JOIN my_database.departments d ON d.departmentId = c.departmentId
    LEFT JOIN my_database.course_modules cm ON cm.courseId = c.courseId
    LEFT JOIN my_database.modules m ON m.moduleId = cm.moduleId
    GROUP BY c.courseId
    ORDER BY c.courseName
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching courses:', err);
      return res.status(500).json({ message: 'Error fetching courses' });
    }
    const formatted = results.map(r => ({
      courseId: r.courseId,
      courseCode: r.courseCode,
      courseName: r.courseName,
      shortName: r.shortName,
      departmentId: r.departmentId,
      departmentName: r.departmentName || null,
      departmentCode: r.departmentCode || null,
      moduleIds: r.moduleIds ? r.moduleIds.split(',').map(Number) : [],
      moduleNames: r.moduleNames ? r.moduleNames.split('||') : [],
      moduleCodes: r.moduleCodes ? r.moduleCodes.split('||') : []
    }));
    res.json(formatted);
  });
});

// POST create a course
app.post('/api/admin/courses', noCache, hasRole('admin'), (req, res) => {
  const { courseCode, courseName, departmentId } = req.body;
  if (!courseCode || !courseName) {
    return res.status(400).json({ message: 'courseCode and courseName are required' });
  }
  const query = 'INSERT INTO my_database.courses (courseCode, courseName, departmentId) VALUES (?, ?, ?)';
  connection.query(query, [courseCode, courseName, departmentId || null], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Course code already exists' });
      }
      console.error('Error creating course:', err);
      return res.status(500).json({ message: 'Error creating course' });
    }
    res.status(201).json({ courseId: result.insertId, courseCode, courseName, departmentId: departmentId || null });
  });
});

// PUT update a course
app.put('/api/admin/courses/:id', noCache, hasRole('admin'), (req, res) => {
  const courseId = req.params.id;
  const { courseCode, courseName, departmentId } = req.body;
  if (!courseCode || !courseName) {
    return res.status(400).json({ message: 'courseCode and courseName are required' });
  }
  const query = 'UPDATE my_database.courses SET courseCode = ?, courseName = ?, departmentId = ? WHERE courseId = ?';
  connection.query(query, [courseCode, courseName, departmentId || null, courseId], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Course code already exists' });
      }
      console.error('Error updating course:', err);
      return res.status(500).json({ message: 'Error updating course' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json({ message: 'Course updated successfully' });
  });
});

// DELETE a course
app.delete('/api/admin/courses/:id', noCache, hasRole('admin'), async (req, res) => {
  const courseId = req.params.id;
  try {
    await new Promise((resolve, reject) => {
      connection.query('DELETE FROM my_database.course_modules WHERE courseId = ?', [courseId], (err) => {
        if (err) reject(err); else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      connection.query('DELETE FROM my_database.lecturer_courses WHERE courseId = ?', [courseId], (err) => {
        if (err) reject(err); else resolve();
      });
    });
    await new Promise((resolve, reject) => {
      connection.query('DELETE FROM my_database.student_courses WHERE courseId = ?', [courseId], (err) => {
        if (err) reject(err); else resolve();
      });
    });
    const result = await new Promise((resolve, reject) => {
      connection.query('DELETE FROM my_database.courses WHERE courseId = ?', [courseId], (err, r) => {
        if (err) reject(err); else resolve(r);
      });
    });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ message: 'Error deleting course' });
  }
});

// ─── Course Modules Management ────────────────────────────────────────────────

// GET all standalone modules (for add-module dropdown)
app.get('/api/admin/modules', noCache, hasRole('admin'), (req, res) => {
  connection.query(
    'SELECT moduleId, moduleCode, moduleName FROM my_database.modules ORDER BY moduleName',
    (err, results) => {
      if (err) {
        console.error('Error fetching modules:', err);
        return res.status(500).json({ message: 'Error fetching modules' });
      }
      res.json(results);
    }
  );
});

// POST create a new module and optionally link to a course
app.post('/api/admin/modules', noCache, hasRole('admin'), async (req, res) => {
  const { moduleCode, moduleName, courseId } = req.body;
  if (!moduleCode || !moduleName) {
    return res.status(400).json({ message: 'moduleCode and moduleName are required' });
  }
  try {
    const result = await new Promise((resolve, reject) => {
      connection.query(
        'INSERT INTO my_database.modules (moduleCode, moduleName) VALUES (?, ?)',
        [moduleCode, moduleName],
        (err, r) => { if (err) reject(err); else resolve(r); }
      );
    });
    const moduleId = result.insertId;
    if (courseId) {
      await new Promise((resolve, reject) => {
        connection.query(
          'INSERT IGNORE INTO my_database.course_modules (courseId, moduleId) VALUES (?, ?)',
          [courseId, moduleId],
          (err, r) => { if (err) reject(err); else resolve(r); }
        );
      });
    }
    res.status(201).json({ moduleId, moduleCode, moduleName });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Module code already exists' });
    }
    console.error('Error creating module:', err);
    res.status(500).json({ message: 'Error creating module' });
  }
});

// PUT update a module
app.put('/api/admin/modules/:id', noCache, hasRole('admin'), (req, res) => {
  const moduleId = req.params.id;
  const { moduleCode, moduleName } = req.body;
  if (!moduleCode || !moduleName) {
    return res.status(400).json({ message: 'moduleCode and moduleName are required' });
  }
  connection.query(
    'UPDATE my_database.modules SET moduleCode = ?, moduleName = ? WHERE moduleId = ?',
    [moduleCode, moduleName, moduleId],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Module code already exists' });
        }
        console.error('Error updating module:', err);
        return res.status(500).json({ message: 'Error updating module' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Module not found' });
      }
      res.json({ message: 'Module updated' });
    }
  );
});

// POST link an existing module to a course
app.post('/api/admin/courses/:id/modules', noCache, hasRole('admin'), (req, res) => {
  const courseId = req.params.id;
  const { moduleId } = req.body;
  if (!moduleId) {
    return res.status(400).json({ message: 'moduleId is required' });
  }
  connection.query(
    'INSERT IGNORE INTO my_database.course_modules (courseId, moduleId) VALUES (?, ?)',
    [courseId, moduleId],
    (err) => {
      if (err) {
        console.error('Error linking module to course:', err);
        return res.status(500).json({ message: 'Error linking module' });
      }
      res.status(201).json({ message: 'Module linked to course' });
    }
  );
});

// DELETE unlink a module from a course
app.delete('/api/admin/courses/:courseId/modules/:moduleId', noCache, hasRole('admin'), (req, res) => {
  const { courseId, moduleId } = req.params;
  connection.query(
    'DELETE FROM my_database.course_modules WHERE courseId = ? AND moduleId = ?',
    [courseId, moduleId],
    (err, result) => {
      if (err) {
        console.error('Error unlinking module:', err);
        return res.status(500).json({ message: 'Error unlinking module' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Link not found' });
      }
      res.json({ message: 'Module unlinked from course' });
    }
  );
});

// ─── Admin Departments CRUD ───────────────────────────────────────────────────

// GET all departments with course count
app.get('/api/admin/departments', noCache, hasRole('admin'), (req, res) => {
  const query = `
    SELECT
      d.departmentId,
      d.departmentCode,
      d.departmentName,
      COUNT(c.courseId) AS courseCount
    FROM my_database.departments d
    LEFT JOIN my_database.courses c ON c.departmentId = d.departmentId
    GROUP BY d.departmentId
    ORDER BY d.departmentName
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching departments:', err);
      return res.status(500).json({ message: 'Error fetching departments' });
    }
    res.json(results);
  });
});

// POST create a department
app.post('/api/admin/departments', noCache, hasRole('admin'), (req, res) => {
  const { departmentCode, departmentName } = req.body;
  if (!departmentCode || !departmentName) {
    return res.status(400).json({ message: 'departmentCode and departmentName are required' });
  }
  connection.query(
    'INSERT INTO my_database.departments (departmentCode, departmentName) VALUES (?, ?)',
    [departmentCode, departmentName],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Department code already exists' });
        }
        console.error('Error creating department:', err);
        return res.status(500).json({ message: 'Error creating department' });
      }
      res.status(201).json({ departmentId: result.insertId, departmentCode, departmentName });
    }
  );
});

// PUT update a department
app.put('/api/admin/departments/:id', noCache, hasRole('admin'), (req, res) => {
  const departmentId = req.params.id;
  const { departmentCode, departmentName } = req.body;
  if (!departmentCode || !departmentName) {
    return res.status(400).json({ message: 'departmentCode and departmentName are required' });
  }
  connection.query(
    'UPDATE my_database.departments SET departmentCode = ?, departmentName = ? WHERE departmentId = ?',
    [departmentCode, departmentName, departmentId],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Department code already exists' });
        }
        console.error('Error updating department:', err);
        return res.status(500).json({ message: 'Error updating department' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Department not found' });
      }
      res.json({ message: 'Department updated successfully' });
    }
  );
});

// DELETE a department
app.delete('/api/admin/departments/:id', noCache, hasRole('admin'), (req, res) => {
  const departmentId = req.params.id;
  // Nullify departmentId on courses before deleting
  connection.query(
    'UPDATE my_database.courses SET departmentId = NULL WHERE departmentId = ?',
    [departmentId],
    (err) => {
      if (err) {
        console.error('Error unlinking courses from department:', err);
        return res.status(500).json({ message: 'Error deleting department' });
      }
      connection.query(
        'DELETE FROM my_database.departments WHERE departmentId = ?',
        [departmentId],
        (err2, result) => {
          if (err2) {
            console.error('Error deleting department:', err2);
            return res.status(500).json({ message: 'Error deleting department' });
          }
          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Department not found' });
          }
          res.json({ message: 'Department deleted successfully' });
        }
      );
    }
  );
});