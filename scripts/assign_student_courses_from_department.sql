-- Assign students to courses by matching student.department to courses.courseName
-- Safe / idempotent: creates a backup, uses INSERT IGNORE to avoid duplicates
-- Run with: mysql -u <user> -p <database> < "scripts/assign_student_courses_from_department.sql"

START TRANSACTION;

-- 1) Backup existing student_courses rows (one-time copy)
CREATE TABLE IF NOT EXISTS student_courses_backup LIKE student_courses;
INSERT IGNORE INTO student_courses_backup SELECT * FROM student_courses;

-- 2) Insert mappings where courseName contains the department text (case-insensitive)
-- NOTE: student_courses.studentNumber stores students.studentId (the PK). We insert the studentId.
INSERT IGNORE INTO student_courses (studentNumber, courseId)
SELECT s.studentId, c.courseId
FROM students s
JOIN courses c ON LOWER(c.courseName) LIKE CONCAT('%', LOWER(TRIM(s.department)), '%')
WHERE s.department IS NOT NULL AND TRIM(s.department) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM student_courses sc WHERE sc.studentNumber = s.studentId AND sc.courseId = c.courseId
  );

-- 3) Report how many rows were added
SELECT ROW_COUNT() AS rows_inserted_by_last_statement;

-- 4) List students that still have NO assignment in student_courses (unmapped)
SELECT s.studentId, s.studentNumber AS studentNumberLabel, s.department
FROM students s
WHERE NOT EXISTS (SELECT 1 FROM student_courses sc WHERE sc.studentNumber = s.studentId)
ORDER BY s.studentId;

-- 5) Example manual-fix statements for unmapped departments
-- Replace 'Engineering' with the desired `courseCode` below if you want to assign a specific course
-- Example: assign all 'Engineering' students to 'BCOM-BUS' (change courseCode as needed)
-- INSERT IGNORE INTO student_courses (studentNumber, courseId)
-- SELECT s.studentId, c.courseId FROM students s JOIN courses c ON c.courseCode = 'BCOM-BUS' WHERE s.department = 'Engineering' AND NOT EXISTS (SELECT 1 FROM student_courses sc WHERE sc.studentNumber = s.studentId AND sc.courseId = c.courseId);

-- 6) If you prefer to map by a custom list, here's how to map specific department values to exact course codes
-- CREATE TEMPORARY TABLE dept_map (dept VARCHAR(100), courseCode VARCHAR(50));
-- INSERT INTO dept_map VALUES ('Engineering','BCOM-BUS'), ('Arts','DIP-ART');
-- INSERT IGNORE INTO student_courses (studentNumber, courseId)
-- SELECT s.studentId, c.courseId FROM students s JOIN dept_map dm ON s.department = dm.dept JOIN courses c ON c.courseCode = dm.courseCode
-- WHERE NOT EXISTS (SELECT 1 FROM student_courses sc WHERE sc.studentNumber = s.studentId AND sc.courseId = c.courseId);

COMMIT;

-- Helpful checks (run after script):
-- 1) Count assignments per course:
-- SELECT c.courseCode, c.courseName, COUNT(sc.studentNumber) AS students_assigned
-- FROM courses c LEFT JOIN student_courses sc ON sc.courseId = c.courseId
-- GROUP BY c.courseId ORDER BY students_assigned DESC;

-- 2) Show sample assignments:
-- SELECT sc.id, sc.studentNumber AS studentId, s.studentNumber AS studentNumberLabel, c.courseCode, c.courseName
-- FROM student_courses sc JOIN students s ON s.studentId = sc.studentNumber JOIN courses c ON c.courseId = sc.courseId
-- ORDER BY sc.id DESC LIMIT 100;
