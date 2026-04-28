/**
 * BattleLogsPage — Battle history with type filters, search, pagination,
 * and detailed battle report slide-over with combat log and participant data.
 *
 * Requirements: 10.1–10.7, 25.1–25.4
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader, AdminStatCard, AdminFilterBar, AdminSlideOver, AdminEmptyState } from '../../components/admin/shared';
import { getBattleOutcome, getBattleHighlight } from '../../components/admin/battleLogHelpers';
import apiClient from '../../utils/apiClient';
import type { Battle, BattleListResponse } from '../../components/admin/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Participant {
  robotId: number;
  team: number | null;
  role: string | null;
  credits: number;
  streamingRevenue: number;
  eloBefore: number;
  eloAfter: number;
  prestigeAwarded: number;
  fameAwarded: number;
  damageDealt: number;
  finalHP: number;
  yielded: boolean;
  destroyed: boolean;
}

interface NarrativeEvent {
  timestamp: number;
  type: string;
  message: string;
  attacker?: string;
  defender?: string;
  weapon?: string;
  [key: string]: unknown;
}

interface BattleLogData {
  events?: NarrativeEvent[];
  detailedCombatEvents?: unknown[];
  isByeMatch?: boolean;
  isTournament?: boolean;
  round?: number;
  maxRounds?: number;
  isFinals?: boolean;
  tagTeamBattle?: boolean;
  isKothMatch?: boolean;
  participantCount?: number;
  placements?: Array<{ robotId: number; robotName: string; placement: number; zoneScore: number; kills: number; destroyed: boolean }>;
  kothData?: { participantCount: number; scoreThreshold: number };
}

interface RobotDetail {
  id: number;
  name: string;
  userId: number;
  maxHP: number;
  maxShield: number;
  loadout: string;
  stance: string;
  attributes: Record<string, unknown>;
}

interface BattleDetail {
  id: number;
  battleType: string;
  battleFormat: '1v1' | '2v2';
  leagueType: string;
  durationSeconds: number;
  createdAt: string;
  robot1: RobotDetail;
  robot2: RobotDetail;
  participants: Participant[];
  winnerId: number | null;
  robot1ELOBefore: number;
  robot2ELOBefore: number;
  robot1ELOAfter: number;
  robot2ELOAfter: number;
  eloChange: number;
  winnerReward: number;
  loserReward: number;
  battleLog: BattleLogData | null;
  teams?: {
    team1: { id: number; activeRobot: { id: number; name: string }; reserveRobot: { id: number; name: string }; stableId: number; league: string };
    team2: { id: number; activeRobot: { id: number; name: string }; reserveRobot: { id: number; name: string }; stableId: number; league: string } | null;
  };
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function BattleLogsPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [pagination, setPagination] = useState<BattleListResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [battleTypeFilter, setBattleTypeFilter] = useState('all');

  // Use ref to avoid stale closure in filter toggle
  const filterRef = useRef(battleTypeFilter);
  filterRef.current = battleTypeFilter;
  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;

  // Slide-over state
  const [selectedBattle, setSelectedBattle] = useState<BattleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  /* ---------- Data fetching ---------- */

  const fetchBattles = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (searchRef.current) params.search = searchRef.current;
      if (filterRef.current !== 'all') params.battleType = filterRef.current;

      const response = await apiClient.get<BattleListResponse>('/api/admin/battles', { params });
      setBattles(response.data.battles);
      setPagination(response.data.pagination);
      setCurrentPage(page);
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBattles(1);
  }, [fetchBattles]);

  const handleSearch = () => {
    fetchBattles(1);
  };

  const handleFilterToggle = (key: string) => {
    setBattleTypeFilter(key);
    filterRef.current = key;
    fetchBattles(1);
  };

  const handleViewBattle = async (battleId: number) => {
    setDetailLoading(true);
    setSlideOverOpen(true);
    try {
      const response = await apiClient.get<BattleDetail>(`/api/admin/battles/${battleId}`);
      setSelectedBattle(response.data);
    } catch {
      setSelectedBattle(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalBattles = pagination?.totalBattles ?? 0;

  return (
    <div data-testid="battle-logs-page" className="space-y-6">
      <AdminPageHeader
        title="Battle Logs"
        subtitle="Battle history, combat reports, and formula breakdowns"
        actions={
          <button type="button" onClick={() => fetchBattles(currentPage)} disabled={loading} className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors">
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {/* Filter Chips */}
      <AdminFilterBar
        filters={[
          { key: 'all', label: 'All Types', active: battleTypeFilter === 'all' },
          { key: 'league', label: 'League', active: battleTypeFilter === 'league' },
          { key: 'tournament', label: 'Tournament', active: battleTypeFilter === 'tournament' },
          { key: 'tagteam', label: 'Tag Team', active: battleTypeFilter === 'tagteam' },
          { key: 'koth', label: 'KotH', active: battleTypeFilter === 'koth' },
        ]}
        onFilterToggle={handleFilterToggle}
      >
        <input
          type="text"
          placeholder="Search by robot name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="bg-surface-elevated text-white px-4 py-2 rounded text-sm w-64"
        />
        <button onClick={handleSearch} disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold text-sm transition-colors">
          Search
        </button>
      </AdminFilterBar>

      {/* Mini-Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard label="Total Battles" value={totalBattles} color="primary" icon={<span>⚔️</span>} />
        <AdminStatCard label="Page" value={`${currentPage}/${pagination?.totalPages ?? 1}`} color="info" icon={<span>📄</span>} />
        <AdminStatCard label="Showing" value={battles.length} color="info" />
        <AdminStatCard label="Filter" value={battleTypeFilter === 'all' ? 'All Types' : battleTypeFilter} color="success" />
      </div>

      {/* Battle Table */}
      {battles.length > 0 ? (
        <div className="bg-surface rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated">
              <tr>
                <th className="p-3 text-left text-secondary">ID</th>
                <th className="p-3 text-left text-secondary">Format</th>
                <th className="p-3 text-left text-secondary">Robot 1</th>
                <th className="p-3 text-left text-secondary">Robot 2</th>
                <th className="p-3 text-left text-secondary">Winner</th>
                <th className="p-3 text-left text-secondary">League</th>
                <th className="p-3 text-left text-secondary">Duration</th>
                <th className="p-3 text-left text-secondary">Date</th>
              </tr>
            </thead>
            <tbody>
              {battles.map((battle) => {
                const outcome = getBattleOutcome(battle);
                const highlight = getBattleHighlight(battle);
                const format = battle.battleType === 'koth' ? 'koth' : battle.battleFormat === '2v2' ? '2v2' : '1v1';

                return (
                  <tr key={battle.id} className={`border-t border-white/10 hover:bg-surface-elevated cursor-pointer ${highlight}`} onClick={() => handleViewBattle(battle.id)}>
                    <td className="p-3">#{battle.id}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${format === 'koth' ? 'bg-orange-600/30 text-orange-300' : format === '2v2' ? 'bg-purple-600/30 text-purple-300' : 'bg-blue-600/30 text-blue-300'}`}>
                        {format === 'koth' ? '👑 KotH' : format}
                      </span>
                    </td>
                    <td className="p-3">
                      <Link to={`/robots/${battle.robot1.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {battle.robot1.name}
                      </Link>
                      <div className="text-xs text-secondary">ELO: {battle.robot1ELOBefore} → {battle.robot1ELOAfter}</div>
                    </td>
                    <td className="p-3">
                      <Link to={`/robots/${battle.robot2.id}`} className="text-purple-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {battle.robot2.name}
                      </Link>
                      <div className="text-xs text-secondary">ELO: {battle.robot2ELOBefore} → {battle.robot2ELOAfter}</div>
                    </td>
                    <td className="p-3">
                      <span className={outcome.color}>{outcome.icon} {battle.winnerName}</span>
                      <div className="text-xs text-secondary">{outcome.label}</div>
                    </td>
                    <td className="p-3"><span className="px-2 py-1 bg-surface-elevated rounded text-xs">{battle.leagueType}</span></td>
                    <td className="p-3"><span className={battle.durationSeconds > 90 ? 'text-warning font-semibold' : ''}>{battle.durationSeconds}s</span></td>
                    <td className="p-3 text-xs text-secondary">{new Date(battle.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t border-white/5">
              <span className="text-xs text-secondary">Page {pagination.page} of {pagination.totalPages} ({pagination.totalBattles} total)</span>
              <div className="flex gap-2">
                <button onClick={() => fetchBattles(currentPage - 1)} disabled={currentPage === 1 || loading} className="px-3 py-1 text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-40 transition-colors">Prev</button>
                <button onClick={() => fetchBattles(currentPage + 1)} disabled={!pagination.hasMore || loading} className="px-3 py-1 text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-40 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        !loading && <AdminEmptyState icon="⚔️" title="No battles found" description="Try adjusting your search or filters." action={{ label: 'Load Battles', onClick: () => fetchBattles(1) }} />
      )}

      {loading && battles.length === 0 && (
        <div className="text-center py-8 text-secondary">Loading battles...</div>
      )}

      {/* Battle Detail Slide-Over */}
      <AdminSlideOver open={slideOverOpen} onClose={() => setSlideOverOpen(false)} title={`Battle #${selectedBattle?.id ?? ''}`} width="xl">
        {detailLoading ? (
          <div className="text-center py-8 text-secondary">Loading battle details...</div>
        ) : selectedBattle ? (
          <BattleDetailPanel battle={selectedBattle} />
        ) : (
          <p className="text-secondary">Failed to load battle details.</p>
        )}
      </AdminSlideOver>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Battle Detail Panel                                                */
/* ------------------------------------------------------------------ */

interface CombatEvent {
  timestamp: number;
  type: string;
  attacker?: string;
  defender?: string;
  damage?: number;
  shieldDamage?: number;
  hpDamage?: number;
  hit?: boolean;
  critical?: boolean;
  counter?: boolean;
  robotHP?: Record<string, number>;
  robotShield?: Record<string, number>;
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
  message: string;
  formulaBreakdown?: {
    calculation: string;
    components: Record<string, number>;
    result: number;
  };
}

const EVENT_ICONS: Record<string, string> = {
  attack: '💥',
  critical: '💢',
  critical_hit: '💢',
  miss: '❌',
  counter: '🔄',
  counter_attack: '🔄',
  shield_break: '🛡️💥',
  shield_regen: '🛡️⚡',
  yield: '🏳️',
  destroyed: '💀',
  destruction: '💀',
  tag_in: '🔄',
  battle_start: '🏁',
  battle_end: '🏁',
  movement: '🏃',
  malfunction: '⚡',
};

function BattleDetailPanel({ battle }: { battle: BattleDetail }) {
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const log = battle.battleLog as BattleLogData | null;
  const detailedEvents: CombatEvent[] = (log?.detailedCombatEvents as CombatEvent[]) ?? [];
  const winner = battle.winnerId;
  const r1Won = winner === battle.robot1.id;
  const r2Won = winner === battle.robot2.id;
  const isDraw = winner === null;

  const p1 = battle.participants.find(p => p.robotId === battle.robot1.id);
  const p2 = battle.participants.find(p => p.robotId === battle.robot2.id);

  return (
    <div className="space-y-5">
      {/* Result Banner */}
      <div className="bg-surface-elevated rounded-lg p-4 text-center">
        <div className="flex items-center justify-center gap-4">
          <div className={`text-right flex-1 ${r1Won ? 'text-success' : ''}`}>
            <p className="font-bold text-lg">{battle.robot1.name}</p>
            <p className="text-xs text-secondary">{battle.robot1.stance} · {battle.robot1.loadout}</p>
          </div>
          <div className="text-2xl font-bold text-secondary">vs</div>
          <div className={`text-left flex-1 ${r2Won ? 'text-success' : ''}`}>
            <p className="font-bold text-lg">{battle.robot2.name}</p>
            <p className="text-xs text-secondary">{battle.robot2.stance} · {battle.robot2.loadout}</p>
          </div>
        </div>
        <div className="mt-2 text-sm">
          {isDraw
            ? <span className="text-secondary">⚖️ Draw</span>
            : <span className="text-success">🏆 {r1Won ? battle.robot1.name : battle.robot2.name} wins</span>}
          <span className="text-secondary ml-2">· {battle.battleType} · {battle.leagueType} · {battle.durationSeconds}s</span>
        </div>
        <p className="text-xs text-tertiary mt-1">{new Date(battle.createdAt).toLocaleString()}</p>
      </div>

      {/* Tag Team Info */}
      {battle.teams && (
        <div className="bg-surface-elevated rounded-lg p-4">
          <h4 className="text-sm font-semibold text-secondary mb-2">🏷️ Tag Team</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-primary">Team 1</p>
              <p className="text-xs text-secondary">Active: {battle.teams.team1.activeRobot.name}</p>
              <p className="text-xs text-secondary">Reserve: {battle.teams.team1.reserveRobot.name}</p>
            </div>
            {battle.teams.team2 && (
              <div>
                <p className="font-semibold text-purple-400">Team 2</p>
                <p className="text-xs text-secondary">Active: {battle.teams.team2.activeRobot.name}</p>
                <p className="text-xs text-secondary">Reserve: {battle.teams.team2.reserveRobot.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Participant Stats */}
      <div className="bg-surface-elevated rounded-lg p-4">
        <h4 className="text-sm font-semibold text-secondary mb-3">📊 Participant Stats</h4>
        <div className="grid grid-cols-2 gap-4">
          <ParticipantCard robot={battle.robot1} participant={p1} isWinner={r1Won} />
          <ParticipantCard robot={battle.robot2} participant={p2} isWinner={r2Won} />
        </div>
      </div>

      {/* ELO & Rewards */}
      <div className="bg-surface-elevated rounded-lg p-4">
        <h4 className="text-sm font-semibold text-secondary mb-3">📈 ELO & Rewards</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-secondary">{battle.robot1.name}</p>
            <p>ELO: {battle.robot1ELOBefore} → {battle.robot1ELOAfter} <EloChange before={battle.robot1ELOBefore} after={battle.robot1ELOAfter} /></p>
          </div>
          <div>
            <p className="text-secondary">{battle.robot2.name}</p>
            <p>ELO: {battle.robot2ELOBefore} → {battle.robot2ELOAfter} <EloChange before={battle.robot2ELOBefore} after={battle.robot2ELOAfter} /></p>
          </div>
        </div>
        <div className="mt-3 text-xs text-secondary">
          Winner reward: ₡{battle.winnerReward?.toLocaleString() ?? 0} · Loser reward: ₡{battle.loserReward?.toLocaleString() ?? 0}
        </div>
      </div>

      {/* Attribute Comparison */}
      {battle.robot1.attributes && Object.keys(battle.robot1.attributes).length > 0 && (
        <div className="bg-surface-elevated rounded-lg p-4">
          <h4 className="text-sm font-semibold text-secondary mb-3">⚙️ Attribute Comparison</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.keys(battle.robot1.attributes).map((attr) => {
              const val1 = Number(battle.robot1.attributes[attr]);
              const val2 = Number(battle.robot2.attributes[attr]);
              const diff = val1 - val2;
              return (
                <div key={attr} className="bg-surface rounded p-2">
                  <div className="text-secondary text-xs truncate" title={attr}>
                    {attr.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-primary">{val1.toFixed(1)}</span>
                    <span className={`text-xs ${Math.abs(diff) < 0.5 ? 'text-tertiary' : diff > 0 ? 'text-success' : 'text-error'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                    </span>
                    <span className="text-purple-400">{val2.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KotH Placements */}
      {log?.placements && log.placements.length > 0 && (
        <div className="bg-surface-elevated rounded-lg p-4">
          <h4 className="text-sm font-semibold text-secondary mb-3">👑 KotH Placements</h4>
          <div className="space-y-1">
            {log.placements.sort((a, b) => a.placement - b.placement).map((p) => (
              <div key={p.robotId} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
                <span>#{p.placement} {p.robotName} {p.destroyed && <span className="text-error text-xs">💀</span>}</span>
                <span className="text-secondary">Score: {p.zoneScore} · Kills: {p.kills}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Combat Log with Formula Breakdowns */}
      {detailedEvents.length > 0 ? (
        <div className="bg-surface-elevated rounded-lg p-4">
          <h4 className="text-sm font-semibold text-secondary mb-3">
            ⚔️ Combat Log ({detailedEvents.length} events)
          </h4>
          <div className="space-y-2 max-h-[48rem] overflow-y-auto">
            {detailedEvents.map((event, idx) => (
              <div key={idx} className="bg-surface rounded p-3">
                <div
                  className="flex items-start cursor-pointer"
                  onClick={() => setExpandedEvent(expandedEvent === idx ? null : idx)}
                >
                  <span className="text-xl mr-2">{EVENT_ICONS[event.type] ?? '⚔️'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div className="text-sm">
                        <span className="text-secondary">[{event.timestamp.toFixed(1)}s]</span>{' '}
                        <span>{event.message}</span>
                      </div>
                      {event.formulaBreakdown && (
                        <button className="text-primary text-xs hover:text-blue-300 shrink-0 ml-2">
                          {expandedEvent === idx ? '▼ Hide' : '▶ Details'}
                        </button>
                      )}
                    </div>

                    {/* HP/Shield State */}
                    {(event.robotHP || event.robot1HP !== undefined) && (
                      <div className="text-xs text-secondary mt-1 flex gap-4 flex-wrap">
                        {event.robotHP && Object.keys(event.robotHP).length > 0
                          ? Object.entries(event.robotHP).map(([name, hp]) => (
                              <span key={name}>{name}: {hp}HP / {event.robotShield?.[name] ?? 0}S</span>
                            ))
                          : (
                            <>
                              {event.robot1HP !== undefined && <span>{battle.robot1.name}: {event.robot1HP}HP / {event.robot1Shield ?? 0}S</span>}
                              {event.robot2HP !== undefined && <span>{battle.robot2.name}: {event.robot2HP}HP / {event.robot2Shield ?? 0}S</span>}
                            </>
                          )}
                      </div>
                    )}

                    {/* Formula Breakdown */}
                    {expandedEvent === idx && event.formulaBreakdown && (
                      <div className="mt-3 bg-background rounded p-3">
                        <div className="text-xs font-mono text-success mb-2 whitespace-pre-line">
                          {event.formulaBreakdown.calculation}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {Object.entries(event.formulaBreakdown.components).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-secondary">{key}:</span>
                              <span className={value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-secondary'}>
                                {typeof value === 'number' ? value.toFixed(2) : value}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-warning">
                          Result: {event.formulaBreakdown.result.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-900/30 border border-yellow-700/30 text-yellow-200 p-4 rounded">
          <p className="font-semibold">⚠️ No Detailed Combat Events</p>
          <p className="text-sm mt-1">
            This battle was fought using the old system or is a bye-match. Detailed
            combat logs with formula breakdowns are only available for battles
            fought with the new combat simulator.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ParticipantCard({ robot, participant, isWinner }: { robot: RobotDetail; participant?: Participant; isWinner: boolean }) {
  if (!participant) return <div className="text-secondary text-sm">No participant data</div>;
  return (
    <div className={`rounded p-3 text-sm ${isWinner ? 'bg-green-900/20 border border-green-700/30' : 'bg-surface'}`}>
      <p className="font-semibold mb-1">{robot.name} {isWinner && <span className="text-success text-xs">🏆</span>}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        <span className="text-secondary">Final HP:</span>
        <span className={participant.finalHP <= 0 ? 'text-error' : ''}>{participant.finalHP} / {robot.maxHP}</span>
        <span className="text-secondary">Damage Dealt:</span>
        <span>{participant.damageDealt}</span>
        <span className="text-secondary">Credits:</span>
        <span>₡{participant.credits.toLocaleString()}</span>
        <span className="text-secondary">Streaming:</span>
        <span>₡{participant.streamingRevenue.toLocaleString()}</span>
        <span className="text-secondary">Prestige:</span>
        <span>{participant.prestigeAwarded}</span>
        <span className="text-secondary">Fame:</span>
        <span>{participant.fameAwarded}</span>
        {participant.yielded && <><span className="text-secondary">Yielded:</span><span className="text-warning">Yes</span></>}
        {participant.destroyed && <><span className="text-secondary">Destroyed:</span><span className="text-error">Yes</span></>}
      </div>
    </div>
  );
}

function EloChange({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  if (diff === 0) return null;
  return <span className={`text-xs ml-1 ${diff > 0 ? 'text-success' : 'text-error'}`}>({diff > 0 ? '+' : ''}{diff})</span>;
}

export default BattleLogsPage;
