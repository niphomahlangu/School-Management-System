# Role-Based School Management System

## Setup Instructions

### 1. Database Update
Run the SQL script to add the role field to your users table:

```bash
mysql -u root -p < database-update.sql
```

Or manually run this SQL in your MySQL client:
```sql
ALTER TABLE users ADD COLUMN role ENUM('admin', 'student', 'lecturer') NOT NULL DEFAULT 'student';
CREATE INDEX idx_role ON users(role);
```

### 2. Update Existing Users
Assign roles to your existing users:

```sql
-- Example: Set a user as admin
UPDATE users SET role = 'admin' WHERE email = 'admin@school.com';

-- Example: Set users as students
UPDATE users SET role = 'student' WHERE email LIKE '%student%';

-- Example: Set users as lecturers
UPDATE users SET role = 'lecturer' WHERE email LIKE '%lecturer%';
```

### 3. Restart Your Server
```bash
node server.js
```

## How It Works

### Login Flow
1. User logs in with email and password
2. System checks their role from the database
3. User is redirected to their role-specific dashboard:
   - Admin → `/admin/dashboard`
   - Student → `/student/dashboard`
   - Lecturer → `/lecturer/dashboard`

### Role-Based Access Control
- Each dashboard has role-specific middleware protection
- Users can only access dashboards appropriate for their role
- Unauthorized access attempts return 403 Forbidden

### Dashboard Features

**Admin Dashboard** (`admin-dashboard.html`)
- Manage all users (students, lecturers, admins)
- View system-wide statistics
- Manage courses and departments
- Access comprehensive reports
- System configuration

**Student Dashboard** (`student-dashboard.html`)
- View enrolled courses
- Check grades and GPA
- View class schedule
- Track attendance
- Access course materials
- See upcoming assignments

**Lecturer Dashboard** (`lecturer-dashboard.html`)
- View assigned courses
- Manage student lists
- Mark attendance
- Enter and update grades
- Upload course materials
- View class schedules

## File Structure

```
/
├── server.js                    # Backend with role-based routing
├── database-update.sql          # SQL to add role field
├── login.html/js/css           # Login page (existing)
├── admin-dashboard.html        # Admin interface
├── student-dashboard.html      # Student interface
├── lecturer-dashboard.html     # Lecturer interface
├── main.js                     # Shared client-side JS
└── index.css                   # Shared styles
```

## API Endpoints

### Public Routes
- `GET /` - Login page
- `POST /login` - Authenticate and redirect based on role

### Protected Routes (require authentication)
- `GET /admin/dashboard` - Admin only
- `GET /student/dashboard` - Students only
- `GET /lecturer/dashboard` - Lecturers only
- `GET /api/user` - Get current user session info
- `POST /logout` - Logout and destroy session

## Next Steps

1. **Test the role-based system:**
   - Create test users with different roles
   - Login as each role type
   - Verify correct dashboard access

2. **Implement specific features:**
   - Add CRUD operations for each role
   - Create API endpoints for data management
   - Build interactive components

3. **Enhance security:**
   - Add CSRF protection
   - Implement rate limiting
   - Use HTTPS in production
   - Add input sanitization

4. **Database design:**
   - Create tables for courses, enrollments, grades, attendance
   - Add foreign keys and relationships
   - Design proper data models

## Testing Different Roles

Create test accounts:

```sql
-- Admin user
INSERT INTO users (name, email, password_hash, role) 
VALUES ('Admin User', 'admin@school.com', '$2a$12$...', 'admin');

-- Student user
INSERT INTO users (name, email, password_hash, role) 
VALUES ('John Student', 'student@school.com', '$2a$12$...', 'student');

-- Lecturer user
INSERT INTO users (name, email, password_hash, role) 
VALUES ('Dr. Smith', 'lecturer@school.com', '$2a$12$...', 'lecturer');
```

Replace `$2a$12$...` with properly hashed passwords using bcrypt.

## Session Information

The session now includes:
- `userId` - User's database ID
- `userEmail` - User's email
- `userName` - User's display name
- `userRole` - User's role (admin/student/lecturer)

Access in routes: `req.session.userRole`
