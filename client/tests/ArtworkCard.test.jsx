import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtworkCard from '../src/components/ArtworkCard';

describe('ArtworkCard', () => {
  const artwork = {
    id: 1,
    title: 'Sunset',
    artist_name: 'Artist',
    status: 'approved_auction',
    base_price: 500,
    current_highest_bid: 700,
    total_bids: 3,
    primary_image: '/uploads/test.jpg',
  };

  test('renders artwork data', () => {
    render(
      <MemoryRouter>
        <ArtworkCard artwork={artwork} />
      </MemoryRouter>
    );

    expect(screen.getByText('Sunset')).toBeInTheDocument();
    expect(screen.getByText('Artist')).toBeInTheDocument();
  });

  test('watch button triggers callback', () => {
    const onToggleWatch = vi.fn();
    render(
      <MemoryRouter>
        <ArtworkCard artwork={artwork} canWatch isWatched={false} onToggleWatch={onToggleWatch} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }));
    expect(onToggleWatch).toHaveBeenCalledWith(1, false);
  });
});
