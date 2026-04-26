const pool = require('../../config/database');

// GET /api/admin/invoices/pending-review — invoices awaiting admin review.
exports.getPendingReview = async (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const [list, count] = await Promise.all([
      pool.query(
        `SELECT i.id, i.amount, i.platform_fee_amount, i.seller_payout_amount,
                i.status, i.created_at,
                i.tracking_number, i.tracking_carrier, i.shipped_at,
                c.id AS card_id, c.name AS card_name, c.card_image_front, c.image_url, c.psa_grade,
                s.username AS seller_username,
                b.username AS buyer_username
         FROM invoices i
         JOIN cards c ON c.id = i.card_id
         JOIN users s ON s.id = i.seller_id
         JOIN users b ON b.id = i.buyer_id
         WHERE i.status = 'awaiting_review'
         ORDER BY i.shipped_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM invoices WHERE status = 'awaiting_review'`
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

// POST /api/admin/invoices/:id/approve — flip awaiting_review → shipped, release payout.
exports.approveShipment = async (req, res, next) => {
  const adminId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });
  const notes = (req.body?.notes || '').toString().trim() || null;

  try {
    const { rows } = await pool.query(
      `UPDATE invoices
       SET status = 'shipped',
           released_at = NOW(),
           reviewed_at = NOW(),
           reviewed_by_id = $1,
           review_notes = $2
       WHERE id = $3 AND status = 'awaiting_review'
       RETURNING *`,
      [adminId, notes, invoiceId]
    );

    if (rows.length === 0) {
      const check = await pool.query(`SELECT status FROM invoices WHERE id = $1`, [invoiceId]);
      if (check.rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
      return res.status(409).json({ message: `Invoice is ${check.rows[0].status}, not awaiting review` });
    }

    res.json({ message: 'Approved — payout released to seller', invoice: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/invoices/:id/reject — bounce back to pending so seller can resubmit.
exports.rejectShipment = async (req, res, next) => {
  const adminId = req.user.id;
  const invoiceId = parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ message: 'Invalid invoice id' });
  const notes = (req.body?.notes || '').toString().trim();
  if (!notes) return res.status(400).json({ message: 'Rejection notes are required' });
  if (notes.length > 1000) return res.status(400).json({ message: 'Notes too long (max 1000)' });

  try {
    // Clear tracking so the seller has to resubmit cleanly.
    const { rows } = await pool.query(
      `UPDATE invoices
       SET status = 'pending',
           tracking_number = NULL,
           tracking_carrier = NULL,
           shipped_at = NULL,
           reviewed_at = NOW(),
           reviewed_by_id = $1,
           review_notes = $2
       WHERE id = $3 AND status = 'awaiting_review'
       RETURNING *`,
      [adminId, notes, invoiceId]
    );

    if (rows.length === 0) {
      const check = await pool.query(`SELECT status FROM invoices WHERE id = $1`, [invoiceId]);
      if (check.rows.length === 0) return res.status(404).json({ message: 'Invoice not found' });
      return res.status(409).json({ message: `Invoice is ${check.rows[0].status}, not awaiting review` });
    }

    res.json({ message: 'Rejected — seller will resubmit', invoice: rows[0] });
  } catch (err) {
    next(err);
  }
};
