const pool = require('../db/pool');

// In-memory rate limit store (per user per artwork, 5 seconds).
// Suitable for single-server intranet deployment.
const bidRateLimit = new Map();

async function placeBid({ artworkId, bidAmount, userId, email, ipAddress, userAgent }) {
  if (!artworkId || !bidAmount) {
    const err = new Error('artwork_id and bid_amount are required');
    err.status = 400;
    throw err;
  }

  const rateLimitKey = `${userId}:${artworkId}`;
  const lastBidAt = bidRateLimit.get(rateLimitKey);
  if (lastBidAt && Date.now() - lastBidAt < 5000) {
    const err = new Error('Please wait 5 seconds between bids on the same artwork');
    err.status = 429;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT is_banned, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows[0]?.is_banned) {
      const err = new Error('Your account has been suspended');
      err.status = 403;
      throw err;
    }

    const configResult = await client.query('SELECT * FROM auction_config ORDER BY id DESC LIMIT 1');
    if (configResult.rows.length === 0) {
      const err = new Error('Auction has not been configured yet');
      err.status = 400;
      throw err;
    }

    const config = configResult.rows[0];
    const now = new Date();
    if (config.is_paused) {
      const err = new Error('Auction is currently paused');
      err.status = 400;
      throw err;
    }
    if (now < new Date(config.auction_start)) {
      const err = new Error('Auction has not started yet');
      err.status = 400;
      throw err;
    }
    if (now > new Date(config.auction_end)) {
      const err = new Error('Auction has ended');
      err.status = 400;
      throw err;
    }

    const artworkResult = await client.query('SELECT * FROM artworks WHERE id = $1 AND deleted_at IS NULL', [artworkId]);
    if (artworkResult.rows.length === 0) {
      const err = new Error('Artwork not found');
      err.status = 404;
      throw err;
    }

    const artwork = artworkResult.rows[0];
    if (artwork.status !== 'approved_auction') {
      const err = new Error('This artwork is not available for bidding');
      err.status = 400;
      throw err;
    }

    const stateResult = await client.query('SELECT * FROM auction_state WHERE artwork_id = $1', [artworkId]);
    const currentState = stateResult.rows[0];
    const minBid = currentState
      ? parseFloat(currentState.current_highest_bid) + parseFloat(config.min_bid_increment)
      : parseFloat(artwork.base_price);

    if (parseFloat(bidAmount) < minBid) {
      const err = new Error(`Minimum bid is ₹${minBid}`);
      err.status = 400;
      err.minBid = minBid;
      throw err;
    }

    const timeUntilEnd = new Date(config.auction_end) - now;
    if (timeUntilEnd > 0 && timeUntilEnd < 5 * 60 * 1000) {
      const newEnd = new Date(new Date(config.auction_end).getTime() + 5 * 60 * 1000);
      await client.query('UPDATE auction_config SET auction_end = $1, updated_at = NOW() WHERE id = $2', [newEnd, config.id]);
      if (global.io) {
        global.io.emit('auction:config', { newEndTime: newEnd, newMinIncrement: config.min_bid_increment });
      }
    }

    const bidResult = await client.query(
      'INSERT INTO bids (artwork_id, bidder_id, bid_amount, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [artworkId, userId, bidAmount, ipAddress, userAgent || '']
    );

    await client.query('COMMIT');
    bidRateLimit.set(rateLimitKey, Date.now());

    const bid = bidResult.rows[0];

    if (global.io) {
      const payload = {
        artworkId,
        newAmount: bid.bid_amount,
        bidderId: userId,
        bidderName: userResult.rows[0]?.username || `User #${userId}`,
        totalBids: currentState ? currentState.total_bids + 1 : 1,
        timestamp: bid.bid_time,
      };

      // Artwork detail page subscriptions
      global.io.to(`artwork:${artworkId}`).emit('bid:new', payload);
      // Global listeners (gallery, admin, profile)
      global.io.emit('bid:new', payload);

      if (currentState?.current_winner_id && currentState.current_winner_id !== userId) {
        global.io.to(`user:${currentState.current_winner_id}`).emit('bid:youOutbid', {
          artworkId,
          artworkTitle: artwork.title,
        });
      }
    }

    return { bid, artworkTitle: artwork.title };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const dupErr = new Error('Duplicate bid amount not allowed');
      dupErr.status = 409;
      throw dupErr;
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { placeBid };