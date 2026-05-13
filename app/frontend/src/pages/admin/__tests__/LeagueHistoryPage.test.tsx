import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      sourceTier: 'gold',
      destinationTier: 'silver',
      leaguePoints: 30,
      cycleNumber: 12,
    },
  ],
  pagination: { page: 1, perPage: 50, total: 2, totalPages: 1 },
};

const mockAggregatesResponse = [
  { tier: 'bronze', promotions: 5, demotions: 2 },
  { tier: 'silver', promotions: 3, demotions: 4 },
  { tier: 'gold', promotions: 1, demotions: 1 },
];

const mockYoYoResponse = [
  {
    entityType: 'robot',
    entityId: 7,
    entityName: 'BouncyBot',
    changeCount: 4,
    tiersInvolved: ['bronze', 'silver'],
  },
];

describe('LeagueHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.get.mockImplementation((url: string) => {
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

  it('fetches data from correct API endpoints', async () => {
    render(<LeagueHistoryPage />);

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/league-history?')
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/league-history/aggregates')
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/admin/league-history/yo-yo');
    });
  });
});
