-- ============================================================
-- Migration 005: Add TCG game column for card game filtering
-- ============================================================

ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcg_game VARCHAR(50);

-- Index for fast filtering by game
CREATE INDEX IF NOT EXISTS idx_cards_tcg_game ON cards(tcg_game);
