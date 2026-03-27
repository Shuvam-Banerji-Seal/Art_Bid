const { validateBidAmount } = require('../../server/utils/bidValidator');

describe('validateBidAmount', () => {
  test('accepts valid first bid at base price', () => {
    const result = validateBidAmount(500, null, 500, 50);
    expect(result.valid).toBe(true);
  });

  test('rejects lower than minimum increment', () => {
    const result = validateBidAmount(540, 500, 300, 50);
    expect(result.valid).toBe(false);
    expect(result.minBid).toBe(550);
  });

  test('rejects non numeric bids', () => {
    const result = validateBidAmount('abc', 500, 300, 50);
    expect(result.valid).toBe(false);
  });
});
