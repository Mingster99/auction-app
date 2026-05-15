-- Migration 014: Add reserve_price column to cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserve_price DECIMAL(10, 2);
