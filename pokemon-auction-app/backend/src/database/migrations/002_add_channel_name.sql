-- Migration: Add channel_name to streams table
-- Run this if you already ran the initial schema

ALTER TABLE streams ADD COLUMN IF NOT EXISTS channel_name VARCHAR(255) UNIQUE;

-- Update existing streams (if any) with generated channel names
UPDATE streams 
SET channel_name = CONCAT('stream_', host_id, '_', EXTRACT(EPOCH FROM created_at)::bigint)
WHERE channel_name IS NULL;
