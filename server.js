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

// Serve static assets (like CSS, client-side JS, images, etc.)
app.use(express.static(path.join(__dirname), { index: false }));

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
      return res.redirect('/admin/dashboard');
    } else if (role === 'student') {
      return res.redirect('/student/dashboard');
    } else if (role === 'lecturer') {
      return res.redirect('/lecturer/dashboard');
    }
  }
  res.sendFile(path.join(__dirname, 'login.html'));
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
            redirectUrl = '/admin/dashboard';
          } else if (results[0].role === 'student') {
            redirectUrl = '/student/dashboard';
          } else if (results[0].role === 'lecturer') {
            redirectUrl = '/lecturer/dashboard';
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
app.get('/admin/dashboard', noCache, hasRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/student/dashboard', noCache, hasRole('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'student-dashboard.html'));
});

app.get('/lecturer/dashboard', noCache, hasRole('lecturer'), (req, res) => {
  res.sendFile(path.join(__dirname, 'lecturer-dashboard.html'));
});

// Legacy route for backward compatibility (redirects based on role)
app.get('/home', noCache, isAuthenticated, (req, res) => {
  const role = req.session.userRole;
  if (role === 'admin') {
    return res.redirect('/admin/dashboard');
  } else if (role === 'student') {
    return res.redirect('/student/dashboard');
  } else if (role === 'lecturer') {
    return res.redirect('/lecturer/dashboard');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});