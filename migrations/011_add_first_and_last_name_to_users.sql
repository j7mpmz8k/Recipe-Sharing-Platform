-- 011_add_first_and_last_name_to_users.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Backfill admin user with Jacob Cardon if empty
UPDATE users SET first_name = 'Jacob', last_name = 'Cardon' WHERE id = 1 AND (first_name IS NULL OR first_name = '');
