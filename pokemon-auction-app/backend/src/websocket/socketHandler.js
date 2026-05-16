const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

let io;

// ── Chat moderation in-memory state ───────────────────────
// Warm caches loaded from DB on startup. DB is source of truth.
const streamBans     = new Map(); // streamId (number) → Set<userId (number)>
const streamSilences = new Map(); // `${streamId}:${userId}` → expiresAt (ms)
const lastChatTime   = new Map(); // userId → last message timestamp (ms)

const CHAT_RATE_LIMIT_MS = 1500;

function isBanned(streamId, userId) {
  return streamBans.get(streamId)?.has(userId) ?? false;
}

function isSilenced(streamId, userId) {
  const key = `${streamId}:${userId}`;
  const expires = streamSilences.get(key);
  if (!expires) return false;
  if (Date.now() >= expires) {
    streamSilences.delete(key);
    return false;
  }
  return true;
}

function addBan(streamId, userId) {
  if (!streamBans.has(streamId)) streamBans.set(streamId, new Set());
  streamBans.get(streamId).add(userId);
}

function removeBan(streamId, userId) {
  streamBans.get(streamId)?.delete(userId);
}

function addSilence(streamId, userId, durationMs) {
  streamSilences.set(`${streamId}:${userId}`, Date.now() + durationMs);
}

function removeSilence(streamId, userId) {
  streamSilences.delete(`${streamId}:${userId}`);
}

// Load all bans and active silences from DB into memory (call on server startup)
const loadModerationState = async () => {
  try {
    const { rows: bans } = await pool.query(
      'SELECT stream_id, user_id FROM stream_chat_bans'
    );
    for (const row of bans) {
      addBan(row.stream_id, row.user_id);
    }

    const { rows: silences } = await pool.query(
      `SELECT stream_id, user_id,
              EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_ms
       FROM stream_chat_silences
       WHERE expires_at > NOW()`
    );
    for (const row of silences) {
      streamSilences.set(`${row.stream_id}:${row.user_id}`, Number(row.expires_ms));
    }

    await pool.query('DELETE FROM stream_chat_silences WHERE expires_at <= NOW()');

    console.log(`✅ Chat moderation loaded: ${bans.length} bans, ${silences.length} active silences`);
  } catch (err) {
    console.error('Failed to load moderation state:', err.message);
  }
};

const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Join personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Join stream room
    socket.on('join-stream', (streamId) => {
      socket.join(`stream-${streamId}`);
      console.log(`${socket.user.username} joined stream ${streamId}`);

      socket.to(`stream-${streamId}`).emit('user-joined', {
        username: socket.user.username,
        userId: socket.user.id
      });
    });

    // Leave stream room
    socket.on('leave-stream', (streamId) => {
      socket.leave(`stream-${streamId}`);
      console.log(`${socket.user.username} left stream ${streamId}`);
    });

    // ── Chat message ─────────────────────────────────────────
    socket.on('chat-message', async ({ streamId, message }) => {
      const userId = socket.user.id;
      const now = Date.now();

      // Rate limit
      const lastTime = lastChatTime.get(userId);
      if (lastTime && now - lastTime < CHAT_RATE_LIMIT_MS) {
        socket.emit('chat-error', { type: 'rate_limited', message: 'Sending messages too fast — slow down a little.' });
        return;
      }

      // Ban check
      if (isBanned(streamId, userId)) {
        socket.emit('chat-error', { type: 'banned', message: 'You are banned from this stream\'s chat.' });
        return;
      }

      // Silence check
      if (isSilenced(streamId, userId)) {
        socket.emit('chat-error', { type: 'silenced', message: 'You are currently silenced in this chat.' });
        return;
      }

      const sanitized = (message || '').trim().slice(0, 500);
      if (!sanitized) return;

      lastChatTime.set(userId, now);

      // Persist to DB and get the row id for client-side deduplication
      let messageId = null;
      try {
        const { rows } = await pool.query(
          'INSERT INTO chat_messages (stream_id, user_id, message) VALUES ($1, $2, $3) RETURNING id',
          [streamId, userId, sanitized]
        );
        messageId = rows[0].id;
      } catch (err) {
        console.error('chat persist error:', err.message);
      }

      const chatMessage = {
        id: messageId,
        username: socket.user.username,
        userId,
        message: sanitized,
        timestamp: new Date()
      };

      io.to(`stream-${streamId}`).emit('chat-message', chatMessage);
    });

    // ── Moderation: Ban ──────────────────────────────────────
    socket.on('ban-user', async ({ streamId, targetUserId }) => {
      try {
        const { rows } = await pool.query(
          'SELECT host_id FROM streams WHERE id = $1',
          [streamId]
        );
        if (!rows[0] || rows[0].host_id !== socket.user.id) {
          socket.emit('moderation-error', { message: 'Only the stream host can ban users.' });
          return;
        }

        await pool.query(
          `INSERT INTO stream_chat_bans (stream_id, user_id, banned_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (stream_id, user_id) DO NOTHING`,
          [streamId, targetUserId, socket.user.id]
        );
        addBan(streamId, targetUserId);

        io.to(`user:${targetUserId}`).emit('you-were-banned', {
          streamId,
          message: 'You have been banned from this stream\'s chat.'
        });
        io.to(`stream-${streamId}`).emit('user-banned', { userId: targetUserId });
        socket.emit('moderation-success', { action: 'ban', targetUserId, streamId });
      } catch (err) {
        console.error('ban-user error:', err.message);
        socket.emit('moderation-error', { message: 'Failed to ban user.' });
      }
    });

    // ── Moderation: Unban ────────────────────────────────────
    socket.on('unban-user', async ({ streamId, targetUserId }) => {
      try {
        const { rows } = await pool.query(
          'SELECT host_id FROM streams WHERE id = $1',
          [streamId]
        );
        if (!rows[0] || rows[0].host_id !== socket.user.id) {
          socket.emit('moderation-error', { message: 'Only the stream host can unban users.' });
          return;
        }

        await pool.query(
          'DELETE FROM stream_chat_bans WHERE stream_id = $1 AND user_id = $2',
          [streamId, targetUserId]
        );
        removeBan(streamId, targetUserId);

        io.to(`user:${targetUserId}`).emit('you-were-unbanned', { streamId });
        socket.emit('moderation-success', { action: 'unban', targetUserId, streamId });
      } catch (err) {
        console.error('unban-user error:', err.message);
        socket.emit('moderation-error', { message: 'Failed to unban user.' });
      }
    });

    // ── Moderation: Silence ──────────────────────────────────
    socket.on('silence-user', async ({ streamId, targetUserId, durationMinutes }) => {
      const ALLOWED = [1, 5, 15, 60];
      const duration = ALLOWED.includes(Number(durationMinutes)) ? Number(durationMinutes) : 5;
      const durationMs = duration * 60 * 1000;

      try {
        const { rows } = await pool.query(
          'SELECT host_id FROM streams WHERE id = $1',
          [streamId]
        );
        if (!rows[0] || rows[0].host_id !== socket.user.id) {
          socket.emit('moderation-error', { message: 'Only the stream host can silence users.' });
          return;
        }

        const expiresAt = new Date(Date.now() + durationMs);
        await pool.query(
          `INSERT INTO stream_chat_silences (stream_id, user_id, silenced_by, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (stream_id, user_id)
           DO UPDATE SET silenced_by = $3, silenced_at = NOW(), expires_at = $4`,
          [streamId, targetUserId, socket.user.id, expiresAt]
        );
        addSilence(streamId, targetUserId, durationMs);

        io.to(`user:${targetUserId}`).emit('you-were-silenced', {
          streamId,
          durationMinutes: duration,
          expiresAt: expiresAt.toISOString(),
          message: `You have been silenced for ${duration} minute${duration === 1 ? '' : 's'}.`
        });
        socket.emit('moderation-success', { action: 'silence', targetUserId, streamId, durationMinutes: duration });
      } catch (err) {
        console.error('silence-user error:', err.message);
        socket.emit('moderation-error', { message: 'Failed to silence user.' });
      }
    });

    // ── Moderation: Unsilence ────────────────────────────────
    socket.on('unsilence-user', async ({ streamId, targetUserId }) => {
      try {
        const { rows } = await pool.query(
          'SELECT host_id FROM streams WHERE id = $1',
          [streamId]
        );
        if (!rows[0] || rows[0].host_id !== socket.user.id) {
          socket.emit('moderation-error', { message: 'Only the stream host can remove silences.' });
          return;
        }

        await pool.query(
          'DELETE FROM stream_chat_silences WHERE stream_id = $1 AND user_id = $2',
          [streamId, targetUserId]
        );
        removeSilence(streamId, targetUserId);

        io.to(`user:${targetUserId}`).emit('you-were-unsilenced', { streamId });
        socket.emit('moderation-success', { action: 'unsilence', targetUserId, streamId });
      } catch (err) {
        console.error('unsilence-user error:', err.message);
        socket.emit('moderation-error', { message: 'Failed to unsilence user.' });
      }
    });

    // ── Auction room management ──────────────────────────────
    socket.on('join-auction', async (streamId) => {
      socket.join(`auction:${streamId}`);
      console.log(`${socket.user.username} joined auction room for stream ${streamId}`);

      try {
        const auctionService = require('../services/auctionService');
        const state = await auctionService.getAuctionState(streamId);
        socket.emit('auction-state', state);
      } catch (err) {
        console.error('Error sending auction state:', err.message);
      }
    });

    socket.on('leave-auction', (streamId) => {
      socket.leave(`auction:${streamId}`);
      console.log(`${socket.user.username} left auction room for stream ${streamId}`);
    });

    // ── Bidding (server-authoritative) ───────────────────────
    socket.on('place-bid', async ({ streamId, cardId, amount }) => {
      try {
        const auctionService = require('../services/auctionService');
        await auctionService.placeBid(cardId, streamId, socket.user.id, amount);
      } catch (err) {
        socket.emit('bid-error', { message: err.message });
      }
    });

    // ── Buyout ───────────────────────────────────────────────
    socket.on('buyout', async ({ streamId, cardId }) => {
      try {
        const auctionService = require('../services/auctionService');
        await auctionService.executeBuyout(cardId, streamId, socket.user.id);
      } catch (err) {
        socket.emit('buyout-error', { message: err.message });
      }
    });

    // ── Seller-only: Start Auction ───────────────────────────
    socket.on('start-auction', async ({ streamId, cardId }) => {
      try {
        const auctionService = require('../services/auctionService');
        await auctionService.startAuction(cardId, streamId, socket.user.id);
      } catch (err) {
        socket.emit('auction-error', { message: err.message });
      }
    });

    // ── Seller-only: End Auction Early ───────────────────────
    socket.on('end-auction-early', async ({ cardId }) => {
      try {
        const auctionService = require('../services/auctionService');
        await auctionService.endAuctionEarly(cardId, socket.user.id);
      } catch (err) {
        socket.emit('auction-error', { message: err.message });
      }
    });

    // ── Seller-only: Skip Card ───────────────────────────────
    socket.on('skip-card', async ({ streamId, cardId }) => {
      try {
        const auctionService = require('../services/auctionService');
        const result = await auctionService.skipCard(cardId, socket.user.id);
        io.to(`auction:${streamId}`).emit('card-skipped', result);
      } catch (err) {
        socket.emit('auction-error', { message: err.message });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// ── Auction broadcast helpers ──────────────────────────────

const broadcastAuctionStart = (streamId, auctionData) => {
  getIO().to(`auction:${streamId}`).emit('auction-started', auctionData);
};

const broadcastNewBid = (streamId, bidData) => {
  getIO().to(`auction:${streamId}`).emit('new-bid', bidData);
};

const broadcastAuctionEnd = (streamId, resultData) => {
  getIO().to(`auction:${streamId}`).emit('auction-ended', resultData);
};

const broadcastTimeExtension = (streamId, newEndTime) => {
  getIO().to(`auction:${streamId}`).emit('auction-time-extended', { auction_ends_at: newEndTime });
};

const broadcastAuctionState = (streamId, stateData) => {
  getIO().to(`auction:${streamId}`).emit('auction-state', stateData);
};

module.exports = {
  initializeWebSocket,
  getIO,
  loadModerationState,
  broadcastAuctionStart,
  broadcastNewBid,
  broadcastAuctionEnd,
  broadcastTimeExtension,
  broadcastAuctionState
};
