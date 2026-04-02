-- Assigns every existing course to its appropriate department
-- Run AFTER modify_courses_add_department.sql
-- Run with: mysql -u <user> -p <database> < "scripts/assign_courses_to_departments.sql"
--
-- Department mapping:
--   CS-IT     → BSC-CS, DISD, DIP-IT
--   MATH-SCI  → BSC-MATH
--   PHY-SCI   → BSC-PHY
--   LANG-HUM  → DIP-ENG
--   VIS-ART   → DIP-ART
--   HEALTH    → MBCHB-MED
--   EDU       → BED-EDU
--   COM-BUS   → BCOM-BUS

START TRANSACTION;

-- Computer Science & Information Technology
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'CS-IT')
WHERE `courseCode` IN ('BSC-CS', 'DISD', 'DIP-IT');

-- Mathematical Sciences
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'MATH-SCI')
WHERE `courseCode` = 'BSC-MATH';

-- Physics & Natural Sciences
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'PHY-SCI')
WHERE `courseCode` = 'BSC-PHY';

-- Languages & Humanities
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'LANG-HUM')
WHERE `courseCode` = 'DIP-ENG';

-- Visual & Performing Arts
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'VIS-ART')
WHERE `courseCode` = 'DIP-ART';

-- Health Sciences
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'HEALTH')
WHERE `courseCode` = 'MBCHB-MED';

-- Education
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'EDU')
WHERE `courseCode` = 'BED-EDU';

-- Commerce & Business
UPDATE my_database.courses
SET `departmentId` = (SELECT `departmentId` FROM my_database.departments WHERE `departmentCode` = 'COM-BUS')
WHERE `courseCode` = 'BCOM-BUS';

COMMIT;

-- Verify: list all courses with their assigned department
SELECT
  c.courseId,
  c.courseCode,
  c.courseName,
  d.departmentCode,
  d.departmentName
FROM my_database.courses c
LEFT JOIN my_database.departments d ON d.departmentId = c.departmentId
ORDER BY d.departmentName, c.courseCode;

-- Check for any courses that were NOT assigned a department
SELECT c.courseId, c.courseCode, c.courseName
FROM my_database.courses c
WHERE c.departmentId IS NULL;
