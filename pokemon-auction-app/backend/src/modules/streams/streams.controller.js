const pool = require('../../config/database');
const livekitService = require('../../services/livekitService');
const { getIO } = require('../../websocket/socketHandler');

// ============================================================
// STREAMS CONTROLLER — LiveKit Version
// ============================================================

const streamsController = {

  // ── GET ACTIVE STREAMS ──────────────────────────────────
  // "Active" = currently broadcasting. Scheduled streams have their own
  // endpoint (GET /upcoming) — including them here mislabels them as live
  // on the home page and in the navbar's "rejoin" check.
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
  // Same endpoint handles both "end a live stream" and "cancel a scheduled stream":
  //   live      → ended
  //   scheduled → cancelled
  // Anything else (already ended/cancelled or not owned by this user) → 404.
  endStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;

      const result = await pool.query(
        `UPDATE streams
         SET status = CASE status
                        WHEN 'live'      THEN 'ended'
                        WHEN 'scheduled' THEN 'cancelled'
                      END,
             ended_at = NOW()
         WHERE id = $1
           AND host_id = $2
           AND status IN ('live', 'scheduled')
         RETURNING *`,
        [streamId, hostId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or already ended',
        });
      }

      const stream = result.rows[0];
      res.json({
        message: stream.status === 'cancelled'
          ? 'Stream cancelled'
          : 'Stream ended successfully',
        stream,
      });
    } catch (error) {
      next(error);
    }
  },

  // ── SCHEDULE STREAM ──────────────────────────────────────
  // POST /api/streams/schedule
  scheduleStream: async (req, res, next) => {
    try {
      const { title, description, scheduled_start_time } = req.body;
      const hostId = req.user.id;

      if (!title) {
        return res.status(400).json({ message: 'Stream title is required' });
      }
      if (!scheduled_start_time) {
        return res.status(400).json({ message: 'Scheduled start time is required' });
      }

      const startTime = new Date(scheduled_start_time);
      if (startTime <= new Date()) {
        return res.status(400).json({ message: 'Scheduled time must be in the future' });
      }

      // Verify seller
      const { rows: userRows } = await pool.query(
        'SELECT is_verified_seller FROM users WHERE id = $1',
        [hostId]
      );
      if (!userRows[0]?.is_verified_seller) {
        return res.status(403).json({ message: 'Only verified sellers can schedule streams' });
      }

      const channelName = `stream_${hostId}_${Date.now()}`;

      const { rows } = await pool.query(
        `INSERT INTO streams (host_id, title, description, channel_name, status, scheduled_start_time)
         VALUES ($1, $2, $3, $4, 'scheduled', $5)
         RETURNING *`,
        [hostId, title, description || '', channelName, startTime]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  },

  // ── GET UPCOMING STREAMS ───────────────────────────────
  // GET /api/streams/upcoming
  getUpcomingStreams: async (req, res, next) => {
    try {
      const { rows: streams } = await pool.query(
        `SELECT s.*, u.username AS host_name, u.avatar_url AS host_avatar,
                (SELECT COUNT(*) FROM stream_notifications sn WHERE sn.stream_id = s.id) AS subscriber_count
         FROM streams s
         JOIN users u ON s.host_id = u.id
         WHERE s.status = 'scheduled' AND s.scheduled_start_time > NOW()
         ORDER BY s.scheduled_start_time ASC`
      );

      // Fetch preview cards for each stream (first 4 queued cards)
      for (const stream of streams) {
        const { rows: cards } = await pool.query(
          `SELECT id, name, card_image_front, image_url, psa_grade, starting_bid
           FROM cards
           WHERE stream_id = $1 AND queued_for_stream = true
           ORDER BY queue_order ASC NULLS LAST, queued_at ASC
           LIMIT 4`,
          [stream.id]
        );
        stream.preview_cards = cards;
      }

      res.json(streams);
    } catch (error) {
      next(error);
    }
  },

  // ── GET STREAM QUEUE (public, read-only) ───────────────
  // GET /api/streams/:id/queue
  getStreamQueue: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const { rows } = await pool.query(
        `SELECT id, name, card_image_front, card_image_back, image_url,
                psa_grade, starting_bid, buyout_price, auction_status,
                queue_order, queued_at
         FROM cards
         WHERE stream_id = $1 AND queued_for_stream = true
           AND auction_status NOT IN ('active', 'sold')
         ORDER BY queue_order ASC NULLS LAST, queued_at ASC
         LIMIT 20`,
        [streamId]
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },

  // ── GET MY STREAMS ─────────────────────────────────────
  // GET /api/streams/my-streams
  getMyStreams: async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*,
                (SELECT COUNT(*) FROM cards c WHERE c.stream_id = s.id AND c.queued_for_stream = true) AS queued_card_count
         FROM streams s
         WHERE s.host_id = $1
         ORDER BY s.created_at DESC`,
        [req.user.id]
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  },

  // ── GO LIVE ────────────────────────────────────────────
  // POST /api/streams/:id/go-live
  goLive: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;

      const { rows } = await pool.query(
        'SELECT * FROM streams WHERE id = $1 AND host_id = $2',
        [streamId, hostId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found or unauthorized' });
      }

      const stream = rows[0];
      if (stream.status !== 'scheduled') {
        return res.status(400).json({ message: 'Stream must be in scheduled status to go live' });
      }

      const roomName = stream.channel_name;
      const livekitConfig = await livekitService.generateHostToken(
        roomName,
        `host_${hostId}`,
        req.user.username
      );

      await pool.query(
        `UPDATE streams SET status = 'live', started_at = NOW() WHERE id = $1`,
        [streamId]
      );

      // Notify subscribers
      try {
        const { rows: subscribers } = await pool.query(
          `SELECT user_id FROM stream_notifications WHERE stream_id = $1 AND notified = false`,
          [streamId]
        );

        if (subscribers.length > 0) {
          const io = getIO();
          for (const sub of subscribers) {
            // Emit to user's personal room (socket joins user:{id} on connect)
            io.to(`user:${sub.user_id}`).emit('stream-going-live', {
              streamId: parseInt(streamId),
              title: stream.title,
              host_name: req.user.username,
            });
          }

          await pool.query(
            `UPDATE stream_notifications SET notified = true WHERE stream_id = $1`,
            [streamId]
          );
        }
      } catch (notifyErr) {
        console.error('Error sending notifications:', notifyErr);
        // Don't fail the go-live if notifications fail
      }

      res.json({
        message: 'Stream is now live',
        streamId: parseInt(streamId),
        livekit: livekitConfig,
      });
    } catch (error) {
      next(error);
    }
  },

  // ── NOTIFY ME ──────────────────────────────────────────
  // POST /api/streams/:id/notify-me
  toggleNotification: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const userId = req.user.id;

      // Check if already subscribed
      const { rows: existing } = await pool.query(
        'SELECT id FROM stream_notifications WHERE user_id = $1 AND stream_id = $2',
        [userId, streamId]
      );

      if (existing.length > 0) {
        // Unsubscribe
        await pool.query(
          'DELETE FROM stream_notifications WHERE user_id = $1 AND stream_id = $2',
          [userId, streamId]
        );
        return res.json({ subscribed: false });
      }

      // Subscribe
      await pool.query(
        'INSERT INTO stream_notifications (user_id, stream_id) VALUES ($1, $2)',
        [userId, streamId]
      );
      res.json({ subscribed: true });
    } catch (error) {
      next(error);
    }
  },

  // ── CHECK NOTIFICATION STATUS ──────────────────────────
  // GET /api/streams/:id/notify-status
  getNotificationStatus: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const userId = req.user.id;

      const { rows } = await pool.query(
        'SELECT id FROM stream_notifications WHERE user_id = $1 AND stream_id = $2',
        [userId, streamId]
      );

      res.json({ subscribed: rows.length > 0 });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = streamsController;
