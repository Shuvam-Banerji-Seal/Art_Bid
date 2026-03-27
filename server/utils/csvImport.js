const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');
const fs = require('fs/promises');
const path = require('path');

const CSV_COLUMN_MAP = {
  'Timestamp': 'submission_timestamp',
  'Name of the Artist/Stall Owner(s)': 'artist_name',
  'Email': 'artist_email',
  'Roll number': 'artist_roll',
  'Contact Number (WhatsApp)': 'artist_contact',
  'What do you want to sell/display?': 'item_type',
  'Do you want to set up your Artwork/Sculpture for Auction...': 'auction_or_exhibit',
  'Picture of Your Entry Here': 'entry_image_url',
  'Surface used in Artwork': 'surface_used',
  'Medium of your Artwork': 'medium',
  'Is the Artwork Framed?': 'is_framed',
  'Dimensions of the Artwork/Sculpture': 'dimensions',
  'Base Price of item to be Auctioned': 'base_price',
  'For Stalls, mention the items to be sold': 'stall_items',
  'Price of item to be sold in Stalls': 'stall_price',
};

async function downloadImageToUploads(imageUrl) {
  const uploadsDir = path.join(__dirname, '../../uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  const filename = `csv_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const fullPath = path.join(uploadsDir, filename);

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(arrayBuffer));

  return `/uploads/${filename}`;
}

async function importCSV(csvBuffer) {
  const records = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const record of records) {
    try {
      const mapped = {};
      for (const [csvCol, dbField] of Object.entries(CSV_COLUMN_MAP)) {
        const value = record[csvCol];
        if (value !== undefined && value !== '') {
          if (dbField === 'base_price' || dbField === 'stall_price') {
            const num = parseFloat(value.replace(/[₹,\s]/g, ''));
            mapped[dbField] = isNaN(num) ? null : num;
          } else if (dbField === 'is_framed') {
            mapped[dbField] = value.toLowerCase().includes('yes') || value.toLowerCase() === 'true';
          } else if (dbField === 'submission_timestamp') {
            mapped[dbField] = new Date(value);
          } else {
            mapped[dbField] = value;
          }
        }
      }

      if (!mapped.artist_name) { results.errors.push({ record, error: 'Missing artist_name' }); continue; }

      // Duplicate detection
      if (mapped.artist_email) {
        const title = mapped.title || record['Title'] || null;
        const existing = await pool.query(
          'SELECT id FROM artworks WHERE artist_email = $1 AND (title = $2 OR (title IS NULL AND $2 IS NULL))',
          [mapped.artist_email, title]
        );
        if (existing.rows.length > 0) { results.skipped++; continue; }
      }

      const imageUrl = mapped.entry_image_url || null;
      delete mapped.entry_image_url;

      const insertFields = Object.keys(mapped);
      const insertValues = Object.values(mapped);
      const insertPlaceholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');

      const artworkInsert = await pool.query(
        `INSERT INTO artworks (${insertFields.join(', ')}, status) VALUES (${insertPlaceholders}, 'pending') RETURNING id`,
        insertValues
      );

      if (imageUrl) {
        try {
          const localPath = await downloadImageToUploads(imageUrl);
          await pool.query(
            'INSERT INTO artwork_images (artwork_id, image_path, is_primary, display_order) VALUES ($1, $2, TRUE, 0)',
            [artworkInsert.rows[0].id, localPath]
          );
        } catch (imgErr) {
          results.errors.push({ record, error: `Image import skipped: ${imgErr.message}` });
        }
      }
      results.imported++;
    } catch (err) {
      results.errors.push({ record, error: err.message });
    }
  }

  return results;
}

module.exports = { importCSV };
