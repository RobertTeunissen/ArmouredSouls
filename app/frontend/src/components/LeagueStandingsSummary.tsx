import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getMyTeamBattles, TeamBattle } from '../utils/teamBattleApi';
import { getLeagueTierColor, getLeagueTierName } from '../utils/matchmakingApi';
import { useRobotStore } from '../stores';
import { useStableOverview } from '../hooks/useSubscriptions';
import { api } from '../utils/api';
import axios from 'axios';

interface KothStanding {
  robotId: number;
  robotName: string;
  tier: string;
  leaguePoints: number;
  wins: number;
  totalMatches: number;
  bestPlacement: number | null;
}

interface GrandMeleeStanding {
  robotId: number;
  robotName: string;
  tier: string;
  leaguePoints: number;
  wins: number;
  totalMatches: number;
  bestPlacement: number | null;
}

function LeagueStandingsSummary() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const robots = useRobotStore(state => state.robots);
  const { data: stableOverview } = useStableOverview();
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [kothStandings, setKothStandings] = useState<KothStanding[]>([]);
  const [grandMeleeStandings, setGrandMeleeStandings] = useState<GrandMeleeStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build per-robot subscription lookup
  const robotSubscriptionMap = new Map<number, string[]>();
  if (stableOverview) {
    for (const robot of stableOverview.robots) {
      robotSubscriptionMap.set(robot.robotId, robot.subscriptions.map(s => s.eventType));
    }
  }

  useEffect(() => {
    fetchTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robots.length]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      const data = await getMyTeamBattles();
      setTeams(data);

      // Fetch KotH standings for all robots
      if (robots.length > 0) {
        const kothResults = await Promise.all(
          robots.map(async (robot) => {
            try {
              const result = await api.get<{ standing: { tier: string; leaguePoints: number; wins: number; totalMatches: number | null; bestPlacement: number | null } | null }>(`/api/robots/${robot.id}/koth-standing`);
              if (result.standing) {
                return {
                  robotId: robot.id,
                  robotName: robot.name,
                  tier: result.standing.tier,
                  leaguePoints: result.standing.leaguePoints,
                  wins: result.standing.wins,
                  totalMatches: result.standing.totalMatches ?? 0,
                  bestPlacement: result.standing.bestPlacement,
                };
              }
              return null;
            } catch {
              return null;
            }
          })
        );
        setKothStandings(kothResults.filter((r): r is KothStanding => r !== null));

        // Fetch Grand Melee standings for all robots
        const grandMeleeResults = await Promise.all(
          robots.map(async (robot) => {
            try {
              const result = await api.get<{ standing: { tier: string; leaguePoints: number; wins: number; totalMatches: number | null; bestPlacement: number | null } | null }>(`/api/robots/${robot.id}/grand-melee-standing`);
              if (result.standing) {
                return {
                  robotId: robot.id,
                  robotName: robot.name,
                  tier: result.standing.tier,
                  leaguePoints: result.standing.leaguePoints,
                  wins: result.standing.wins,
                  totalMatches: result.standing.totalMatches ?? 0,
                  bestPlacement: result.standing.bestPlacement,
                };
              }
              return null;
            } catch {
              return null;
            }
          })
        );
        setGrandMeleeStandings(grandMeleeResults.filter((r): r is GrandMeleeStanding => r !== null));
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      setError('Failed to load team standings');
    } finally {
      setLoading(false);
    }
  };

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
              {teams2v2.map(team => (
                <TeamStandingCard key={team.id} team={team} />
              ))}
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
              {teams2v2.map(team => (
                <TagTeamStandingCard key={`tt-${team.id}`} team={team} />
              ))}
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
              {teams3v3.map(team => (
                <TeamStandingCard key={team.id} team={team} />
              ))}
            </div>
          </div>
        )}

        {/* KotH — per robot */}
        {kothStandings.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-orange-400/20 rounded text-orange-400 font-semibold">KotH</span>
              King of the Hill
            </div>
            <div className="space-y-1.5">
              {kothStandings.map(standing => (
                <KothStandingCard key={standing.robotId} standing={standing} isSubscribed={robotSubscriptionMap.get(standing.robotId)?.includes('koth') ?? false} />
              ))}
            </div>
          </div>
        )}

        {/* Grand Melee — per robot */}
        {grandMeleeStandings.length > 0 && (
          <div>
            <div className="text-xs text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="text-xs px-1.5 py-0.5 bg-red-400/20 rounded text-red-400 font-semibold">Melee</span>
              Grand Melee
            </div>
            <div className="space-y-1.5">
              {grandMeleeStandings.map(standing => (
                <KothStandingCard key={`gm-${standing.robotId}`} standing={standing} isSubscribed={robotSubscriptionMap.get(standing.robotId)?.includes('grand_melee') ?? false} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RobotStandingCardProps {
  robot: { id: number; name: string; currentLeague: string; leaguePoints: number; totalLeague1v1Wins: number; totalLeague1v1Losses: number; totalLeague1v1Draws: number };
  isSubscribed: boolean;
}

function RobotStandingCard({ robot, isSubscribed }: RobotStandingCardProps) {
  const tierColor = getLeagueTierColor(robot.currentLeague);
  const tierName = getLeagueTierName(robot.currentLeague);
  const totalMatches = robot.totalLeague1v1Wins + robot.totalLeague1v1Losses + robot.totalLeague1v1Draws;

  return (
    <div className="bg-[#252b38] border border-white/10 rounded-lg p-2.5">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{robot.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">•</span>
            <span className="text-xs text-secondary">{robot.leaguePoints} LP</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-secondary">
          <span className="text-[#3fb950]">{robot.totalLeague1v1Wins}W</span>
          <span className="mx-1">/</span>
          <span className="text-[#f85149]">{robot.totalLeague1v1Losses}L</span>
          <span className="mx-1">/</span>
          <span className="text-[#d29922]">{robot.totalLeague1v1Draws}D</span>
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
            <span className="text-xs text-secondary">{robot.leaguePoints} LP</span>
          </div>
          <div className="text-xs text-secondary">
            <span className="text-[#3fb950]">{robot.totalLeague1v1Wins}W</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#f85149]">{robot.totalLeague1v1Losses}L</span>
            <span className="mx-0.5">/</span>
            <span className="text-[#d29922]">{robot.totalLeague1v1Draws}D</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TeamStandingCardProps {
  team: TeamBattle;
}

function TeamStandingCard({ team }: TeamStandingCardProps) {
  const tierColor = getLeagueTierColor(team.teamLeague);
  const tierName = getLeagueTierName(team.teamLeague);
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
            <span className="text-xs text-secondary">{team.teamLp} LP</span>
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
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            team.eligibility === 'ELIGIBLE' ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {team.eligibility === 'ELIGIBLE' ? '✓ Ready' : '✗ Ineligible'}
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{team.teamName}</div>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            team.eligibility === 'ELIGIBLE' ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {team.eligibility === 'ELIGIBLE' ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">{team.teamLp} LP</span>
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

function TagTeamStandingCard({ team }: TeamStandingCardProps) {
  const tierColor = getLeagueTierColor(team.tagTeamLeague || 'bronze');
  const tierName = getLeagueTierName(team.tagTeamLeague || 'bronze');
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
            <span className="text-xs text-secondary">{team.tagTeamLp || 0} LP</span>
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
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            team.eligibility === 'ELIGIBLE' ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {team.eligibility === 'ELIGIBLE' ? '✓ Ready' : '✗ Ineligible'}
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{team.teamName}</div>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            team.eligibility === 'ELIGIBLE' ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {team.eligibility === 'ELIGIBLE' ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">{team.tagTeamLp || 0} LP</span>
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
  standing: KothStanding;
  isSubscribed: boolean;
}

function KothStandingCard({ standing, isSubscribed }: KothStandingCardProps) {
  const tierColor = getLeagueTierColor(standing.tier);
  const tierName = getLeagueTierName(standing.tier);

  return (
    <div className="bg-[#252b38] border border-white/10 rounded-lg p-2.5">
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[#e6edf3] truncate">{standing.robotName}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">•</span>
            <span className="text-xs text-secondary">{standing.leaguePoints} LP</span>
            {standing.bestPlacement && (
              <>
                <span className="text-xs text-secondary">•</span>
                <span className="text-xs text-secondary">Best: #{standing.bestPlacement}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-xs text-secondary">
          <span className="text-[#3fb950]">{standing.wins}W</span>
          <span className="mx-1">/</span>
          <span className="text-secondary">{standing.totalMatches} matches</span>
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
          <div className="font-medium text-sm text-[#e6edf3] truncate">{standing.robotName}</div>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSubscribed ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
          }`}>
            {isSubscribed ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tierColor}`}>{tierName}</span>
            <span className="text-xs text-secondary">{standing.leaguePoints} LP</span>
            {standing.bestPlacement && (
              <span className="text-xs text-secondary">Best #{standing.bestPlacement}</span>
            )}
          </div>
          <div className="text-xs text-secondary">
            <span className="text-[#3fb950]">{standing.wins}W</span>
            <span className="mx-0.5">/</span>
            <span>{standing.totalMatches} matches</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeagueStandingsSummary;
