-- users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL CHECK (email LIKE '%@iiserkol.ac.in'),
  username VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL,
  roll_number VARCHAR(20),
  contact_number VARCHAR(15),
  is_admin BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  lockout_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- artworks table
CREATE TABLE IF NOT EXISTS artworks (
  id SERIAL PRIMARY KEY,
  submission_timestamp TIMESTAMP,
  artist_name VARCHAR(200) NOT NULL,
  artist_email VARCHAR(100),
  artist_roll VARCHAR(20),
  artist_contact VARCHAR(15),
  item_type VARCHAR(50),
  auction_or_exhibit VARCHAR(30),
  surface_used VARCHAR(100),
  medium VARCHAR(100),
  is_framed BOOLEAN,
  dimensions VARCHAR(80),
  base_price NUMERIC(10,2),
  stall_items TEXT,
  stall_price NUMERIC(10,2),
  status VARCHAR(30) DEFAULT 'pending',
  title VARCHAR(200),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- artwork_images table
CREATE TABLE IF NOT EXISTS artwork_images (
  id SERIAL PRIMARY KEY,
  artwork_id INTEGER REFERENCES artworks(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- auction_config table
CREATE TABLE IF NOT EXISTS auction_config (
  id SERIAL PRIMARY KEY,
  auction_start TIMESTAMP NOT NULL,
  auction_end TIMESTAMP NOT NULL,
  min_bid_increment NUMERIC(10,2) DEFAULT 50.00,
  is_paused BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- bids table
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  artwork_id INTEGER REFERENCES artworks(id) ON DELETE CASCADE,
  bidder_id INTEGER REFERENCES users(id),
  bid_amount NUMERIC(10,2) NOT NULL,
  bid_time TIMESTAMP DEFAULT NOW(),
  is_winning BOOLEAN DEFAULT FALSE,
  is_voided BOOLEAN DEFAULT FALSE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  CONSTRAINT bid_positive CHECK (bid_amount > 0),
  CONSTRAINT unique_bid UNIQUE(bidder_id, artwork_id, bid_amount)
);

-- auction_state table
CREATE TABLE IF NOT EXISTS auction_state (
  artwork_id INTEGER PRIMARY KEY REFERENCES artworks(id),
  current_highest_bid NUMERIC(10,2),
  current_winner_id INTEGER REFERENCES users(id),
  total_bids INTEGER DEFAULT 0,
  last_bid_at TIMESTAMP
);

-- watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  artwork_id INTEGER REFERENCES artworks(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, artwork_id)
);

-- admin_audit_log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bids_artwork ON bids(artwork_id, bid_amount DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_id);

-- Trigger function for auction_state
CREATE OR REPLACE FUNCTION update_auction_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_voided = FALSE THEN
    INSERT INTO auction_state (artwork_id, current_highest_bid, current_winner_id, total_bids, last_bid_at)
    VALUES (NEW.artwork_id, NEW.bid_amount, NEW.bidder_id, 1, NEW.bid_time)
    ON CONFLICT (artwork_id) DO UPDATE
      SET current_highest_bid = GREATEST(auction_state.current_highest_bid, EXCLUDED.current_highest_bid),
          current_winner_id = CASE
            WHEN EXCLUDED.current_highest_bid > auction_state.current_highest_bid THEN EXCLUDED.current_winner_id
            ELSE auction_state.current_winner_id
          END,
          total_bids = auction_state.total_bids + 1,
          last_bid_at = EXCLUDED.last_bid_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_auction_state
AFTER INSERT ON bids
FOR EACH ROW EXECUTE FUNCTION update_auction_state();

-- Function to recalculate auction_state after bid void
CREATE OR REPLACE FUNCTION recalculate_auction_state(p_artwork_id INTEGER)
RETURNS VOID AS $$
DECLARE
  top_bid RECORD;
  bid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bid_count FROM bids WHERE artwork_id = p_artwork_id AND is_voided = FALSE;
  
  SELECT b.bid_amount, b.bidder_id, b.bid_time INTO top_bid
  FROM bids b
  WHERE b.artwork_id = p_artwork_id AND b.is_voided = FALSE
  ORDER BY b.bid_amount DESC
  LIMIT 1;
  
  IF bid_count = 0 THEN
    DELETE FROM auction_state WHERE artwork_id = p_artwork_id;
  ELSE
    INSERT INTO auction_state (artwork_id, current_highest_bid, current_winner_id, total_bids, last_bid_at)
    VALUES (p_artwork_id, top_bid.bid_amount, top_bid.bidder_id, bid_count, top_bid.bid_time)
    ON CONFLICT (artwork_id) DO UPDATE
      SET current_highest_bid = EXCLUDED.current_highest_bid,
          current_winner_id = EXCLUDED.current_winner_id,
          total_bids = EXCLUDED.total_bids,
          last_bid_at = EXCLUDED.last_bid_at;
  END IF;
END;
$$ LANGUAGE plpgsql;
