const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const cardRoutes = require('./modules/cards/cards.routes');
const psaRoutes = require('./modules/cards/psa.routes');
const streamRoutes = require('./modules/streams/streams.routes');
const bidRoutes = require('./modules/bids/bids.routes');
const errorMiddleware = require('./middleware/error.middleware');
const inventoryRoutes = require('./modules/inventory/inventory.routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cards', psaRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/inventory', inventoryRoutes);

// Error handling middleware (must be last)
app.use(errorMiddleware);

module.exports = app;