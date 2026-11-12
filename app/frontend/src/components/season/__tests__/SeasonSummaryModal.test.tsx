/**
 * Season summary modal after a rollover (#605): the site's modal template
 * (theme tokens, Escape closes), the stable page's labels, and the preparation
 * notice as the site's notification.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SeasonSummaryModal from '../SeasonSummaryModal';
import { useSeasonStore } from '../../../stores/seasonStore';
import * as seasonApi from '../../../utils/seasonApi';
import type { SeasonState, SeasonSummary } from '../../../utils/seasonApi';

vi.mock('../../../utils/seasonApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/seasonApi')>()),
  getSeasonSummary: vi.fn(),
  markSeasonSummarySeen: vi.fn(),
}));

const summary: SeasonSummary = {
  seasonNumber: 1,
  isLegacy: false,
  finalCredits: 3427312,
  prestigeEarned: 27339,
  wins: 385,
  losses: 179,
  draws: 16,
  achievementsUnlocked: 89,
  achievementsAvailable: 135,
  bestTier: { tier: 'champion', mode: 'koth' },
  accolades: [
    { category: 'mostTitles', rank: 4, subjectName: 'Ultron Inc', value: 2, valueLabel: 'titles' },
    { category: 'highestPrestige', rank: 8, subjectName: 'Ultron Inc', value: 27339, valueLabel: 'prestige' },
    { category: 'tournamentChampion', rank: 1, subjectName: 'Ultron Inc', value: 0, valueLabel: '1v1 Tournament #8' },
  ],
};

const preparation: SeasonState = {
  seasonNumber: 2,
  phase: 'preparation',
  seasonCycle: 0,
  seasonLengthCycles: 100,
  remainingCompetitiveCycles: 100,
  preparationDay: 1,
  remainingPreparationCycles: 1,
  isLegacy: false,
};

async function renderModal(): Promise<HTMLElement> {
  render(
    <MemoryRouter>
      <SeasonSummaryModal />
    </MemoryRouter>,
  );
  return screen.findByRole('dialog', { name: 'Season 1 archived' });
}

beforeEach(() => {
  // setupTests mocks localStorage; the modal only loads with a token present.
  vi.mocked(localStorage.getItem).mockImplementation((key) => (key === 'token' ? 'test-token' : null));
  vi.mocked(seasonApi.getSeasonSummary).mockResolvedValue(summary);
  vi.mocked(seasonApi.markSeasonSummarySeen).mockResolvedValue(undefined);
  useSeasonStore.setState({ season: preparation, failed: false, loading: false });
});

describe('SeasonSummaryModal', () => {
  it('uses the site theme, not raw palette colours', async () => {
    const dialog = await renderModal();

    expect(dialog).toHaveClass('bg-surface', 'border-white/10', 'animate-scale-in');
    // Above the fixed navigation (z-[1000]), which otherwise covers it on mobile.
    expect(screen.getByTestId('season-summary-modal')).toHaveClass('z-[1100]');
    expect(screen.getByTestId('season-summary-modal').innerHTML).not.toMatch(/(slate|cyan|amber)-\d/);
  });

  it('labels figures and placements like the stable page', async () => {
    const dialog = await renderModal();

    expect(dialog).toHaveTextContent('₡3,427,312');
    expect(dialog).toHaveTextContent('Champion · King of the Hill');
    expect(dialog).toHaveTextContent('#4 Most Championship Titles · Ultron Inc · 2 titles');
    expect(dialog).toHaveTextContent('#8 Highest Prestige · Ultron Inc · 27,339 prestige');
    expect(dialog).toHaveTextContent('🥇 Tournament Champions · Ultron Inc · 1v1 Tournament #8');
  });

  it('shows the preparation notice with a correct plural', async () => {
    const dialog = await renderModal();

    expect(dialog).toHaveTextContent('Season 2 is being prepared');
    expect(dialog).toHaveTextContent('Competitive battles resume in 1 cycle. Build your stable now.');
    expect(dialog).not.toHaveTextContent('cycle(s)');
  });

  it('closes on Escape and records the summary as seen', async () => {
    const user = userEvent.setup();
    await renderModal();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(seasonApi.markSeasonSummarySeen).toHaveBeenCalledWith(1);
  });

  it('starts focus on the primary action', async () => {
    const dialog = await renderModal();

    expect(within(dialog).getByRole('button', { name: 'Start building' })).toHaveFocus();
  });
});
