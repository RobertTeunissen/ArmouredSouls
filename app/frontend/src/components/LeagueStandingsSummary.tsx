import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyTeamBattles, TeamBattle } from '../utils/teamBattleApi';
import { getLeagueTierColor, getLeagueTierName } from '../utils/matchmakingApi';
import { useRobotStore } from '../stores';
import { useStableOverview } from '../hooks/useSubscriptions';
import { api } from '../utils/api';
import { useApiQuery } from '../hooks/useApiQuery';
import type { PlacementStandingResponse } from '@shared/types';

interface KothStanding {
  robotId: number;
  robotName: string;
  tier: string;
  leaguePoints: number;
  wins: number;
  totalMatches: number;
  bestPlacement: number | null;
}

// KotH and Grand Melee share the same shape
type GrandMeleeStanding = KothStanding;

type TeamEventType = 'league_2v2' | 'tag_team' | 'league_3v3';

interface TeamReadiness {
  isReady: boolean;
  label: string;
}

/** Mirrors team scheduling prerequisites that are available in the team payload. */
function getTeamReadiness(team: TeamBattle, eventType: TeamEventType): TeamReadiness {
  if (team.members.length !== team.teamSize) {
    return { isReady: false, label: 'Incomplete team' };
  }

  const allMembersHaveWeapons = team.members.every(({ robot }) => {
    const requiresOffhand = robot.loadoutType === 'dual_wield' || robot.loadoutType === 'weapon_shield';
    const hasValidLoadout = robot.loadoutType === 'single'
      || robot.loadoutType === 'two_handed'
      || requiresOffhand;
    return hasValidLoadout
      && robot.mainWeaponId !== null
      && (!requiresOffhand || robot.offhandWeaponId !== null);
  });
  if (!allMembersHaveWeapons) {
    return { isReady: false, label: 'Missing weapons' };
  }

  const allMembersSubscribed = team.members.every(({ robot }) =>
    robot.subscriptions?.some(subscription =>
      subscription.eventType === eventType && subscription.status === 'active',
    ) ?? false,
  );
  return allMembersSubscribed
    ? { isReady: true, label: 'Ready' }
    : { isReady: false, label: 'Not subscribed' };
}

function TeamReadinessBadge({ readiness }: { readiness: TeamReadiness }) {
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${
      readiness.isReady ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
    }`}>
      {readiness.isReady ? '✓' : '✗'} {readiness.label}
    </span>
  );
}

interface RobotRef {
  id: number;
  name: string;
}

interface SummaryData {
  teams: TeamBattle[];
  kothStandings: KothStanding[];
  grandMeleeStandings: GrandMeleeStanding[];
}

/** One robot's KotH or Grand Melee standing; a robot without one (or a failed read) is left out. */
async function loadPlacementStanding(
  robot: RobotRef,
  mode: 'koth' | 'grand-melee',
  signal: AbortSignal,
): Promise<KothStanding | null> {
  try {
    const result = await api.get<PlacementStandingResponse>(`/api/robots/${robot.id}/${mode}-standing`, { signal });
    if (!result.standing) return null;
    return {
      robotId: robot.id,
      robotName: robot.name,
      tier: result.standing.tier,
      leaguePoints: result.standing.leaguePoints,
      wins: result.standing.wins,
      totalMatches: result.standing.totalMatches ?? 0,
      bestPlacement: result.standing.bestPlacement,
    };
  } catch {
    return null;
  }
}

async function loadSummary(robots: RobotRef[], signal: AbortSignal): Promise<SummaryData> {
  const [teams, koth, grandMelee] = await Promise.all([
    getMyTeamBattles(undefined, signal),
    Promise.all(robots.map((robot) => loadPlacementStanding(robot, 'koth', signal))),
    Promise.all(robots.map((robot) => loadPlacementStanding(robot, 'grand-melee', signal))),
  ]);
  return {
    teams,
    kothStandings: koth.filter((r): r is KothStanding => r !== null),
    grandMeleeStandings: grandMelee.filter((r): r is GrandMeleeStanding => r !== null),
  };
}

function LeagueStandingsSummary() {
  const navigate = useNavigate();
  const robots = useRobotStore(state => state.robots);
  const { data: stableOverview } = useStableOverview();

  // Refetch only when the set of robots (or a name) changes, not on every
  // robot-store refresh (repairs, HP updates).
  const robotKey = JSON.stringify(robots.map((robot) => [robot.id, robot.name]));
  const robotRefs = useMemo<RobotRef[]>(
    () => (JSON.parse(robotKey) as Array<[number, string]>).map(([id, name]) => ({ id, name })),
    [robotKey],
  );
  // A 401 ends the session in the API client; this panel only reports other failures.
  const summary = useApiQuery((signal) => loadSummary(robotRefs, signal), [robotRefs]);
  const teams = summary.data?.teams ?? [];
  const kothStandings = summary.data?.kothStandings ?? [];
  const grandMeleeStandings = summary.data?.grandMeleeStandings ?? [];
  const loading = summary.loading && summary.data === null;
  const error = summary.error ? 'Failed to load team standings' : null;

  // Build per-robot subscription lookup
  const robotSubscriptionMap = new Map<number, string[]>();
  if (stableOverview) {
    for (const robot of stableOverview.robots) {
      robotSubscriptionMap.set(robot.robotId, robot.subscriptions.map(s => s.eventType));
    }
  }

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h3 className="text-base font-semibold mb-3">League Standings</h3>
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h3 className="text-base font-semibold mb-3">League Standings</h3>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (teams.length === 0 && robots.length === 0) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h3 className="text-base font-semibold mb-3">League Standings</h3>
        <p className="text-sm text-secondary">No league data yet.</p>
      </div>
    );
  }

  const teams2v2 = teams.filter(t => t.teamSize === 2);
  const teams3v3 = teams.filter(t => t.teamSize === 3);

  return (
    <div className="bg-surface p-4 rounded-lg border border-white/10">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold">League Standings</h3>
        <button
          onClick={() => navigate('/league-standings')}
          className="text-primary hover:text-primary-light text-xs font-semibold"
        >
          Full Standings →
        </button>
      </div>

      <div className="space-y-3">
        {/* 1v1 League — per robot */}
        {robots.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-blue-400/20 rounded text-blue-400 font-semibold">1v1</span>
              League
            </div>
            <div className="space-y-1.5">
              {robots.map(robot => {
                const isSubscribed = robotSubscriptionMap.get(robot.id)?.includes('league_1v1') ?? false;
                return <RobotStandingCard key={robot.id} robot={robot} isSubscribed={isSubscribed} />;
              })}
            </div>
          </div>
        )}
        {/* 2v2 Teams */}
        {teams2v2.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-emerald-400/20 rounded text-emerald-400 font-semibold">2v2</span>
              League
            </div>
            <div className="space-y-1.5">
              {teams2v2.map(team => {
                const readiness = getTeamReadiness(team, 'league_2v2');
                return <TeamStandingCard key={team.id} team={team} readiness={readiness} />;
              })}
            </div>
          </div>
        )}

        {/* Tag Team League (2v2 teams with tag team stats) */}
        {teams2v2.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-amber-400/20 rounded text-amber-400 font-semibold">Tag Team</span>
              League
            </div>
            <div className="space-y-1.5">
              {teams2v2.map(team => {
                const readiness = getTeamReadiness(team, 'tag_team');
                return <TagTeamStandingCard key={`tt-${team.id}`} team={team} readiness={readiness} />;
              })}
            </div>
          </div>
        )}

        {/* 3v3 Teams */}
        {teams3v3.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-violet-400/20 rounded text-violet-400 font-semibold">3v3</span>
              League
            </div>
            <div className="space-y-1.5">
              {teams3v3.map(team => {
                const readiness = getTeamReadiness(team, 'league_3v3');
                return <TeamStandingCard key={team.id} team={team} readiness={readiness} />;
              })}
            </div>
          </div>
        )}

        {/* KotH — per robot (always show all robots, like 1v1) */}
        {robots.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-orange-400/20 rounded text-orange-400 font-semibold">KotH</span>
              King of the Hill
            </div>
            <div className="space-y-1.5">
              {robots.map(robot => {
                const standing = kothStandings.find(s => s.robotId === robot.id) ?? null;
                const isSubscribed = robotSubscriptionMap.get(robot.id)?.includes('koth') ?? false;
                return <KothStandingCard key={robot.id} robotName={robot.name} standing={standing} isSubscribed={isSubscribed} />;
              })}
            </div>
          </div>
        )}

        {/* Grand Melee — per robot (always show all robots, like 1v1) */}
        {robots.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-red-400/20 rounded text-red-400 font-semibold">Melee</span>
              Grand Melee
            </div>
            <div className="space-y-1.5">
              {robots.map(robot => {
                const standing = grandMeleeStandings.find(s => s.robotId === robot.id) ?? null;
                const isSubscribed = robotSubscriptionMap.get(robot.id)?.includes('grand_melee') ?? false;
                return <KothStandingCard key={`gm-${robot.id}`} robotName={robot.name} standing={standing} isSubscribed={isSubscribed} />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RobotStandingCardProps {
  /** League fields are omitted by the API when the robot has no league_1v1 standing. */
  robot: { id: number; name: string; currentLeague?: string; leaguePoints?: number; totalLeague1v1Wins?: number; totalLeague1v1Losses?: number; totalLeague1v1Draws?: number };
  isSubscribed: boolean;
}

function RobotStandingCard({ robot, isSubscribed }: RobotStandingCardProps) {
  const tierColor = getLeagueTierColor(robot.currentLeague);
  const tierName = getLeagueTierName(robot.currentLeague);
  const lpLabel = robot.leaguePoints !== undefined ? `${robot.leaguePoints} LP` : '— LP';
  const wins = robot.totalLeague1v1Wins ?? 0;
  const losses = robot.totalLeague1v1Losses ?? 0;
  const draws = robot.totalLeague1v1Draws ?? 0;
  const totalMatches = wins + losses + draws;

  return (
    <div className="bg-[#252b38] border border-white/10 rounded-lg p-2.5">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{robot.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">•</span>
            <span className="text-xs text-secondary">{lpLabel}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-secondary">
          <span className="text-[#3fb950]">{wins}W</span>
          <span className="mx-1">/</span>
          <span className="text-[#f85149]">{losses}L</span>
          <span className="mx-1">/</span>
          <span className="text-[#d29922]">{draws}D</span>
          {totalMatches > 0 && (
            <span className="ml-2 text-secondary">({totalMatches})</span>
          )}
        </div>
        <div className="flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSubscribed ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {isSubscribed ? '✓ Ready' : '✗ Not subscribed'}
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{robot.name}</div>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSubscribed ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {isSubscribed ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">{lpLabel}</span>
          </div>
          <div className="text-xs text-secondary">
            <span className="text-[#3fb950]">{wins}W</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#f85149]">{losses}L</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#d29922]">{draws}D</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TeamStandingCardProps {
  team: TeamBattle;
  readiness: TeamReadiness;
}

function TeamStandingCard({ team, readiness }: TeamStandingCardProps) {
  // teamLeague/teamLp are null when the team has no standing in the league (Unranked)
  const tierColor = getLeagueTierColor(team.teamLeague);
  const tierName = getLeagueTierName(team.teamLeague);
  const lpLabel = typeof team.teamLp === 'number' ? `${team.teamLp} LP` : '— LP';
  const totalMatches = team.totalLeagueWins + team.totalLeagueLosses + team.totalLeagueDraws;

  return (
    <div className="bg-[#252b38] border border-white/10 rounded-lg p-2.5">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{team.teamName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">•</span>
            <span className="text-xs text-secondary">{lpLabel}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-secondary">
          <span className="text-[#3fb950]">{team.totalLeagueWins}W</span>
          <span className="mx-1">/</span>
          <span className="text-[#f85149]">{team.totalLeagueLosses}L</span>
          <span className="mx-1">/</span>
          <span className="text-[#d29922]">{team.totalLeagueDraws}D</span>
          {totalMatches > 0 && (
            <span className="ml-2 text-secondary">({totalMatches})</span>
          )}
        </div>
        <div className="flex-shrink-0">
          <TeamReadinessBadge readiness={readiness} />
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{team.teamName}</div>
          <TeamReadinessBadge readiness={readiness} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">{lpLabel}</span>
          </div>
          <div className="text-xs text-secondary">
            <span className="text-[#3fb950]">{team.totalLeagueWins}W</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#f85149]">{team.totalLeagueLosses}L</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#d29922]">{team.totalLeagueDraws}D</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagTeamStandingCard({ team, readiness }: TeamStandingCardProps) {
  // tagTeamLeague/tagTeamLp are null when the team has no Tag Team standing (Unranked)
  const tierColor = getLeagueTierColor(team.tagTeamLeague);
  const tierName = getLeagueTierName(team.tagTeamLeague);
  const lpLabel = typeof team.tagTeamLp === 'number' ? `${team.tagTeamLp} LP` : '— LP';
  const totalMatches = (team.totalTagTeamWins || 0) + (team.totalTagTeamLosses || 0) + (team.totalTagTeamDraws || 0);

  return (
    <div className="bg-[#252b38] border border-white/10 rounded-lg p-2.5">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{team.teamName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">•</span>
            <span className="text-xs text-secondary">{lpLabel}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-secondary">
          <span className="text-[#3fb950]">{team.totalTagTeamWins || 0}W</span>
          <span className="mx-1">/</span>
          <span className="text-[#f85149]">{team.totalTagTeamLosses || 0}L</span>
          <span className="mx-1">/</span>
          <span className="text-[#d29922]">{team.totalTagTeamDraws || 0}D</span>
          {totalMatches > 0 && (
            <span className="ml-2 text-secondary">({totalMatches})</span>
          )}
        </div>
        <div className="flex-shrink-0">
          <TeamReadinessBadge readiness={readiness} />
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{team.teamName}</div>
          <TeamReadinessBadge readiness={readiness} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">{lpLabel}</span>
          </div>
          <div className="text-xs text-secondary">
            <span className="text-[#3fb950]">{team.totalTagTeamWins || 0}W</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#f85149]">{team.totalTagTeamLosses || 0}L</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#d29922]">{team.totalTagTeamDraws || 0}D</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface KothStandingCardProps {
  robotName: string;
  standing: KothStanding | null;
  isSubscribed: boolean;
}

function KothStandingCard({ robotName, standing, isSubscribed }: KothStandingCardProps) {
  const tierColor = standing ? getLeagueTierColor(standing.tier) : 'text-gray-500';
  const tierName = standing ? getLeagueTierName(standing.tier) : '—';

  return (
    <div className="bg-[#252b38] border border-white/10 rounded-lg p-2.5">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{robotName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            {standing && (
              <>
                <span className="text-xs text-secondary">•</span>
                <span className="text-xs text-secondary">{standing.leaguePoints} LP</span>
                {standing.bestPlacement && (
                  <>
                    <span className="text-xs text-secondary">•</span>
                    <span className="text-xs text-secondary">Best: #{standing.bestPlacement}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-secondary">
          {standing ? (
            <>
              <span className="text-[#3fb950]">{standing.wins}W</span>
              <span className="mx-1">/</span>
              <span className="text-secondary">{standing.totalMatches} matches</span>
            </>
          ) : (
            <span className="text-secondary">No matches</span>
          )}
        </div>
        <div className="flex-shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSubscribed ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {isSubscribed ? '✓ Ready' : '✗ Not subscribed'}
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{robotName}</div>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSubscribed ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {isSubscribed ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            {standing && (
              <>
                <span className="text-xs text-secondary">{standing.leaguePoints} LP</span>
                {standing.bestPlacement && (
                  <span className="text-xs text-secondary">Best #{standing.bestPlacement}</span>
                )}
              </>
            )}
          </div>
          <div className="text-xs text-secondary">
            {standing ? (
              <>
                <span className="text-[#3fb950]">{standing.wins}W</span>
                <span className="mx-0.5">/</span>
                <span>{standing.totalMatches} matches</span>
              </>
            ) : (
              <span>No matches</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeagueStandingsSummary;
