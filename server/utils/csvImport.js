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
  'Surface used in Artwork': 'surface_used',
  'Medium of your Artwork': 'medium',
  'Is the Artwork Framed?': 'is_framed',
  'Dimensions of the Artwork/Sculpture': 'dimensions',
  'Base Price of item to be Auctioned': 'base_price',
  'For Stalls, mention the items to be sold': 'stall_items',
  'Price of item to be sold in Stalls': 'stall_price',
};

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

      const fields = Object.keys(mapped);
      const values = Object.values(mapped);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      await pool.query(
        `INSERT INTO artworks (${fields.join(', ')}, status) VALUES (${placeholders}, 'pending')`,
        values
      );
      results.imported++;
    } catch (err) {
      results.errors.push({ record, error: err.message });
    }
  }

  return results;
}

module.exports = { importCSV };
