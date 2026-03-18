-- Populate `student_courses` by assigning each student a random course
-- Usage: mysql -u <user> -p <database> < "scripts/populate_student_courses_random.sql"

START TRANSACTION;

-- 1) Ensure a lightweight backup table exists and copy any existing rows once
CREATE TABLE IF NOT EXISTS student_courses_backup LIKE student_courses;
INSERT IGNORE INTO student_courses_backup SELECT * FROM student_courses;

-- 2) Insert one random course per student who currently has no student_courses entry
-- Uses INSERT IGNORE to avoid duplicate unique-key errors
INSERT IGNORE INTO student_courses (studentNumber, courseId)
SELECT s.studentId,
       (SELECT c.courseId FROM courses c ORDER BY RAND() LIMIT 1) AS rndCourseId
FROM students s
WHERE NOT EXISTS (
  SELECT 1 FROM student_courses sc WHERE sc.studentNumber = s.studentId
);

-- Report how many rows were inserted by the last statement
SELECT ROW_COUNT() AS rows_inserted;

-- Optional: show a sample of assignments just created (last 100)
SELECT sc.id, sc.studentNumber AS studentId, s.studentNumber AS studentNumberLabel, sc.courseId, c.courseCode, c.courseName
FROM student_courses sc
JOIN students s ON s.studentId = sc.studentNumber
JOIN courses c ON c.courseId = sc.courseId
ORDER BY sc.id DESC
LIMIT 100;

COMMIT;

-- Notes:
-- - This assigns exactly one random course to each student who currently has no row in student_courses.
-- - If you want to assign multiple courses per student, run a similar INSERT but join against a small numbers table.
-- - Always take a DB backup before running on production.
