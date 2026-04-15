-- Populates `lecturer_sessions` for every lecturer–module pair
-- Each module gets one session per week for a 10-week term (2026-04-13 to 2026-06-19)
-- Session day / time / venue are derived deterministically from the moduleId so the
-- schedule is stable across re-runs (INSERT IGNORE keeps it idempotent)
--
-- Prerequisites (run first):
--   seed_dummy_data.sql
--   populate_lecturers_from_users.sql
--   assign_lecturers_to_courses_random.sql
--
-- Requires MySQL 8.0+ (uses recursive CTE for week generation)

-- One session per (lecturer, module) pair per week.
-- Day offset  : MOD(moduleId, 5)     => 0=Mon … 4=Fri
-- Start hour  : 8 + MOD(moduleId, 4) => 08:00 / 09:00 / 10:00 / 11:00
-- Duration    : 90 minutes
-- Venue       : Room <first letter of moduleCode><(moduleId*7) % 20 + 1>

INSERT INTO `my_database`.`lecturer_sessions`
  (`lecturerId`, `moduleId`, `sessionDate`, `startTime`, `endTime`, `venue`, `notes`)
WITH RECURSIVE weeks (week_num) AS (
  SELECT 0
  UNION ALL
  SELECT week_num + 1 FROM weeks WHERE week_num < 9
)
SELECT
  lc.`lecturerId`,
  cm.`moduleId`,
  DATE_ADD('2026-04-13', INTERVAL (w.week_num * 7 + (cm.`moduleId` MOD 5)) DAY)  AS `sessionDate`,
  MAKETIME(8 + (cm.`moduleId` MOD 4), 0, 0)                                      AS `startTime`,
  MAKETIME(8 + (cm.`moduleId` MOD 4) + 1, 30, 0)                                 AS `endTime`,
  CONCAT('Room ', LEFT(m.`moduleCode`, 1), (cm.`moduleId` * 7) MOD 20 + 1)       AS `venue`,
  CONCAT('Week ', w.week_num + 1, ' \u2013 ', m.`moduleName`)                    AS `notes`
FROM weeks w
CROSS JOIN `my_database`.`lecturer_courses`  lc
JOIN       `my_database`.`course_modules`    cm ON cm.`courseId`  = lc.`courseId`
JOIN       `my_database`.`modules`           m  ON m.`moduleId`   = cm.`moduleId`;

-- Verify: sessions per lecturer with their name and module
SELECT
  ls.`sessionId`,
  CONCAT(u.`first_name`, ' ', u.`last_name`)  AS `lecturerName`,
  m.`moduleCode`,
  m.`moduleName`,
  ls.`sessionDate`,
  ls.`startTime`,
  ls.`endTime`,
  ls.`venue`,
  ls.`notes`
FROM `my_database`.`lecturer_sessions` ls
JOIN `my_database`.`lecturers`         l  ON l.`lecturerId` = ls.`lecturerId`
JOIN `my_database`.`users`             u  ON u.`id`         = l.`user_id`
JOIN `my_database`.`modules`           m  ON m.`moduleId`   = ls.`moduleId`
ORDER BY ls.`sessionDate`, ls.`startTime`, ls.`lecturerId`;
