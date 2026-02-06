const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();
const path = require('path');

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
  const query = 'SELECT id, username, email, role, is_active FROM my_database.users';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Error fetching users' });
    }
    res.json(results);
  });
});

// Create a new user (admin only)
app.post('/api/admin/users', noCache, hasRole('admin'), async (req, res) => {
  try {
    const { username, name, surname, role, password } = req.body;

    console.log('Received user creation request:', req.body);

    if (!name || !surname || !role || !password) {
      return res.status(400).json({ message: 'Name, surname, role and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Generate email from name with domain from environment variable
    const emailDomain = process.env.EMAIL_DOMAIN || 'myinstitute.co.za';
    let baseEmail = `${name.toLowerCase()}@${emailDomain}`;
    let email = baseEmail;
    
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

    const passwordHash = await bcrypt.hash(password, 10);

    const insertQuery = 'INSERT INTO my_database.users (username, email, password_hash, first_name, last_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [username, email, passwordHash, name, surname, role, true];

    connection.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('Error creating user:', err);
        return res.status(500).json({ message: 'Error creating user' });
      }
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

// Update an existing user (admin only)
app.put('/api/admin/users/:id', noCache, hasRole('admin'), async (req, res) => {
  const userId = req.params.id;
  const { username, role, password } = req.body;

  if (!username || !role) {
    return res.status(400).json({ message: 'Username and role are required' });
  }

  try {
    let updateQuery = 'UPDATE users SET username = ?, role = ?';
    const values = [username, role];

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

// Delete a user (admin only)
app.delete('/api/admin/users/:id', noCache, hasRole('admin'), (req, res) => {
  const userId = req.params.id;

  const deleteQuery = 'DELETE FROM users WHERE id = ?';
  connection.query(deleteQuery, [userId], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ message: 'Error deleting user' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});