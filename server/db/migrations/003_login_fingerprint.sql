CREATE TABLE IF NOT EXISTS login_fingerprints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(100),
  ip_address VARCHAR(64),
  forwarded_for TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  login_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_fingerprints_user_time
  ON login_fingerprints(user_id, login_at DESC);
