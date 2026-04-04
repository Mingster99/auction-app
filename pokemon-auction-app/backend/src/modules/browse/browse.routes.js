const express = require('express');
const router = express.Router();
const pool = require('../../config/database');

// ============================================================
// BROWSE ROUTES (public — no auth required)
// ============================================================
// GET /api/browse/cards       — Browse all listed cards from verified sellers
// GET /api/browse/games       — Get list of games with available cards
// GET /api/browse/seller/:username — Public seller profile
// ============================================================


// ── BROWSE CARDS ─────────────────────────────────────────
// Query params:
//   search    — search card name, brand, subject
//   game      — filter by tcg_game (e.g. 'pokemon')
//   grade     — filter by psa_grade (e.g. 'GEM MT 10')
//   sort      — 'price_asc', 'price_desc', 'newest' (default)
//   upcoming  — 'true' to show only queued for stream
//   limit     — number of results (default 40)
//   offset    — pagination offset (default 0)
router.get('/cards', async (req, res, next) => {
  try {
    const {
      search,
      game,
      grade,
      sort = 'newest',
      upcoming,
      limit = 40,
      offset = 0,
    } = req.query;

    const conditions = [
      'u.is_verified_seller = true',
      'c.starting_bid > 0',
      "c.status != 'ended'",
    ];
    const values = [];
    let paramIndex = 1;

    // Search filter
    if (search && search.trim()) {
      conditions.push(
        `(c.name ILIKE $${paramIndex} OR c.psa_brand ILIKE $${paramIndex} OR c.psa_subject ILIKE $${paramIndex})`
      );
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Game filter
    if (game && game !== 'all') {
      conditions.push(`c.tcg_game = $${paramIndex}`);
      values.push(game);
      paramIndex++;
    }

    // Grade filter
    if (grade && grade !== 'all') {
      conditions.push(`c.psa_grade = $${paramIndex}`);
      values.push(grade);
      paramIndex++;
    }

    // Upcoming auctions filter
    if (upcoming === 'true') {
      conditions.push('c.queued_for_stream = true');
    }

    // Sort
    let orderBy;
    switch (sort) {
      case 'price_asc':
        orderBy = 'c.starting_bid ASC';
        break;
      case 'price_desc':
        orderBy = 'c.starting_bid DESC';
        break;
      case 'newest':
      default:
        orderBy = 'c.created_at DESC';
        break;
    }

    const whereClause = conditions.join(' AND ');

    // Get cards
    const cardsQuery = `
      SELECT c.*, u.username as seller_name
      FROM cards c
      JOIN users u ON c.seller_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(parseInt(limit), parseInt(offset));

    const cardsResult = await pool.query(cardsQuery, values);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cards c
      JOIN users u ON c.seller_id = u.id
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values.slice(0, -2));

    res.json({
      cards: cardsResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    next(error);
  }
});


// ── AVAILABLE GAMES ──────────────────────────────────────
// Returns only games that have listed cards from verified sellers
router.get('/games', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT c.tcg_game
      FROM cards c
      JOIN users u ON c.seller_id = u.id
      WHERE u.is_verified_seller = true
        AND c.starting_bid > 0
        AND c.status != 'ended'
        AND c.tcg_game IS NOT NULL
        AND c.tcg_game != ''
      ORDER BY c.tcg_game
    `);

    res.json(result.rows.map(r => r.tcg_game));
  } catch (error) {
    next(error);
  }
});


// ── AVAILABLE GRADES ─────────────────────────────────────
// Returns only grades that have listed cards from verified sellers
router.get('/grades', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT c.psa_grade
      FROM cards c
      JOIN users u ON c.seller_id = u.id
      WHERE u.is_verified_seller = true
        AND c.starting_bid > 0
        AND c.status != 'ended'
        AND c.psa_grade IS NOT NULL
        AND c.psa_grade != ''
      ORDER BY c.psa_grade DESC
    `);

    res.json(result.rows.map(r => r.psa_grade));
  } catch (error) {
    next(error);
  }
});


// ── SELLER PROFILE ───────────────────────────────────────
// Public profile showing a verified seller's listed cards
router.get('/seller/:username', async (req, res, next) => {
  try {
    const { username } = req.params;

    // Get seller info
    const userResult = await pool.query(
      `SELECT id, username, avatar_url, rating, is_verified, is_verified_seller, created_at
       FROM users WHERE username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const seller = userResult.rows[0];

    if (!seller.is_verified_seller) {
      return res.status(403).json({ message: 'This user is not a verified seller' });
    }

    // Get seller's listed cards
    const cardsResult = await pool.query(
      `SELECT * FROM cards
       WHERE seller_id = $1 AND starting_bid > 0 AND status != 'ended'
       ORDER BY queued_for_stream DESC, created_at DESC`,
      [seller.id]
    );

    // Get seller stats
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total_cards,
         COUNT(*) FILTER (WHERE queued_for_stream = true) as queued_cards
       FROM cards
       WHERE seller_id = $1 AND starting_bid > 0 AND status != 'ended'`,
      [seller.id]
    );

    res.json({
      seller: {
        username: seller.username,
        avatarUrl: seller.avatar_url,
        rating: seller.rating,
        isVerified: seller.is_verified,
        memberSince: seller.created_at,
      },
      cards: cardsResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
