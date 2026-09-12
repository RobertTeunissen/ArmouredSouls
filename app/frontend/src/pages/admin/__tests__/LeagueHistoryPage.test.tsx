import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import LeagueHistoryPage from '../LeagueHistoryPage';

// Mock apiClient
vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Mock Recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

const mockEventsResponse = {
  data: [
    {
      id: 1,
      entityType: 'robot',
      entityId: 5,
      entityName: 'TestBot',
      changeType: 'promotion',
      mode: 'league_1v1',
      sourceTier: 'bronze',
      destinationTier: 'silver',
      leaguePoints: 120,
      cycleNumber: 10,
    },
    {
      id: 2,
      entityType: 'tag_team',
      entityId: 3,
      entityName: 'Team Alpha',
      changeType: 'demotion',
      mode: 'tag_team',
      sourceTier: 'gold',
      destinationTier: 'silver',
      leaguePoints: 30,
      cycleNumber: 12,
    },
  ],
  pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
};

const mockAggregatesResponse = [
  { mode: 'league_1v1', tier: 'silver', promotions: 5, demotions: 2 },
  { mode: 'league_2v2', tier: 'silver', promotions: 3, demotions: 4 },
  { mode: 'tag_team', tier: 'gold', promotions: 1, demotions: 1 },
];

const mockYoYoResponse = [
  {
    entityType: 'robot',
    entityId: 7,
    entityName: 'BouncyBot',
    mode: 'league_1v1',
    changeCount: 4,
    tiersInvolved: ['bronze', 'silver'],
  },
];

const mockEntityHistory = [mockEventsResponse.data[0]];

describe('LeagueHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/api/admin/league-history/entity/')) {
        return Promise.resolve({ data: { data: mockEntityHistory } });
      }
      if (url.includes('/api/admin/league-history/yo-yo')) {
        return Promise.resolve({ data: mockYoYoResponse });
      }
      if (url.includes('/api/admin/league-history/aggregates')) {
        return Promise.resolve({ data: mockAggregatesResponse });
      }
      if (url.includes('/api/admin/league-history')) {
        return Promise.resolve({ data: mockEventsResponse });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders summary cards', async () => {
    render(<LeagueHistoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
    });

    expect(screen.getByText('Promotions')).toBeInTheDocument();
    expect(screen.getByText('Demotions')).toBeInTheDocument();
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Yo-Yo Candidates')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    render(<LeagueHistoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('filter-controls')).toBeInTheDocument();
    });

    expect(screen.getByTestId('start-cycle-input')).toBeInTheDocument();
    expect(screen.getByTestId('end-cycle-input')).toBeInTheDocument();
    expect(screen.getByTestId('entity-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('mode-select')).toBeInTheDocument();
    expect(screen.getByTestId('apply-filters-btn')).toBeInTheDocument();
  });

  it('renders events table with data', async () => {
    render(<LeagueHistoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('events-table')).toBeInTheDocument();
    });

    expect(screen.getByText('TestBot')).toBeInTheDocument();
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('▲ Promotion')).toBeInTheDocument();
    expect(screen.getByText('▼ Demotion')).toBeInTheDocument();
    expect(within(screen.getByTestId('events-table')).getByText('1v1 League')).toBeInTheDocument();
  });

  it('renders yo-yo candidates section', async () => {
    render(<LeagueHistoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('yoyo-section')).toBeInTheDocument();
    });

    expect(screen.getByText('🔄 Yo-Yo Candidates')).toBeInTheDocument();
    expect(screen.getByText('BouncyBot')).toBeInTheDocument();
    expect(screen.getByText('4 changes')).toBeInTheDocument();
  });

  it('propagates mode filters and scopes a timeline to the clicked row mode', async () => {
    render(<LeagueHistoryPage />);

    await screen.findByText('TestBot');
    fireEvent.change(screen.getByTestId('mode-select'), { target: { value: 'league_2v2' } });

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history',
        expect.objectContaining({ params: expect.objectContaining({ mode: 'league_2v2' }) }),
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history/aggregates',
        expect.objectContaining({ params: expect.objectContaining({ mode: 'league_2v2' }) }),
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history/yo-yo',
        { params: { mode: 'league_2v2' } },
      );
    });

    fireEvent.click(screen.getByText('TestBot'));

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history/entity/robot/5',
        { params: { mode: 'league_1v1' } },
      );
    });
    expect(screen.getByText('TestBot — 1v1 League Timeline')).toBeInTheDocument();
  });

  it('loads legacy mode-less history when its row is selected', async () => {
    const legacyResponse = {
      data: [{
        ...mockEventsResponse.data[0],
        id: 3,
        entityName: 'LegacyBot',
        mode: null,
      }],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    };
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/api/admin/league-history/entity/')) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url.includes('/api/admin/league-history/yo-yo')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/admin/league-history/aggregates')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/admin/league-history')) {
        return Promise.resolve({ data: legacyResponse });
      }
      return Promise.resolve({ data: [] });
    });

    render(<LeagueHistoryPage />);
    fireEvent.click(await screen.findByText('LegacyBot'));

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history/entity/robot/5',
        { params: {} },
      );
    });
  });

  it('fetches data from correct API endpoints', async () => {
    render(<LeagueHistoryPage />);

    await waitFor(() => {
      // Main events endpoint with params
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history',
        expect.objectContaining({ params: expect.any(Object) }),
      );
      // Aggregates endpoint
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history/aggregates',
        expect.objectContaining({ params: expect.any(Object) }),
      );
      // Yo-yo endpoint receives an empty params object when all modes are selected.
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/admin/league-history/yo-yo',
        { params: {} },
      );
    });
  });
});
