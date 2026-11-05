-- 008_create_admin.sql
-- Auto-create the initial primary administrator account (User #1) to prevent lockout.
INSERT INTO users (id, username, email, password_hash, first_name, last_name)
VALUES (
    1,
    'admin',
    'contact@recipes.jcardon.me',
    '$2b$10$.8k6xQCqJ3dl85OH1/Z6ue35NmIKEfpJXd7W52tPp9u9tVi.MGwSi',
    'John',
    'Doe'
)
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
