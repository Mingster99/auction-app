const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const emailService = require('../../utils/emailService');
const airwallexService = require('../../utils/airwallexService');
const { getIO } = require('../../websocket/socketHandler');

// ── TOTP Setup ─────────────────────────────────────────────────────────────

// GET /api/admin/totp/setup — generate (or return existing) secret + QR URI
exports.setupTotp = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { rows } = await pool.query(
      'SELECT secret, verified FROM admin_totp_secrets WHERE user_id = $1',
      [adminId]
    );

    let secret;
    if (rows.length > 0) {
      secret = rows[0].secret;
    } else {
      secret = generateSecret();
      await pool.query(
        'INSERT INTO admin_totp_secrets (user_id, secret) VALUES ($1, $2)',
        [adminId, secret]
      );
    }

    const otpauthUrl = generateURI({ type: 'totp', label: req.user.email, issuer: 'Vaultive Admin', secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      secret,
      otpauth_url: otpauthUrl,
      qr_data_url: qrDataUrl,
      verified: rows[0]?.verified ?? false,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/totp/setup — verify first code and mark secret active
exports.activateTotp = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'TOTP code required' });

    const { rows } = await pool.query(
      'SELECT secret FROM admin_totp_secrets WHERE user_id = $1',
      [adminId]
    );
    if (rows.length === 0) return res.status(400).json({ message: 'Run GET /admin/totp/setup first' });

    const result = verifySync({ token: code, secret: rows[0].secret });
    if (!result?.valid) return res.status(400).json({ message: 'Invalid TOTP code' });

    await pool.query(
      'UPDATE admin_totp_secrets SET verified = TRUE WHERE user_id = $1',
      [adminId]
    );

    res.json({ message: 'TOTP activated successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/totp/validate — validate TOTP, return short-lived admin token
exports.validateTotp = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'TOTP code required' });

    const { rows } = await pool.query(
      'SELECT secret, verified FROM admin_totp_secrets WHERE user_id = $1',
      [adminId]
    );
    if (rows.length === 0 || !rows[0].verified) {
      return res.status(400).json({ code: 'TOTP_NOT_SETUP', message: 'TOTP not set up yet — visit /admin/totp-setup' });
    }

    const result = verifySync({ token: code, secret: rows[0].secret });
    if (!result?.valid) return res.status(400).json({ message: 'Invalid TOTP code' });

    const adminToken = jwt.sign(
      { id: req.user.id, email: req.user.email, username: req.user.username, admin_verified_at: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ admin_token: adminToken });
  } catch (err) {
    next(err);
  }
};

// ── Sales / Delivery Dashboard ─────────────────────────────────────────────

// GET /api/admin/sales — all invoices with buyer/seller addresses
exports.getAllSales = async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  const { status, sort } = req.query;
  const byPostal = sort === 'postal_code';

  // Build ORDER BY — pickup tabs sort by seller, delivery tabs sort by buyer
  const orderBy = byPostal
    ? `CASE WHEN i.status IN ('picked_up','delivered') THEN b.postal_code ELSE s.postal_code END ASC, i.created_at DESC`
    : `CASE WHEN i.status IN ('picked_up','delivered') THEN b.username ELSE s.username END ASC, i.created_at DESC`;

  try {
    // Main query: $1=limit, $2=offset, $3=status (if present)
    const mainClause = status ? `AND i.status = $3` : '';
    const mainParams = status ? [limit, offset, status] : [limit, offset];

    // Count query has no limit/offset so status is $1
    const countClause = status ? `AND i.status = $1` : '';
    const countParams = status ? [status] : [];

    const [list, count] = await Promise.all([
      pool.query(
        `SELECT i.id, i.amount, i.platform_fee_amount, i.seller_payout_amount,
                i.status, i.created_at,
                i.pickup_scheduled_at, i.pickup_note,
                i.picked_up_at, i.delivered_at,
                c.id AS card_id, c.name AS card_name, c.card_image_front, c.image_url, c.psa_grade,
                s.id AS seller_id, s.username AS seller_username, s.email AS seller_email,
                s.phone AS seller_phone,
                s.address_line1 AS seller_address_line1, s.address_line2 AS seller_address_line2,
                s.city AS seller_city, s.state AS seller_state,
                s.postal_code AS seller_postal_code, s.country AS seller_country,
                b.id AS buyer_id, b.username AS buyer_username, b.email AS buyer_email,
                b.phone AS buyer_phone,
                b.address_line1 AS buyer_address_line1, b.address_line2 AS buyer_address_line2,
                b.city AS buyer_city, b.state AS buyer_state,
                b.postal_code AS buyer_postal_code, b.country AS buyer_country
         FROM invoices i
         LEFT JOIN cards c ON c.id = i.card_id
         JOIN users s ON s.id = i.seller_id
         JOIN users b ON b.id = i.buyer_id
         WHERE 1=1 ${mainClause}
         ORDER BY ${orderBy}
         LIMIT $1 OFFSET $2`,
        mainParams
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM invoices i WHERE 1=1 ${countClause}`,
        countParams
      ),
    ]);

    res.json({ invoices: list.rows, total: count.rows[0].total, limit, offset });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/audit-log
exports.getAuditLog = async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const { rows } = await pool.query(
      `SELECT al.id, al.action, al.details, al.ip_address, al.created_at,
              al.invoice_id,
              u.username AS admin_username
       FROM admin_audit_log al
       JOIN users u ON u.id = al.admin_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const total = await pool.query('SELECT COUNT(*)::int AS total FROM admin_audit_log');
    res.json({ entries: rows, total: total.rows[0].total, limit, offset });
  } catch (err) {
    next(err);
  }
};

// ── Delivery actions ───────────────────────────────────────────────────────

// POST /api/admin/sellers/:sellerId/schedule-pickup-batch
// Schedules a pickup for ALL pending/paid invoices from one seller in a single action.
exports.scheduleBatchPickup = async (req, res, next) => {
  const adminId = req.user.id;
  const sellerId = parseInt(req.params.sellerId, 10);
  if (Number.isNaN(sellerId)) return res.status(400).json({ message: 'Invalid seller id' });

  const pickup_note = (req.body?.pickup_note || '').toString().trim();
  if (!pickup_note) return res.status(400).json({ message: 'Pickup note is required' });

  try {
    const { rows } = await pool.query(
      `UPDATE invoices
       SET status = 'pickup_scheduled', pickup_scheduled_at = NOW(), pickup_note = $1
       WHERE seller_id = $2 AND status IN ('pending', 'paid')
       RETURNING id, seller_id, card_id`,
      [pickup_note, sellerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No eligible invoices found for this seller' });
    }

    // Notify seller once
    try {
      getIO().to(`user:${sellerId}`).emit('pickup-scheduled', { pickup_note, count: rows.length });
    } catch (_) {}

    const sellerInfo = await pool.query('SELECT email FROM users WHERE id = $1', [sellerId]);
    emailService.sendPickupScheduledToSeller(
      sellerInfo.rows[0]?.email,
      `${rows.length} card${rows.length !== 1 ? 's' : ''}`,
      pickup_note
    ).catch(console.error);

    // Audit log per invoice
    for (const inv of rows) {
      await pool.query(
        'INSERT INTO admin_audit_log (admin_id, action, invoice_id, details, ip_address) VALUES ($1,$2,$3,$4,$5)',
        [adminId, 'schedule_pickup', inv.id, JSON.stringify({ pickup_note, batch: true }), req.ip]
      );
    }

    res.json({ message: `Pickup scheduled for ${rows.length} invoice${rows.length !== 1 ? 's' : ''}`, updated: rows.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/invoices/:id/schedule-pickup
exports.schedulePickup = async (req, res, next) => {
  const adminId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });

  const pickup_note = (req.body?.pickup_note || '').toString().trim();
  if (!pickup_note) return res.status(400).json({ message: 'Pickup note is required (include the date/time you will arrive)' });

  try {
    const { rows } = await pool.query(
      `UPDATE invoices
       SET status = 'pickup_scheduled',
           pickup_scheduled_at = NOW(),
           pickup_note = $1
       WHERE id = $2 AND status IN ('pending', 'paid')
       RETURNING *, seller_id, buyer_id, card_id`,
      [pickup_note, invoiceId]
    );

    if (rows.length === 0) {
      const check = await pool.query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
      if (check.rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
      return res.status(409).json({ message: `Invoice is ${check.rows[0].status}, cannot schedule pickup` });
    }

    const inv = rows[0];

    // Notify seller via socket
    try {
      getIO().to(`user:${inv.seller_id}`).emit('pickup-scheduled', {
        invoice_id: inv.id,
        card_name: inv.card_name,
        pickup_note,
      });
    } catch (_) {}

    // Notify seller via email
    const sellerInfo = await pool.query('SELECT email, username FROM users WHERE id = $1', [inv.seller_id]);
    const cardInfo = await pool.query('SELECT name FROM cards WHERE id = $1', [inv.card_id]);
    const cardName = cardInfo.rows[0]?.name || 'your card';
    emailService.sendPickupScheduledToSeller(sellerInfo.rows[0]?.email, cardName, pickup_note).catch(console.error);

    // Audit log
    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, invoice_id, details, ip_address) VALUES ($1,$2,$3,$4,$5)',
      [adminId, 'schedule_pickup', invoiceId, JSON.stringify({ pickup_note }), req.ip]
    );

    res.json({ message: 'Pickup scheduled — seller notified', invoice: inv });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/invoices/:id/confirm-pickup
exports.confirmPickup = async (req, res, next) => {
  const adminId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT i.*, c.name AS card_name, c.id AS card_db_id,
              s.email AS seller_email, b.email AS buyer_email
       FROM invoices i
       LEFT JOIN cards c ON c.id = i.card_id
       JOIN users s ON s.id = i.seller_id
       JOIN users b ON b.id = i.buyer_id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [invoiceId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const inv = rows[0];
    if (inv.status !== 'pickup_scheduled') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Invoice is ${inv.status}, not pickup_scheduled` });
    }

    // Update invoice
    await client.query(
      `UPDATE invoices
       SET status = 'picked_up', picked_up_at = NOW(), picked_up_by_admin_id = $1
       WHERE id = $2`,
      [adminId, invoiceId]
    );

    // Release payout (Airwallex stub)
    await airwallexService.releasePayout(inv);

    // Card stays in seller inventory until delivery is confirmed — do NOT delete here.

    // Audit log
    await client.query(
      'INSERT INTO admin_audit_log (admin_id, action, invoice_id, details, ip_address) VALUES ($1,$2,$3,$4,$5)',
      [adminId, 'confirm_pickup', invoiceId, JSON.stringify({ seller_payout: inv.seller_payout_amount }), req.ip]
    );

    await client.query('COMMIT');

    // Post-commit notifications
    try {
      getIO().to(`user:${inv.buyer_id}`).emit('card-picked-up', {
        invoice_id: inv.id,
        card_name: inv.card_name,
        message: 'Your card has been picked up from the seller and is on its way to you!',
      });
    } catch (_) {}

    emailService.sendCardPickedUpToBuyer(inv.buyer_email, inv.card_name).catch(console.error);

    res.json({ message: 'Pickup confirmed — payout released to seller, buyer notified' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// POST /api/admin/invoices/:id/confirm-delivery
exports.confirmDelivery = async (req, res, next) => {
  const adminId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT i.*, c.name AS card_name, c.id AS card_db_id,
              b.email AS buyer_email
       FROM invoices i
       LEFT JOIN cards c ON c.id = i.card_id
       JOIN users b ON b.id = i.buyer_id
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [invoiceId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const inv = rows[0];
    if (inv.status !== 'picked_up') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: `Invoice is ${inv.status}, not picked_up` });
    }

    // Mark delivered
    await client.query(
      `UPDATE invoices
       SET status = 'delivered', delivered_at = NOW(), delivered_by_admin_id = $1
       WHERE id = $2`,
      [adminId, invoiceId]
    );

    // Soft-delete the card — removed from seller's inventory but card details
    // remain in the DB so invoice history can still display them.
    if (inv.card_db_id) {
      await client.query('UPDATE cards SET deleted_at = NOW() WHERE id = $1', [inv.card_db_id]);
    }

    // Audit log
    await client.query(
      'INSERT INTO admin_audit_log (admin_id, action, invoice_id, details, ip_address) VALUES ($1,$2,$3,$4,$5)',
      [adminId, 'confirm_delivery', invoiceId, JSON.stringify({ card_name: inv.card_name }), req.ip]
    );

    await client.query('COMMIT');

    // Post-commit notifications
    try {
      getIO().to(`user:${inv.buyer_id}`).emit('card-delivered', {
        invoice_id: inv.id,
        message: 'Your card has been delivered!',
      });
    } catch (_) {}

    emailService.sendDeliveryConfirmationToBuyer(inv.buyer_email, inv.card_name || 'your card').catch(console.error);

    res.json({ message: 'Delivery confirmed — buyer notified', invoice: inv });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};
