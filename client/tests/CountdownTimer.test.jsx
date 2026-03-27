import { render, screen } from '@testing-library/react';
import CountdownTimer from '../src/components/CountdownTimer';

describe('CountdownTimer', () => {
  test('shows countdown text for future target', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(<CountdownTimer targetDate={future} label="Closes in" />);
    expect(screen.getByText('Closes in')).toBeInTheDocument();
  });
});
