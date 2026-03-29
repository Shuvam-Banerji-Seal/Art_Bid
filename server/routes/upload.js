const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const pool = require('../db/pool');
const authMiddleware = require('../middleware/auth');
const adminGuard = require('../middleware/adminGuard');
const router = express.Router();

const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), 'art_bid_uploads');
const LEGACY_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

function inferMimeTypeFromPath(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
}

function resolveLegacyUploadPath(imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) {
    return null;
  }

  const fileName = path.basename(imagePath);
  if (!fileName || fileName === '.' || fileName === '..') {
    return null;
  }

  return path.join(LEGACY_UPLOADS_DIR, fileName);
}

async function migrateLegacyDiskImageToDb(imageId, row) {
  const legacyFilePath = resolveLegacyUploadPath(row.image_path);
  if (!legacyFilePath) {
    return null;
  }

  try {
    const imageBytes = await fsp.readFile(legacyFilePath);
    const mimeType = row.mime_type || inferMimeTypeFromPath(legacyFilePath);
    const canonicalPath = `/api/upload/images/${imageId}/content`;

    await pool.query(
      'UPDATE artwork_images SET image_data = $1, mime_type = COALESCE(mime_type, $2), image_path = $3 WHERE id = $4',
      [imageBytes, mimeType, canonicalPath, imageId]
    );

    return { imageBytes, mimeType };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to migrate legacy image ${imageId}:`, err);
    }
    return null;
  }
}

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 16);
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`);
    },
  }),
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

    if (row.image_path && row.image_path.startsWith('/uploads/')) {
      const migrated = await migrateLegacyDiskImageToDb(imageId, row);
      if (migrated) {
        res.setHeader('Content-Type', migrated.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(migrated.imageBytes);
      }

      // If the local file still exists, keep old links functional.
      return res.redirect(row.image_path);
    }

    // Backward compatibility for older URL-based records.
    if (row.image_path && /^https?:\/\//i.test(row.image_path)) {
      return res.redirect(row.image_path);
    }

    return res.status(404).json({ error: 'Image data not available' });
  } catch (err) {
    console.error('Error serving image:', err);
    return res.status(500).json({ error: 'Failed to serve image' });
  }
});

// POST /api/upload/artwork/:id/images (admin only)
router.post('/artwork/:id/images', authMiddleware, adminGuard, upload.array('images'), async (req, res) => {
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
      let imageBytes;
      try {
        imageBytes = await fsp.readFile(file.path);
      } finally {
        if (file.path) {
          await fsp.unlink(file.path).catch(() => {});
        }
      }

      const isPrimary = i === 0 && is_primary !== 'false';

      if (isPrimary) {
        await client.query('UPDATE artwork_images SET is_primary = FALSE WHERE artwork_id = $1', [id]);
      }

      const inserted = await client.query(
        `INSERT INTO artwork_images (artwork_id, image_path, image_data, mime_type, is_primary, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [id, '/api/upload/images/pending/content', imageBytes, file.mimetype || 'application/octet-stream', isPrimary, i]
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

    await Promise.all(
      (req.files || []).map((file) => (file.path ? fsp.unlink(file.path).catch(() => {}) : Promise.resolve()))
    );

    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload images' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/upload/images/backfill-legacy (admin only)
// Migrates old /uploads/* rows into BYTEA so images survive server restarts.
router.post('/images/backfill-legacy', authMiddleware, adminGuard, async (req, res) => {
  const requestedLimit = Number(req.body?.limit ?? req.query?.limit ?? 500);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 5000)
    : 500;

  try {
    const pending = await pool.query(
      `SELECT id, image_path, mime_type
       FROM artwork_images
       WHERE image_data IS NULL
         AND image_path LIKE '/uploads/%'
       ORDER BY id
       LIMIT $1`,
      [limit]
    );

    let migrated = 0;
    let missing = 0;
    let failed = 0;

    for (const row of pending.rows) {
      const legacyFilePath = resolveLegacyUploadPath(row.image_path);
      if (!legacyFilePath) {
        failed += 1;
        continue;
      }

      try {
        const imageBytes = await fsp.readFile(legacyFilePath);
        const mimeType = row.mime_type || inferMimeTypeFromPath(legacyFilePath);
        await pool.query(
          'UPDATE artwork_images SET image_data = $1, mime_type = COALESCE(mime_type, $2), image_path = $3 WHERE id = $4',
          [imageBytes, mimeType, `/api/upload/images/${row.id}/content`, row.id]
        );
        migrated += 1;
      } catch (err) {
        if (err.code === 'ENOENT') {
          missing += 1;
        } else {
          failed += 1;
          console.error(`Backfill failed for image ${row.id}:`, err);
        }
      }
    }

    return res.json({
      scanned: pending.rows.length,
      migrated,
      missing,
      failed,
      note: 'Run this endpoint again until scanned becomes 0.',
    });
  } catch (err) {
    console.error('Legacy backfill endpoint failed:', err);
    return res.status(500).json({ error: 'Failed to backfill legacy images' });
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
