const adminGuard = require('../../server/middleware/adminGuard');

describe('adminGuard middleware', () => {
  test('allows admin user', () => {
    const req = { user: { isAdmin: true } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    adminGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks non admin user', () => {
    const req = { user: { isAdmin: false } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
