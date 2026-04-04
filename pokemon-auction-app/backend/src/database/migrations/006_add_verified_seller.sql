-- ============================================================
-- Migration 006: Add verified seller flag to users table
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;
