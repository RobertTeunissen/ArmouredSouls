import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankPrefix } from '../RankPrefix';

describe('RankPrefix', () => {
  it('renders nothing for 0 refinements', () => {
    const { container } = render(<RankPrefix refinementCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    [1, 'Refined'],
    [2, 'Refined'],
    [3, 'Crafted'],
    [4, 'Mastercrafted'],
    [5, 'Legendary'],
  ])('renders "%s" for %i refinements', (count, expected) => {
    render(<RankPrefix refinementCount={count} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('saturates 6 refinements (overflow) to Legendary', () => {
    render(<RankPrefix refinementCount={6} />);
    expect(screen.getByText('Legendary')).toBeInTheDocument();
  });

  it('returns null for negative refinementCount (defensive)', () => {
    const { container } = render(<RankPrefix refinementCount={-1} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders subtle variant', () => {
    render(<RankPrefix refinementCount={3} variant="subtle" />);
    expect(screen.getByTestId('rank-prefix-subtle')).toHaveTextContent('Crafted');
  });

  it('renders badge variant', () => {
    render(<RankPrefix refinementCount={5} variant="badge" />);
    expect(screen.getByTestId('rank-prefix-badge')).toHaveTextContent('Legendary');
  });
});
