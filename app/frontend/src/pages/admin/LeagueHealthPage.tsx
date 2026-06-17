/**
 * LeagueHealthPage — Robots/Teams per tier, ELO distribution.
 *
 * Fetches from GET /api/admin/league-health (1v1),
 * GET /api/admin/team-battle-league-health (2v2/3v3), and
 * GET /api/admin/tag-team-league-health (tag team).
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, R11.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */
import { useState, useEffect, useCallback } from 'react';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
} from '../../components/admin/shared';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeagueTier {
  league: string;
  robotCount: number;
  averageElo: number;
  instances: number;
  instanceDetails: { id: string; robotCount: number }[];
  [key: string]: unknown;
}

interface LeagueHealthData {
  leagues: LeagueTier[];
  totalRobots: number;
}

interface TeamBattleLeagueTier {
  league: string;
  teamCount: number;
  averageElo: number;
  instances: number;
  instanceDetails: { id: string; teamCount: number }[];
  needsRebalancing: boolean;
  [key: string]: unknown;
}

interface TeamBattleLeagueData {
  leagues: TeamBattleLeagueTier[];
  totalTeams: number;
}

interface TeamBattleLeagueHealthData {
  league2v2: TeamBattleLeagueData;
  league3v3: TeamBattleLeagueData;
}

interface TagTeamLeagueTier {
  league: string;
  teamCount: number;
  instances: number;
  instanceDetails: { id: string; teamCount: number }[];
  teamsPerInstance: { min: number; max: number; avg: number };
  needsRebalancing: boolean;
  [key: string]: unknown;
}

interface TagTeamLeagueHealthData {
  leagues: TagTeamLeagueTier[];
  totalTeams: number;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function LeagueHealthPage() {
  const [data, setData] = useState<LeagueHealthData | null>(null);
  const [teamBattleData, setTeamBattleData] = useState<TeamBattleLeagueHealthData | null>(null);
  const [tagTeamData, setTagTeamData] = useState<TagTeamLeagueHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leagueData, tbData, ttData] = await Promise.all([
        api.get<LeagueHealthData>('/api/admin/league-health'),
        api.get<TeamBattleLeagueHealthData>('/api/admin/team-battle-league-health'),
        api.get<TagTeamLeagueHealthData>('/api/admin/tag-team-league-health'),
      ]);
      setData(leagueData);
      setTeamBattleData(tbData);
      setTagTeamData(ttData);
    } catch (err: unknown) {
      const msg = (err instanceof ApiError && err.message) || 'Failed to load league health data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const leagues = data?.leagues ?? [];
  const totalRobots = data?.totalRobots ?? 0;
  const emptyTiers = leagues.filter((l) => l.robotCount === 0).length;
  const activeTiers = leagues.filter((l) => l.robotCount > 0).length;

  const league2v2 = teamBattleData?.league2v2;
  const league3v3 = teamBattleData?.league3v3;

  return (
    <div data-testid="league-health-page" className="space-y-6">
      <AdminPageHeader
        title="League Health"
        subtitle="Tier distribution and ELO stats"
        actions={
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <AdminStatCard label="Total Robots" value={totalRobots} color="primary" icon={<span>🤖</span>} />
        <AdminStatCard label="Active Tiers" value={activeTiers} color="success" icon={<span>🏆</span>} />
        <AdminStatCard label="Empty Tiers" value={emptyTiers} color={emptyTiers > 0 ? 'warning' : 'success'} icon={<span>📭</span>} />
      </div>

      {/* 1v1 League Tiers Table */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">1v1 League Tiers</h3>
        <AdminDataTable<LeagueTier>
          columns={[
            {
              key: 'league',
              label: 'Tier',
              render: (row) => <span className="capitalize font-medium">{row.league}</span>,
            },
            { key: 'robotCount', label: 'Robots', align: 'right' },
            {
              key: 'instances',
              label: 'Instances',
              align: 'right',
              render: (row) => row.instances > 0 ? (
                <span title={row.instanceDetails.map((i: { id: string; robotCount: number }) => `${i.id}: ${i.robotCount}`).join(', ')}>
                  {row.instances}
                </span>
              ) : '—',
            },
            {
              key: 'averageElo',
              label: 'Avg ELO',
              align: 'right',
              render: (row) => row.robotCount > 0 ? row.averageElo.toLocaleString() : '—',
            },
          ]}
          data={leagues}
          loading={loading}
          emptyMessage="No league data available"
        />
      </div>

      {/* 2v2 League Tiers Table */}
      <div className="bg-surface rounded-lg p-6" data-testid="league-health-2v2">
        <h3 className="text-lg font-semibold mb-3">2v2 League Tiers</h3>
        {league2v2 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <AdminStatCard label="Total Teams" value={league2v2.totalTeams} color="primary" icon={<span>👥</span>} />
            <AdminStatCard
              label="Active Tiers"
              value={league2v2.leagues.filter((l) => l.teamCount > 0).length}
              color="success"
              icon={<span>🏆</span>}
            />
            <AdminStatCard
              label="Needs Rebalancing"
              value={league2v2.leagues.filter((l) => l.needsRebalancing).length}
              color={league2v2.leagues.some((l) => l.needsRebalancing) ? 'warning' : 'success'}
              icon={<span>⚖️</span>}
            />
          </div>
        )}
        <AdminDataTable<TeamBattleLeagueTier>
          columns={[
            {
              key: 'league',
              label: 'Tier',
              render: (row) => <span className="capitalize font-medium">{row.league}</span>,
            },
            { key: 'teamCount', label: 'Teams', align: 'right' },
            {
              key: 'instances',
              label: 'Instances',
              align: 'right',
              render: (row) => row.instances > 0 ? (
                <span title={row.instanceDetails.map((i: { id: string; teamCount: number }) => `${i.id}: ${i.teamCount}`).join(', ')}>
                  {row.instances}
                </span>
              ) : '—',
            },
            {
              key: 'averageElo',
              label: 'Avg ELO',
              align: 'right',
              render: (row) => row.teamCount > 0 ? row.averageElo.toLocaleString() : '—',
            },
            {
              key: 'needsRebalancing',
              label: 'Rebalancing',
              align: 'center',
              render: (row) => row.needsRebalancing ? (
                <span className="text-yellow-400" title="Needs rebalancing">⚠️</span>
              ) : (
                <span className="text-green-400" title="Balanced">✓</span>
              ),
            },
          ]}
          data={league2v2?.leagues ?? []}
          loading={loading}
          emptyMessage="No 2v2 league data available"
        />
      </div>

      {/* 3v3 League Tiers Table */}
      <div className="bg-surface rounded-lg p-6" data-testid="league-health-3v3">
        <h3 className="text-lg font-semibold mb-3">3v3 League Tiers</h3>
        {league3v3 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <AdminStatCard label="Total Teams" value={league3v3.totalTeams} color="primary" icon={<span>👥</span>} />
            <AdminStatCard
              label="Active Tiers"
              value={league3v3.leagues.filter((l) => l.teamCount > 0).length}
              color="success"
              icon={<span>🏆</span>}
            />
            <AdminStatCard
              label="Needs Rebalancing"
              value={league3v3.leagues.filter((l) => l.needsRebalancing).length}
              color={league3v3.leagues.some((l) => l.needsRebalancing) ? 'warning' : 'success'}
              icon={<span>⚖️</span>}
            />
          </div>
        )}
        <AdminDataTable<TeamBattleLeagueTier>
          columns={[
            {
              key: 'league',
              label: 'Tier',
              render: (row) => <span className="capitalize font-medium">{row.league}</span>,
            },
            { key: 'teamCount', label: 'Teams', align: 'right' },
            {
              key: 'instances',
              label: 'Instances',
              align: 'right',
              render: (row) => row.instances > 0 ? (
                <span title={row.instanceDetails.map((i: { id: string; teamCount: number }) => `${i.id}: ${i.teamCount}`).join(', ')}>
                  {row.instances}
                </span>
              ) : '—',
            },
            {
              key: 'averageElo',
              label: 'Avg ELO',
              align: 'right',
              render: (row) => row.teamCount > 0 ? row.averageElo.toLocaleString() : '—',
            },
            {
              key: 'needsRebalancing',
              label: 'Rebalancing',
              align: 'center',
              render: (row) => row.needsRebalancing ? (
                <span className="text-yellow-400" title="Needs rebalancing">⚠️</span>
              ) : (
                <span className="text-green-400" title="Balanced">✓</span>
              ),
            },
          ]}
          data={league3v3?.leagues ?? []}
          loading={loading}
          emptyMessage="No 3v3 league data available"
        />
      </div>

      {/* Tag Team League Tiers Table */}
      <div className="bg-surface rounded-lg p-6" data-testid="league-health-tag-team">
        <h3 className="text-lg font-semibold mb-3">Tag Team League Tiers</h3>
        {tagTeamData && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <AdminStatCard label="Total Teams" value={tagTeamData.totalTeams} color="primary" icon={<span>🤝</span>} />
            <AdminStatCard
              label="Active Tiers"
              value={tagTeamData.leagues.filter((l) => l.teamCount > 0).length}
              color="success"
              icon={<span>🏆</span>}
            />
            <AdminStatCard
              label="Needs Rebalancing"
              value={tagTeamData.leagues.filter((l) => l.needsRebalancing).length}
              color={tagTeamData.leagues.some((l) => l.needsRebalancing) ? 'warning' : 'success'}
              icon={<span>⚖️</span>}
            />
          </div>
        )}
        <AdminDataTable<TagTeamLeagueTier>
          columns={[
            {
              key: 'league',
              label: 'Tier',
              render: (row) => (
                <span className="capitalize font-medium">
                  {row.needsRebalancing && <span className="text-yellow-400 mr-1" title="Needs rebalancing">⚠️</span>}
                  {row.league}
                </span>
              ),
            },
            { key: 'teamCount', label: 'Teams', align: 'right' },
            {
              key: 'instances',
              label: 'Instances',
              align: 'right',
              render: (row) => row.instances > 0 ? (
                <span title={row.instanceDetails.map((i) => `${i.id}: ${i.teamCount}`).join(', ')}>
                  {row.instances}
                </span>
              ) : '—',
            },
            {
              key: 'teamsPerInstance' as string,
              label: 'Distribution',
              align: 'right',
              render: (row) => row.instances > 0
                ? `${row.teamsPerInstance.min}/${row.teamsPerInstance.max}/${row.teamsPerInstance.avg}`
                : '—',
            },
            {
              key: 'needsRebalancing',
              label: 'Rebalancing',
              align: 'center',
              render: (row) => row.needsRebalancing ? (
                <span className="text-yellow-400" title="Needs rebalancing">⚠️</span>
              ) : (
                <span className="text-green-400" title="Balanced">✓</span>
              ),
            },
          ]}
          data={tagTeamData?.leagues ?? []}
          loading={loading}
          emptyMessage="No tag team league data available"
        />
      </div>
    </div>
  );
}

export default LeagueHealthPage;
