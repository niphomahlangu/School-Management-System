-- Adds a `departmentId` foreign key column to the `courses` table
-- Run AFTER populate_departments.sql and BEFORE assign_courses_to_departments.sql
-- Run with: mysql -u <user> -p <database> < "scripts/modify_courses_add_department.sql"

-- Add the nullable column first (safe while existing rows have no value yet)
ALTER TABLE `courses`
  ADD COLUMN `departmentId` INT NULL AFTER `courseName`,
  ADD CONSTRAINT `fk_courses_department`
    FOREIGN KEY (`departmentId`) REFERENCES `departments` (`departmentId`)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

-- Optional: verify the new column exists
-- DESCRIBE `courses`;
