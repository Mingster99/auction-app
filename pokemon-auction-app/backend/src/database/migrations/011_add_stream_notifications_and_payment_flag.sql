-- ============================================================
-- Migration 011: Stream notifications + user payment flag
-- ============================================================
-- stream_notifications – tracks "notify me" for upcoming streams
-- has_payment_method   – stub flag on users, wired to Stripe later
-- ============================================================

CREATE TABLE IF NOT EXISTS stream_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stream_id INTEGER REFERENCES streams(id) ON DELETE CASCADE,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent duplicate notification signups
CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_notifications_unique
  ON stream_notifications(user_id, stream_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_payment_method BOOLEAN DEFAULT false;
