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

    // Place bid (validation happens in backend API)
    socket.on('place-bid', async ({ streamId, cardId, amount }) => {
      // Here you would validate and save the bid to database
      // For now, just broadcast the bid
      const bid = {
        username: socket.user.username,
        userId: socket.user.id,
        cardId,
        amount,
        timestamp: new Date()
      };
      
      io.to(`stream-${streamId}`).emit('new-bid', bid);
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

module.exports = { initializeWebSocket, getIO };
