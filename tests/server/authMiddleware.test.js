const jwt = require('jsonwebtoken');
const authMiddleware = require('../../server/middleware/auth');

describe('auth middleware', () => {
  test('accepts valid token', () => {
    const token = jwt.sign({ userId: 1, email: 'a@iiserkol.ac.in', isAdmin: false }, process.env.JWT_SECRET || 'chitrakavyam_secret');
    const req = { cookies: { token }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe(1);
  });

  test('rejects missing token', () => {
    const req = { cookies: {}, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
