const pool = require('../../config/database');

const ALLOWED_CARRIERS = ['USPS', 'SingPost', 'DHL', 'FedEx', 'UPS', 'Other'];

const num = (v) => (v == null ? 0 : parseFloat(v));

// GET /api/invoices/my — buyer's invoices, paginated/filtered.
exports.getMy = async (req, res, next) => {
  const buyerId = req.user.id;
  const { status, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  const filters = ['i.buyer_id = $1'];
  const params = [buyerId];

  if (status && status !== 'all') {
    params.push(status);
    filters.push(`i.status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    filters.push(`i.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    filters.push(`i.created_at <= $${params.length}`);
  }
  const where = filters.join(' AND ');

  try {
    const [list, count] = await Promise.all([
      pool.query(
        `SELECT i.id, i.amount, i.status, i.created_at,
                i.tracking_number, i.tracking_carrier,
                i.shipped_at, i.released_at,
                c.id AS card_id, c.name AS card_name,
                c.card_image_front, c.image_url, c.psa_grade,
                u.username AS seller_username
         FROM invoices i
         JOIN cards c ON c.id = i.card_id
         JOIN users u ON u.id = i.seller_id
         WHERE ${where}
         ORDER BY i.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM invoices i WHERE ${where}`,
        params
      ),
    ]);

    res.json({
      invoices: list.rows,
      total: count.rows[0].total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/invoices/:id — single invoice. Buyer or seller of the invoice can view.
exports.getOne = async (req, res, next) => {
  const userId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });

  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              c.name AS card_name, c.card_image_front, c.card_image_back, c.image_url,
              c.psa_grade, c.psa_brand, c.psa_year, c.condition, c.tcg_game,
              s.username AS seller_username,
              b.username AS buyer_username
       FROM invoices i
       JOIN cards c ON c.id = i.card_id
       JOIN users s ON s.id = i.seller_id
       JOIN users b ON b.id = i.buyer_id
       WHERE i.id = $1`,
      [invoiceId]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    const inv = rows[0];

    if (inv.buyer_id !== userId && inv.seller_id !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }

    // Buyer doesn't see seller-private payout fields.
    if (inv.buyer_id === userId && inv.seller_id !== userId) {
      delete inv.platform_fee_amount;
      delete inv.seller_payout_amount;
    }

    res.json(inv);
  } catch (err) {
    next(err);
  }
};

// POST /api/invoices/:id/ship — seller submits tracking; flips to 'awaiting_review'.
// Admin approval is what releases the payout (status → 'shipped').
exports.markShipped = async (req, res, next) => {
  const sellerId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });

  const tracking_number = (req.body?.tracking_number || '').trim();
  const tracking_carrier = req.body?.tracking_carrier;

  if (!tracking_number) {
    return res.status(400).json({ message: 'Tracking number is required' });
  }
  if (tracking_number.length > 100) {
    return res.status(400).json({ message: 'Tracking number too long (max 100 chars)' });
  }
  if (!ALLOWED_CARRIERS.includes(tracking_carrier)) {
    return res.status(400).json({
      message: `Carrier must be one of: ${ALLOWED_CARRIERS.join(', ')}`,
    });
  }

  try {
    // 404 (not 403) for non-owner — don't leak invoice existence.
    const { rows } = await pool.query(
      `UPDATE invoices
       SET tracking_number = $1,
           tracking_carrier = $2,
           shipped_at = NOW(),
           status = 'awaiting_review',
           review_notes = NULL
       WHERE id = $3 AND seller_id = $4 AND status = 'pending'
       RETURNING *`,
      [tracking_number, tracking_carrier, invoiceId, sellerId]
    );

    if (rows.length === 0) {
      // Distinguish ownership from state for a clearer message.
      const check = await pool.query(
        `SELECT status, seller_id FROM invoices WHERE id = $1`,
        [invoiceId]
      );
      if (check.rows.length === 0 || check.rows[0].seller_id !== sellerId) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      return res.status(409).json({
        message: `Invoice is already ${check.rows[0].status}`,
      });
    }

    res.json({
      message: 'Tracking submitted — awaiting admin review',
      invoice: rows[0],
    });
  } catch (err) {
    next(err);
  }
};

exports.ALLOWED_CARRIERS = ALLOWED_CARRIERS;
exports._num = num;
