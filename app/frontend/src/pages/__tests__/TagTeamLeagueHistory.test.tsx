/**
 * Tests for the Tag Team League History expandable section.
 * Tests the LeagueTimeline component integration with tag team data fetching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeagueTimeline from '../../components/LeagueTimeline';
import type { LeagueHistoryEntry } from '../../components/LeagueTimeline';

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
}));

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import apiClient from '../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/**
 * Simulates the TagTeamLeagueHistory expandable section behavior.
 * This tests the same logic used in TagTeamManagementPage's expandable section.
 */
function TagTeamLeagueHistoryTestWrapper({ teamId, currentTier }: { teamId: number; currentTier: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const [history, setHistory] = React.useState<LeagueHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [fetched, setFetched] = React.useState(false);

  const handleToggle = () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    if (willExpand && !fetched) {
      setLoading(true);
      apiClient
        .get(`/api/tag-teams/${teamId}/league-history`)
        .then((res) => {
          const data = (res as { data: { data?: LeagueHistoryEntry[] } }).data.data || (res as { data: LeagueHistoryEntry[] }).data;
          setHistory(
            (data as Array<{ cycleNumber: number; destinationTier: string; changeType: string; leaguePoints: number }>).map((r) => ({
              cycleNumber: r.cycleNumber,
              destinationTier: r.destinationTier,
              changeType: r.changeType as 'promotion' | 'demotion',
              leaguePoints: r.leaguePoints,
            }))
          );
        })
        .catch(() => {
          setHistory([]);
        })
        .finally(() => {
          setLoading(false);
          setFetched(true);
        });
    }
  };

  return (
    <div data-testid="tag-team-league-history">
      <button
        type="button"
        onClick={handleToggle}
        data-testid="league-history-toggle"
      >
        🏆 League History
      </button>

      {expanded && (
        <div data-testid="league-history-content">
          {loading ? (
            <div>Loading history...</div>
          ) : (
            <LeagueTimeline
              history={history}
              currentTier={currentTier}
              emptyMessage="No tier changes recorded yet for this team."
            />
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';

describe('TagTeam League History Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders expandable section with toggle button', () => {
    render(<TagTeamLeagueHistoryTestWrapper teamId={1} currentTier="silver" />);

    expect(screen.getByTestId('tag-team-league-history')).toBeInTheDocument();
    expect(screen.getByTestId('league-history-toggle')).toBeInTheDocument();
    expect(screen.getByText('🏆 League History')).toBeInTheDocument();
    // Content should not be visible initially
    expect(screen.queryByTestId('league-history-content')).not.toBeInTheDocument();
  });

  it('fetches data on expand and shows timeline', async () => {
    const user = userEvent.setup();

    mockedApiClient.get.mockResolvedValue({
      data: {
        data: [
          { cycleNumber: 5, destinationTier: 'silver', changeType: 'promotion', leaguePoints: 120 },
          { cycleNumber: 12, destinationTier: 'gold', changeType: 'promotion', leaguePoints: 150 },
        ],
      },
    });

    render(<TagTeamLeagueHistoryTestWrapper teamId={1} currentTier="silver" />);

    await user.click(screen.getByTestId('league-history-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('league-history-content')).toBeInTheDocument();
    });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/tag-teams/1/league-history');

    await waitFor(() => {
      expect(screen.getByTestId('league-timeline-chart')).toBeInTheDocument();
    });
  });

  it('shows empty state when no history exists', async () => {
    const user = userEvent.setup();

    mockedApiClient.get.mockResolvedValue({
      data: { data: [] },
    });

    render(<TagTeamLeagueHistoryTestWrapper teamId={2} currentTier="bronze" />);

    await user.click(screen.getByTestId('league-history-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('league-timeline-empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/No tier changes recorded yet/)).toBeInTheDocument();
  });
});
