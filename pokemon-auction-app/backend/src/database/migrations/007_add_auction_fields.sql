-- ============================================================
-- Migration 007: Add auction fields to cards table
-- ============================================================
-- Adds columns needed for live auction functionality:
--   buyout_price      – optional instant-buy price
--   auction_duration  – countdown length in seconds
--   current_bid       – denormalized current highest bid (source of truth for concurrency)
--   current_bidder_id – FK to the user holding the current high bid
--   auction_started_at / auction_ends_at – server-authoritative timers
--   auction_status    – lifecycle: idle → active → ended → sold
--   winner_id         – FK to the auction winner
--   queue_order       – integer for drag-drop reordering in seller dashboard
-- ============================================================

ALTER TABLE cards ADD COLUMN IF NOT EXISTS buyout_price DECIMAL(10, 2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS auction_duration_seconds INTEGER DEFAULT 60;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS current_bid DECIMAL(10, 2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS current_bidder_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS auction_started_at TIMESTAMP;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS auction_ends_at TIMESTAMP;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS auction_status VARCHAR(20) DEFAULT 'idle';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS queue_order INTEGER;

-- Constraint to enforce valid auction statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_auction_status'
  ) THEN
    ALTER TABLE cards ADD CONSTRAINT chk_auction_status
      CHECK (auction_status IN ('idle', 'active', 'ended', 'sold'));
  END IF;
END $$;

-- Indexes for auction queries
CREATE INDEX IF NOT EXISTS idx_cards_auction_status ON cards(auction_status);
CREATE INDEX IF NOT EXISTS idx_cards_current_bidder ON cards(current_bidder_id);
CREATE INDEX IF NOT EXISTS idx_cards_winner ON cards(winner_id);
CREATE INDEX IF NOT EXISTS idx_cards_queue_order ON cards(seller_id, queue_order);
