-- ============================================================
-- Migration 012: Add stream_id to cards table
-- ============================================================
-- Links a card directly to a scheduled stream for queue management.
-- ============================================================

ALTER TABLE cards ADD COLUMN IF NOT EXISTS stream_id INTEGER REFERENCES streams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cards_stream ON cards(stream_id);
