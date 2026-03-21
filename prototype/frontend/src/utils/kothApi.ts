import apiClient from './apiClient';

export interface KothStandingRobot {
  rank: number;
  robotId: number;
  robotName: string;
  ownerName: string;
  ownerId: number;
  kothWins: number;
  kothMatches: number;
  winRate: number;
  totalZoneScore: number;
  avgZoneScore: number;
  kothKills: number;
  bestWinStreak: number;
}

export interface KothStandingsResponse {
  data: KothStandingRobot[];
  summary: {
    totalEvents: number;
    uniqueParticipants: number;
    topRobot: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface KothRobotPerformance {
  kothMatches: number;
  kothWins: number;
  kothTotalZoneScore: number;
  kothTotalZoneTime: number;
  kothKills: number;
  kothBestPlacement: number | null;
  kothCurrentWinStreak: number;
  kothBestWinStreak: number;
  podiumRate: number;
  avgZoneScore: number;
}

export const getKothStandings = async (
  view: 'all_time' | 'last_10' = 'all_time',
  page: number = 1,
  limit: number = 50,
): Promise<KothStandingsResponse> => {
  const response = await apiClient.get('/api/koth/standings', {
    params: { view, page, limit },
  });
  const raw = response.data;

  // Map backend shape to frontend interface
  return {
    data: (raw.standings ?? []).map((r: Record<string, unknown>) => ({
      rank: r.rank,
      robotId: r.robotId,
      robotName: r.robotName,
      ownerName: r.owner ?? r.ownerName,
      ownerId: r.ownerId,
      kothWins: r.kothWins,
      kothMatches: r.kothMatches,
      winRate: r.winRate,
      totalZoneScore: r.totalZoneScore,
      avgZoneScore: r.avgZoneScore,
      kothKills: r.kothKills,
      bestWinStreak: r.bestStreak ?? r.bestWinStreak,
    })),
    summary: {
      totalEvents: raw.summary?.totalEvents ?? 0,
      uniqueParticipants: raw.summary?.uniqueParticipants ?? 0,
      topRobot: typeof raw.summary?.topRobot === 'string'
        ? raw.summary.topRobot
        : raw.summary?.topRobot?.name ?? null,
    },
    pagination: {
      page: raw.pagination?.page ?? 1,
      pageSize: raw.pagination?.limit ?? raw.pagination?.pageSize ?? limit,
      total: raw.pagination?.total ?? 0,
      totalPages: raw.pagination?.totalPages ?? 0,
    },
  };
};

export const getKothRobotPerformance = async (
  robotId: number,
): Promise<KothRobotPerformance> => {
  const response = await apiClient.get(`/api/analytics/robot/${robotId}/koth-performance`);
  return response.data;
};
