const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/auction/config (public)
router.get('/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM auction_config ORDER BY id DESC LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Auction config fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch auction config' });
  }
});

module.exports = router;