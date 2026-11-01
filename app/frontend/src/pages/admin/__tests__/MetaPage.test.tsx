/**
 * Unit tests for the admin MetaPage (`/admin/meta`): the three groups;
 * compact stances, loadouts, yield thresholds and facilities; the build
 * sections merged in from the old Tuning, Refinement and Subscriptions pages;
 * the shared URL filter; refresh; errors with retry (per request); and the
 * stale-response race on a filter change.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MetaPage from '../MetaPage';
import type { SystemStats } from '../../../components/admin/types';
import type { MetaBuilds } from '../../../utils/adminMetaApi';

type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();

vi.mock('../../../utils/apiClient', () => ({
  default: { get: (url: string, config?: Config) => mockGet(url, config) },
}));

const stats = (overrides: Partial<SystemStats> = {}): SystemStats => ({
  robots: { total: 144, byTier: [], battleReady: 124, battleReadyPercentage: 86.1 },
  matches: { scheduled: 0, completed: 0 },
  battles: { last24Hours: 0, total: 0, draws: 0, drawPercentage: 0, avgDuration: 0, kills: 0, killPercentage: 0 },
  finances: { totalCredits: 0, avgBalance: 0, usersAtRisk: 0, totalUsers: 52 },
  facilities: {
    summary: [
      { type: 'repair_bay', purchaseCount: 30, avgLevel: 2.5 },
      { type: 'training_facility', purchaseCount: 45, avgLevel: 3.25 },
    ],
    totalPurchases: 75,
    mostPopular: 'training_facility',
  },
  weapons: { totalBought: 200, equipped: 120, equippedInventoryItems: 150 },
  stances: [{ stance: 'offensive', count: 60 }, { stance: 'defensive', count: 40 }],
  loadouts: [{ type: 'weapon_shield', count: 70 }, { type: 'dual_wield', count: 30 }],
  yieldThresholds: {
    distribution: [
      { threshold: 0, count: 10 },
      { threshold: 10, count: 50 },
      { threshold: 15, count: 20 },
      { threshold: 30, count: 20 },
    ],
    mostCommon: 10,
    mostCommonCount: 50,
  },
  ...overrides,
});

const attributes = [
  'combatPower', 'attackSpeed', 'shieldCapacity', 'servoMotors', 'armorPlating', 'hullIntegrity', 'targetingSystems',
  'weaponControl', 'counterProtocols', 'hydraulicSystems', 'penetration', 'syncProtocols',
].map((attribute, index) => ({ attribute, group: 'combat' as const, points: 120 - index * 10, robots: 12 - index }));

const builds = (overrides: Partial<MetaBuilds> = {}): MetaBuilds => ({
  tuning: {
    totalRobots: 98, robotsTuned: 96, poolUsed: 3670, poolTotal: 3670,
    byGroup: [
      { group: 'combat', points: 1682 }, { group: 'defence', points: 1047 }, { group: 'chassis', points: 873 },
      { group: 'ai', points: 40 }, { group: 'team', points: 28 },
    ],
    attributes,
  },
  refinements: {
    stables: 26, stablesRefining: 13, refinements: 171, weaponsRefined: 50, creditsSpent: 85_200_000,
    perKind: [
      { kind: 'hone', refinements: 45, stables: 11, credits: 9_770_000 },
      { kind: 'augment', refinements: 21, stables: 2, credits: 10_500_000 },
      { kind: 'sharpen', refinements: 61, stables: 10, credits: 32_100_000 },
      { kind: 'forge', refinements: 44, stables: 5, credits: 32_800_000 },
    ],
    targeted: [{ attribute: 'attackSpeed', refinements: 30, magnitude: 148 }],
    topSpenders: [{ userId: 206, stableName: 'Iron House', username: 'iron', credits: 30_450_000, weapons: 12 }],
  },
  eventEntry: {
    totalRobots: 98, robotsEntered: 97, averageEvents: 7.5,
    perEvent: [{ eventType: 'league_1v1', robots: 91 }, { eventType: 'koth', robots: 89 }],
    eventsPerRobot: [{ events: 0, robots: 1 }, { events: 1, robots: 0 }, { events: 2, robots: 97 }],
  },
  ...overrides,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/meta${search}`]}>
      <Routes>
        <Route path="/admin/meta" element={<><MetaPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const statsCalls = () => mockGet.mock.calls.filter(([url]) => url === '/api/admin/stats');
const buildsCalls = () => mockGet.mock.calls.filter(([url]) => url === '/api/admin/meta/builds');

function respond(statsData: SystemStats = stats(), buildsData: MetaBuilds = builds()) {
  mockGet.mockImplementation((url) => {
    if (url === '/api/admin/stats') return Promise.resolve({ data: statsData });
    if (url === '/api/admin/meta/builds') return Promise.resolve({ data: buildsData });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  respond();
});

describe('MetaPage', () => {
  it('shows stances and loadouts as shares, largest first, for real players by default', async () => {
    renderPage();

    const stances = await screen.findByRole('region', { name: 'Stances' });
    expect(statsCalls()[0]?.[1]?.params).toEqual({ filter: 'real' });
    expect(within(stances).getByText('100 robots')).toBeInTheDocument();
    const items = within(stances).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Offensive60.0%60');
    expect(items[1]).toHaveTextContent('Defensive40.0%40');

    const loadouts = screen.getByRole('region', { name: 'Loadouts' });
    expect(within(loadouts).getByText('Weapon shield')).toBeInTheDocument();
    expect(within(loadouts).getByText('70.0%')).toBeInTheDocument();
  });

  it('summarises yield thresholds in one chart with the exact numbers in a table', async () => {
    renderPage();

    const yieldPanel = await screen.findByRole('region', { name: 'Yield thresholds' });
    expect(within(yieldPanel).getByText('Most common').nextElementSibling).toHaveTextContent('10% (50.0%)');
    expect(within(yieldPanel).getByText('Median').nextElementSibling).toHaveTextContent('10%');
    expect(within(yieldPanel).getByText('Above 20%').nextElementSibling).toHaveTextContent('20 (20.0%)');

    const table = within(yieldPanel).getByRole('table', { name: 'Robots per yield threshold' });
    expect(within(table).getAllByRole('row')).toHaveLength(5); // header + 4 thresholds in use
    expect(within(table).getByRole('rowheader', { name: '30%' })).toBeInTheDocument();
  });

  it('groups the sections under Combat settings, Robot builds and Stable investments', async () => {
    renderPage();

    const combat = await screen.findByRole('region', { name: 'Combat settings' });
    expect(within(combat).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Stances', 'Loadouts', 'Yield thresholds']);
    const buildsGroup = screen.getByRole('region', { name: 'Robot builds' });
    expect(within(buildsGroup).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Tuning', 'Weapons and refinements']);
    const investments = screen.getByRole('region', { name: 'Stable investments' });
    expect(within(investments).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Event entry', 'Facilities']);
  });

  it('lists facilities by stables owning them and shows weapons owned and equipped', async () => {
    renderPage();

    const facilities = await screen.findByRole('region', { name: 'Facilities' });
    const rows = within(within(facilities).getByRole('list', { name: /Stables owning each facility/ })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Training facility45 stables, average levelL3.3');
    expect(rows[1]).toHaveTextContent('Repair bay30 stables, average levelL2.5');

    const weapons = screen.getByRole('region', { name: 'Weapons and refinements' });
    expect(within(weapons).getByText('equipped (75%)').nextElementSibling).toHaveTextContent('150'); // offhands included
    expect(within(weapons).getByText('owned').nextElementSibling).toHaveTextContent('200');
    expect(within(weapons).getByRole('link', { name: /Weapons →/ })).toHaveAttribute('href', '/admin/weapons');
  });

  it('shows tuning adoption, pool use, points by group and the top 10 attributes, with all on request', async () => {
    const user = userEvent.setup();
    renderPage();

    const tuning = await screen.findByRole('region', { name: 'Tuning' });
    expect(buildsCalls()[0]?.[1]?.params).toEqual({ filter: 'real' });
    expect(within(tuning).getByText('robots tuned').nextElementSibling).toHaveTextContent('96 of 98');
    expect(within(tuning).getByText('of the pool used · 3,670 of 3,670 pts').nextElementSibling).toHaveTextContent('100%');
    const groups = within(within(tuning).getByRole('list', { name: 'Tuning points by attribute group' })).getAllByRole('listitem');
    expect(groups[0]).toHaveTextContent('Combat1,682 (46%)');
    expect(groups).toHaveLength(5);

    const list = () => within(within(tuning).getByRole('list', { name: 'Tuning points per attribute' })).getAllByRole('listitem');
    expect(list()).toHaveLength(10);
    expect(list()[0]).toHaveTextContent('Combat Power120 points on 12 robots');
    await user.click(within(tuning).getByRole('button', { name: 'Show all 12 tuned attributes' }));
    expect(list()).toHaveLength(12);
    expect(within(tuning).getByRole('button', { name: 'Show top 10' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows refinements per kind, targeted attributes and top spenders linking to the Players panel', async () => {
    renderPage();

    const weapons = await screen.findByRole('region', { name: 'Weapons and refinements' });
    await within(weapons).findByText('Refinements per kind');
    expect(within(weapons).getByText('refined (25%)').nextElementSibling).toHaveTextContent('50'); // 50 of 200 owned
    expect(within(weapons).getByText('stables refine').nextElementSibling).toHaveTextContent('13 of 26');
    expect(within(weapons).getByText('spent on refinements').nextElementSibling).toHaveTextContent('₡85.2M');

    const kinds = within(weapons).getAllByRole('row').slice(1);
    expect(kinds.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Hone'), expect.stringContaining('Augment'), expect.stringContaining('Sharpen'), expect.stringContaining('Forge'),
    ]);
    expect(kinds[2]).toHaveTextContent('Sharpen−10% cooldown6110₡32.1M');
    expect(within(within(weapons).getByRole('list', { name: 'Attributes targeted by Hone and Augment' })).getByRole('listitem')).toHaveTextContent('Attack Speed30×+148 total');
    expect(within(weapons).getByRole('link', { name: 'Iron House' })).toHaveAttribute('href', '/admin/players?user=206');
  });

  it('shows event entry per event and the events-per-robot histogram', async () => {
    renderPage();

    const entry = await screen.findByRole('region', { name: 'Event entry' });
    expect(within(entry).getByText('robots entered in at least one event').nextElementSibling).toHaveTextContent('97 of 98');
    expect(within(entry).getByText('events per robot (average)').nextElementSibling).toHaveTextContent('7.5');
    const events = within(within(entry).getByRole('list', { name: 'Robots entered per event' })).getAllByRole('listitem');
    expect(events[0]).toHaveTextContent('1v1 League91 robots, 93%');
    expect(events[1]).toHaveTextContent('King of the Hill89 robots, 91%');
    const histogram = within(entry).getByRole('table', { name: 'Robots by number of events entered' });
    expect(within(histogram).getByRole('rowheader', { name: '2' }).nextElementSibling).toHaveTextContent('97');
    expect(within(entry).getByText('Robots by events entered (2 = all)')).toBeInTheDocument();
  });

  it('keeps the choice sections when only the build sections fail, and retries them', async () => {
    const user = userEvent.setup();
    let failBuilds = true;
    mockGet.mockImplementation((url) => {
      if (url === '/api/admin/stats') return Promise.resolve({ data: stats() });
      if (failBuilds) return Promise.reject({ response: { status: 500, data: { error: 'Builds failed', code: 'INTERNAL' } } });
      return Promise.resolve({ data: builds() });
    });
    renderPage();

    const tuning = await screen.findByRole('region', { name: 'Tuning' });
    expect(await within(tuning).findByRole('alert')).toHaveTextContent('Builds failed');
    expect(screen.getByRole('region', { name: 'Stances' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Weapons and refinements' })).getByText('owned')).toBeInTheDocument();

    failBuilds = false;
    await user.click(within(tuning).getByRole('button', { name: 'Retry' }));
    expect(await within(tuning).findByText('robots tuned')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('keeps the filter in the URL, shared with the dashboard', async () => {
    const user = userEvent.setup();
    renderPage('?filter=all');
    await screen.findByRole('region', { name: 'Stances' });
    expect(statsCalls()[0]?.[1]?.params).toEqual({ filter: 'all' });

    expect(buildsCalls()[0]?.[1]?.params).toEqual({ filter: 'all' });

    await user.click(screen.getByRole('button', { name: /Automatons/ }));
    await waitFor(() => expect(statsCalls().at(-1)?.[1]?.params).toEqual({ filter: 'automaton' }));
    expect(buildsCalls().at(-1)?.[1]?.params).toEqual({ filter: 'automaton' });
    expect(screen.getByTestId('location')).toHaveTextContent('?filter=automaton');

    await user.click(screen.getByRole('button', { name: /Real players/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^$/));
  });

  it('shows an error with Retry, and Refresh refetches', async () => {
    const user = userEvent.setup();
    let failStats = true;
    mockGet.mockImplementation((url) => {
      if (url === '/api/admin/meta/builds') return Promise.resolve({ data: builds() });
      if (failStats) {
        failStats = false;
        return Promise.reject({ response: { status: 500, data: { error: 'Stats failed', code: 'INTERNAL' } } });
      }
      return Promise.resolve({ data: stats() });
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Stats failed');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Stances' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(statsCalls()).toHaveLength(3));
    expect(buildsCalls()).toHaveLength(2); // Refresh reloads the build sections too
  });

  it('keeps the current filter when an old response arrives late', async () => {
    const user = userEvent.setup();
    let resolveReal: (value: { data: SystemStats }) => void = () => undefined;
    mockGet.mockImplementation((url, config) => {
      if (url === '/api/admin/meta/builds') return Promise.resolve({ data: builds() });
      return config?.params?.filter === 'real'
        ? new Promise((resolve) => { resolveReal = resolve; })
        : Promise.resolve({ data: stats({ stances: [{ stance: 'balanced', count: 9 }] }) });
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: /Auto-generated/ }));
    expect(await screen.findByText('Balanced')).toBeInTheDocument();

    resolveReal({ data: stats() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.queryByText('Offensive')).not.toBeInTheDocument();
    expect(statsCalls()[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('says so when the filter has no robots', async () => {
    const empty = builds();
    respond(
      stats({
        stances: [],
        loadouts: [],
        yieldThresholds: { distribution: [], mostCommon: 10, mostCommonCount: 0 },
        facilities: { summary: [], totalPurchases: 0, mostPopular: '' },
        weapons: { totalBought: 0, equipped: 0, equippedInventoryItems: 0 },
      }),
      {
        tuning: { ...empty.tuning, totalRobots: 0, robotsTuned: 0, poolUsed: 0, poolTotal: 0, attributes: [] },
        refinements: { ...empty.refinements, stables: 0, stablesRefining: 0, refinements: 0, weaponsRefined: 0, creditsSpent: 0, targeted: [], topSpenders: [] },
        eventEntry: { ...empty.eventEntry, totalRobots: 0, robotsEntered: 0, averageEvents: 0 },
      },
    );
    renderPage('?filter=automaton');

    const stances = await screen.findByRole('region', { name: 'Stances' });
    expect(within(stances).getByText('No robots')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Yield thresholds' })).getByText('No robots')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Facilities' })).getByText('No facilities owned yet')).toBeInTheDocument();
    expect(await within(screen.getByRole('region', { name: 'Tuning' })).findByText('No robots')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Event entry' })).getByText('No robots')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Weapons and refinements' })).getByText('No refinements bought')).toBeInTheDocument();
  });
});
