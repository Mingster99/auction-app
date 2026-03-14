const pool = require('../../config/database');
const livekitService = require('../../services/livekitService');

// ============================================================
// STREAMS CONTROLLER — LiveKit Version
// ============================================================

const streamsController = {

  // ── GET ACTIVE STREAMS ──────────────────────────────────
  getActiveStreams: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT s.*, u.username as host_name
         FROM streams s
         JOIN users u ON s.host_id = u.id
         WHERE s.status IN ('live', 'scheduled')
         ORDER BY s.started_at DESC`
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  },

  // ── GET STREAM BY ID ───────────────────────────────────
  getStreamById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT s.*, u.username as host_name
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

  // ── CREATE STREAM ──────────────────────────────────────
  createStream: async (req, res, next) => {
    try {
      const { title, description } = req.body;
      const hostId = req.user.id;

      if (!title) {
        return res.status(400).json({ message: 'Stream title is required' });
      }

      // Check for existing active stream
      const existing = await pool.query(
        `SELECT id FROM streams
         WHERE host_id = $1 AND status IN ('scheduled', 'live')`,
        [hostId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          message: 'You already have an active stream',
          streamId: existing.rows[0].id,
        });
      }

      // Generate a unique room name for LiveKit
      const channelName = `stream_${hostId}_${Date.now()}`;

      const result = await pool.query(
        `INSERT INTO streams (host_id, title, description, channel_name, status)
         VALUES ($1, $2, $3, $4, 'scheduled')
         RETURNING *`,
        [hostId, title, description || '', channelName]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  // ── START STREAM (get HOST token) ──────────────────────
  // POST /api/streams/:id/start
  // IDEMPOTENT — calling again returns a fresh token
  startStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;

      console.log('🎥 Starting stream:', streamId, 'for user:', hostId);

      // Verify stream exists and belongs to user
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1 AND host_id = $2',
        [streamId, hostId]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or unauthorized',
        });
      }

      const stream = streamResult.rows[0];
      const roomName = stream.channel_name || `stream_${streamId}_${Date.now()}`;

      // Generate LiveKit HOST token
      const livekitConfig = await livekitService.generateHostToken(
        roomName,
        `host_${hostId}`,
        req.user.username
      );

      console.log('🔑 Generated LiveKit host token:', {
        wsUrl: livekitConfig.wsUrl,
        room: livekitConfig.roomName,
        identity: livekitConfig.identity,
      });

      // Update DB — only flip to 'live' if not already
      if (stream.status !== 'live') {
        await pool.query(
          `UPDATE streams
           SET status = 'live',
               started_at = NOW(),
               channel_name = $1
           WHERE id = $2`,
          [roomName, streamId]
        );
      }

      res.json({
        message: 'Stream started successfully',
        streamId: parseInt(streamId),
        livekit: livekitConfig,
      });

      console.log('✅ Stream started successfully');
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      next(error);
    }
  },

  // ── JOIN STREAM (get VIEWER token) ─────────────────────
  // POST /api/streams/:id/join
  joinStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const viewerId = req.user.id;

      console.log('👁️  Viewer joining stream:', streamId, 'user:', viewerId);

      const streamResult = await pool.query(
        `SELECT channel_name, host_id, title
         FROM streams
         WHERE id = $1 AND status = 'live'`,
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or not live',
        });
      }

      const { channel_name, host_id } = streamResult.rows[0];

      if (host_id === viewerId) {
        return res.status(400).json({
          message: 'Host cannot join as viewer',
        });
      }

      const livekitConfig = await livekitService.generateViewerToken(
        channel_name,
        `viewer_${viewerId}`,
        req.user.username
      );

      console.log('🔑 Generated LiveKit viewer token');

      // Increment viewer count
      await pool.query(
        'UPDATE streams SET viewer_count = viewer_count + 1 WHERE id = $1',
        [streamId]
      );

      res.json({
        message: 'Joined stream successfully',
        streamId: parseInt(streamId),
        livekit: livekitConfig,
      });

      console.log('✅ Viewer joined successfully');
    } catch (error) {
      console.error('❌ Error joining stream:', error);
      next(error);
    }
  },

  // ── END STREAM ─────────────────────────────────────────
  endStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;

      const result = await pool.query(
        `UPDATE streams
         SET status = 'ended',
             ended_at = NOW()
         WHERE id = $1 AND host_id = $2 AND status = 'live'
         RETURNING *`,
        [streamId, hostId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or already ended',
        });
      }

      res.json({
        message: 'Stream ended successfully',
        stream: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = streamsController;
