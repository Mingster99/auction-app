const pool = require('../../config/database');

exports.getOverview = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const [userRow, myCards, myBids, wonCards] = await Promise.all([
      pool.query(
        `SELECT id, username, email, avatar_url, is_verified, is_verified_seller,
                has_payment_method, created_at
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
