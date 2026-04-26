const pool = require('../../config/database');

const num = (v) => (v == null ? 0 : parseFloat(v));

exports.getOverview = async (req, res, next) => {
  const sellerId = req.user.id;
  try {
    const [
      pendingPayouts,
      monthSales,
      activeListings,
      upcomingCount,
      recentSales,
      recentBids,
      upcomingStreams,
    ] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(seller_payout_amount), 0) AS total
         FROM invoices
         WHERE seller_id = $1 AND status IN ('pending', 'processing')`,
        [sellerId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM invoices
         WHERE seller_id = $1 AND created_at >= date_trunc('month', NOW())`,
        [sellerId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM cards WHERE seller_id = $1 AND status = 'active'`,
        [sellerId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM streams WHERE host_id = $1 AND status = 'scheduled'`,
        [sellerId]
      ),
      pool.query(
        `SELECT i.id, i.amount, i.status, i.created_at,
                c.name AS card_name,
                u.username AS buyer_username
         FROM invoices i
         JOIN cards c ON c.id = i.card_id
         JOIN users u ON u.id = i.buyer_id
         WHERE i.seller_id = $1
         ORDER BY i.created_at DESC
         LIMIT 5`,
        [sellerId]
      ),
      pool.query(
        `SELECT b.amount, b.placed_at,
                c.id AS card_id, c.name AS card_name,
                u.username AS bidder_username
         FROM bids b
         JOIN cards c ON c.id = b.card_id
         JOIN users u ON u.id = b.bidder_id
         WHERE c.seller_id = $1
         ORDER BY b.placed_at DESC
         LIMIT 5`,
        [sellerId]
      ),
      pool.query(
        `SELECT s.id, s.title, s.scheduled_start_time,
                COUNT(c.id) FILTER (WHERE c.queued_for_stream = true)::int AS queued_card_count
         FROM streams s
         LEFT JOIN cards c ON c.stream_id = s.id
         WHERE s.host_id = $1 AND s.status = 'scheduled'
         GROUP BY s.id
         ORDER BY s.scheduled_start_time ASC
         LIMIT 5`,
        [sellerId]
      ),
    ]);

    res.json({
      stats: {
        pending_payouts: num(pendingPayouts.rows[0].total),
        sales_this_month: num(monthSales.rows[0].total),
        active_listings_count: activeListings.rows[0].total,
        upcoming_streams_count: upcomingCount.rows[0].total,
      },
      recent_sales: recentSales.rows,
      recent_bids: recentBids.rows,
      upcoming_streams: upcomingStreams.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.getInvoices = async (req, res, next) => {
  const sellerId = req.user.id;
  const { status, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  const filters = ['i.seller_id = $1'];
  const params = [sellerId];

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
    const [list, count, pending] = await Promise.all([
      pool.query(
        `SELECT i.id, i.amount, i.platform_fee_amount, i.seller_payout_amount,
                i.status, i.created_at, i.paid_at,
                i.tracking_number, i.tracking_carrier,
                i.shipped_at, i.released_at, i.review_notes,
                c.name AS card_name, c.id AS card_id,
                u.username AS buyer_username
         FROM invoices i
         JOIN cards c ON c.id = i.card_id
         JOIN users u ON u.id = i.buyer_id
         WHERE ${where}
         ORDER BY i.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM invoices i WHERE ${where}`,
        params
      ),
      pool.query(
        `SELECT COALESCE(SUM(seller_payout_amount), 0) AS total
         FROM invoices
         WHERE seller_id = $1 AND status IN ('pending', 'processing')`,
        [sellerId]
      ),
    ]);

    res.json({
      invoices: list.rows,
      total: count.rows[0].total,
      limit,
      offset,
      pending_payouts: num(pending.rows[0].total),
    });
  } catch (err) {
    next(err);
  }
};

exports.getStreams = async (req, res, next) => {
  const sellerId = req.user.id;
  try {
    // Subqueries instead of joins to avoid cartesian inflation when a stream
    // has both multiple cards and multiple invoices.
    const { rows } = await pool.query(
      `SELECT s.id, s.title, s.description, s.status,
              s.scheduled_start_time, s.started_at, s.ended_at, s.viewer_count,
              COALESCE((
                SELECT COUNT(*)::int FROM cards c
                WHERE c.stream_id = s.id AND c.status = 'sold'
              ), 0) AS cards_sold,
              COALESCE((
                SELECT SUM(i.amount) FROM invoices i WHERE i.stream_id = s.id
              ), 0) AS total_revenue,
              COALESCE((
                SELECT COUNT(*)::int FROM cards c
                WHERE c.stream_id = s.id AND c.queued_for_stream = true
              ), 0) AS queued_card_count
       FROM streams s
       WHERE s.host_id = $1
       ORDER BY
         CASE s.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
         COALESCE(s.scheduled_start_time, s.started_at, s.created_at) DESC`,
      [sellerId]
    );

    res.json(
      rows.map((r) => ({
        ...r,
        total_revenue: num(r.total_revenue),
      }))
    );
  } catch (err) {
    next(err);
  }
};
