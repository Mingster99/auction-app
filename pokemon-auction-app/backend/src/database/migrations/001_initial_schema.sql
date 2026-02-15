-- Initial database schema for Pokémon Auction App

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  rating DECIMAL(3, 2) DEFAULT 0.00,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  set VARCHAR(255),
  rarity VARCHAR(100),
  condition VARCHAR(50),
  grading VARCHAR(50),
  description TEXT,
  image_url VARCHAR(500),
  starting_bid DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, sold, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
  id SERIAL PRIMARY KEY,
  host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, live, ended
  daily_room_url VARCHAR(500), -- Daily.co room URL
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream cards (queue of cards for a stream)
CREATE TABLE IF NOT EXISTS stream_cards (
  id SERIAL PRIMARY KEY,
  stream_id INTEGER REFERENCES streams(id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  auction_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  bidder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  is_winning BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table (for escrow/payments)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, held, released, refunded
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  stream_id INTEGER REFERENCES streams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_cards_seller ON cards(seller_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_streams_host ON streams(host_id);
CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_bids_card ON bids(card_id);
CREATE INDEX idx_bids_bidder ON bids(bidder_id);
CREATE INDEX idx_stream_cards_stream ON stream_cards(stream_id);
CREATE INDEX idx_chat_messages_stream ON chat_messages(stream_id);
