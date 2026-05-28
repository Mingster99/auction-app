const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const airwallexService = require('../utils/airwallexService');
const { getIO } = require('../websocket/socketHandler');

// POST /api/webhooks/airwallex
// IMPORTANT: this route must receive the raw body for signature verification.
// Mount it in app.js BEFORE express.json() using express.raw({ type: 'application/json' }).
router.post('/airwallex', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-airwallex-signature'] || req.headers['x-signature'];
  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET;

  if (secret) {
    const valid = airwallexService.verifyWebhookSignature(req.body, signature, secret);
    if (!valid) {
      console.warn('[Webhook] Invalid Airwallex signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`[Webhook] Airwallex event: ${event.name}`);

  try {
    if (event.name === 'payment_intent.succeeded') {
      const intentId = event.data?.object?.id;
      if (intentId) {
        const { rows } = await pool.query(
          `UPDATE invoices SET status = 'paid', paid_at = NOW()
           WHERE airwallex_payment_intent_id = $1 AND status != 'paid'
           RETURNING id, buyer_id, amount`,
          [intentId]
        );
        if (rows.length > 0) {
          const inv = rows[0];
          console.log(`[Webhook] Invoice ${inv.id} marked paid`);
          try {
            getIO().to(`user:${inv.buyer_id}`).emit('payment-succeeded', {
              invoiceId: inv.id,
              amount: inv.amount,
            });
          } catch (_) {}
        }
      }
    }

    if (event.name === 'payment_intent.cancelled' || event.name === 'payment_intent.failed') {
      const intentId = event.data?.object?.id;
      if (intentId) {
        const { rows } = await pool.query(
          `UPDATE invoices SET status = 'failed'
           WHERE airwallex_payment_intent_id = $1 AND status = 'pending'
           RETURNING id, buyer_id`,
          [intentId]
        );
        if (rows.length > 0) {
          const inv = rows[0];
          console.log(`[Webhook] Invoice ${inv.id} payment failed`);
          try {
            getIO().to(`user:${inv.buyer_id}`).emit('payment-failed', {
              invoiceId: inv.id,
              message: 'Payment failed. Please retry from My Invoices.',
            });
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Handler error:', err.message);
  }

  // Always return 200 quickly so Airwallex doesn't retry
  res.json({ received: true });
});

module.exports = router;
