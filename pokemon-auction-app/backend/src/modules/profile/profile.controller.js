const pool = require('../../config/database');

const COUNTRIES = [
  'Singapore','Malaysia','Indonesia','Thailand','Philippines',
  'Vietnam','Australia','United States','United Kingdom','Other',
];

exports.getOverview = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const [userRow, myCards, myBids, wonCards] = await Promise.all([
      pool.query(
        `SELECT id, username, email, avatar_url, is_verified, is_verified_seller,
                has_payment_method, created_at,
                phone, address_line1, address_line2, city, state, postal_code, country
         FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, name, card_image_front, image_url, psa_grade,
                starting_bid, current_bid, status, auction_status
         FROM cards
         WHERE seller_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT b.amount, b.placed_at, b.is_winning_bid,
                c.id AS card_id, c.name AS card_name, c.card_image_front, c.image_url,
                c.psa_grade, c.auction_status, c.current_bid
         FROM bids b
         JOIN cards c ON c.id = b.card_id
         WHERE b.bidder_id = $1
         ORDER BY b.placed_at DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT id, name, card_image_front, image_url, psa_grade,
                current_bid, updated_at
         FROM cards
         WHERE winner_id = $1 AND status = 'sold'
         ORDER BY updated_at DESC
         LIMIT 5`,
        [userId]
      ),
    ]);

    if (userRow.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: userRow.rows[0],
      my_cards: myCards.rows,
      my_bids: myBids.rows,
      won_cards: wonCards.rows,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/profile/details
exports.updateDetails = async (req, res, next) => {
  const userId = req.user.id;
  const { phone, address_line1, address_line2, city, state, postal_code, country } = req.body;

  if (address_line1 !== undefined && !address_line1?.trim()) {
    return res.status(400).json({ message: 'Address line 1 cannot be empty' });
  }
  if (city !== undefined && !city?.trim()) {
    return res.status(400).json({ message: 'City cannot be empty' });
  }
  if (postal_code !== undefined && !postal_code?.trim()) {
    return res.status(400).json({ message: 'Postal code cannot be empty' });
  }
  if (country !== undefined && !COUNTRIES.includes(country)) {
    return res.status(400).json({ message: 'Invalid country' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         phone         = COALESCE($1, phone),
         address_line1 = COALESCE($2, address_line1),
         address_line2 = $3,
         city          = COALESCE($4, city),
         state         = $5,
         postal_code   = COALESCE($6, postal_code),
         country       = COALESCE($7, country),
         updated_at    = NOW()
       WHERE id = $8
       RETURNING id, username, email, phone,
                 address_line1, address_line2, city, state, postal_code, country,
                 is_verified, is_verified_seller, created_at`,
      [
        phone        ?? null,
        address_line1?.trim() ?? null,
        address_line2?.trim() ?? null,
        city?.trim()         ?? null,
        state?.trim()        ?? null,
        postal_code?.trim()  ?? null,
        country              ?? null,
        userId,
      ]
    );

    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    next(err);
  }
};
