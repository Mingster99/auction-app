-- Migration 015: Stream-scoped chat moderation (bans + silences)

CREATE TABLE IF NOT EXISTS stream_chat_bans (
  id          SERIAL PRIMARY KEY,
  stream_id   INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_chat_bans_lookup
  ON stream_chat_bans(stream_id, user_id);

CREATE TABLE IF NOT EXISTS stream_chat_silences (
  id          SERIAL PRIMARY KEY,
  stream_id   INTEGER NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  silenced_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  silenced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL,
  UNIQUE (stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_chat_silences_lookup
  ON stream_chat_silences(stream_id, user_id);

CREATE INDEX IF NOT EXISTS idx_stream_chat_silences_expiry
  ON stream_chat_silences(expires_at);
