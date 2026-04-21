const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

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
      
      // Notify others in the room
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

    // Chat message
    socket.on('chat-message', ({ streamId, message }) => {
      const chatMessage = {
        username: socket.user.username,
        userId: socket.user.id,
        message,
        timestamp: new Date()
      };
      
      // Broadcast to everyone in the stream
      io.to(`stream-${streamId}`).emit('chat-message', chatMessage);
    });

    // ── Auction room management ──────────────────────────────
    socket.on('join-auction', async (streamId) => {
      socket.join(`auction:${streamId}`);
      console.log(`${socket.user.username} joined auction room for stream ${streamId}`);

      // Send current auction state to the joining client
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
// Called from auction route handlers to push state to clients.

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
  broadcastAuctionStart,
  broadcastNewBid,
  broadcastAuctionEnd,
  broadcastTimeExtension,
  broadcastAuctionState
};
