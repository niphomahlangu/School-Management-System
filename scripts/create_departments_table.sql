-- Creates the `departments` table (faculty groupings for courses)
-- Run BEFORE populate_departments.sql and modify_courses_add_department.sql
-- Run with: mysql -u <user> -p <database> < "scripts/create_departments_table.sql"

CREATE TABLE IF NOT EXISTS `departments` (
  `departmentId`   INT          NOT NULL AUTO_INCREMENT,
  `departmentCode` VARCHAR(20)  NOT NULL,
  `departmentName` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`departmentId`),
  UNIQUE KEY `uq_departments_code` (`departmentCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
