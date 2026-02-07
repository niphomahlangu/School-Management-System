-- Add first_name and last_name columns to users table if they don't exist
-- Run this script in your MySQL database

USE my_database;

-- Add first_name column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) AFTER email;

-- Add last_name column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) AFTER first_name;

-- Update existing users to populate first_name and last_name from username
UPDATE users 
SET 
    first_name = SUBSTRING_INDEX(username, ' ', 1),
    last_name = SUBSTRING_INDEX(username, ' ', -1)
WHERE first_name IS NULL OR last_name IS NULL;
