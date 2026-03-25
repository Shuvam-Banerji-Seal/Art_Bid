const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const adminGuard = require('../middleware/adminGuard');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `artwork_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload/artwork/:id/images (admin only)
router.post('/artwork/:id/images', authMiddleware, adminGuard, upload.array('images', 10), async (req, res) => {
  const { id } = req.params;
  const { is_primary } = req.body;
  try {
    const insertedImages = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imagePath = `/uploads/${file.filename}`;
      const isPrimary = i === 0 && is_primary !== 'false';

      if (isPrimary) {
        await pool.query('UPDATE artwork_images SET is_primary = FALSE WHERE artwork_id = $1', [id]);
      }

      const result = await pool.query(
        'INSERT INTO artwork_images (artwork_id, image_path, is_primary, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, imagePath, isPrimary, i]
      );
      insertedImages.push(result.rows[0]);
    }
    res.status(201).json(insertedImages);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload images' });
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
