const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const adminGuard = require('../middleware/adminGuard');
const router = express.Router();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /api/upload/images/:imageId/content
// Serves image bytes stored in PostgreSQL.
router.get('/images/:imageId/content', async (req, res) => {
  const { imageId } = req.params;
  try {
    const result = await pool.query(
      'SELECT image_data, mime_type, image_path FROM artwork_images WHERE id = $1',
      [imageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const row = result.rows[0];

    if (row.image_data) {
      res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(row.image_data);
    }

    // Backward compatibility for older URL-based records.
    if (row.image_path && /^https?:\/\//i.test(row.image_path)) {
      return res.redirect(row.image_path);
    }
    if (row.image_path && row.image_path.startsWith('/uploads/')) {
      return res.redirect(row.image_path);
    }

    return res.status(404).json({ error: 'Image data not available' });
  } catch (err) {
    console.error('Error serving image:', err);
    return res.status(500).json({ error: 'Failed to serve image' });
  }
});

// POST /api/upload/artwork/:id/images (admin only)
router.post('/artwork/:id/images', authMiddleware, adminGuard, upload.array('images', 30), async (req, res) => {
  const { id } = req.params;
  const { is_primary } = req.body;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const insertedImages = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const isPrimary = i === 0 && is_primary !== 'false';

      if (isPrimary) {
        await client.query('UPDATE artwork_images SET is_primary = FALSE WHERE artwork_id = $1', [id]);
      }

      const inserted = await client.query(
        `INSERT INTO artwork_images (artwork_id, image_path, image_data, mime_type, is_primary, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [id, '/api/upload/images/pending/content', file.buffer, file.mimetype || 'application/octet-stream', isPrimary, i]
      );

      const imageId = inserted.rows[0].id;
      const dbImagePath = `/api/upload/images/${imageId}/content`;

      const result = await client.query(
        'UPDATE artwork_images SET image_path = $1 WHERE id = $2 RETURNING id, artwork_id, image_path, is_primary, display_order, uploaded_at',
        [dbImagePath, imageId]
      );
      insertedImages.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(insertedImages);
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload images' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// DELETE /api/upload/images/:imageId (admin only)
router.delete('/images/:imageId', authMiddleware, adminGuard, async (req, res) => {
  const { imageId } = req.params;
  try {
    const result = await pool.query('DELETE FROM artwork_images WHERE id = $1 RETURNING *', [imageId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found' });
    // Note: actual file deletion from disk can be added here
    res.json({ message: 'Image deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// PATCH /api/upload/images/:imageId (set primary, update order)
router.patch('/images/:imageId', authMiddleware, adminGuard, async (req, res) => {
  const { imageId } = req.params;
  const { is_primary, display_order } = req.body;
  try {
    if (is_primary) {
      const img = await pool.query('SELECT artwork_id FROM artwork_images WHERE id = $1', [imageId]);
      if (img.rows.length > 0) {
        await pool.query('UPDATE artwork_images SET is_primary = FALSE WHERE artwork_id = $1', [img.rows[0].artwork_id]);
      }
    }
    const result = await pool.query(
      'UPDATE artwork_images SET is_primary = COALESCE($1, is_primary), display_order = COALESCE($2, display_order) WHERE id = $3 RETURNING *',
      [is_primary || null, display_order !== undefined ? display_order : null, imageId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update image' });
  }
});

module.exports = router;
