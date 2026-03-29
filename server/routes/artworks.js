const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const adminGuard = require('../middleware/adminGuard');
const router = express.Router();

// GET /api/artworks
router.get('/', async (req, res) => {
  const { status, item_type, sort, search, limit } = req.query;
  try {
    let whereClause = 'WHERE a.deleted_at IS NULL AND a.is_active = TRUE';
    const params = [];
    let paramIdx = 1;

    if (status) {
      whereClause += ` AND a.status = $${paramIdx++}`;
      params.push(status);
    } else {
      whereClause += ` AND a.status != 'pending' AND a.status != 'rejected'`;
    }

    if (item_type) { whereClause += ` AND a.item_type = $${paramIdx++}`; params.push(item_type); }
    if (search) { whereClause += ` AND (a.title ILIKE $${paramIdx} OR a.artist_name ILIKE $${paramIdx++})`; params.push(`%${search}%`); }

    let orderClause = 'ORDER BY a.created_at DESC';
    if (sort === 'highest_bid') orderClause = 'ORDER BY COALESCE(ast.current_highest_bid, 0) DESC';
    else if (sort === 'most_bids') orderClause = 'ORDER BY COALESCE(ast.total_bids, 0) DESC';
    else if (sort === 'base_price') orderClause = 'ORDER BY a.base_price ASC';

    let limitClause = '';
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      const safeLimit = Math.min(parsedLimit, 100);
      limitClause = `LIMIT $${paramIdx++}`;
      params.push(safeLimit);
    }

    const query = `
      SELECT a.id, a.title, a.artist_name, a.item_type, a.auction_or_exhibit, a.status,
             a.base_price, a.medium, a.dimensions, a.is_framed, a.description,
             ast.current_highest_bid, ast.total_bids, ast.last_bid_at,
            (SELECT CASE
             WHEN ai.image_path ~ '^https?://' AND ai.image_data IS NULL THEN ai.image_path
             ELSE '/api/upload/images/' || ai.id || '/content'
          END
        FROM artwork_images ai
        WHERE ai.artwork_id = a.id AND ai.is_primary = TRUE
        LIMIT 1) AS primary_image,
            (SELECT CASE
             WHEN ai.image_path ~ '^https?://' AND ai.image_data IS NULL THEN ai.image_path
             ELSE '/api/upload/images/' || ai.id || '/content'
          END
        FROM artwork_images ai
        WHERE ai.artwork_id = a.id
        ORDER BY ai.display_order
        LIMIT 1) AS fallback_image
      FROM artworks a
      LEFT JOIN auction_state ast ON ast.artwork_id = a.id
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching artworks:', err);
    res.status(500).json({ error: 'Failed to fetch artworks' });
  }
});

// GET /api/artworks/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const artworkResult = await pool.query(`
      SELECT a.*, ast.current_highest_bid, ast.current_winner_id, ast.total_bids, ast.last_bid_at
      FROM artworks a
      LEFT JOIN auction_state ast ON ast.artwork_id = a.id
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `, [id]);

    if (artworkResult.rows.length === 0) return res.status(404).json({ error: 'Artwork not found' });

    const imagesResult = await pool.query(
      `SELECT id,
              CASE
                WHEN image_path ~ '^https?://' AND image_data IS NULL THEN image_path
                ELSE '/api/upload/images/' || id || '/content'
              END AS image_path,
              is_primary,
              display_order
       FROM artwork_images
       WHERE artwork_id = $1
       ORDER BY display_order`,
      [id]
    );

    const artwork = artworkResult.rows[0];
    artwork.images = imagesResult.rows;

    res.json(artwork);
  } catch (err) {
    console.error('Error fetching artwork:', err);
    res.status(500).json({ error: 'Failed to fetch artwork' });
  }
});

// POST /api/artworks (admin only)
router.post('/', authMiddleware, adminGuard, async (req, res) => {
  const { artist_name, title, description, base_price, stall_price, item_type, auction_or_exhibit, medium, surface_used, is_framed, dimensions, artist_email, artist_roll, artist_contact, status } = req.body;
  try {
    let price = base_price;
    if (typeof price === 'string') {
      price = price.replace(/[^0-9.]/g, '');
    }
    let sPrice = stall_price;
    if (typeof sPrice === 'string') {
      sPrice = sPrice.replace(/[^0-9.]/g, '');
    }
    
    const result = await pool.query(`
      INSERT INTO artworks (artist_name, title, description, base_price, stall_price, item_type, auction_or_exhibit, medium, surface_used, is_framed, dimensions, artist_email, artist_roll, artist_contact, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [artist_name, title, description, price || null, sPrice || null, item_type, auction_or_exhibit, medium, surface_used, is_framed, dimensions, artist_email, artist_roll, artist_contact, status || 'pending']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating artwork:', err);
    res.status(500).json({ error: 'Failed to create artwork' });
  }
});

// PATCH /api/artworks/:id (admin only)
router.patch('/:id', authMiddleware, adminGuard, async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const allowed = ['title', 'description', 'base_price', 'stall_price', 'stall_items', 'status', 'item_type', 'auction_or_exhibit', 'medium', 'surface_used', 'is_framed', 'dimensions', 'artist_name', 'artist_email', 'artist_roll', 'artist_contact', 'is_active'];
  const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const setClause = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = updates.map(([k, v]) => {
    if ((k === 'base_price' || k === 'stall_price') && typeof v === 'string') {
      const sanitized = v.replace(/[^0-9.]/g, '');
      return sanitized === '' ? null : sanitized;
    }
    return v;
  });

  try {
    const result = await pool.query(
      `UPDATE artworks SET ${setClause} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, ...values]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Artwork not found' });

    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, 'artwork_update', 'artwork', id, JSON.stringify(fields)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating artwork:', err);
    res.status(500).json({ error: 'Failed to update artwork' });
  }
});

// DELETE /api/artworks/:id (soft delete, admin only)
router.delete('/:id', authMiddleware, adminGuard, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('UPDATE artworks SET deleted_at = NOW() WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Artwork not found' });
    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id) VALUES ($1, $2, $3, $4)',
      [req.user.userId, 'artwork_delete', 'artwork', id]
    );
    res.json({ message: 'Artwork deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete artwork' });
  }
});

// GET /api/artworks/:id/bids
router.get('/:id/bids', async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.cookies?.token
    ? (() => {
        try {
          const jwt = require('jsonwebtoken');
          const d = jwt.verify(req.cookies.token, process.env.JWT_SECRET || 'chitrakavyam_secret');
          return d.isAdmin;
        } catch {
          return false;
        }
      })()
    : false;

  try {
    const limit = isAdmin ? 1000 : 3;
    const result = await pool.query(`
      SELECT b.bid_amount, b.bid_time, b.is_voided,
            u.id AS bidder_id,
            u.username AS bidder_username
      FROM bids b
      JOIN users u ON u.id = b.bidder_id
      WHERE b.artwork_id = $1 AND b.is_voided = FALSE
      ORDER BY b.bid_amount DESC
      LIMIT $2
    `, [id, limit]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

module.exports = router;
