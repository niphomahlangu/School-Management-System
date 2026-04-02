-- Populates the `lecturers` table from all users with role = 'lecturer'
-- Idempotent: uses INSERT IGNORE so re-running will not create duplicates
-- Run with: mysql -u <user> -p <database> < "scripts/populate_lecturers_from_users.sql"

INSERT IGNORE INTO my_database.lecturers (`email`, `user_id`)
SELECT `email`, `id`
FROM my_database.users
WHERE `role` = 'lecturer';

-- Verify: show all lecturer records joined to their user details
SELECT
  l.lecturerId,
  l.email,
  l.user_id,
  u.first_name,
  u.last_name,
  u.is_active
FROM my_database.lecturers l
JOIN my_database.users u ON u.id = l.user_id
ORDER BY l.lecturerId;
