-- Creates the `lecturer_sessions` table
-- A lecturer can hold multiple sessions per module, including repeated sessions of the same module
-- Run AFTER the `lecturers` and `modules` tables exist
-- Run with: mysql -u <user> -p my_database < "scripts/create_lecturer_sessions_table.sql"

CREATE TABLE IF NOT EXISTS `my_database`.`lecturer_sessions` (
  `sessionId`     INT           NOT NULL AUTO_INCREMENT,
  `lecturerId`    INT           NOT NULL,
  `moduleId`      INT           NOT NULL,
  `sessionDate`   DATE          NOT NULL,
  `startTime`     TIME          NOT NULL,
  `endTime`       TIME          NOT NULL,
  `venue`         VARCHAR(100)  NULL,
  `notes`         TEXT          NULL,
  `createdAt`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sessionId`),
  CONSTRAINT `fk_ls_lecturer`
    FOREIGN KEY (`lecturerId`) REFERENCES `my_database`.`lecturers` (`lecturerId`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ls_module`
    FOREIGN KEY (`moduleId`)   REFERENCES `my_database`.`modules`   (`moduleId`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_ls_lecturer`   (`lecturerId`),
  INDEX `idx_ls_module`     (`moduleId`),
  INDEX `idx_ls_date`       (`sessionDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
