-- ============================================================
-- Migration 013: Invoice shipping fields + admin role
-- ============================================================
-- invoices: tracking + review columns for human-in-the-loop settlement.
-- users:    is_admin flag for the review queue.
-- ============================================================

-- ── Admin role ────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- ── Invoice shipping + review columns ────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tracking_number  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tracking_carrier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS released_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS review_notes     TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewed_by_id   INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- ── Status enum: add 'awaiting_review' and 'shipped' ─────
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_status;
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_status
  CHECK (status IN ('pending', 'processing', 'paid', 'awaiting_review', 'shipped', 'failed', 'refunded'));

-- ── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_seller_status ON invoices(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
