-- ============================================================
-- Migration 004: Add stream queue support
-- ============================================================
-- Adds a listing_status column to track card lifecycle:
--   pending → active → queued → sold / ended
-- Also adds queued_at timestamp for ordering the stream queue.
-- ============================================================

ALTER TABLE cards ADD COLUMN IF NOT EXISTS queued_for_stream BOOLEAN DEFAULT false;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP;
