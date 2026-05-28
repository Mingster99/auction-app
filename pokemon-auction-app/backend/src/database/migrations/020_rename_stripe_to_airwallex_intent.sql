-- Migration 020: Rename stripe_payment_intent_id to airwallex_payment_intent_id
ALTER TABLE invoices
  RENAME COLUMN stripe_payment_intent_id TO airwallex_payment_intent_id;
