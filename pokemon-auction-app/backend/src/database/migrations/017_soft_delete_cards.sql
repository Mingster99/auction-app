-- Migration 017: Soft-delete for cards
-- Cards are now hidden from inventory/browse by setting deleted_at instead of
-- being hard-deleted. This keeps card details accessible from invoice history.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_cards_deleted_at ON cards(deleted_at) WHERE deleted_at IS NULL;
