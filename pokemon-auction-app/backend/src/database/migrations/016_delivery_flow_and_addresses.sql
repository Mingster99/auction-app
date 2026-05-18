-- Migration 016: Personal delivery flow + mandatory user addresses

-- ── Users: address fields ──────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postal_code   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country       VARCHAR(100) DEFAULT 'Singapore';

-- ── Invoices: delivery lifecycle columns ───────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pickup_scheduled_at   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pickup_note           TEXT,
  ADD COLUMN IF NOT EXISTS picked_up_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS picked_up_by_admin_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS delivered_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivered_by_admin_id INTEGER REFERENCES users(id);

-- Replace old status constraints with delivery-based statuses.
-- Migration 010 created chk_invoice_status; migration 013 may have added invoices_status_check.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_status;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'pending', 'paid', 'pickup_scheduled', 'picked_up', 'delivered',
    'failed', 'refunded',
    'processing', 'awaiting_review', 'shipped'
  ));

-- ── Admin audit log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER REFERENCES users(id),
  action     VARCHAR(100) NOT NULL,
  invoice_id INTEGER REFERENCES invoices(id),
  details    JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin    ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_invoice  ON admin_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON admin_audit_log(created_at DESC);

-- ── Admin TOTP secrets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_totp_secrets (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret     VARCHAR(255) NOT NULL,
  verified   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
