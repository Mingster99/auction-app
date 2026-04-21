-- ============================================================
-- Migration 010: Create invoices and payment_methods tables
-- ============================================================
-- invoices  – tracks post-auction payment lifecycle
-- payment_methods – stores Stripe payment method stubs
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  stream_id INTEGER REFERENCES streams(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  platform_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  seller_payout_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stripe_payment_intent_id VARCHAR(255),
  payment_method_id INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  failure_reason TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Constraint for valid invoice statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_status'
  ) THEN
    ALTER TABLE invoices ADD CONSTRAINT chk_invoice_status
      CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255),
  type VARCHAR(20) NOT NULL,
  last_four VARCHAR(4),
  brand VARCHAR(50),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Constraint for valid payment method types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_method_type'
  ) THEN
    ALTER TABLE payment_methods ADD CONSTRAINT chk_payment_method_type
      CHECK (type IN ('card', 'paynow'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_buyer ON invoices(buyer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_seller ON invoices(seller_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
