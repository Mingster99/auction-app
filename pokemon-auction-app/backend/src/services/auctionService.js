const pool = require('../config/database');
const {
  broadcastAuctionStart,
  broadcastNewBid,
  broadcastAuctionEnd,
  broadcastTimeExtension,
  broadcastAuctionState,
} = require('../websocket/socketHandler');

// ── Timer & Rate-Limit State ─────────────────────────────
const auctionTimers = new Map();    // cardId → timeoutId
const lastBidTime = new Map();      // odanIduserId → timestamp (rate limit)

const PLATFORM_FEE_RATE = 0.05;    // 5% platform fee
const ANTI_SNIPE_WINDOW = 30;      // seconds
const ANTI_SNIPE_EXTENSION = 30;   // seconds
const BID_RATE_LIMIT_MS = 500;     // min ms between bids per user

// ── Start Auction ────────────────────────────────────────
async function startAuction(cardId, streamId, hostId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT c.*, s.host_id
       FROM cards c
       JOIN streams s ON s.id = $2
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [cardId, streamId]
    );

    const card = rows[0];
    if (!card) throw new Error('Card not found');
    if (card.host_id !== hostId) throw new Error('Only the stream host can start auctions');
    if (card.auction_status !== 'idle' && card.auction_status !== 'ended') throw new Error('Card auction is not idle');
    if (card.seller_id !== hostId) throw new Error('Card does not belong to this host');

    const duration = card.auction_duration_seconds || 60;

    const { rows: updated } = await client.query(
      `UPDATE cards SET
        auction_status = 'active',
        auction_started_at = NOW(),
        auction_ends_at = NOW() + INTERVAL '1 second' * $2,
        current_bid = starting_bid,
        current_bidder_id = NULL,
        stream_id = $3
       WHERE id = $1
       RETURNING *`,
      [cardId, duration, streamId]
    );

    await client.query('COMMIT');

    const updatedCard = updated[0];

    // Schedule server-side timer
    scheduleAuctionEnd(cardId, duration * 1000);

    const auctionData = {
      card: updatedCard,
      current_bid: updatedCard.current_bid,
      current_bidder: null,
      auction_ends_at: updatedCard.auction_ends_at,
      auction_status: 'active',
      bid_history: [],
    };

    broadcastAuctionStart(streamId, auctionData);
    return auctionData;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Place Bid ────────────────────────────────────────────
async function placeBid(cardId, streamId, bidderId, amount) {
  // Rate limit check
  const rateLimitKey = `${bidderId}`;
  const now = Date.now();
  const lastTime = lastBidTime.get(rateLimitKey);
  if (lastTime && now - lastTime < BID_RATE_LIMIT_MS) {
    throw new Error('Bidding too fast. Please wait.');
  }
  lastBidTime.set(rateLimitKey, now);

  const bidAmount = parseFloat(amount);
  if (isNaN(bidAmount) || bidAmount <= 0) {
    throw new Error('Invalid bid amount');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT c.*, u.username AS bidder_username
       FROM cards c
       LEFT JOIN users u ON u.id = $2
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [cardId, bidderId]
    );

    const card = rows[0];
    if (!card) throw new Error('Card not found');
    if (card.auction_status !== 'active') throw new Error('Auction is not active');
    if (new Date(card.auction_ends_at) <= new Date()) throw new Error('Auction has ended');
    if (bidderId === card.seller_id) throw new Error('Seller cannot bid on their own card');
    if (bidAmount <= parseFloat(card.current_bid)) {
      throw new Error(`Bid must be higher than current bid of $${parseFloat(card.current_bid).toFixed(2)}`);
    }

    // has_payment_method check — stub is toggled by /api/users/me/payment-method
    const { rows: userRows } = await client.query('SELECT has_payment_method FROM users WHERE id = $1', [bidderId]);
    if (!userRows[0]?.has_payment_method) throw new Error('Payment method required to bid');

    // Update card
    await client.query(
      `UPDATE cards SET current_bid = $2, current_bidder_id = $3 WHERE id = $1`,
      [cardId, bidAmount, bidderId]
    );

    // Insert bid record
    await client.query(
      `INSERT INTO bids (card_id, stream_id, bidder_id, amount, placed_at, is_winning_bid)
       VALUES ($1, $2, $3, $4, NOW(), false)`,
      [cardId, streamId, bidderId, bidAmount]
    );

    // Anti-snipe: extend if bid placed within last 30 seconds
    let newEndTime = card.auction_ends_at;
    const remainingMs = new Date(card.auction_ends_at).getTime() - Date.now();
    if (remainingMs < ANTI_SNIPE_WINDOW * 1000) {
      const { rows: extRows } = await client.query(
        `UPDATE cards SET auction_ends_at = NOW() + INTERVAL '${ANTI_SNIPE_EXTENSION} seconds'
         WHERE id = $1 RETURNING auction_ends_at`,
        [cardId]
      );
      newEndTime = extRows[0].auction_ends_at;

      // Reschedule timer
      rescheduleAuctionEnd(cardId, ANTI_SNIPE_EXTENSION * 1000);
    }

    await client.query('COMMIT');

    const bidData = {
      cardId,
      amount: bidAmount,
      bidderUsername: card.bidder_username,
      bidderId,
      newEndTime,
      timestamp: new Date(),
    };

    broadcastNewBid(streamId, bidData);

    if (remainingMs < ANTI_SNIPE_WINDOW * 1000) {
      broadcastTimeExtension(streamId, newEndTime);
    }

    return bidData;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Execute Buyout ───────────────────────────────────────
async function executeBuyout(cardId, streamId, buyerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT c.*, u.username AS buyer_username
       FROM cards c
       LEFT JOIN users u ON u.id = $2
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [cardId, buyerId]
    );

    const card = rows[0];
    if (!card) throw new Error('Card not found');
    if (card.auction_status !== 'active') throw new Error('Auction is not active');
    if (!card.buyout_price) throw new Error('This card has no buyout price');
    if (buyerId === card.seller_id) throw new Error('Seller cannot buyout their own card');

    // has_payment_method check
    const { rows: buyerRows } = await client.query('SELECT has_payment_method FROM users WHERE id = $1', [buyerId]);
    if (!buyerRows[0]?.has_payment_method) throw new Error('Payment method required to buy now');

    const buyoutAmount = parseFloat(card.buyout_price);
    const platformFee = parseFloat((buyoutAmount * PLATFORM_FEE_RATE).toFixed(2));
    const sellerPayout = parseFloat((buyoutAmount - platformFee).toFixed(2));

    // Update card
    await client.query(
      `UPDATE cards SET
        auction_status = 'sold',
        current_bid = $2,
        current_bidder_id = $3,
        winner_id = $3,
        auction_ends_at = NOW(),
        status = 'sold'
       WHERE id = $1`,
      [cardId, buyoutAmount, buyerId]
    );

    // Insert buyout as final bid
    await client.query(
      `INSERT INTO bids (card_id, stream_id, bidder_id, amount, placed_at, is_winning_bid)
       VALUES ($1, $2, $3, $4, NOW(), true)`,
      [cardId, streamId, buyerId, buyoutAmount]
    );

    // Create invoice
    await client.query(
      `INSERT INTO invoices (buyer_id, seller_id, card_id, stream_id, amount, platform_fee_amount, seller_payout_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [buyerId, card.seller_id, cardId, streamId, buyoutAmount, platformFee, sellerPayout]
    );

    await client.query('COMMIT');

    // Clear timer
    clearAuctionTimer(cardId);

    const resultData = {
      cardId,
      isBuyout: true,
      winner: card.buyer_username,
      winnerId: buyerId,
      amount: buyoutAmount,
      card,
    };

    broadcastAuctionEnd(streamId, resultData);
    return resultData;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── End Auction (timer expiry) ───────────────────────────
async function endAuction(cardId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT c.*, u.username AS winner_username
       FROM cards c
       LEFT JOIN users u ON u.id = c.current_bidder_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [cardId]
    );

    const card = rows[0];
    if (!card) {
      await client.query('ROLLBACK');
      return;
    }
    if (card.auction_status !== 'active') {
      await client.query('ROLLBACK');
      return;
    }

    let resultData;

    if (card.current_bidder_id) {
      // We have a winner
      const winAmount = parseFloat(card.current_bid);
      const platformFee = parseFloat((winAmount * PLATFORM_FEE_RATE).toFixed(2));
      const sellerPayout = parseFloat((winAmount - platformFee).toFixed(2));

      await client.query(
        `UPDATE cards SET auction_status = 'sold', winner_id = current_bidder_id, status = 'sold' WHERE id = $1`,
        [cardId]
      );

      // Mark winning bid (use subquery for PostgreSQL compatibility)
      await client.query(
        `UPDATE bids SET is_winning_bid = true
         WHERE id = (
           SELECT id FROM bids
           WHERE card_id = $1 AND bidder_id = $2 AND amount = $3 AND is_winning_bid = false
           ORDER BY placed_at DESC LIMIT 1
         )`,
        [cardId, card.current_bidder_id, card.current_bid]
      );

      // Create invoice
      await client.query(
        `INSERT INTO invoices (buyer_id, seller_id, card_id, stream_id, amount, platform_fee_amount, seller_payout_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [card.current_bidder_id, card.seller_id, cardId, card.stream_id, winAmount, platformFee, sellerPayout]
      );

      resultData = {
        cardId,
        isBuyout: false,
        winner: card.winner_username,
        winnerId: card.current_bidder_id,
        amount: winAmount,
      };
    } else {
      // No bids — no sale
      await client.query(
        `UPDATE cards SET auction_status = 'ended' WHERE id = $1`,
        [cardId]
      );

      resultData = {
        cardId,
        isBuyout: false,
        winner: null,
        winnerId: null,
        amount: null,
      };
    }

    await client.query('COMMIT');

    clearAuctionTimer(cardId);

    // Broadcast to the stream room
    if (card.stream_id) {
      broadcastAuctionEnd(card.stream_id, resultData);
    }

    return resultData;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error ending auction for card', cardId, err);
  } finally {
    client.release();
  }
}

// ── End Auction Early (host cancels) ─────────────────────
async function endAuctionEarly(cardId, hostId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT c.*, s.host_id, s.id AS sid
       FROM cards c
       LEFT JOIN streams s ON s.id = c.stream_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [cardId]
    );

    const card = rows[0];
    if (!card) throw new Error('Card not found');
    if (card.host_id !== hostId) throw new Error('Only the stream host can end auctions');
    if (card.auction_status !== 'active') throw new Error('Auction is not active');

    await client.query(
      `UPDATE cards SET auction_status = 'ended', auction_ends_at = NOW() WHERE id = $1`,
      [cardId]
    );

    await client.query('COMMIT');

    clearAuctionTimer(cardId);

    const resultData = {
      cardId,
      isCancelled: true,
      winner: null,
      winnerId: null,
      amount: null,
    };

    if (card.stream_id) {
      broadcastAuctionEnd(card.stream_id, resultData);
    }

    return resultData;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Skip Card ────────────────────────────────────────────
async function skipCard(cardId, hostId) {
  const { rows } = await pool.query(
    `SELECT c.*, s.host_id
     FROM cards c
     LEFT JOIN streams s ON s.id = c.stream_id
     WHERE c.id = $1`,
    [cardId]
  );

  const card = rows[0];
  if (!card) throw new Error('Card not found');
  if (card.seller_id !== hostId) throw new Error('Card does not belong to this host');
  if (card.auction_status === 'active') throw new Error('Cannot skip a card with an active auction');

  await pool.query(
    `UPDATE cards SET queued_for_stream = false, queue_order = NULL, auction_status = 'idle' WHERE id = $1`,
    [cardId]
  );

  return { cardId, skipped: true };
}

// ── Get Auction State (for resync) ───────────────────────
async function getAuctionState(streamId) {
  // Find active auction card for this stream
  const { rows: cardRows } = await pool.query(
    `SELECT c.*, u.username AS current_bidder
     FROM cards c
     LEFT JOIN users u ON u.id = c.current_bidder_id
     WHERE c.stream_id = $1 AND c.auction_status = 'active'
     LIMIT 1`,
    [streamId]
  );

  if (cardRows.length === 0) {
    return { card: null, auction_status: 'idle', current_bid: null, current_bidder: null, auction_ends_at: null, bid_history: [] };
  }

  const card = cardRows[0];

  // Get last 10 bids
  const { rows: bidRows } = await pool.query(
    `SELECT b.amount, b.placed_at, u.username
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.card_id = $1
     ORDER BY b.placed_at DESC
     LIMIT 10`,
    [card.id]
  );

  return {
    card,
    current_bid: card.current_bid,
    current_bidder: card.current_bidder,
    auction_ends_at: card.auction_ends_at,
    auction_status: 'active',
    bid_history: bidRows,
  };
}

// ── Timer Management ─────────────────────────────────────
function scheduleAuctionEnd(cardId, delayMs) {
  clearAuctionTimer(cardId);
  const timerId = setTimeout(() => {
    auctionTimers.delete(cardId);
    endAuction(cardId).catch((err) => {
      console.error('Failed to end auction for card', cardId, err);
    });
  }, delayMs);
  auctionTimers.set(cardId, timerId);
}

function rescheduleAuctionEnd(cardId, delayMs) {
  scheduleAuctionEnd(cardId, delayMs);
}

function clearAuctionTimer(cardId) {
  const existing = auctionTimers.get(cardId);
  if (existing) {
    clearTimeout(existing);
    auctionTimers.delete(cardId);
  }
}

// ── Startup Recovery ─────────────────────────────────────
async function recoverActiveAuctions() {
  try {
    const { rows } = await pool.query(
      `SELECT id, auction_ends_at FROM cards WHERE auction_status = 'active'`
    );

    if (rows.length === 0) {
      console.log('No active auctions to recover');
      return;
    }

    console.log(`Recovering ${rows.length} active auction(s)...`);

    for (const card of rows) {
      const remainingMs = new Date(card.auction_ends_at).getTime() - Date.now();

      if (remainingMs <= 0) {
        // Auction should have ended while server was down
        console.log(`Ending expired auction for card ${card.id}`);
        await endAuction(card.id);
      } else {
        console.log(`Resuming auction for card ${card.id} (${Math.ceil(remainingMs / 1000)}s remaining)`);
        scheduleAuctionEnd(card.id, remainingMs);
      }
    }
  } catch (err) {
    console.error('Failed to recover active auctions:', err);
  }
}

module.exports = {
  startAuction,
  placeBid,
  executeBuyout,
  endAuction,
  endAuctionEarly,
  skipCard,
  getAuctionState,
  recoverActiveAuctions,
};
