const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// In-memory rate limit store (per user per artwork, 5 seconds)
const bidRateLimit = new Map();

// POST /api/bids
router.post('/', authMiddleware, async (req, res) => {
  const { artwork_id, bid_amount } = req.body;
  const { userId, email } = req.user;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  if (!artwork_id || !bid_amount) return res.status(400).json({ error: 'artwork_id and bid_amount are required' });

  // Rate limit: 1 bid per user per artwork per 5 seconds
  const rateLimitKey = `${userId}:${artwork_id}`;
  const lastBid = bidRateLimit.get(rateLimitKey);
  if (lastBid && Date.now() - lastBid < 5000) {
    return res.status(429).json({ error: 'Please wait 5 seconds between bids on the same artwork' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check user is not banned
    const userResult = await client.query('SELECT is_banned FROM users WHERE id = $1', [userId]);
    if (userResult.rows[0]?.is_banned) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Your account has been suspended' });
    }

    // 2. Check auction is open
    const configResult = await client.query('SELECT * FROM auction_config ORDER BY id DESC LIMIT 1');
    if (configResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Auction has not been configured yet' });
    }
    const config = configResult.rows[0];
    const now = new Date();
    if (config.is_paused) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Auction is currently paused' });
    }
    if (now < new Date(config.auction_start)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Auction has not started yet' });
    }
    if (now > new Date(config.auction_end)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Auction has ended' });
    }

    // 3. Check artwork is approved_auction and active
    const artworkResult = await client.query('SELECT * FROM artworks WHERE id = $1 AND deleted_at IS NULL', [artwork_id]);
    if (artworkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Artwork not found' });
    }
    const artwork = artworkResult.rows[0];
    if (artwork.status !== 'approved_auction') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This artwork is not available for bidding' });
    }

    // 4. Check bid amount
    const stateResult = await client.query('SELECT * FROM auction_state WHERE artwork_id = $1', [artwork_id]);
    const currentState = stateResult.rows[0];
    const minBid = currentState
      ? parseFloat(currentState.current_highest_bid) + parseFloat(config.min_bid_increment)
      : parseFloat(artwork.base_price);

    if (parseFloat(bid_amount) < minBid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Minimum bid is ₹${minBid}`, minBid });
    }

    // 5. Last-minute bid extension: if bid within 5 minutes of end, extend by 5 minutes
    const timeUntilEnd = new Date(config.auction_end) - now;
    if (timeUntilEnd > 0 && timeUntilEnd < 5 * 60 * 1000) {
      const newEnd = new Date(new Date(config.auction_end).getTime() + 5 * 60 * 1000);
      await client.query('UPDATE auction_config SET auction_end = $1, updated_at = NOW() WHERE id = $2', [newEnd, config.id]);
    }

    // 6. Insert bid
    const bidResult = await client.query(
      'INSERT INTO bids (artwork_id, bidder_id, bid_amount, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [artwork_id, userId, bid_amount, ip, userAgent]
    );

    await client.query('COMMIT');

    // Update rate limit
    bidRateLimit.set(rateLimitKey, Date.now());

    // Emit WebSocket event (handled in index.js via global io)
    const bid = bidResult.rows[0];
    if (global.io) {
      global.io.to(`artwork:${artwork_id}`).emit('bid:new', {
        artworkId: artwork_id,
        newAmount: bid.bid_amount,
        bidderMasked: `${email[0]}***`,
        totalBids: currentState ? currentState.total_bids + 1 : 1,
        timestamp: bid.bid_time,
      });

      // Notify outbid user
      if (currentState?.current_winner_id && currentState.current_winner_id !== userId) {
        global.io.to(`user:${currentState.current_winner_id}`).emit('bid:youOutbid', {
          artworkId: artwork_id,
          artworkTitle: artwork.title,
        });
      }
    }

    res.status(201).json({ message: 'Bid placed successfully', bid });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bid error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Duplicate bid amount not allowed' });
    res.status(500).json({ error: 'Failed to place bid' });
  } finally {
    client.release();
  }
});

// GET /api/bids/my
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (b.artwork_id)
        b.artwork_id, b.bid_amount, b.bid_time,
        a.title, a.artist_name,
        (SELECT image_path FROM artwork_images WHERE artwork_id = a.id AND is_primary = TRUE LIMIT 1) AS primary_image,
        ast.current_highest_bid,
        ast.current_winner_id = $1 AS is_winning
      FROM bids b
      JOIN artworks a ON a.id = b.artwork_id
      LEFT JOIN auction_state ast ON ast.artwork_id = b.artwork_id
      WHERE b.bidder_id = $1 AND b.is_voided = FALSE
      ORDER BY b.artwork_id, b.bid_amount DESC
    `, [req.user.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user bids:', err);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

module.exports = router;
