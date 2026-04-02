-- Randomly assigns each course to one lecturer in lecturer_courses
-- Idempotent: uses INSERT IGNORE so re-running will not create duplicates
-- Run with: mysql -u <user> -p <database> < "scripts/assign_lecturers_to_courses_random.sql"

INSERT IGNORE INTO my_database.lecturer_courses (lecturerId, courseId)
SELECT
    (
        SELECT l.lecturerId
        FROM my_database.lecturers l
        ORDER BY RAND()
        LIMIT 1
    ) AS lecturerId,
    c.courseId
FROM my_database.courses c;

-- Verify: list all assignments
SELECT
    lc.id,
    lc.lecturerId,
    CONCAT(u.first_name, ' ', u.last_name) AS lecturerName,
    lc.courseId,
    c.courseCode,
    c.courseName
FROM my_database.lecturer_courses lc
JOIN my_database.lecturers l  ON l.lecturerId = lc.lecturerId
JOIN my_database.users u      ON u.id = l.user_id
JOIN my_database.courses c    ON c.courseId = lc.courseId
ORDER BY lc.courseId;
