/**
 * Unit tests for CycleControlsPage (`/admin/cycles`).
 *
 * Every one of the ten Run buttons: confirm → POST /api/admin/scheduler/runs
 * with that job → started message → overview refetched. Plus the status strip,
 * the missed-run banner, run history (filters, rows, paging), the bulk runner,
 * errors (409), the dialog's keyboard behaviour and polling. API shapes match
 * the backend contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CycleControlsPage from '../CycleControlsPage';
import type {
  SchedulerHistoryPage,
  SchedulerJobName,
  SchedulerOverview,
  SchedulerRun,
  SchedulerSlot,
} from '../../../utils/adminCycleApi';
import { SCHEDULER_JOB_NAMES } from '../../../utils/adminCycleApi';
import { jobLabel } from '../../../utils/adminCycleFormat';

type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();
const mockPost = vi.fn<(url: string, body?: unknown) => Promise<{ data: unknown }>>();

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: (url: string, config?: Config) => mockGet(url, config),
    post: (url: string, body?: unknown) => mockPost(url, body),
  },
}));

// ----------------------------------------------------------------
// Fixtures (the clock is 09:04 UTC on 23 Oct)
// ----------------------------------------------------------------
const NOW = new Date('2026-10-23T09:04:12.000Z');

const TIMES: Record<SchedulerJobName, string> = {
  settlement: '00:00', league: '08:00', team2v2League: '09:00', tournament: '10:00', tagTeam: '11:00',
  koth: '13:00', team3v3League: '14:00', team2v2Tournament: '15:00', grandMelee: '17:00', team3v3Tournament: '18:00',
};
const ORDER: SchedulerJobName[] = ['settlement', 'league', 'team2v2League', 'tournament', 'tagTeam', 'koth', 'team3v3League', 'team2v2Tournament', 'grandMelee', 'team3v3Tournament'];

function run(overrides: Partial<SchedulerRun> & Pick<SchedulerRun, 'id' | 'jobName'>): SchedulerRun {
  return {
    trigger: 'cron',
    triggeredBy: null,
    status: 'success',
    queuedAt: '2026-10-22T09:00:00.000Z',
    startedAt: '2026-10-22T09:00:00.000Z',
    finishedAt: '2026-10-22T09:13:17.000Z',
    durationMs: 797_000,
    summary: { matchesCompleted: 669 },
    error: null,
    ...overrides,
  };
}

function slot(jobName: SchedulerJobName, overrides: Partial<SchedulerSlot> = {}): SchedulerSlot {
  const [hh, mm] = TIMES[jobName].split(':');
  return {
    jobName,
    schedule: `${Number(mm)} ${Number(hh)} * * *`,
    time: TIMES[jobName],
    nextRunAt: null,
    lastRun: run({ id: ORDER.indexOf(jobName) + 100, jobName }),
    activeRun: null,
    ...overrides,
  };
}

function overview(overrides: Partial<SchedulerOverview> = {}): SchedulerOverview {
  return {
    scheduler: { active: true, process: { id: 7, startedAt: '2026-10-22T21:14:02.000Z', deployTag: 'deploy-acc-20261022-211402' } },
    season: { number: 1, phase: 'competitive', seasonCycle: 82 },
    cycle: { number: 82 },
    running: null,
    queue: [],
    next: { jobName: 'team2v2League', at: '2026-10-23T09:00:00.000Z' },
    slots: ORDER.map((name) => slot(name)),
    missed: { windowDays: 7, runs: [] },
    timestamp: NOW.toISOString(),
    ...overrides,
  };
}

const RUNNING_LEAGUE = run({ id: 900, jobName: 'league', status: 'running', startedAt: '2026-10-23T09:00:00.000Z', queuedAt: '2026-10-23T09:00:00.000Z', finishedAt: null, durationMs: null, summary: null });

function busyOverview(): SchedulerOverview {
  return overview({
    running: RUNNING_LEAGUE,
    slots: ORDER.map((name) => (name === 'league' ? slot(name, { activeRun: RUNNING_LEAGUE }) : slot(name))),
  });
}

const historyPage = (overrides: Partial<SchedulerHistoryPage> = {}): SchedulerHistoryPage => ({
  entries: [
    { kind: 'run', at: '2026-10-23T00:00:00.000Z', run: run({ id: 1, jobName: 'settlement', startedAt: '2026-10-23T00:00:00.000Z', durationMs: 995_000, summary: { cycleNumber: 81 } }) },
    { kind: 'restart', at: '2026-10-22T21:14:02.000Z', restart: { processId: 7, deployTag: 'deploy-acc-20261022-211402', schedulerEnabled: true, downSince: '2026-10-22T21:12:00.000Z' } },
    { kind: 'missed', at: '2026-10-21T18:00:00.000Z', missed: { jobName: 'team3v3Tournament', expectedAt: '2026-10-21T18:00:00.000Z', downtime: { from: '2026-10-21T17:58:00.000Z', to: '2026-10-21T18:03:00.000Z' } } },
    { kind: 'run', at: '2026-10-21T17:00:00.000Z', run: run({ id: 2, jobName: 'grandMelee', status: 'interrupted', startedAt: '2026-10-21T17:00:00.000Z', durationMs: 3_492_000, summary: null, error: 'The backend stopped before the run finished' }) },
    { kind: 'run', at: '2026-10-21T18:06:00.000Z', run: run({ id: 3, jobName: 'team3v3Tournament', trigger: 'manual', triggeredBy: { userId: 1, username: 'Robert' }, startedAt: '2026-10-21T18:06:00.000Z', durationMs: 220_000, summary: { tournamentRound: 1, tournamentMaxRounds: 9, matchesCompleted: 256 } }) },
  ],
  page: 1,
  limit: 25,
  total: 5,
  windowDays: 7,
  ...overrides,
});

let currentOverview: SchedulerOverview;

function routeApi(): void {
  mockGet.mockImplementation((url) => {
    if (url === '/api/admin/scheduler/overview') return Promise.resolve({ data: currentOverview });
    if (url === '/api/admin/scheduler/runs') return Promise.resolve({ data: historyPage() });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  mockPost.mockImplementation((url, body) => {
    if (url === '/api/admin/scheduler/runs') {
      const { jobName } = body as { jobName: string };
      return Promise.resolve({ data: { run: { id: 501, jobName, status: 'queued', queuedAt: NOW.toISOString() } } });
    }
    if (url === '/api/admin/cycles/bulk') {
      return Promise.resolve({ data: { run: { id: 502, jobName: 'bulkCycles', status: 'queued', queuedAt: NOW.toISOString() } } });
    }
    return Promise.reject(new Error(`unexpected POST ${url}`));
  });
}

const getCalls = (url: string) => mockGet.mock.calls.filter(([called]) => called === url);

function scheduleTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Scheduler slots with their last run' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  currentOverview = overview();
  routeApi();
});

afterEach(() => {
  vi.useRealTimers();
});

const setupUser = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------
describe('CycleControlsPage — status', () => {
  it('shows season, scheduler uptime, nothing running, empty queue and the next slot', async () => {
    render(<CycleControlsPage />);

    const strip = await screen.findByRole('region', { name: 'Scheduler status' });
    expect(within(strip).getByText('S1 · Cycle 82')).toBeInTheDocument();
    expect(within(strip).getByText('Competitive · day 82')).toBeInTheDocument();
    expect(within(strip).getByText('Active')).toBeInTheDocument();
    expect(within(strip).getByText('Up since Yesterday 21:14 (deploy-acc-20261022-211402)')).toBeInTheDocument();
    expect(within(strip).getByText('Nothing')).toBeInTheDocument();
    expect(within(strip).getByText('Empty')).toBeInTheDocument();
    expect(within(strip).getByText('League 2v2')).toBeInTheDocument();
    expect(screen.getByText('Last updated 09:04:12 UTC')).toBeInTheDocument();
  });

  it('shows the running job with its elapsed time, and the row reads Running instead of a Run button', async () => {
    currentOverview = busyOverview();
    render(<CycleControlsPage />);

    const strip = await screen.findByRole('region', { name: 'Scheduler status' });
    expect(within(strip).getByText('League 1v1')).toBeInTheDocument();
    expect(within(strip).getByText('Started 09:00 · 4m 12s so far')).toBeInTheDocument();
    expect(within(strip).getByText('09:00 · after the running job')).toBeInTheDocument();

    const row = within(scheduleTable()).getByRole('rowheader', { name: 'League 1v1' }).closest('tr')!;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(within(row).getAllByText('Running').length).toBeGreaterThan(0);
    expect(within(row).getByText('4m 12s…')).toBeInTheDocument();
  });

  it('lists the slots in time order with last run, duration and result', async () => {
    render(<CycleControlsPage />);
    const table = await screen.findByRole('table', { name: 'Scheduler slots with their last run' });

    const jobs = within(table).getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(jobs).toEqual(ORDER.map((name) => jobLabel(name)));
    const row = within(table).getByRole('rowheader', { name: 'League 2v2' }).closest('tr')!;
    expect(row).toHaveTextContent('09:00');
    expect(row).toHaveTextContent('Yesterday 09:00 · Cron');
    expect(row).toHaveTextContent('Success');
    expect(row).toHaveTextContent('13m 17s');
    expect(row).toHaveTextContent('669 battles');
  });

  it('warns about missed runs and jumps to the problems in history', async () => {
    currentOverview = overview({
      missed: { windowDays: 7, runs: [{ jobName: 'team3v3Tournament', expectedAt: '2026-10-21T18:00:00.000Z', downtime: { from: '2026-10-21T17:58:00.000Z', to: '2026-10-21T18:03:00.000Z' } }] },
    });
    const user = setupUser();
    render(<CycleControlsPage />);

    const banner = await screen.findByRole('region', { name: 'Missed runs' });
    expect(banner).toHaveTextContent('1 missed run in the last 7 days');
    expect(banner).toHaveTextContent('Tournament 3v3 on 21 Oct 18:00 · backend down 17:58–18:03');

    Element.prototype.scrollIntoView = vi.fn();
    await user.click(within(banner).getByRole('button', { name: /Show in history/ }));
    await waitFor(() => expect(getCalls('/api/admin/scheduler/runs').at(-1)?.[1]?.params).toMatchObject({ problemsOnly: 'true', days: 7 }));
  });
});

describe('CycleControlsPage — every Run button', () => {
  it('offers exactly one Run button per scheduler job', async () => {
    render(<CycleControlsPage />);
    const table = await screen.findByRole('table', { name: 'Scheduler slots with their last run' });

    const buttons = within(table).getAllByRole('button', { name: /^Run .* now$/ });
    expect(buttons.map((button) => button.getAttribute('aria-label')).sort())
      .toEqual(SCHEDULER_JOB_NAMES.map((name) => `Run ${jobLabel(name)} now`).sort());
  });

  for (const jobName of SCHEDULER_JOB_NAMES) {
    it(`runs ${jobName}: confirm, POST /scheduler/runs, started message, overview refreshed`, async () => {
      const user = setupUser();
      render(<CycleControlsPage />);
      const table = await screen.findByRole('table', { name: 'Scheduler slots with their last run' });
      const overviewCallsBefore = getCalls('/api/admin/scheduler/overview').length;

      await user.click(within(table).getByRole('button', { name: `Run ${jobLabel(jobName)} now` }));
      const dialog = screen.getByRole('dialog', { name: `Run ${jobLabel(jobName)} now?` });
      expect(dialog).toHaveTextContent('as the');
      expect(mockPost).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: 'Run now' }));

      expect(mockPost).toHaveBeenCalledWith('/api/admin/scheduler/runs', { jobName });
      expect(await screen.findByRole('status')).toHaveTextContent(`${jobLabel(jobName)} started.`);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(getCalls('/api/admin/scheduler/overview').length).toBeGreaterThan(overviewCallsBefore));
    });
  }

  it('shows why a run did not start (409), and closes the dialog', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { error: 'koth is already queued or running', code: 'SCHEDULER_JOB_ALREADY_ACTIVE' } } });
    const user = setupUser();
    render(<CycleControlsPage />);
    const table = await screen.findByRole('table', { name: 'Scheduler slots with their last run' });

    await user.click(within(table).getByRole('button', { name: 'Run King of the Hill now' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Run now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('King of the Hill did not start: koth is already queued or running');
  });

  it('cancels with Escape and returns focus to the Run button', async () => {
    const user = setupUser();
    render(<CycleControlsPage />);
    const table = await screen.findByRole('table', { name: 'Scheduler slots with their last run' });
    const button = within(table).getByRole('button', { name: 'Run Grand Melee now' });

    await user.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('marks settlement as the consequential action in its dialog', async () => {
    const user = setupUser();
    render(<CycleControlsPage />);
    const table = await screen.findByRole('table', { name: 'Scheduler slots with their last run' });

    await user.click(within(table).getByRole('button', { name: 'Run Settlement now' }));
    const dialog = screen.getByRole('dialog', { name: 'Run Settlement now?' });
    expect(dialog).toHaveTextContent('Closes the current cycle for every stable');
    expect(within(dialog).getByRole('button', { name: 'Run now' }).className).toContain('bg-red-700');
  });
});

describe('CycleControlsPage — run history', () => {
  it('shows runs, the restart marker and the missed run with their details', async () => {
    render(<CycleControlsPage />);
    const table = await screen.findByRole('table', { name: 'Scheduler runs, restarts and missed runs, newest first' });

    const restart = within(table).getByRole('rowheader', { name: '↻ Backend restarted' }).closest('tr')!;
    expect(restart).toHaveTextContent('deploy-acc-20261022-211402');
    expect(restart).toHaveTextContent('Down 21:12–21:14');

    const missed = within(table).getAllByRole('rowheader', { name: 'Tournament 3v3' }).map((cell) => cell.closest('tr')!);
    expect(missed.some((row) => /Missed/.test(row.textContent ?? '') && /backend down 17:58–18:03/.test(row.textContent ?? ''))).toBe(true);
    expect(missed.some((row) => /Manual · Robert/.test(row.textContent ?? '') && /Round 1\/9 · 256 matches/.test(row.textContent ?? ''))).toBe(true);

    const interrupted = within(table).getByRole('rowheader', { name: 'Grand Melee' }).closest('tr')!;
    expect(interrupted).toHaveTextContent('Interrupted');
    expect(interrupted).toHaveTextContent('58m 12s');
    expect(interrupted).toHaveTextContent('The backend stopped before the run finished');
  });

  it('refetches with the chosen filters', async () => {
    const user = setupUser();
    render(<CycleControlsPage />);
    await screen.findByRole('table', { name: 'Scheduler runs, restarts and missed runs, newest first' });

    await user.selectOptions(screen.getByLabelText('Job'), 'grandMelee');
    await waitFor(() => expect(getCalls('/api/admin/scheduler/runs').at(-1)?.[1]?.params).toMatchObject({ jobName: 'grandMelee', page: 1 }));

    await user.click(screen.getByRole('button', { name: 'Problems only' }));
    await waitFor(() => expect(getCalls('/api/admin/scheduler/runs').at(-1)?.[1]?.params).toMatchObject({ jobName: 'grandMelee', problemsOnly: 'true' }));
    expect(screen.getByRole('button', { name: 'Problems only' })).toHaveAttribute('aria-pressed', 'true');

    await user.selectOptions(screen.getByLabelText('Period'), '30');
    await waitFor(() => expect(getCalls('/api/admin/scheduler/runs').at(-1)?.[1]?.params).toMatchObject({ days: 30 }));
  });

  it('pages through long histories', async () => {
    mockGet.mockImplementation((url, config) => {
      if (url === '/api/admin/scheduler/overview') return Promise.resolve({ data: currentOverview });
      return Promise.resolve({ data: historyPage({ total: 60, page: Number(config?.params?.page ?? 1) }) });
    });
    const user = setupUser();
    render(<CycleControlsPage />);
    await screen.findByText('1–25 of 60 entries');

    await user.click(screen.getByRole('button', { name: 'Next page of entries' }));
    await waitFor(() => expect(getCalls('/api/admin/scheduler/runs').at(-1)?.[1]?.params).toMatchObject({ page: 2 }));
  });
});

describe('CycleControlsPage — bulk runner', () => {
  it('starts bulk cycles in the background with the chosen options (stable generation off by default)', async () => {
    const user = setupUser();
    render(<CycleControlsPage />);
    await screen.findByRole('table', { name: 'Scheduler slots with their last run' });

    const toggle = screen.getByRole('button', { name: /Testing tools/ });
    // Ten slots whose last run took 13m 17s each.
    expect(toggle).toHaveTextContent('About 2h 12m per cycle here.');
    await user.click(toggle);

    expect(screen.getByRole('checkbox', { name: 'Generate stables each cycle' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Finances' })).toBeChecked();
    await user.clear(screen.getByLabelText('Cycles'));
    await user.type(screen.getByLabelText('Cycles'), '2');
    await user.click(screen.getByRole('checkbox', { name: 'King of the Hill' }));
    expect(screen.getByText('Estimated 4h 25m for 2 cycles.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run 2 cycles…' }));

    const dialog = screen.getByRole('dialog', { name: 'Run 2 bulk cycles?' });
    expect(dialog).toHaveTextContent('no stable generation, tournaments, no KotH, finances');
    await user.click(within(dialog).getByRole('button', { name: 'Start bulk run' }));

    expect(mockPost).toHaveBeenCalledWith('/api/admin/cycles/bulk', {
      cycles: 2, generateUsersPerCycle: false, includeTournaments: true, includeKoth: false, includeDailyFinances: true, background: true,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Bulk cycles started.');
  });

  it('rejects an out-of-range cycle count without starting anything', async () => {
    const user = setupUser();
    render(<CycleControlsPage />);
    await screen.findByRole('table', { name: 'Scheduler slots with their last run' });
    await user.click(screen.getByRole('button', { name: /Testing tools/ }));

    await user.clear(screen.getByLabelText('Cycles'));
    await user.type(screen.getByLabelText('Cycles'), '101');
    await user.click(screen.getByRole('button', { name: /Run .*cycle/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 1 to 100.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an active bulk run instead of the form', async () => {
    const bulk = run({ id: 77, jobName: 'bulkCycles', trigger: 'bulk', status: 'running', startedAt: '2026-10-23T08:34:12.000Z', finishedAt: null, durationMs: null, summary: null });
    currentOverview = overview({ running: bulk });
    const user = setupUser();
    render(<CycleControlsPage />);
    await screen.findByRole('table', { name: 'Scheduler slots with their last run' });
    await user.click(screen.getByRole('button', { name: /Testing tools/ }));

    expect(screen.getByText(/Bulk run running for 30m 00s/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Cycles')).not.toBeInTheDocument();
  });
});

describe('CycleControlsPage — polling', () => {
  it('polls every 10 s while a job runs', async () => {
    currentOverview = busyOverview();
    render(<CycleControlsPage />);
    await screen.findByRole('table', { name: 'Scheduler slots with their last run' });
    expect(getCalls('/api/admin/scheduler/overview')).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await waitFor(() => expect(getCalls('/api/admin/scheduler/overview')).toHaveLength(2));
  });

  it('polls every 60 s when idle, and refreshes history when a run finishes', async () => {
    render(<CycleControlsPage />);
    await screen.findByRole('table', { name: 'Scheduler slots with their last run' });
    const historyCalls = getCalls('/api/admin/scheduler/runs').length;

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getCalls('/api/admin/scheduler/overview')).toHaveLength(1);

    currentOverview = busyOverview();
    await act(async () => { await vi.advanceTimersByTimeAsync(50_000); });
    await waitFor(() => expect(getCalls('/api/admin/scheduler/overview')).toHaveLength(2));
    // A run started: history follows.
    await waitFor(() => expect(getCalls('/api/admin/scheduler/runs').length).toBeGreaterThan(historyCalls));
  });

  it('shows an error with the status strip when the overview fails', async () => {
    mockGet.mockImplementation((url) => (url === '/api/admin/scheduler/overview'
      ? Promise.reject({ response: { status: 500, data: { error: 'Scheduler status failed', code: 'INTERNAL_ERROR' } } })
      : Promise.resolve({ data: historyPage() })));
    render(<CycleControlsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Scheduler status failed');
  });
});
