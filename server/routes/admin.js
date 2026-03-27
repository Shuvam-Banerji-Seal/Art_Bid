const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const adminGuard = require('../middleware/adminGuard');
const router = express.Router();

router.use(authMiddleware, adminGuard);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [artworks, bidsToday, users, highestBid, config] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM artworks WHERE deleted_at IS NULL'),
      pool.query("SELECT COUNT(*) FROM bids WHERE bid_time > NOW() - INTERVAL '24 hours' AND is_voided = FALSE"),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT MAX(bid_amount) FROM bids WHERE is_voided = FALSE'),
      pool.query('SELECT * FROM auction_config ORDER BY id DESC LIMIT 1'),
    ]);

    const now = new Date();
    let auctionStatus = 'not_configured';
    if (config.rows.length > 0) {
      const c = config.rows[0];
      if (c.is_paused) auctionStatus = 'paused';
      else if (now < new Date(c.auction_start)) auctionStatus = 'upcoming';
      else if (now > new Date(c.auction_end)) auctionStatus = 'ended';
      else auctionStatus = 'live';
    }

    res.json({
      totalArtworks: parseInt(artworks.rows[0].count),
      bidsToday: parseInt(bidsToday.rows[0].count),
      totalUsers: parseInt(users.rows[0].count),
      highestBid: highestBid.rows[0].max || 0,
      auctionStatus,
      config: config.rows[0] || null,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/bids
router.get('/bids', async (req, res) => {
  const { page = 1, limit = 50, artwork_id } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (artwork_id) { where += ` AND b.artwork_id = $${params.length + 1}`; params.push(artwork_id); }

    const result = await pool.query(`
      SELECT b.id, b.artwork_id, b.bid_amount, b.bid_time, b.is_voided, b.ip_address,
             u.username, u.email, u.roll_number,
             a.title AS artwork_title
      FROM bids b
      JOIN users u ON u.id = b.bidder_id
      JOIN artworks a ON a.id = b.artwork_id
      ${where}
      ORDER BY b.bid_time DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const count = await pool.query(`SELECT COUNT(*) FROM bids b ${where}`, params);
    res.json({ bids: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// DELETE /api/admin/bids/:id (void bid)
router.delete('/bids/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bidResult = await client.query('UPDATE bids SET is_voided = TRUE WHERE id = $1 RETURNING artwork_id', [id]);
    if (bidResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bid not found' });
    }
    const { artwork_id } = bidResult.rows[0];
    await client.query('SELECT recalculate_auction_state($1)', [artwork_id]);
    await client.query('COMMIT');

    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id) VALUES ($1, $2, $3, $4)',
      [req.user.userId, 'bid_void', 'bid', id]
    );

    if (global.io) {
      const stateResult = await pool.query('SELECT * FROM auction_state WHERE artwork_id = $1', [artwork_id]);
      global.io.to(`artwork:${artwork_id}`).emit('bid:new', {
        artworkId: artwork_id,
        newAmount: stateResult.rows[0]?.current_highest_bid || 0,
        bidderName: null,
        bidderId: null,
        totalBids: stateResult.rows[0]?.total_bids || 0,
        timestamp: new Date(),
        voided: true,
      });
    }

    res.json({ message: 'Bid voided successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Void bid error:', err);
    res.status(500).json({ error: 'Failed to void bid' });
  } finally {
    client.release();
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.username, u.roll_number, u.contact_number, u.is_admin, u.is_banned, u.is_verified, u.created_at,
             COUNT(b.id) AS total_bids,
             COUNT(CASE WHEN ast.current_winner_id = u.id THEN 1 END) AS winning_bids
      FROM users u
      LEFT JOIN bids b ON b.bidder_id = u.id AND b.is_voided = FALSE
      LEFT JOIN auction_state ast ON ast.current_winner_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const count = await pool.query('SELECT COUNT(*) FROM users');
    res.json({ users: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/logins
router.get('/logins', async (req, res) => {
  const { page = 1, limit = 50, user_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (user_id) {
      where += ` AND lf.user_id = $${params.length + 1}`;
      params.push(Number(user_id));
    }

    const rows = await pool.query(
      `SELECT lf.id, lf.user_id, lf.email, lf.ip_address, lf.forwarded_for, lf.user_agent, lf.success, lf.login_at,
              u.username
       FROM login_fingerprints lf
       LEFT JOIN users u ON u.id = lf.user_id
       ${where}
       ORDER BY lf.login_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    const count = await pool.query(`SELECT COUNT(*) FROM login_fingerprints lf ${where}`, params);
    res.json({ logins: rows.rows, total: Number(count.rows[0].count) });
  } catch (err) {
    console.error('Error fetching login fingerprints:', err);
    res.status(500).json({ error: 'Failed to fetch login fingerprints' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { is_banned, is_admin } = req.body;
  const updates = [];
  const values = [];
  if (is_banned !== undefined) { updates.push(`is_banned = $${values.length + 2}`); values.push(is_banned); }
  if (is_admin !== undefined) { updates.push(`is_admin = $${values.length + 2}`); values.push(is_admin); }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields' });

  try {
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING id, email, username, is_admin, is_banned`,
      [id, ...values]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, 'user_update', 'user', id, JSON.stringify(req.body)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/config
router.get('/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM auction_config ORDER BY id DESC LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// POST /api/admin/config
router.post('/config', async (req, res) => {
  const { auction_start, auction_end, min_bid_increment, is_paused } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM auction_config ORDER BY id DESC LIMIT 1');
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        'UPDATE auction_config SET auction_start = COALESCE($1, auction_start), auction_end = COALESCE($2, auction_end), min_bid_increment = COALESCE($3, min_bid_increment), is_paused = COALESCE($4, is_paused), updated_at = NOW() WHERE id = $5 RETURNING *',
        [auction_start || null, auction_end || null, min_bid_increment || null, is_paused !== undefined ? is_paused : null, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        'INSERT INTO auction_config (auction_start, auction_end, min_bid_increment, is_paused) VALUES ($1, $2, $3, $4) RETURNING *',
        [auction_start, auction_end, min_bid_increment || 50, is_paused || false]
      );
    }

    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, 'config_update', 'auction_config', result.rows[0].id, JSON.stringify(req.body)]
    );

    if (global.io) {
      if (is_paused === true) global.io.emit('auction:pause', { reason: 'Admin paused the auction' });
      else if (is_paused === false) global.io.emit('auction:resume', {});
      global.io.emit('auction:config', { newEndTime: result.rows[0].auction_end, newMinIncrement: result.rows[0].min_bid_increment });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Config error:', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// GET /api/admin/artworks (all including pending)
router.get('/artworks', async (req, res) => {
  const { page = 1, limit = 50, status, item_type, min_price, max_price } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = 'WHERE a.deleted_at IS NULL';
    const params = [];
    if (status) { where += ` AND a.status = $${params.length + 1}`; params.push(status); }
    if (item_type) { where += ` AND a.item_type = $${params.length + 1}`; params.push(item_type); }
    if (min_price !== undefined && min_price !== '') { where += ` AND COALESCE(a.base_price, 0) >= $${params.length + 1}`; params.push(Number(min_price)); }
    if (max_price !== undefined && max_price !== '') { where += ` AND COALESCE(a.base_price, 0) <= $${params.length + 1}`; params.push(Number(max_price)); }

    const result = await pool.query(`
      SELECT a.*, ast.current_highest_bid, ast.total_bids,
             (SELECT image_path FROM artwork_images WHERE artwork_id = a.id AND is_primary = TRUE LIMIT 1) AS primary_image
      FROM artworks a
      LEFT JOIN auction_state ast ON ast.artwork_id = a.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    const count = await pool.query(`SELECT COUNT(*) FROM artworks a ${where}`, params);
    res.json({ artworks: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error('Error fetching admin artworks:', err);
    res.status(500).json({ error: 'Failed to fetch artworks' });
  }
});

// GET /api/admin/winners (export winning bids)
router.get('/winners', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id AS artwork_id, a.title, a.artist_name,
             ast.current_highest_bid AS final_price,
             u.username AS winner_name, u.email AS winner_email,
             u.roll_number AS winner_roll, u.contact_number AS winner_contact
      FROM auction_state ast
      JOIN artworks a ON a.id = ast.artwork_id
      JOIN users u ON u.id = ast.current_winner_id
      WHERE a.status = 'approved_auction' AND a.deleted_at IS NULL
      ORDER BY ast.current_highest_bid DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch winners' });
  }
});

// GET /api/admin/audit
router.get('/audit', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const result = await pool.query(`
      SELECT al.*, u.username AS admin_name, u.email AS admin_email
      FROM admin_audit_log al
      JOIN users u ON u.id = al.admin_id
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;
