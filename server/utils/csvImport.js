const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');

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

function sanitizePrice(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

async function downloadImageToBuffer(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);

  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType: contentType || 'image/jpeg',
    buffer: Buffer.from(arrayBuffer),
  };
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
            mapped[dbField] = sanitizePrice(value);
          } else if (dbField === 'is_framed') {
            mapped[dbField] = value.toLowerCase().includes('yes') || value.toLowerCase() === 'true';
          } else if (dbField === 'submission_timestamp') {
            const parsedDate = new Date(value);
            if (!Number.isNaN(parsedDate.getTime())) {
              mapped[dbField] = parsedDate;
            }
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
          const { buffer, mimeType } = await downloadImageToBuffer(imageUrl);
          const insertedImage = await pool.query(
            `INSERT INTO artwork_images (artwork_id, image_path, image_data, mime_type, is_primary, display_order)
             VALUES ($1, $2, $3, $4, TRUE, 0)
             RETURNING id`,
            [artworkInsert.rows[0].id, '/api/upload/images/pending/content', buffer, mimeType]
          );

          const imageId = insertedImage.rows[0].id;
          await pool.query('UPDATE artwork_images SET image_path = $1 WHERE id = $2', [
            `/api/upload/images/${imageId}/content`,
            imageId,
          ]);
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
