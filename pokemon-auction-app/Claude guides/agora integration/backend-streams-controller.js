const pool = require('../../config/database');
const agoraService = require('../../services/agoraService');

const streamsController = {
  // Get all active streams
  getActiveStreams: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT s.*, u.username as host_name 
         FROM streams s 
         JOIN users u ON s.host_id = u.id 
         WHERE s.status = 'live' 
         ORDER BY s.started_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  },

  // Get stream by ID
  getStreamById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT s.*, u.username as host_name, u.avatar_url as host_avatar
         FROM streams s
         JOIN users u ON s.host_id = u.id
         WHERE s.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  // Create new stream
  createStream: async (req, res, next) => {
    try {
      const { title, description } = req.body;
      const hostId = req.user.id;

      // Validate
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }

      // Check if user already has an active stream
      const existingStream = await pool.query(
        'SELECT id FROM streams WHERE host_id = $1 AND status IN ($2, $3)',
        [hostId, 'scheduled', 'live']
      );

      if (existingStream.rows.length > 0) {
        return res.status(400).json({ 
          message: 'You already have an active stream. Please end it first.' 
        });
      }

      // Generate unique channel name
      const channelName = `stream_${hostId}_${Date.now()}`;

      // Create stream in database
      const result = await pool.query(
        `INSERT INTO streams (host_id, title, description, channel_name, status) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [hostId, title, description || '', channelName, 'scheduled']
      );

      const stream = result.rows[0];

      res.status(201).json(stream);
    } catch (error) {
      next(error);
    }
  },

  // Start stream (go live)
  startStream: async (req, res, next) => {
    try {
      const { id } = req.params;
      const hostId = req.user.id;

      // Get stream
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1',
        [id]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found' });
      }

      const stream = streamResult.rows[0];

      // Verify ownership
      if (stream.host_id !== hostId) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Check stream is not already live
      if (stream.status === 'live') {
        return res.status(400).json({ message: 'Stream is already live' });
      }

      // Generate Agora token for host
      const agoraConfig = agoraService.generateHostToken(
        stream.channel_name,
        hostId
      );

      // Update stream status
      await pool.query(
        `UPDATE streams 
         SET status = 'live', started_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [id]
      );

      res.json({
        message: 'Stream started',
        streamId: id,
        channelName: stream.channel_name,
        agora: agoraConfig
      });
    } catch (error) {
      next(error);
    }
  },

  // Join stream as viewer (get Agora token)
  joinStream: async (req, res, next) => {
    try {
      const { id } = req.params;
      const viewerId = req.user.id;

      // Get stream
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1',
        [id]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found' });
      }

      const stream = streamResult.rows[0];

      // Check stream is live
      if (stream.status !== 'live') {
        return res.status(400).json({ message: 'Stream is not live' });
      }

      // Generate Agora token for viewer
      const agoraConfig = agoraService.generateViewerToken(
        stream.channel_name,
        viewerId
      );

      // Increment viewer count
      await pool.query(
        'UPDATE streams SET viewer_count = viewer_count + 1 WHERE id = $1',
        [id]
      );

      res.json({
        message: 'Joined stream',
        streamId: id,
        channelName: stream.channel_name,
        agora: agoraConfig
      });
    } catch (error) {
      next(error);
    }
  },

  // End stream
  endStream: async (req, res, next) => {
    try {
      const { id } = req.params;
      const hostId = req.user.id;

      // Get stream
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1',
        [id]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found' });
      }

      const stream = streamResult.rows[0];

      // Verify ownership
      if (stream.host_id !== hostId) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Update stream status
      await pool.query(
        `UPDATE streams 
         SET status = 'ended', ended_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [id]
      );

      res.json({ message: 'Stream ended' });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = streamsController;
