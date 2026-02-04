-- Add PRODUCER role to user_role enum (same permissions as SUPERVISOR)
ALTER TYPE user_role ADD VALUE 'PRODUCER' AFTER 'SUPERVISOR';
