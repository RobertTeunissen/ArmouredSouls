/**
 * Season_Progress_Indicator styling (issue #602): the navigation chip uses the
 * site's theme tokens like the credits chip next to it, and marks the
 * preparation window with a warning-token dot instead of a raw amber chip.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SeasonProgressIndicator from '../SeasonProgressIndicator';
import { useSeasonStore } from '../../../stores/seasonStore';
import type { SeasonState } from '@shared/types';

function seed(overrides: Partial<SeasonState>): void {
  const season: SeasonState = {
    seasonNumber: 2,
    phase: 'competitive',
    seasonCycle: 12,
    seasonLengthCycles: 100,
    remainingCompetitiveCycles: 88,
    preparationDay: 0,
    remainingPreparationCycles: 0,
    isLegacy: false,
    ...overrides,
  };
  useSeasonStore.setState({ season, failed: false, loading: false, dismissedBanner: null });
}

/** Raw Tailwind palette colours the theme replaces (amber, slate, gray, …). */
const RAW_PALETTE = /\b(?:bg|text|border)-(?:amber|slate|gray|yellow|orange|zinc|neutral)-\d/;

afterEach(() => {
  cleanup();
  useSeasonStore.setState(useSeasonStore.getInitialState());
});

describe('SeasonProgressIndicator styling', () => {
  it('shows the preparation day in the shared chip with a warning dot', () => {
    seed({ phase: 'preparation', preparationDay: 2, remainingPreparationCycles: 1 });
    render(<SeasonProgressIndicator />);

    const chip = screen.getByTestId('season-progress-indicator');
    expect(chip).toHaveTextContent('Season 2 · Preparation 2');
    expect(chip).toHaveAttribute('data-phase', 'preparation');
    expect(chip.className).toContain('bg-surface');
    expect(chip.className).toContain('border-white/10');
    expect(screen.getByTestId('season-preparation-dot').className).toContain('bg-warning');
  });

  it('shows the competitive cycle in the same chip without the dot', () => {
    seed({});
    render(<SeasonProgressIndicator />);

    const chip = screen.getByTestId('season-progress-indicator');
    expect(chip).toHaveTextContent('Season 2 · Cycle 12 / 100');
    expect(chip.className).toContain('bg-surface');
    expect(screen.queryByTestId('season-preparation-dot')).toBeNull();
  });

  // The desktop bar only fits the long label from 1440 px; below that the short
  // one shows, or Logout is pushed off a 1280 px screen.
  it('switches the desktop chip to the short label below 1440 px', () => {
    seed({});
    render(<SeasonProgressIndicator />);

    const short = screen.getByText('S2 · 12/100');
    const long = screen.getByText('Season 2 · Cycle 12 / 100');
    expect(short.className).toContain('min-[1440px]:hidden');
    expect(long.className).toMatch(/(?:^|\s)hidden(?:\s|$)/);
    expect(long.className).toContain('min-[1440px]:inline');
  });

  it('shows only the short label in the compact chip', () => {
    seed({});
    render(<SeasonProgressIndicator compact />);

    expect(screen.getByTestId('season-progress-indicator')).toHaveTextContent(/^S2 · 12\/100$/);
  });

  it.each([
    ['preparation', { phase: 'preparation' as const, preparationDay: 1 }],
    ['competitive', {}],
  ])('uses only theme tokens in the %s phase, desktop and compact', (_phase, overrides) => {
    seed(overrides);
    const { container, rerender } = render(<SeasonProgressIndicator />);
    const classesOf = (): string[] =>
      Array.from(container.querySelectorAll<HTMLElement>('*')).map((el) => el.className);

    expect(classesOf().filter((c) => RAW_PALETTE.test(c))).toEqual([]);
    rerender(<SeasonProgressIndicator compact />);
    expect(classesOf().filter((c) => RAW_PALETTE.test(c))).toEqual([]);
  });

  it('keeps the explanation as the accessible name', () => {
    seed({ phase: 'preparation', preparationDay: 1, remainingPreparationCycles: 1 });
    render(<SeasonProgressIndicator compact />);

    expect(screen.getByLabelText(/Preparation window — no battles are scheduled\. 1 cycle\(s\) remaining\./))
      .toHaveTextContent('S2 · Prep 1');
  });
});
