import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { useRobotStore } from '../stores';
import {
  getLeagueStandings,
  getLeagueInstances,
  LeagueRobot,
  LeagueInstance,
  ZoneMeta,
  getLeagueTierName,
  getLeagueTierColor,
  getLeagueTierIcon,
} from '../utils/matchmakingApi';
import {
  getTeamBattleStandings,
  getTeamBattleLeagueInstances,
  getTagTeamStandingsNew,
  getTagTeamLeagueInstances,
  getMyTeamBattles,
  TeamBattleStanding,
  TeamBattleLeagueInstance,
} from '../utils/teamBattleApi';
import OwnerNameLink from '../components/OwnerNameLink';

type LeagueMode = '1v1' | '2v2' | '3v3' | 'tag_team' | 'koth';

const MODES: { value: LeagueMode; label: string; shortLabel: string }[] = [
  { value: '1v1', label: '1v1 League', shortLabel: '1v1' },
  { value: '2v2', label: '2v2 League', shortLabel: '2v2' },
  { value: '3v3', label: '3v3 League', shortLabel: '3v3' },
  { value: 'tag_team', label: 'Tag Team', shortLabel: 'Tag' },
  { value: 'koth', label: 'King of the Hill', shortLabel: 'KotH' },
];

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

function LeagueStandingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeRobots = useRobotStore(state => state.robots);
  const fetchStoreRobots = useRobotStore(state => state.fetchRobots);

  // Mode from URL (default: 1v1)
  const initialMode = (MODES.find(m => m.value === searchParams.get('mode'))?.value || '1v1') as LeagueMode;
  const [mode, setModeRaw] = useState<LeagueMode>(initialMode);

  const initialTier = TIERS.includes(searchParams.get('tier') ?? '') ? searchParams.get('tier')! : 'bronze';
  const initialInstance = searchParams.get('instance') || null;
  const [selectedTier, setSelectedTierRaw] = useState(initialTier);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(initialInstance);

  // Mode change handler — updates URL and resets tier/instance
  const setMode = (newMode: LeagueMode) => {
    setModeRaw(newMode);
    setSelectedTierRaw('bronze');
    setSelectedInstance(null);
    setSearchParams(() => {
      const next = new URLSearchParams();
      if (newMode !== '1v1') next.set('mode', newMode);
      return next;
    }, { replace: true });
  };

  // Wrapper that updates both state and URL when tier changes
  const setSelectedTier = (tier: string) => {
    setSelectedTierRaw(tier);
    setSelectedInstance(null);
    setSearchParams(() => {
      const next = new URLSearchParams();
      if (mode !== '1v1') next.set('mode', mode);
      if (tier !== 'bronze') next.set('tier', tier);
      return next;
    }, { replace: true });
    if (mode === '1v1') {
      fetchLeagueData(tier, 1);
    } else if (mode === 'tag_team') {
      fetchTagTeamData(tier, 1);
    } else if (mode === 'koth') {
      fetchLeagueData(tier, 1);
    } else {
      fetchTeamBattleData(tier, 1);
    }
  };

  // 1v1 state
  const [robots, setRobots] = useState<LeagueRobot[]>([]);
  const [instances, setInstances] = useState<LeagueInstance[]>([]);
  const [userRobotTiers, setUserRobotTiers] = useState<Set<string>>(new Set());
  const [userRobotInstances, setUserRobotInstances] = useState<Set<string>>(new Set());
  const [showInstancesList, setShowInstancesList] = useState(false);
  const [zoneMeta, setZoneMeta] = useState<ZoneMeta | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });

  // Team battle state (2v2/3v3)
  const [teamStandings, setTeamStandings] = useState<TeamBattleStanding[]>([]);
  const [teamInstances, setTeamInstances] = useState<TeamBattleLeagueInstance[]>([]);
  const [userTeamInstances, setUserTeamInstances] = useState<Set<string>>(new Set());
  const [userTeamTiers, setUserTeamTiers] = useState<Set<string>>(new Set());
  const [teamZoneMeta, setTeamZoneMeta] = useState<ZoneMeta | null>(null);
  const [teamPagination, setTeamPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [showTeamInstancesList, setShowTeamInstancesList] = useState(false);

  // KotH now uses the same state as 1v1 (robots, instances, pagination) via fetchLeagueData

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === '1v1') {
      fetchLeagueData(selectedTier, 1, selectedInstance || undefined);
    } else if (mode === '2v2' || mode === '3v3') {
      fetchTeamBattleData(selectedTier, 1, selectedInstance || undefined);
    } else if (mode === 'tag_team') {
      fetchTagTeamData(selectedTier, 1, selectedInstance || undefined);
    } else if (mode === 'koth') {
      fetchLeagueData(selectedTier, 1, selectedInstance || undefined);
    }
    fetchStoreRobots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStoreRobots, mode]); // Re-fetch on mount and mode change

  // Derive user robot tiers/instances from store
  useEffect(() => {
    if (storeRobots.length > 0) {
      const tiers = new Set<string>(storeRobots.map((r) => r.currentLeague));
      const instanceIds = new Set<string>(storeRobots.map((r) => r.leagueId).filter(Boolean) as string[]);
      setUserRobotTiers(tiers);
      setUserRobotInstances(instanceIds);
    }
  }, [storeRobots]);

  const fetchLeagueData = async (tier: string, page: number, instance?: string) => {
    try {
      setLoading(true);
      const leagueMode = mode === 'koth' ? 'koth' : undefined; // undefined = default league_1v1
      const [standingsData, instancesData] = await Promise.all([
        getLeagueStandings(tier, page, 50, instance, leagueMode),
        getLeagueInstances(tier, leagueMode),
      ]);
      setRobots(standingsData.data);
      setPagination(standingsData.pagination);
      setZoneMeta(standingsData.zoneMeta);
      setInstances(instancesData);
      setError(null);
    } catch {
      setError('Failed to load league standings');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamBattleData = async (tier: string, page: number, instance?: string) => {
    try {
      setLoading(true);
      const teamSize = mode === '2v2' ? 2 : 3;
      const [standingsData, instancesData, myTeams] = await Promise.all([
        getTeamBattleStandings(teamSize as 2 | 3, tier, page, 50, instance),
        getTeamBattleLeagueInstances(teamSize as 2 | 3, tier),
        getMyTeamBattles(),
      ]);
      setTeamStandings(standingsData.standings);
      setTeamPagination(standingsData.pagination);
      setTeamZoneMeta(standingsData.zoneMeta ? standingsData.zoneMeta as ZoneMeta : null);
      setTeamInstances(instancesData);
      // Build set of instance IDs and tiers where user has teams of this size
      const myTeamsOfSize = myTeams.filter(t => t.teamSize === teamSize);
      const myInstanceIds = new Set(myTeamsOfSize.map(t => t.teamLeagueId));
      const myTierIds = new Set(myTeamsOfSize.map(t => t.teamLeague));
      setUserTeamInstances(myInstanceIds);
      setUserTeamTiers(myTierIds);
      setError(null);
    } catch {
      setError('Failed to load team battle standings');
    } finally {
      setLoading(false);
    }
  };

  const fetchTagTeamData = async (tier: string, page: number, instance?: string) => {
    try {
      setLoading(true);
      const [standingsData, instancesData, myTeams] = await Promise.all([
        getTagTeamStandingsNew(tier, page, 50, instance),
        getTagTeamLeagueInstances(tier),
        getMyTeamBattles(2),
      ]);
      // Map tag team response into TeamBattleStanding shape
      const mapped: TeamBattleStanding[] = standingsData.standings.map(entry => ({
        rank: entry.rank,
        teamId: entry.teamId,
        teamName: entry.teamName,
        stableId: entry.stableId,
        stableName: entry.stableName,
        teamSize: 2,
        teamLp: entry.tagTeamLp,
        teamELO: entry.combinedELO,
        teamLeague: entry.tagTeamLeague,
        teamLeagueId: entry.tagTeamLeagueId,
        wins: entry.totalTagTeamWins,
        losses: entry.totalTagTeamLosses,
        draws: entry.totalTagTeamDraws,
        totalMatches: entry.totalTagTeamWins + entry.totalTagTeamLosses + entry.totalTagTeamDraws,
        eligibility: 'ELIGIBLE',
        cyclesInLeague: entry.cyclesInTagTeamLeague ?? 0,
        isSubscribed: undefined,
        zone: entry.zone,
        eligible: entry.eligible,
        members: entry.members.map(m => ({
          robotId: m.id,
          robotName: m.name,
          robotElo: m.elo,
          slotIndex: m.slotIndex,
        })),
      }));
      setTeamStandings(mapped);
      setTeamPagination({
        page: standingsData.pagination.page,
        pageSize: standingsData.pagination.pageSize,
        total: standingsData.pagination.total,
        totalPages: standingsData.pagination.totalPages,
      });
      setTeamZoneMeta(standingsData.zoneMeta ? standingsData.zoneMeta as ZoneMeta : null);
      setTeamInstances(instancesData);
      // Build user team tier/instance sets from tag team fields
      const myTierIds = new Set(myTeams.map(t => t.tagTeamLeague));
      const myInstanceIds = new Set(myTeams.map(t => t.tagTeamLeagueId));
      setUserTeamTiers(myTierIds);
      setUserTeamInstances(myInstanceIds);
      setError(null);
    } catch {
      setError('Failed to load tag team standings');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (mode === '1v1') {
      fetchLeagueData(selectedTier, newPage, selectedInstance || undefined);
    } else if (mode === 'tag_team') {
      fetchTagTeamData(selectedTier, newPage, selectedInstance || undefined);
    } else if (mode === 'koth') {
      fetchLeagueData(selectedTier, newPage, selectedInstance || undefined);
    } else {
      fetchTeamBattleData(selectedTier, newPage, selectedInstance || undefined);
    }
  };

  const handleInstanceClick = (instanceId: string) => {
    if (selectedInstance === instanceId) {
      // Clicking on the same instance deselects it
      setSelectedInstance(null);
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('instance'); return next; }, { replace: true });
      if (mode === '1v1') {
        fetchLeagueData(selectedTier, 1);
      } else if (mode === 'tag_team') {
        fetchTagTeamData(selectedTier, 1);
      } else if (mode === 'koth') {
        fetchLeagueData(selectedTier, 1);
      } else {
        fetchTeamBattleData(selectedTier, 1);
      }
    } else {
      setSelectedInstance(instanceId);
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('instance', instanceId); return next; }, { replace: true });
      if (mode === '1v1') {
        fetchLeagueData(selectedTier, 1, instanceId);
      } else if (mode === 'tag_team') {
        fetchTagTeamData(selectedTier, 1, instanceId);
      } else if (mode === 'koth') {
        fetchLeagueData(selectedTier, 1, instanceId);
      } else {
        fetchTeamBattleData(selectedTier, 1, instanceId);
      }
    }
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-warning'; // Gold
    if (rank === 2) return 'text-secondary'; // Silver
    if (rank === 3) return 'text-orange-600'; // Bronze
    return 'text-secondary';
  };

  // Transform league instance identifier to human-readable display text
  const buildInstanceDisplayLabel = (leagueIdentifier: string) => {
    const segments = leagueIdentifier.split('_');
    if (segments.length < 2) return leagueIdentifier;
    
    const tierLabel = getLeagueTierName(segments[0]);
    const instanceNum = segments[1];
    return `${tierLabel} ${instanceNum}`;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <h1 className="text-4xl font-bold mb-6">League Standings</h1>

        {/* Mode Selector */}
        <div className="flex gap-1.5 lg:gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto scrollbar-none">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-3 lg:px-5 py-2 lg:py-2.5 rounded-lg font-semibold transition-colors min-h-[40px] lg:min-h-[44px] text-sm lg:text-base whitespace-nowrap shrink-0 ${
                mode === m.value
                  ? 'bg-primary text-white'
                  : 'bg-surface text-secondary hover:bg-surface-elevated hover:text-white'
              }`}
            >
              <span className="hidden lg:inline">{m.label}</span>
              <span className="lg:hidden">{m.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Tier Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TIERS.map((tier) => {
            const tierColor = getLeagueTierColor(tier);
            const tierName = getLeagueTierName(tier);
            const tierIcon = getLeagueTierIcon(tier);
            const isActive = selectedTier === tier;
            const hasUserRobots = mode === '1v1'
              ? userRobotTiers.has(tier)
              : userTeamTiers.has(tier);

            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors relative ${
                  isActive
                    ? `${tierColor} bg-surface-elevated border-2 border-current`
                    : 'bg-surface text-secondary hover:bg-surface-elevated'
                }`}
              >
                <span>{tierIcon}</span>
                <span>{tierName}</span>
                {hasUserRobots && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-dark rounded-full border-2 border-background"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Instance Information — 1v1 mode */}
        {(mode === '1v1' || mode === 'koth') && !loading && instances.length > 0 && (
          <div className="bg-surface p-4 rounded-lg mb-6">
            <div 
              className="flex items-center justify-between cursor-pointer mb-2"
              onClick={() => setShowInstancesList(!showInstancesList)}
            >
              <h2 className="text-lg font-semibold">
                League Instances
                {selectedInstance && (
                  <span className="ml-2 text-sm text-secondary">
                    (Click selected to view all)
                  </span>
                )}
              </h2>
              <button className="text-secondary hover:text-white transition-colors">
                {showInstancesList ? (
                  <span className="text-2xl">−</span>
                ) : (
                  <span className="text-2xl">+</span>
                )}
              </button>
            </div>
            
            {showInstancesList && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                {instances.map((instance) => {
                  const isSelected = selectedInstance === instance.leagueId;
                  const tierColorClass = getLeagueTierColor(instance.leagueTier);
                  const hasUserRobots = userRobotInstances.has(instance.leagueId);

                  return (
                    <div
                      key={instance.leagueId}
                      onClick={() => handleInstanceClick(instance.leagueId)}
                      className={`p-3 rounded cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-yellow-900 border-2 border-yellow-500 ring-2 ring-yellow-400'
                          : 'bg-surface-elevated hover:bg-gray-600 border-2 border-transparent'
                      }`}
                    >
                      <div className={`text-sm ${tierColorClass} font-semibold`}>
                        {buildInstanceDisplayLabel(instance.leagueId)}
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {instance.currentRobots} / {instance.maxRobots}
                      </div>
                      <div className="text-xs text-tertiary">robots</div>
                      {hasUserRobots && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-dark rounded-full border-2 border-background"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Instance Information — Team Battle mode (2v2/3v3/tag_team) */}
        {(mode === '2v2' || mode === '3v3' || mode === 'tag_team') && !loading && teamInstances.length > 0 && (
          <div className="bg-surface p-4 rounded-lg mb-6">
            <div 
              className="flex items-center justify-between cursor-pointer mb-2"
              onClick={() => setShowTeamInstancesList(!showTeamInstancesList)}
            >
              <h2 className="text-lg font-semibold">
                League Instances
                {selectedInstance && (
                  <span className="ml-2 text-sm text-secondary">
                    (Click selected to view all)
                  </span>
                )}
              </h2>
              <button className="text-secondary hover:text-white transition-colors">
                {showTeamInstancesList ? (
                  <span className="text-2xl">−</span>
                ) : (
                  <span className="text-2xl">+</span>
                )}
              </button>
            </div>
            
            {showTeamInstancesList && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                {teamInstances.map((instance) => {
                  const isSelected = selectedInstance === instance.leagueId;
                  const tierColorClass = getLeagueTierColor(instance.leagueTier);
                  const hasUserTeams = userTeamInstances.has(instance.leagueId);

                  return (
                    <div
                      key={instance.leagueId}
                      onClick={() => handleInstanceClick(instance.leagueId)}
                      className={`p-3 rounded cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-yellow-900 border-2 border-yellow-500 ring-2 ring-yellow-400'
                          : 'bg-surface-elevated hover:bg-gray-600 border-2 border-transparent'
                      }`}
                    >
                      <div className={`text-sm ${tierColorClass} font-semibold`}>
                        {buildInstanceDisplayLabel(instance.leagueId)}
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {instance.currentTeams} / {instance.maxTeams}
                      </div>
                      <div className="text-xs text-tertiary">teams</div>
                      {hasUserTeams && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-dark rounded-full border-2 border-background"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="bg-surface p-6 rounded-lg">
            <p className="text-secondary">Loading standings...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg">
            <p className="text-error">{error}</p>
          </div>
        )}

        {/* ── 1v1 League Standings ── */}
        {(mode === '1v1' || mode === 'koth') && !loading && !error && robots.length === 0 && (
          <div className="bg-surface p-6 rounded-lg">
            <p className="text-secondary">No robots in this tier yet.</p>
          </div>
        )}

        {(mode === '1v1' || mode === 'koth') && !loading && !error && robots.length > 0 && (
          <>
            {/* Zone Legend & Status */}
            {zoneMeta && (
              <div className="bg-surface p-4 rounded-lg mb-4 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span>
                  <span className="text-secondary">Promotion zone (top 10%, ≥{zoneMeta.minLP} LP, ≥{zoneMeta.minCycles} cycles)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>
                  <span className="text-secondary">Demotion zone (bottom 10%, ≥{zoneMeta.minCycles} cycles)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-white inline-block"></span>
                  <span className="text-secondary">Eligible for promotion/demotion (≥{zoneMeta.minCycles} cycles)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-white/10 text-tertiary px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                  <span className="text-secondary">Not subscribed to this league</span>
                </div>
                {!zoneMeta.hasEnoughRobots && (
                  <div className="flex items-center gap-2 text-warning">
                    <span>⚠️</span>
                    <span>Promotion/demotion paused — need {zoneMeta.minRobotsRequired} eligible robots, currently {zoneMeta.eligibleCount}</span>
                  </div>
                )}
                {zoneMeta.isChampion && (
                  <div className="text-tertiary italic">No promotion from Champion tier</div>
                )}
                {zoneMeta.isBronze && (
                  <div className="text-tertiary italic">No demotion from Bronze tier</div>
                )}
              </div>
            )}
            <div className="bg-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full">
                  <thead className="bg-surface-elevated">
                    <tr>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">#</th>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">Robot</th>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">Owner</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">LP</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">ELO</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Fame</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">{mode === 'koth' ? 'Wins / Matches' : 'W-D-L'}</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {robots.map((robot, index) => {
                      const rank = (pagination.page - 1) * pagination.pageSize + index + 1;
                      const rankColor = getRankColor(rank);
                      const isMyBot = isMyRobot(robot.userId);
                      const isInactive = robot.isSubscribed === false;
                      const winRate =
                        robot.totalBattles > 0
                          ? ((robot.wins / robot.totalBattles) * 100).toFixed(1)
                          : '0.0';

                      const zoneClass = robot.zone === 'promotion'
                        ? 'border-l-4 border-l-green-500 bg-green-900/10'
                        : robot.zone === 'demotion'
                          ? 'border-l-4 border-l-red-500 bg-red-900/10'
                          : '';

                      const eligibilityClass = isInactive ? 'opacity-40' : '';

                      return (
                        <tr
                          key={robot.id}
                          className={`border-b border-white/10 ${zoneClass} ${eligibilityClass} ${
                            robot.eligible ? (robot.zone === 'promotion' ? 'border-l-2 border-l-green-500' : 'border-l-2 border-l-white') : ''
                          } ${
                            isMyBot ? 'bg-blue-900 bg-opacity-30' : 'hover:bg-surface-elevated'
                          } transition-colors`}
                        >
                          <td className={`px-1.5 lg:px-4 py-3 font-bold ${rankColor} text-sm lg:text-base`}>
                            #{rank}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div 
                                className={`font-semibold text-sm lg:text-base truncate max-w-[100px] lg:max-w-none cursor-pointer hover:underline transition-colors ${isMyBot ? 'text-primary hover:text-blue-300' : 'hover:text-[#58a6ff]'}`}
                                onClick={() => navigate(`/robots/${robot.id}`)}
                              >
                                {robot.name}
                              </div>
                              {isInactive && (
                                <span className="shrink-0 text-[10px] bg-white/10 text-tertiary px-1.5 py-0.5 rounded font-medium">
                                  INACTIVE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-secondary text-sm lg:text-base">
                            <div className="flex items-center gap-1.5">
                              <OwnerNameLink
                                userId={robot.userId}
                                displayName={robot.user.stableName || robot.user.username}
                                className="truncate max-w-[80px] lg:max-w-none"
                              />
                              {isMyBot && (
                                <span className="shrink-0 text-xs bg-primary text-white px-1.5 py-0.5 rounded font-semibold">
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base text-warning">
                            {robot.leaguePoints}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base">{robot.elo}</td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono text-purple-400">
                            {robot.fame}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">
                            {mode === 'koth' ? (
                              <><span className="text-success">{robot.wins}</span><span className="text-tertiary"> / </span><span>{robot.totalBattles}</span></>
                            ) : (
                              <>
                                <span className="text-success">{robot.wins}</span>
                                <span className="text-tertiary"> - </span>
                                <span className="text-warning">{robot.draws}</span>
                                <span className="text-tertiary"> - </span>
                                <span className="text-error">{robot.losses}</span>
                              </>
                            )}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">{winRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-surface-elevated rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 min-h-[44px]"
                >
                  Previous
                </button>

                <div className="px-4 py-2 bg-surface rounded min-h-[44px] flex items-center">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-surface-elevated rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 min-h-[44px]"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 2v2 / 3v3 / Tag Team Standings ── */}
        {(mode === '2v2' || mode === '3v3' || mode === 'tag_team') && !loading && !error && teamStandings.length === 0 && (
          <div className="bg-surface p-6 rounded-lg">
            <p className="text-secondary">No teams in this tier yet.</p>
          </div>
        )}

        {(mode === '2v2' || mode === '3v3' || mode === 'tag_team') && !loading && !error && teamStandings.length > 0 && (
          <>
            {/* Zone Legend & Status */}
            {teamZoneMeta && (
              <div className="bg-surface p-4 rounded-lg mb-4 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span>
                  <span className="text-secondary">Promotion zone (top 10%, ≥{teamZoneMeta.minLP} LP, ≥{teamZoneMeta.minCycles} cycles)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>
                  <span className="text-secondary">Demotion zone (bottom 10%, ≥{teamZoneMeta.minCycles} cycles)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-white inline-block"></span>
                  <span className="text-secondary">Eligible for promotion/demotion (≥{teamZoneMeta.minCycles} cycles)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-white/10 text-tertiary px-1.5 py-0.5 rounded font-medium">INACTIVE</span>
                  <span className="text-secondary">Not subscribed to this league</span>
                </div>
                {!teamZoneMeta.hasEnoughRobots && (
                  <div className="flex items-center gap-2 text-warning">
                    <span>⚠️</span>
                    <span>Promotion/demotion paused — need {teamZoneMeta.minRobotsRequired} eligible teams, currently {teamZoneMeta.eligibleCount}</span>
                  </div>
                )}
                {teamZoneMeta.isChampion && (
                  <div className="text-tertiary italic">No promotion from Champion tier</div>
                )}
                {teamZoneMeta.isBronze && (
                  <div className="text-tertiary italic">No demotion from Bronze tier</div>
                )}
              </div>
            )}
            <div className="bg-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full">
                  <thead className="bg-surface-elevated">
                    <tr>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">#</th>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">Team</th>
                      <th className="px-1.5 lg:px-4 py-3 text-left font-semibold text-sm lg:text-base">Stable</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">LP</th>
                      <th className="px-1.5 lg:px-4 py-3 text-center font-semibold text-sm lg:text-base">ELO</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">W-D-L</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStandings.map((team) => {
                      const rankColor = getRankColor(team.rank);
                      const isMyTeam = user && team.stableId === user.id;
                      const isInactive = team.isSubscribed === false;
                      const winRate =
                        team.totalMatches > 0
                          ? ((team.wins / team.totalMatches) * 100).toFixed(1)
                          : '0.0';

                      const zoneClass = team.zone === 'promotion'
                        ? 'border-l-4 border-l-green-500 bg-green-900/10'
                        : team.zone === 'demotion'
                          ? 'border-l-4 border-l-red-500 bg-red-900/10'
                          : '';

                      const eligibilityClass = isInactive ? 'opacity-40' : '';

                      return (
                        <tr
                          key={team.teamId}
                          className={`border-b border-white/10 ${zoneClass} ${eligibilityClass} ${
                            team.eligible ? (team.zone === 'promotion' ? 'border-l-2 border-l-green-500' : 'border-l-2 border-l-white') : ''
                          } ${
                            isMyTeam ? 'bg-blue-900 bg-opacity-30' : 'hover:bg-surface-elevated'
                          } transition-colors`}
                        >
                          <td className={`px-1.5 lg:px-4 py-3 font-bold ${rankColor} text-sm lg:text-base`}>
                            #{team.rank}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3">
                            <div className="space-y-0.5">
                              <div className={`flex items-center gap-1.5`}>
                                <span className={`font-semibold text-sm lg:text-base truncate max-w-[120px] lg:max-w-none ${isMyTeam ? 'text-primary' : 'text-white'}`}>
                                  {team.teamName}
                                </span>
                                {isInactive && (
                                  <span className="shrink-0 text-[10px] bg-white/10 text-tertiary px-1.5 py-0.5 rounded font-medium">
                                    INACTIVE
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-tertiary hidden lg:block">
                                {team.members.map((m) => m.robotName).join(', ')}
                              </div>
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-secondary text-sm lg:text-base">
                            <div className="flex items-center gap-1.5">
                              <OwnerNameLink
                                userId={team.stableId}
                                displayName={team.stableName}
                                className="truncate max-w-[80px] lg:max-w-none"
                              />
                              {isMyTeam && (
                                <span className="shrink-0 text-xs bg-primary text-white px-1.5 py-0.5 rounded font-semibold">
                                  YOU
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base text-warning">
                            {team.teamLp}
                          </td>
                          <td className="px-1.5 lg:px-4 py-3 text-center font-mono text-sm lg:text-base">
                            {team.teamELO}
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">
                            <span className="text-success">{team.wins}</span>
                            <span className="text-tertiary"> - </span>
                            <span className="text-warning">{team.draws}</span>
                            <span className="text-tertiary"> - </span>
                            <span className="text-error">{team.losses}</span>
                          </td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center font-mono">{winRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {teamPagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => handlePageChange(teamPagination.page - 1)}
                  disabled={teamPagination.page === 1}
                  className="px-4 py-2 bg-surface-elevated rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 min-h-[44px]"
                >
                  Previous
                </button>

                <div className="px-4 py-2 bg-surface rounded min-h-[44px] flex items-center">
                  Page {teamPagination.page} of {teamPagination.totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(teamPagination.page + 1)}
                  disabled={teamPagination.page === teamPagination.totalPages}
                  className="px-4 py-2 bg-surface-elevated rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 min-h-[44px]"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}


      </div>
    </div>
  );
}

export default LeagueStandingsPage;
