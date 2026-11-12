/**
 * Season countdown: one notice in the site's warning style, below the
 * navigation on every page except the Dashboard (which lists it with its own
 * notifications), for the final 7 competitive cycles, dismissed until the next
 * cycle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SeasonCountdownBanner, { SeasonCountdownNotice } from '../SeasonCountdownBanner';
import { useSeasonStore } from '../../../stores/seasonStore';
import type { SeasonState } from '@shared/types';

function season(overrides: Partial<SeasonState> = {}): SeasonState {
  return {
    seasonNumber: 1,
    phase: 'competitive',
    seasonCycle: 93,
    seasonLengthCycles: 100,
    remainingCompetitiveCycles: 7,
    preparationDay: 0,
    remainingPreparationCycles: 0,
    isLegacy: false,
    ...overrides,
  };
}

function seed(state: SeasonState | null): void {
  useSeasonStore.setState({ season: state, failed: false, loading: false, dismissedBanner: null });
}

function renderBanner(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SeasonCountdownBanner userId={7} />
    </MemoryRouter>,
  );
}

beforeEach(() => seed(season()));

describe('SeasonCountdownBanner', () => {
  it('shows the warning notification with the cycle count and the history link', () => {
    renderBanner('/robots');

    const notice = screen.getByTestId('season-countdown-banner');
    expect(notice).toHaveTextContent('Season 1 ends in 7 cycles');
    expect(notice).toHaveTextContent('Every robot, weapon, facility, and standing will be archived and reset.');
    expect(within(notice).getByRole('link', { name: 'View your season history' })).toHaveAttribute('href', '/stables/7#season-history');
    // The site's warning style (theme tokens), not a raw amber bar.
    const card = notice.firstElementChild as HTMLElement;
    expect(card.className).toContain('bg-warning/10');
    expect(card.className).toContain('border-warning');
    expect(notice.innerHTML).not.toMatch(/amber-\d/);
  });

  it('sits in the page container so it lines up with page content', () => {
    renderBanner('/robots');

    const container = screen.getByTestId('season-countdown-banner').parentElement as HTMLElement;
    expect(container).toHaveClass('container', 'mx-auto', 'px-4');
    // On the site background across the full width (pages paint their own below it).
    expect(container.parentElement).toHaveClass('bg-background');
  });

  it('leaves the Dashboard to its own notification list', () => {
    renderBanner('/dashboard');

    expect(screen.queryByTestId('season-countdown-banner')).toBeNull();
  });

  it('shows from 7 remaining cycles, not before', () => {
    seed(season({ remainingCompetitiveCycles: 8 }));
    renderBanner('/robots');
    expect(screen.queryByTestId('season-countdown-banner')).toBeNull();
  });

  it('uses the singular for the last cycle', () => {
    seed(season({ remainingCompetitiveCycles: 1 }));
    renderBanner('/robots');
    expect(screen.getByTestId('season-countdown-banner')).toHaveTextContent('Season 1 ends in 1 cycle');
  });

  it('hides for the rest of the cycle when dismissed, and returns next cycle', async () => {
    const user = userEvent.setup();
    renderBanner('/robots');

    await user.click(screen.getByRole('button', { name: 'Dismiss season countdown for this cycle' }));
    expect(screen.queryByTestId('season-countdown-banner')).toBeNull();

    useSeasonStore.setState({ season: season({ seasonCycle: 94, remainingCompetitiveCycles: 6 }) });
    expect(await screen.findByTestId('season-countdown-banner')).toHaveTextContent('ends in 6 cycles');
  });
});

describe('SeasonCountdownNotice (Dashboard)', () => {
  it('renders the same notice without the page container', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <SeasonCountdownNotice userId={7} />
      </MemoryRouter>,
    );

    const notice = screen.getByTestId('season-countdown-banner');
    expect(notice).toHaveTextContent('Season 1 ends in 7 cycles');
    expect(notice.parentElement).not.toHaveClass('container');
  });

  it('renders nothing outside the countdown window', () => {
    seed(season({ phase: 'preparation' }));
    const { container } = render(
      <MemoryRouter>
        <SeasonCountdownNotice userId={7} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });
});
