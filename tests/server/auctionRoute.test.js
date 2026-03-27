const express = require('express');
const request = require('supertest');

jest.mock('../../server/db/pool', () => ({
  query: jest.fn(),
}));

const pool = require('../../server/db/pool');
const auctionRoute = require('../../server/routes/auction');

describe('GET /config', () => {
  const app = express();
  app.use('/auction', auctionRoute);

  test('returns latest config', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, min_bid_increment: 50 }] });

    const res = await request(app).get('/auction/config');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  test('returns null if no config', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/auction/config');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});
