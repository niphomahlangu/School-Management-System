-- Seed dummy data for `courses`, `modules`, and `course_modules`
-- Run with: mysql -u <user> -p <database> < "scripts/seed_dummy_data.sql"

START TRANSACTION;

-- Courses (majors) using South African qualification-style codes
INSERT INTO `courses` (`courseCode`, `courseName`) VALUES
  ('BSC-CS', 'Bachelor of Science: Computer Science'),
  ('DISD', 'Diploma: Information Technology (Software Development)'),
  ('DIP-IT', 'Diploma: Information Technology'),
  ('BSC-MATH', 'Bachelor of Science: Mathematics'),
  ('DIP-ENG', 'Diploma: English'),
  ('BSC-PHY', 'Bachelor of Science: Physics'),
  ('DIP-ART', 'Diploma: Art'),
  ('MBCHB-MED', 'Bachelor of Medicine and Bachelor of Surgery (Medicine)'),
  ('BED-EDU', 'Bachelor of Education'),
  ('BCOM-BUS', 'Bachelor of Commerce: Business');

-- Modules
INSERT INTO `modules` (`moduleCode`, `moduleName`) VALUES
  ('CS101-1', 'Programming Basics'),
  ('CS101-2', 'Computer Systems'),
  ('CS102-1', 'Algorithms'),
  ('CS102-2', 'Data Structures Lab'),
  ('MATH101-1', 'Limits and Continuity'),
  ('MATH101-2', 'Differentiation'),
  ('ENG101-1', 'Essay Writing'),
  ('PHY101-1', 'Mechanics'),
  ('ART101-1', 'Art History'),
  ('ART101-2', 'Drawing Basics'),
  ('MED101-1', 'Human Anatomy'),
  ('MED101-2', 'Physiology'),
  ('EDU101-1', 'Foundations of Education'),
  ('EDU101-2', 'Curriculum Design'),
  ('BUS101-1', 'Introduction to Business'),
  ('BUS101-2', 'Accounting Basics');

-- Link modules to courses via subqueries (safe regardless of AUTO_INCREMENT values)
INSERT INTO `course_modules` (`courseId`, `moduleId`) VALUES
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-CS'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='CS101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-CS'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='CS101-2')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-CS'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='CS102-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-CS'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='CS102-2')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-MATH'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='MATH101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-MATH'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='MATH101-2')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='DIP-ENG'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='ENG101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BSC-PHY'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='PHY101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='DIP-ART'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='ART101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='DIP-ART'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='ART101-2')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='MBCHB-MED'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='MED101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='MBCHB-MED'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='MED101-2')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BED-EDU'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='EDU101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BED-EDU'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='EDU101-2')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BCOM-BUS'), (SELECT `moduleId` FROM `modules` WHERE `moduleCode`='BUS101-1')),
  ((SELECT `courseId` FROM `courses` WHERE `courseCode`='BCOM-BUS'), (SELECT `moduleId` FROM `courses` WHERE `courseCode`='BCOM-BUS'));

COMMIT;

-- Optional: verify inserted rows
-- SELECT * FROM `courses`;
-- SELECT * FROM `modules`;
-- SELECT c.courseCode, m.moduleCode FROM `course_modules` cm
--   JOIN `courses` c ON cm.courseId = c.courseId
--   JOIN `modules` m ON cm.moduleId = m.moduleId;
