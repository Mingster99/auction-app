-- Migration 018: Optional phone number on users (shown to admin during pickup/delivery)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
