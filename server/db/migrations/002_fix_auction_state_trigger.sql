-- Ensure auction_state keeps total_bids/last_bid_at correct for every non-voided bid.
CREATE OR REPLACE FUNCTION update_auction_state()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_voided = FALSE THEN
    INSERT INTO auction_state (artwork_id, current_highest_bid, current_winner_id, total_bids, last_bid_at)
    VALUES (NEW.artwork_id, NEW.bid_amount, NEW.bidder_id, 1, NEW.bid_time)
    ON CONFLICT (artwork_id) DO UPDATE
      SET current_highest_bid = GREATEST(auction_state.current_highest_bid, EXCLUDED.current_highest_bid),
          current_winner_id = CASE
            WHEN EXCLUDED.current_highest_bid > auction_state.current_highest_bid THEN EXCLUDED.current_winner_id
            ELSE auction_state.current_winner_id
          END,
          total_bids = auction_state.total_bids + 1,
          last_bid_at = EXCLUDED.last_bid_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
