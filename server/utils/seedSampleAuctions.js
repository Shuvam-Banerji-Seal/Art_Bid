require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function upsertUser(client, { email, username, password, isAdmin }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (email, username, password_hash, is_admin, is_verified, is_banned)
     VALUES ($1, $2, $3, $4, true, false)
     ON CONFLICT (email) DO UPDATE
     SET username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         is_admin = EXCLUDED.is_admin,
         is_verified = true,
         is_banned = false
     RETURNING id`,
    [email, username, hash, isAdmin]
  );
  return rows[0].id;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clean up the entire database for a fresh start
    console.log('Truncating existing data for a clean slate...');
    await client.query('TRUNCATE TABLE users, artworks, artwork_images, bids, auction_state, watchlist, admin_audit_log, login_fingerprints RESTART IDENTITY CASCADE;');

    const now = new Date();
    const auctionStart = new Date(now.getTime() - 30 * 60 * 1000);
    const auctionEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    await client.query('DELETE FROM auction_config');
    await client.query(
      `INSERT INTO auction_config (auction_start, auction_end, min_bid_increment, is_paused)
       VALUES ($1, $2, 50, false)`,
      [auctionStart, auctionEnd]
    );

    await upsertUser(client, {
      email: 'artmaster@iiserkol.ac.in',
      username: 'ArtMaster',
      password: 'master001',
      isAdmin: true,
    });

    await client.query('COMMIT');

    console.log('Clean slate initialized successfully.');
    console.log('Admin credentials: artmaster@iiserkol.ac.in / master001');
    console.log('No dummy artworks or bids were created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Initialization failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
