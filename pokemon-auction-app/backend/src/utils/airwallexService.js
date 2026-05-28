const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.AIRWALLEX_ENV === 'prod'
  ? 'https://api.airwallex.com'
  : 'https://api-demo.airwallex.com';

// ── Token cache ───────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const { data } = await axios.post(
    `${BASE_URL}/api/v1/authentication/login`,
    {},
    {
      headers: {
        'x-client-id': process.env.AIRWALLEX_CLIENT_ID,
        'x-api-key': process.env.AIRWALLEX_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  cachedToken = data.token;
  tokenExpiresAt = Date.now() + 25 * 60 * 1000; // 5 min buffer before 30-min expiry
  return cachedToken;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Customer ──────────────────────────────────────────────
async function createCustomer(userId, email) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/api/v1/pa/customers/create`,
    { request_id: crypto.randomUUID(), merchant_customer_id: String(userId), email },
    { headers: authHeaders(token) }
  );
  return data.id;
}

// ── Customer client_secret (needed by frontend Elements SDK) ─
async function generateCustomerClientSecret(customerId) {
  const token = await getAccessToken();
  const { data } = await axios.get(
    `${BASE_URL}/api/v1/pa/customers/${customerId}/generate_client_secret`,
    { headers: authHeaders(token) }
  );
  return data.client_secret;
}

// ── Payment Consent (saves a card for future charges) ────
async function createPaymentConsent(customerId) {
  const token = await getAccessToken();
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/v1/pa/payment_consents/create`,
      {
        request_id: crypto.randomUUID(),
        customer_id: customerId,
        currency: 'SGD',
        next_triggered_by: 'merchant',
        merchant_trigger_reason: 'scheduled',
      },
      { headers: authHeaders(token) }
    );
    return { consentId: data.id, clientSecret: data.client_secret };
  } catch (err) {
    console.error('[Airwallex createPaymentConsent] error:', err.response?.data ?? err.message);
    throw err;
  }
}

// ── Charge invoice using saved consent ───────────────────
// Creates and immediately confirms a PaymentIntent against the buyer's saved consent.
// Returns { id, status } — status is 'SUCCEEDED' on success.
async function chargeInvoice(invoice, buyer) {
  const token = await getAccessToken();

  let intent;
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/v1/pa/payment_intents/create`,
      {
        request_id: crypto.randomUUID(),
        amount: parseFloat(invoice.amount),
        currency: 'SGD',
        merchant_order_id: `invoice_${invoice.id}`,
        customer_id: buyer.airwallex_customer_id,
        auto_capture: true,
      },
      { headers: authHeaders(token) }
    );
    intent = data;
    console.log(`[Airwallex] Created intent ${intent.id} status=${intent.status}`);
  } catch (err) {
    const detail = err.response?.data ?? err.message;
    console.error('[Airwallex] Create intent failed:', JSON.stringify(detail, null, 2));
    throw err;
  }

  let confirmed;
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/v1/pa/payment_intents/${intent.id}/confirm`,
      {
        request_id: crypto.randomUUID(),
        payment_consent_id: buyer.airwallex_consent_id,
        customer_id: buyer.airwallex_customer_id,
      },
      { headers: authHeaders(token) }
    );
    confirmed = data;
    console.log(`[Airwallex] Confirmed intent ${intent.id} status=${confirmed.status}`);
  } catch (err) {
    const detail = err.response?.data ?? err.message;
    console.error('[Airwallex] Confirm intent failed:', JSON.stringify(detail, null, 2));
    throw err;
  }

  return { id: intent.id, status: confirmed.status };
}

// ── Webhook signature verification ───────────────────────
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Seller payout stub ────────────────────────────────────
exports.releasePayout = async (invoice) => {
  console.log(`[Airwallex STUB] Would release $${invoice.seller_payout_amount} to seller_id=${invoice.seller_id} for invoice_id=${invoice.id}`);
  return { status: 'stub_success', invoice_id: invoice.id };
};

exports.getAccessToken = getAccessToken;
exports.createCustomer = createCustomer;
exports.generateCustomerClientSecret = generateCustomerClientSecret;
exports.createPaymentConsent = createPaymentConsent;
exports.chargeInvoice = chargeInvoice;
exports.verifyWebhookSignature = verifyWebhookSignature;
