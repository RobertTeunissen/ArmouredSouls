import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SearchResultList from '../SearchResultList';
import type { SearchResponse } from '../../../utils/searchTypes';

const results: SearchResponse = {
  robots: [
    {
      category: 'robots',
      id: 7,
      label: 'Atlas',
      subtitle: 'North Stable',
    },
  ],
  stables: [
    {
      category: 'stables',
      userId: 12,
      label: 'North Stable',
    },
  ],
  guide: [
    {
      category: 'guide',
      title: 'Combat Basics',
      sectionTitle: 'Combat',
      sectionSlug: 'combat',
      articleSlug: 'basics',
    },
  ],
};

describe('SearchResultList', () => {
  it('renders the three groups in fixed order using only approved display fields', () => {
    render(<SearchResultList results={results} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Robots',
      'Stables',
      'Guide articles',
    ]);
    expect(screen.getByRole('button', { name: 'Robot: Atlas, North Stable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stable: North Stable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guide article: Combat Basics, section Combat' })).toBeInTheDocument();
    expect(screen.queryByText('combat')).not.toBeInTheDocument();
    expect(screen.queryByText('basics')).not.toBeInTheDocument();
  });

  it('activates a result from pointer input and provides a 44px visible-focus target', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SearchResultList results={results} onSelect={onSelect} />);

    const robot = screen.getByRole('button', { name: 'Robot: Atlas, North Stable' });
    await user.click(robot);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(results.robots[0]);
    expect(robot.className).toContain('min-h-11');
    expect(robot.className).toContain('min-w-11');
    expect(robot.className).toContain('focus-visible:outline-primary');
    expect(robot.className).toContain('focus-visible:ring-primary/50');
  });

  it('moves focus with Arrow keys and activates the focused result with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActiveResultIndexChange = vi.fn();
    render(
      <SearchResultList
        results={results}
        onSelect={onSelect}
        onActiveResultIndexChange={onActiveResultIndexChange}
      />,
    );

    const robot = screen.getByRole('button', { name: 'Robot: Atlas, North Stable' });
    const stable = screen.getByRole('button', { name: 'Stable: North Stable' });
    robot.focus();
    await user.keyboard('{ArrowDown}');

    expect(stable).toHaveFocus();
    expect(onActiveResultIndexChange).toHaveBeenLastCalledWith(1);

    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(results.stables[0]);
  });
});
