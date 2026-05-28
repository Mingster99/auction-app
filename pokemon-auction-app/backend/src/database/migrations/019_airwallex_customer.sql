-- Migration 019: Add Airwallex customer/consent columns to users
-- These store the Airwallex customer ID and saved payment consent ID
-- so the backend can charge buyers automatically when they win an auction.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS airwallex_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS airwallex_consent_id  VARCHAR(255);
