const express = require('express');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/watchlist
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.artwork_id, w.created_at,
             a.title, a.artist_name, a.base_price, a.status,
             ast.current_highest_bid, ast.total_bids,
              (SELECT CASE
               WHEN ai.image_path ~ '^https?://' AND ai.image_data IS NULL THEN ai.image_path
               ELSE '/api/upload/images/' || ai.id || '/content'
            END
          FROM artwork_images ai
          WHERE ai.artwork_id = a.id AND ai.is_primary = TRUE
          LIMIT 1) AS primary_image
      FROM watchlist w
      JOIN artworks a ON a.id = w.artwork_id
      LEFT JOIN auction_state ast ON ast.artwork_id = a.id
      WHERE w.user_id = $1 AND a.deleted_at IS NULL
      ORDER BY w.created_at DESC
    `, [req.user.userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Watchlist fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// POST /api/watchlist
router.post('/', async (req, res) => {
  const { artwork_id } = req.body;
  if (!artwork_id) return res.status(400).json({ error: 'artwork_id is required' });

  try {
    await pool.query(
      'INSERT INTO watchlist (user_id, artwork_id) VALUES ($1, $2) ON CONFLICT (user_id, artwork_id) DO NOTHING',
      [req.user.userId, artwork_id]
    );
    res.status(201).json({ message: 'Added to watchlist' });
  } catch (err) {
    console.error('Watchlist add error:', err);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// DELETE /api/watchlist/:artworkId
router.delete('/:artworkId', async (req, res) => {
  try {
    await pool.query('DELETE FROM watchlist WHERE user_id = $1 AND artwork_id = $2', [req.user.userId, req.params.artworkId]);
    res.json({ message: 'Removed from watchlist' });
  } catch (err) {
    console.error('Watchlist delete error:', err);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

module.exports = router;