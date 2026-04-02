-- Populates the `departments` table with faculty/department data
-- Run AFTER create_departments_table.sql and BEFORE modify_courses_add_department.sql
-- Run with: mysql -u <user> -p <database> < "scripts/populate_departments.sql"

START TRANSACTION;

INSERT INTO `departments` (`departmentCode`, `departmentName`) VALUES
  ('CS-IT',     'Computer Science & Information Technology'),
  ('MATH-SCI',  'Mathematical Sciences'),
  ('PHY-SCI',   'Physics & Natural Sciences'),
  ('LANG-HUM',  'Languages & Humanities'),
  ('VIS-ART',   'Visual & Performing Arts'),
  ('HEALTH',    'Health Sciences'),
  ('EDU',       'Education'),
  ('COM-BUS',   'Commerce & Business');

COMMIT;

-- Optional: verify
-- SELECT * FROM `departments`;
