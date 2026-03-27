import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../src/utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {
      auction_start: new Date(Date.now() - 1000).toISOString(),
      auction_end: new Date(Date.now() + 3600000).toISOString(),
      is_paused: false,
      min_bid_increment: 50,
    } })),
  },
}));

vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

import { useAuction } from '../src/hooks/useAuction';

describe('useAuction', () => {
  test('loads config and sets status', async () => {
    const { result } = renderHook(() => useAuction());

    await waitFor(() => {
      expect(result.current.status).toBe('live');
    });
  });
});
