const { placeBid } = require('../utils/placeBid');
const pool = require('../db/pool');

module.exports = function setupSocketHandlers(io) {
  let lastAuctionStatus = null;

  const monitorAuctionState = async () => {
    try {
      const configResult = await pool.query('SELECT * FROM auction_config ORDER BY id DESC LIMIT 1');
      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];
      const now = new Date();
      let status = 'upcoming';
      if (config.is_paused) status = 'paused';
      else if (now > new Date(config.auction_end)) status = 'ended';
      else if (now >= new Date(config.auction_start)) status = 'live';

      if (lastAuctionStatus !== status) {
        if (status === 'live') {
          io.emit('auction:start', { startsAt: config.auction_start });
        }

        if (status === 'ended') {
          const winnersResult = await pool.query(`
            SELECT a.id AS artwork_id, ast.current_winner_id AS winner_id, ast.current_highest_bid AS amount
            FROM auction_state ast
            JOIN artworks a ON a.id = ast.artwork_id
            WHERE a.status = 'approved_auction' AND a.deleted_at IS NULL
          `);
          io.emit('auction:end', {
            endedAt: config.auction_end,
            winners: winnersResult.rows,
          });
        }
      }

      lastAuctionStatus = status;
    } catch (err) {
      console.error('Auction monitor error:', err);
    }
  };

  monitorAuctionState();
  setInterval(monitorAuctionState, 15000);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
      ?.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];

    if (!token) {
      return next(new Error('Authentication required for WebSocket connection'));
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chitrakavyam_secret');
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      socket.isAdmin = decoded.isAdmin;
    } catch (err) {
      return next(new Error('Invalid WebSocket token'));
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.userId || 'anonymous'}`);

    socket.join(`user:${socket.userId}`);

    socket.on('subscribe:artwork', ({ artworkId }) => {
      socket.join(`artwork:${artworkId}`);
    });

    socket.on('unsubscribe:artwork', ({ artworkId }) => {
      socket.leave(`artwork:${artworkId}`);
    });

    socket.on('bid:place', async ({ artworkId, amount }, ack) => {
      try {
        const result = await placeBid({
          artworkId: Number(artworkId),
          bidAmount: Number(amount),
          userId: socket.userId,
          email: socket.userEmail,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'] || '',
        });

        if (typeof ack === 'function') {
          ack({ ok: true, bid: result.bid });
        }
      } catch (err) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: err.message, status: err.status || 500, ...(err.minBid ? { minBid: err.minBid } : {}) });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
