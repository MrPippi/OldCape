-- Guestbook. ip_hash = SHA-256(IP_SALT + client IP), first 32 hex; the raw IP is never stored.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX messages_visible ON messages (hidden, id DESC);
CREATE INDEX messages_source_time ON messages (ip_hash, created_at);

-- One row per (message, reporter): a visitor's repeated reports count once.
CREATE TABLE reports (
  message_id INTEGER NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, ip_hash)
);
