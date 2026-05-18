const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

const authService = {
  // Register new user
  signup: async (email, password, username, address = {}) => {
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw { status: 409, message: 'User already exists' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { address_line1, address_line2, city, state, postal_code, country, phone } = address;

    const result = await pool.query(
      `INSERT INTO users
         (email, username, password_hash, address_line1, address_line2, city, state, postal_code, country, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email, username, address_line1, address_line2, city, state, postal_code, country, phone, created_at`,
      [email, username, passwordHash, address_line1, address_line2, city, state, postal_code, country, phone]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { user, token };
  },

  // Login user
  login: async (email, password) => {
    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    delete user.password_hash;

    return { user, token };
  },

  // Get user by ID
  getUserById: async (userId) => {
    const result = await pool.query(
      'SELECT id, username, email, avatar_url, rating, is_verified, is_verified_seller, has_payment_method, is_admin, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw { status: 404, message: 'User not found' };
    }

    return result.rows[0];
  }
};

module.exports = authService;
