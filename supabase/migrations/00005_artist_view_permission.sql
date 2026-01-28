-- Add can_view_all_shots permission column
ALTER TABLE users ADD COLUMN can_view_all_shots BOOLEAN DEFAULT FALSE;

-- Default: ADMIN and SUPERVISOR can view all shots
UPDATE users SET can_view_all_shots = TRUE WHERE role IN ('ADMIN', 'SUPERVISOR');
