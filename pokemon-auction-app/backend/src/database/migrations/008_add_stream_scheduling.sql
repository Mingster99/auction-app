-- ============================================================
-- Migration 008: Add stream scheduling support
-- ============================================================
-- Adds scheduled_start_time for stream scheduling.
-- Title, description, and status already exist from migration 001.
-- Adds CHECK constraint to support 'cancelled' status value.
-- ============================================================

ALTER TABLE streams ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMP;

-- Add CHECK constraint for valid stream statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stream_status'
  ) THEN
    ALTER TABLE streams ADD CONSTRAINT chk_stream_status
      CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled'));
  END IF;
END $$;
