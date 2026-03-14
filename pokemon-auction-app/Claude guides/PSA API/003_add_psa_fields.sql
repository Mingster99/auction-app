-- ============================================================
-- Migration 003: Add PSA card fields to cards table
-- ============================================================
-- Adds columns to support PSA graded card imports.
-- All new columns are nullable so existing cards are unaffected.
-- ============================================================

-- PSA certification data
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_cert_number VARCHAR(20) UNIQUE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_grade VARCHAR(10);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_year VARCHAR(10);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_brand VARCHAR(100);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_category VARCHAR(100);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_subject VARCHAR(255);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_card_number VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_variety VARCHAR(255);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa_label_type VARCHAR(50);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_psa_verified BOOLEAN DEFAULT false;

-- Image fields (front/back slab photos)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_image_front TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_image_back TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_source VARCHAR(20);
-- image_source values: 'psa_api', 'psa_scrape', 'user_upload', NULL

-- Index for fast cert number lookups
CREATE INDEX IF NOT EXISTS idx_cards_psa_cert ON cards(psa_cert_number);
