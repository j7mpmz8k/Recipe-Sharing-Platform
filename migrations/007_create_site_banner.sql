CREATE TABLE IF NOT EXISTS site_banner (
    id INTEGER PRIMARY KEY DEFAULT 1,
    message TEXT DEFAULT '',
    banner_type VARCHAR(20) DEFAULT 'warning',
    is_active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO site_banner (id, message, banner_type, is_active)
VALUES (1, '', 'warning', FALSE)
ON CONFLICT (id) DO NOTHING;
