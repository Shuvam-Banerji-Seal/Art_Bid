function validateBidAmount(bidAmount, currentHighest, basePrice, minIncrement) {
  const amount = parseFloat(bidAmount);
  if (isNaN(amount) || amount <= 0) return { valid: false, error: 'Invalid bid amount' };

  const minBid = currentHighest
    ? parseFloat(currentHighest) + parseFloat(minIncrement)
    : parseFloat(basePrice);

  if (amount < minBid) return { valid: false, error: `Minimum bid is ₹${minBid}`, minBid };
  return { valid: true, minBid };
}

module.exports = { validateBidAmount };
