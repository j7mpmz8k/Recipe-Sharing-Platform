-- 012_case_insensitive_unique_usernames.sql
-- Prevent overlapping/colliding usernames or emails differing only by capitalization.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
