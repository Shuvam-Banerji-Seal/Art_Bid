const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const { placeBid } = require('../utils/placeBid');
const router = express.Router();

// POST /api/bids
router.post('/', authMiddleware, async (req, res) => {
  const { artwork_id, bid_amount } = req.body;
  const { userId, email } = req.user;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  try {
    const { bid } = await placeBid({
      artworkId: Number(artwork_id),
      bidAmount: Number(bid_amount),
      userId,
      email,
      ipAddress: ip,
      userAgent,
    });

    res.status(201).json({ message: 'Bid placed successfully', bid });
  } catch (err) {
    console.error('Bid error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to place bid',
      ...(err.minBid ? { minBid: err.minBid } : {}),
    });
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
