/**
 * Overview_Row and the three tiles — Spec #48 Requirements 1, 3, 4, 5, 6, 7, 10, 13.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import { OverviewRow } from '../OverviewRow';
import { placementReward, ordinal } from '../placementFormatting';
import type { OverviewRowData } from '../types';
import type { CycleProgressSummary } from '../../../utils/dashboardApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const PROGRESS: CycleProgressSummary = {
  window: { start: '2026-08-26T00:00:00.000Z', end: '2026-08-26T12:00:00.000Z', cycleNumber: 61 },
  battlesFought: 3,
  matchesScheduled: 5,
  // 2 win/loss + 1 placement = 3 fought. The service guarantees that identity.
  winLossBattles: 2,
  placementBattles: 1,
  winLossDraw: { wins: 2, losses: 1, draws: 0 },
  bestPlacement: { position: 4, fieldSize: 20 },
  remainingSlotsUtc: ['15:00', '17:00', '18:00'],
  nextSettlementAt: '2026-08-27T00:00:00.000Z',
  prestigeEarned: 40,
  battleEarnings: 51000,
  repairSpend: { manual: 1200, automatic: 800 },
  comparison: {
    cycleNumber: 60,
    prestigeEarned: 55,
    battleEarnings: 62000,
    repairSpend: { manual: 900, automatic: 1500 },
  },
};

function baseData(overrides: Partial<OverviewRowData> = {}): OverviewRowData {
  return {
    prestigeTotal: 1500,
    creditBalance: 250000,
    robotCount: 4,
    isPreparationPhase: false,
    cycleProgress: PROGRESS,
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function renderRow(data: OverviewRowData) {
  return render(
    <MemoryRouter>
      <OverviewRow data={data} />
    </MemoryRouter>,
  );
}

describe('Requirement 1: three tiles, fixed order, every data state', () => {
  it.each([
    ['loaded', baseData()],
    ['loading', baseData({ isLoading: true, cycleProgress: null })],
    ['failed', baseData({ error: "Today's figures are unavailable.", cycleProgress: null })],
    ['no robots', baseData({ robotCount: 0 })],
    ['no comparison', baseData({ cycleProgress: { ...PROGRESS, comparison: null } })],
  ])('renders exactly three tiles in order in the %s state', (_name, data) => {
    renderRow(data);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    // Requirement 1 criteria 1, 8 and 9: count and order never depend on the data.
    expect(headings).toEqual(['Prestige', "Today's Battles", 'Credits']);
  });

  it('stacks in one column below 1024px and uses three equal columns above', () => {
    const { container } = renderRow(baseData());
    const grid = container.querySelector('div.grid');
    // Requirement 13 criteria 1, 2 and 7: one utility pair covers both layouts and
    // re-renders on rotation with no reload.
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('lg:grid-cols-3');
  });

  it('clips no text-bearing element and sets no fixed pixel width', () => {
    // Requirement 13 criteria 3, 6 and 8. Scoped to elements that actually carry text:
    // the progress-bar TRACK legitimately uses `overflow-hidden` to clip its own fill
    // to the rounded corners, and it holds no text, so a blanket ban on the class
    // would forbid correct markup and teach the next person to delete the assertion.
    const { container } = renderRow(baseData());

    const textBearing = Array.from(container.querySelectorAll<HTMLElement>('*')).filter(
      (el) => (el.textContent ?? '').trim().length > 0,
    );

    for (const el of textBearing) {
      expect(el.className).not.toContain('whitespace-nowrap');
      expect(el.className).not.toContain('truncate');
      expect(el.className).not.toContain('text-ellipsis');
      expect(el.className).not.toContain('overflow-hidden');
      // No fixed pixel width anywhere, which is what would force a horizontal
      // scrollbar at 320px.
      expect(el.className).not.toMatch(/\bw-\[\d/);
      expect(el.className).not.toMatch(/\bmin-w-\[\d/);
    }
  });
});

describe('Requirement 7: the removed Lifetime_Stats appear nowhere', () => {
  it.each([
    ['loaded', baseData()],
    ['loading', baseData({ isLoading: true, cycleProgress: null })],
    ['failed', baseData({ error: 'nope', cycleProgress: null })],
  ])('renders no lifetime figure in the %s state', (_name, data) => {
    const { container } = renderRow(data);
    const text = container.textContent ?? '';

    for (const forbidden of [
      'Highest ELO',
      'Highest League',
      'Total Robots',
      'Total Battles',
      'Win Rate',
      'Win rate',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('Requirement 3: Prestige_Tile', () => {
  it('renders the total, the cycle figure and the comparison', () => {
    renderRow(baseData());
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText(/vs 55/)).toBeInTheDocument();
  });

  it('renders a zero cycle figure as 0, because a known zero is not an absent figure', () => {
    renderRow(baseData({ cycleProgress: { ...PROGRESS, prestigeEarned: 0 } }));
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('omits the comparison entirely when no snapshot exists', () => {
    renderRow(baseData({ cycleProgress: { ...PROGRESS, comparison: null } }));
    expect(screen.queryByText(/vs /)).not.toBeInTheDocument();
  });

  it('renders gate progress as text beside the bar, not only as a bar', () => {
    renderRow(baseData());
    // Requirement 3 criterion 5.
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeInTheDocument();
    expect(screen.getByText(/to go/)).toBeInTheDocument();
  });

  it('replaces the bar with the level reached at the top of the curve', () => {
    // Requirement 3 criterion 6: `getNextPrestigeThreshold` returns null past the last
    // gate, so there is nothing to draw a bar toward.
    renderRow(baseData({ prestigeTotal: 500000 }));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(/All facility levels unlocked/)).toBeInTheDocument();
  });
});

describe('Requirements 4 and 5: Todays_Battles_Tile', () => {
  it('renders the fought-of-scheduled figure unabbreviated', () => {
    renderRow(baseData());
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('renders the earliest two slots plus a bounded +N more', () => {
    renderRow(baseData());
    expect(screen.getByText('15:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('17:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
    // Requirement 4 criterion 6: no more than two times plus the indicator.
    expect(screen.queryByText('18:00 UTC')).not.toBeInTheDocument();
  });

  it('renders a reward-earning placement with a marker a non-earning one lacks', () => {
    // Requirement 5 criterion 6.
    renderRow(baseData());
    expect(screen.getByText(/🏆 best 4th of 20/)).toBeInTheDocument();

    render(
      <MemoryRouter>
        <OverviewRow
          data={baseData({
            cycleProgress: { ...PROGRESS, bestPlacement: { position: 15, fieldSize: 20 } },
          })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/best 15th of 20/)).toBeInTheDocument();
  });

  it('labels each result line with its own match count so the three figures add up', () => {
    // Requirement 4 criterion 13. The regression: `4 of 1` with a record covering only
    // two of the four battles and nothing saying the other two were placement events.
    renderRow(baseData());

    expect(screen.getByText('3 of 5')).toBeInTheDocument();
    expect(screen.getByText(/Wins and losses \(2 matches\)/)).toBeInTheDocument();
    expect(screen.getByText(/Placement events \(1\)/)).toBeInTheDocument();
  });

  it('says "match" rather than "matches" for a single win/loss battle', () => {
    renderRow(
      baseData({
        cycleProgress: {
          ...PROGRESS,
          battlesFought: 1,
          winLossBattles: 1,
          placementBattles: 0,
          winLossDraw: { wins: 1, losses: 0, draws: 0 },
          bestPlacement: null,
        },
      }),
    );
    expect(screen.getByText(/Wins and losses \(1 match\)/)).toBeInTheDocument();
  });

  it('drops the ratio rather than rendering an impossible one', () => {
    // Requirement 4 criterion 12. The service makes `matchesScheduled >= battlesFought`
    // true by construction; this is the safety net if that ever breaks, because `4 of 1`
    // on the most prominent module of the page discredits every figure beside it.
    renderRow(
      baseData({
        cycleProgress: { ...PROGRESS, battlesFought: 4, matchesScheduled: 1 },
      }),
    );
    expect(screen.queryByText('4 of 1')).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('omits outcome and placement lines when nothing was fought, keeping the progress line', () => {
    // Requirement 10 criterion 1.
    renderRow(
      baseData({
        cycleProgress: {
          ...PROGRESS,
          battlesFought: 0,
          winLossDraw: { wins: 0, losses: 0, draws: 0 },
          bestPlacement: null,
        },
      }),
    );
    expect(screen.getByText('0 of 5')).toBeInTheDocument();
    expect(screen.queryByText(/W .*L .*D/)).not.toBeInTheDocument();
  });

  it('replaces the slot line with the settlement countdown when everything is fought', () => {
    // Requirement 10 criterion 3.
    renderRow(
      baseData({
        cycleProgress: { ...PROGRESS, remainingSlotsUtc: [] },
      }),
    );
    expect(screen.getByText(/Settlement in \d+h \d+m/)).toBeInTheDocument();
  });

  it('states the Preparation_Phase as a note, not an error, with no retry', () => {
    // Requirement 10 criterion 4.
    renderRow(
      baseData({
        isPreparationPhase: true,
        cycleProgress: { ...PROGRESS, matchesScheduled: 0, remainingSlotsUtc: [] },
      }),
    );
    expect(screen.getByText(/preparation window/)).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tile-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('replaces every figure line with a creation prompt when the player owns no robots', () => {
    // Requirement 10 criteria 7 and 11.
    renderRow(baseData({ robotCount: 0 }));
    expect(screen.getByText(/No robots yet/)).toBeInTheDocument();
    expect(screen.queryByText('3 of 5')).not.toBeInTheDocument();
  });

  it('shows the error state rather than a zero fought count on a failed read', () => {
    // Requirement 4 criterion 7 — a zero would read as "the day ran and you did nothing".
    renderRow(baseData({ error: "Today's figures are unavailable.", cycleProgress: null }));
    expect(screen.getAllByTestId('dashboard-tile-error').length).toBeGreaterThan(0);
    expect(screen.queryByText('0 of 0')).not.toBeInTheDocument();
  });

  it('renders no per-battle LP figure anywhere', () => {
    // Requirement 5 criterion 8.
    const { container } = renderRow(baseData());
    expect(container.textContent).not.toMatch(/\bLP\b/);
  });
});

describe('Requirement 6: Credits_Tile', () => {
  it('renders the balance, earnings and repair spend split by type', () => {
    // Requirement 6 criteria 3 and 4, as amended: two plain lines, no derived figure.
    renderRow(baseData());
    expect(screen.getByText('₡250,000')).toBeInTheDocument();
    expect(screen.getByText('₡51,000')).toBeInTheDocument();
    expect(screen.getByText(/Automatic repairs/)).toBeInTheDocument();
    expect(screen.getByText('₡800')).toBeInTheDocument();
    expect(screen.getByText(/Manual repairs/)).toBeInTheDocument();
    expect(screen.getByText('₡1,200')).toBeInTheDocument();
  });

  it('renders no combined repair total and no avoidable figure', () => {
    // The two lines replace them. A total would be a third repair number to reconcile,
    // and the avoidable figure needed a sentence of label to explain a number that was
    // never a real transaction.
    renderRow(baseData());
    expect(screen.queryByText(/Avoidable/i)).not.toBeInTheDocument();
    // 1200 + 800: the old combined total.
    expect(screen.queryByText('₡2,000')).not.toBeInTheDocument();
  });

  it('shows a zero automatic line when there was manual spend, since that is the good news', () => {
    renderRow(
      baseData({ cycleProgress: { ...PROGRESS, repairSpend: { manual: 7468, automatic: 0 } } }),
    );
    expect(screen.getByText(/Automatic repairs/)).toBeInTheDocument();
    expect(screen.getByText('₡0')).toBeInTheDocument();
    expect(screen.getByText('₡7,468')).toBeInTheDocument();
  });

  it('omits both repair lines together when nothing was spent', () => {
    // Requirement 10 criterion 8.
    renderRow(
      baseData({ cycleProgress: { ...PROGRESS, repairSpend: { manual: 0, automatic: 0 } } }),
    );
    expect(screen.queryByText(/repairs/i)).not.toBeInTheDocument();
  });

  it('keeps the balance and the breakdown link when the cycle read fails', () => {
    // Requirement 6 criteria 10 and 13: this tile is NOT put into the shared error
    // state, which would hide both.
    renderRow(baseData({ error: 'nope', cycleProgress: null }));
    expect(screen.getByText('₡250,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full breakdown' })).toBeInTheDocument();
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
  });

  it('omits the repair comparison independently of the other two', () => {
    // Requirement 10 criterion 6: after a Season_Rollover purged audit_logs.
    renderRow(
      baseData({
        cycleProgress: {
          ...PROGRESS,
          comparison: { ...PROGRESS.comparison!, repairSpend: null },
        },
      }),
    );
    // Battle earnings keeps its comparison…
    expect(screen.getByText(/vs ₡62,000/)).toBeInTheDocument();
    // …while both repair lines render their own figure without one.
    expect(screen.getByText('₡800')).toBeInTheDocument();
    expect(screen.getByText('₡1,200')).toBeInTheDocument();
    expect(screen.queryByText(/vs ₡1,500/)).not.toBeInTheDocument();
    expect(screen.queryByText(/vs ₡900/)).not.toBeInTheDocument();
  });

  it('renders no passive income or operating cost line', () => {
    // Requirement 6 criterion 8.
    const { container } = renderRow(baseData());
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/merchandis/i);
    expect(text).not.toMatch(/operating/i);
    expect(text).not.toMatch(/passive/i);
  });

  it('offers no repair control', () => {
    // Requirement 1 criterion 7: repair action stays in the notification stack.
    renderRow(baseData());
    expect(screen.queryByRole('button', { name: /repair/i })).not.toBeInTheDocument();
  });
});

describe('Property 13: placement reward banding is total and field-size independent', () => {
  // Feature: 48-dashboard-overview-row, Property 13: Best_Placement selection is deterministic and reward banding is total

  it('bands every position, with the same bands at every field size', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (position) => {
        const band = placementReward(position);
        expect(['prestige', 'lp-and-fame', 'none']).toContain(band);
        if (position <= 3) expect(band).toBe('prestige');
        else if (position <= 10) expect(band).toBe('lp-and-fame');
        else expect(band).toBe('none');
      }),
      { numRuns: 200 },
    );
  });

  it('formats every position as an ordinal', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (position) => {
        expect(ordinal(position)).toMatch(/^\d+(st|nd|rd|th)$/);
      }),
      { numRuns: 200 },
    );
  });

  it('handles the teens correctly', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(102)).toBe('102nd');
  });
});
