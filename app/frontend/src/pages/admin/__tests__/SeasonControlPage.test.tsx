/**
 * SeasonControlPage (Season Control, Spec #45): timeline, on-demand preview,
 * the typed rollover confirmation (background start, 409), the running view
 * and its outcome message, the history, and the testing tools.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeasonControlPage from '../SeasonControlPage';
import { ApiError } from '../../../utils/ApiError';
import type { AdminSeasonState, RolloverPreview, SeasonRolloverHistory } from '../../../utils/seasonApi';

const mockGetState = vi.fn();
const mockGetPreview = vi.fn();
const mockGetHistory = vi.fn();
const mockStartRollover = vi.fn();
const mockExtend = vi.fn();
const mockSetPrep = vi.fn();

vi.mock('../../../utils/seasonApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/seasonApi')>()),
  getAdminSeasonState: () => mockGetState(),
  getRolloverPreview: () => mockGetPreview(),
  getSeasonRolloverHistory: () => mockGetHistory(),
  startRollover: (n: number) => mockStartRollover(n),
  extendSeason: (n: number) => mockExtend(n),
  setPreparationCycles: (n: number) => mockSetPrep(n),
}));

const competitive: AdminSeasonState = {
  seasonNumber: 1,
  phase: 'competitive',
  seasonCycle: 82,
  seasonLengthCycles: 100,
  remainingCompetitiveCycles: 19,
  preparationDay: 0,
  remainingPreparationCycles: 0,
  isLegacy: false,
  rolloverInProgress: false,
  balanceChangesAppropriate: false,
  config: { seasonLengthCycles: 100, preparationLengthCycles: 2, countdownCycles: 7, accoladeDepth: 3, retainedImagesPerStable: 20 },
  startedAt: '2026-08-01T00:00:00.000Z',
  nextSettlementAt: '2026-10-23T00:00:00.000Z',
  activeRollover: null,
};

const preparing: AdminSeasonState = {
  ...competitive,
  seasonNumber: 2,
  phase: 'preparation',
  seasonCycle: 0,
  remainingCompetitiveCycles: 0,
  preparationDay: 1,
  remainingPreparationCycles: 2,
  balanceChangesAppropriate: true,
};

const preview: RolloverPreview = {
  humanStables: 292,
  humanRobots: 900,
  generatedStables: 3483,
  generatedRobots: 9000,
  breakdown: { human: { stables: 87, robots: 250 }, automaton: { stables: 205, robots: 650 }, generated: { stables: 3483, robots: 9000 } },
  rowsToPurge: { battles: 360_000, financial_ledger: 1_000_000, standings: 4000 },
  imagesRetained: 30,
  imagesDeleted: 0,
};

const emptyHistory: SeasonRolloverHistory = { seasons: [], currentSeasonAttempts: [] };

const history: SeasonRolloverHistory = {
  seasons: [{
    seasonNumber: 0,
    isLegacy: true,
    startedAt: '2026-03-01T00:00:00.000Z',
    endedAt: '2026-07-29T14:33:00.000Z',
    competitiveCycles: 122,
    humanStableCount: 81,
    generatedStableCount: 200,
    rollover: {
      source: 'audit', id: 31, at: '2026-07-29T14:33:05.000Z', status: 'success', trigger: 'manual',
      triggeredBy: { userId: 1, username: 'robert' }, durationMs: 2289, error: null, failedStage: null, stages: null,
      result: { stablesArchived: 81, robotsArchived: 809, snapshotRows: 3650, accoladeRows: 304, generatedStablesDeleted: 200, totalRowsPurged: 2_125_614, durations: { archiveMs: 68, purgeMs: 1303, postMs: 473, totalMs: 2289 } },
    },
    failedAttempts: [
      { source: 'audit', id: 30, at: '2026-07-29T13:00:00.000Z', status: 'failed', trigger: 'manual', triggeredBy: { userId: 1, username: 'robert' }, durationMs: null, error: 'prisma is not defined', failedStage: null, stages: null, result: null },
    ],
  }],
  currentSeasonAttempts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetState.mockResolvedValue(competitive);
  mockGetPreview.mockResolvedValue(preview);
  mockGetHistory.mockResolvedValue(emptyHistory);
  mockStartRollover.mockResolvedValue({ id: 41, jobName: 'seasonRollover', status: 'queued', queuedAt: '2026-10-22T10:00:00.000Z' });
  mockExtend.mockResolvedValue(competitive);
  mockSetPrep.mockResolvedValue(preparing);
});

describe('SeasonControlPage', () => {
  it('shows the season timeline with estimated dates and the configuration', async () => {
    render(<SeasonControlPage />);

    expect(await screen.findByRole('heading', { name: 'Season 1' })).toBeInTheDocument();
    expect(screen.getByText('Cycle 82 of 100 · 19 remaining')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Competitive cycles completed' })).toHaveAttribute('aria-valuenow', '81');
    // 19 cycles left from the 23 Oct settlement: rollover 10 Nov, countdown from 3 Nov, Season 2 competitive 12 Nov.
    expect(screen.getByText('~10 Nov 00:00')).toBeInTheDocument();
    expect(screen.getByText('~3 Nov')).toBeInTheDocument();
    expect(screen.getByText('~12 Nov')).toBeInTheDocument();
    expect(screen.getByText('100 cycles')).toBeInTheDocument();
    expect(screen.getByText('last 7 cycles')).toBeInTheDocument();
  });

  it('shows no dates when automated scheduling is off, and explains Season 0', async () => {
    mockGetState.mockResolvedValue({ ...competitive, nextSettlementAt: null });
    const { unmount } = render(<SeasonControlPage />);
    expect(await screen.findByText(/No dates: automated scheduling is off/)).toBeInTheDocument();
    unmount();

    mockGetState.mockResolvedValue({ ...competitive, seasonNumber: 0, isLegacy: true, remainingCompetitiveCycles: 0 });
    render(<SeasonControlPage />);
    expect(await screen.findByRole('heading', { name: 'Season 0 (legacy)' })).toBeInTheDocument();
    expect(screen.getByText(/never rolls over by itself/)).toBeInTheDocument();
  });

  it('loads the preview on demand, by stable type and in groups', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await user.click(await screen.findByRole('button', { name: 'Preview rollover' }));

    expect(await screen.findByText('Human players')).toBeInTheDocument();
    expect(screen.getByText('Automatons')).toBeInTheDocument();
    expect(screen.getByText('Deleted; their results stay in the archive')).toBeInTheDocument();
    expect(screen.getByText('Battles and summaries')).toBeInTheDocument();
    expect(screen.getByText('Ledger, audit and snapshots')).toBeInTheDocument();
    expect(screen.getByText('1,000,000 rows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh preview' })).toBeInTheDocument();
  });

  it('starts a background rollover only after the phrase is typed', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await user.click(await screen.findByRole('button', { name: 'Roll over Season 1…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Roll over Season 1?' });
    // The preview is loaded for the dialog's counts.
    expect(await within(dialog).findByText('Deletes 3,483 generated stables and 9,000 robots.')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Roll over Season 1' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), 'CONFIRM_ROLLOVE');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), 'R');
    await user.click(confirm);

    expect(mockStartRollover).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/Season 1 rollover started/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open with the reason when the rollover is refused', async () => {
    mockStartRollover.mockRejectedValue(new ApiError('A season rollover is already queued or running', 'ROLLOVER_IN_PROGRESS', 409));
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await user.click(await screen.findByRole('button', { name: 'Roll over Season 1…' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/to confirm/), 'CONFIRM_ROLLOVER');
    await user.click(within(dialog).getByRole('button', { name: 'Roll over Season 1' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A season rollover is already queued or running');
  });

  it('follows a running rollover by stage and announces the outcome when it ends', async () => {
    mockGetState.mockResolvedValueOnce({
      ...competitive,
      rolloverInProgress: true,
      activeRollover: {
        runId: 41, status: 'running', trigger: 'manual', triggeredBy: { userId: 1, username: 'robert' }, queuedAt: null, startedAt: '2026-10-22T10:00:00.000Z',
        progress: {
          seasonNumber: 1, newSeasonNumber: null, generatedStables: { deleted: 1250, total: 3483 }, result: null,
          stages: [
            { stage: 'archive', status: 'done', startedAt: '2026-10-22T10:00:00.000Z', finishedAt: '2026-10-22T10:00:01.000Z', detail: '81 stables, 809 robots archived' },
            { stage: 'verify', status: 'done', startedAt: '2026-10-22T10:00:01.000Z', finishedAt: '2026-10-22T10:00:02.000Z', detail: 'Counts match' },
            { stage: 'purge', status: 'running', startedAt: '2026-10-22T10:00:02.000Z', finishedAt: null, detail: 'Generated stables 1,250 of 3,483' },
            { stage: 'post', status: 'pending', startedAt: null, finishedAt: null, detail: null },
            { stage: 'automaton', status: 'pending', startedAt: null, finishedAt: null, detail: null },
          ],
        },
      },
    });
    const user = userEvent.setup();
    render(<SeasonControlPage />);

    expect(await screen.findByRole('heading', { name: 'Rollover of Season 1 running' })).toBeInTheDocument();
    const stages = screen.getByRole('list', { name: 'Rollover stages' });
    expect(within(stages).getByText('3. Purge and reset')).toBeInTheDocument();
    expect(within(stages).getByText('Generated stables 1,250 of 3,483')).toBeInTheDocument();
    expect(within(stages).getByRole('progressbar', { name: 'Generated stables deleted' })).toHaveAttribute('aria-valuenow', '1250');
    expect(screen.getByText(/Started by robert/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Roll over Season/ })).not.toBeInTheDocument();

    // It finishes: the next state has no active rollover, and the history has the run.
    mockGetHistory.mockResolvedValue({
      seasons: [{ ...history.seasons[0], seasonNumber: 1, isLegacy: false, failedAttempts: [], rollover: { ...history.seasons[0].rollover!, source: 'run', id: 41, at: '2026-10-22T10:00:00.000Z', durationMs: 125_000 } }],
      currentSeasonAttempts: [],
    });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText(/Rollover complete in 2m 05s · 2,125,614 rows emptied/)).toBeInTheDocument();
  });

  it('lists completed seasons with their rollover and folded failed attempts', async () => {
    mockGetHistory.mockResolvedValue(history);
    const user = userEvent.setup();
    render(<SeasonControlPage />);

    expect(await screen.findByRole('heading', { name: 'Season 0 (legacy)' })).toBeInTheDocument();
    expect(screen.getByText(/Rolled over 29 Jul 14:33 UTC/)).toBeInTheDocument();
    expect(screen.getByText(/Admin · robert · 2s/)).toBeInTheDocument();
    await user.click(screen.getByText('1 failed attempt'));
    expect(screen.getByText('Failed: prisma is not defined')).toBeVisible();
  });

  it('extends the season after showing the effect', async () => {
    const user = userEvent.setup();
    render(<SeasonControlPage />);
    await user.click(await screen.findByRole('button', { name: /Testing tools/ }));
    const form = screen.getByRole('form', { name: 'Extend the season' });
    expect(within(form).getByText('100 → 105 cycles · rollover moves to ~15 Nov')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Extend…' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Extend' }));

    expect(mockExtend).toHaveBeenCalledWith(5);
    expect(await screen.findByText('Season 1 extended by 5 cycles.')).toBeInTheDocument();
  });

  it('only sets preparation cycles while preparing, within the configured window', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SeasonControlPage />);
    await user.click(await screen.findByRole('button', { name: /Testing tools/ }));
    expect(within(screen.getByRole('form', { name: 'Set remaining preparation cycles' })).getByRole('button', { name: 'Set…' })).toBeDisabled();
    unmount();

    mockGetState.mockResolvedValue(preparing);
    render(<SeasonControlPage />);
    await user.click(await screen.findByRole('button', { name: /Testing tools/ }));
    const form = screen.getByRole('form', { name: 'Set remaining preparation cycles' });
    const input = within(form).getByLabelText('Remaining (0–2)');
    await user.clear(input);
    await user.type(input, '3');
    await user.click(within(form).getByRole('button', { name: 'Set…' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('from 0 to 2');
    expect(mockSetPrep).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, '0');
    await user.click(within(form).getByRole('button', { name: 'Set…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set remaining preparation cycles to 0?' });
    expect(within(dialog).getByText('The competitive phase starts at the next settlement.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Set' }));
    await waitFor(() => expect(mockSetPrep).toHaveBeenCalledWith(0));
  });
});
