-- ============================================================
-- Migration 009: Alter bids table for auction support
-- ============================================================
-- Adds stream_id to link bids to specific streams.
-- Adds placed_at for precise bid timing (anti-snipe checks).
-- Renames is_winning to is_winning_bid for clarity.
-- ============================================================

ALTER TABLE bids ADD COLUMN IF NOT EXISTS stream_id INTEGER REFERENCES streams(id) ON DELETE SET NULL;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Rename is_winning → is_winning_bid (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bids' AND column_name = 'is_winning'
  ) THEN
    ALTER TABLE bids RENAME COLUMN is_winning TO is_winning_bid;
  END IF;
END $$;

-- Composite index for querying bids per card per stream
CREATE INDEX IF NOT EXISTS idx_bids_card_stream ON bids(card_id, stream_id);
