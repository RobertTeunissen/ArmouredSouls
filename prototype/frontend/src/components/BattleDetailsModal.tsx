import { useEffect, useState } from 'react';
import axios from 'axios';

interface BattleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  battleId: number | null;
}

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
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
  /** Per-robot HP map for N-robot modes (KotH/FFA) and consistent name-keyed access */
  robotHP?: Record<string, number>;
  /** Per-robot shield map for N-robot modes (KotH/FFA) and consistent name-keyed access */
  robotShield?: Record<string, number>;
  message: string;
  formulaBreakdown?: {
    calculation: string;
    components: Record<string, number>;
    result: number;
  };
}

/**
 * Extract HP and Shield values for a robot from a combat event.
 * Prefers the robotHP/robotShield maps (correct, keyed by name) over
 * the legacy robot1HP/robot2HP fields (which swap based on attacker/defender).
 */
function getEventHP(
  event: CombatEvent,
  robotName: string,
  robot1Name: string,
  robot2Name: string
): { hp: number | undefined; shield: number | undefined } {
  // Prefer robotHP/robotShield maps (correct source of truth, keyed by robot name)
  if (event.robotHP && robotName in event.robotHP) {
    return {
      hp: event.robotHP[robotName],
      shield: event.robotShield?.[robotName],
    };
  }
  
  // Legacy fallback for old battle data stored before this fix
  // Note: These values may be incorrect for events where robot2 attacked,
  // as the legacy fields swap based on attacker/defender roles
  if (robotName === robot1Name) {
    return { hp: event.robot1HP, shield: event.robot1Shield };
  }
  if (robotName === robot2Name) {
    return { hp: event.robot2HP, shield: event.robot2Shield };
  }
  
  return { hp: undefined, shield: undefined };
}

interface TeamRobot {
  id: number;
  name: string;
  userId?: number;
}

interface TeamData {
  id: number;
  activeRobot: TeamRobot;
  reserveRobot: TeamRobot;
  stableId: number;
  league: string;
}

interface BattleParticipant {
  robotId: number;
  team: number | null;
  role: string | null;
  credits: number | null;
  streamingRevenue: number | null;
  eloBefore: number | null;
  eloAfter: number | null;
  prestigeAwarded: number | null;
  fameAwarded: number | null;
  damageDealt: number | null;
  finalHP: number | null;
  yielded: boolean | null;
  destroyed: boolean | null;
}

function BattleDetailsModal({ isOpen, onClose, battleId }: BattleDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [battle, setBattle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && battleId) {
      fetchBattleDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, battleId]);

  const fetchBattleDetails = async () => {
    if (!battleId) return;

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/admin/battles/${battleId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setBattle(response.data);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(err.response?.data?.error || 'Failed to load battle details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'attack':
        return '💥';
      case 'critical':
        return '💢';
      case 'miss':
        return '❌';
      case 'counter':
        return '🔄';
      case 'shield_break':
        return '🛡️💥';
      case 'shield_regen':
        return '🛡️⚡';
      case 'yield':
        return '🏳️';
      case 'destroyed':
        return '💀';
      default:
        return '⚔️';
    }
  };

  const detailedEvents: CombatEvent[] =
    battle?.battleLog?.detailedCombatEvents || [];

  const isTagTeam = battle?.battleFormat === '2v2' || !!battle?.teams;
  const teams: { team1: TeamData; team2: TeamData | null } | null = battle?.teams ?? null;
  const participants: BattleParticipant[] = battle?.participants ?? [];

  /** Find participant stats for a given robot ID */
  const getParticipant = (robotId: number): BattleParticipant | undefined =>
    participants.find((p) => p.robotId === robotId);

  /** Render a single team member card */
  const renderTeamMember = (
    robot: TeamRobot,
    role: 'Active' | 'Reserve',
    colorClass: string
  ) => {
    const p = getParticipant(robot.id);
    return (
      <div className="bg-surface rounded p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-sm font-semibold ${colorClass}`}>{robot.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${role === 'Active' ? 'bg-green-900/40 text-green-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
            {role}
          </span>
        </div>
        {p && (
          <div className="text-xs space-y-0.5 text-secondary">
            {p.finalHP !== null && <p>Final HP: {p.finalHP}{p.destroyed ? ' 💀' : ''}{p.yielded ? ' 🏳️' : ''}</p>}
            {p.damageDealt !== null && <p>Damage Dealt: {p.damageDealt}</p>}
            {p.eloBefore !== null && p.eloAfter !== null && (
              <p>
                ELO: {p.eloBefore} →{' '}
                <span className={p.eloAfter > p.eloBefore ? 'text-success' : 'text-error'}>
                  {p.eloAfter}
                </span>
                {' ('}{p.eloAfter > p.eloBefore ? '+' : ''}{p.eloAfter - p.eloBefore})
              </p>
            )}
            {p.credits !== null && <p>Credits: +₡{p.credits.toLocaleString()}</p>}
            {(p.prestigeAwarded ?? 0) > 0 && <p>Prestige: +{p.prestigeAwarded}</p>}
            {(p.fameAwarded ?? 0) > 0 && <p>Fame: +{p.fameAwarded}</p>}
          </div>
        )}
        {!p && <div className="text-xs text-tertiary">No participant data</div>}
      </div>
    );
  };

  /** Render the tag team (2v2) battle summary */
  const renderTagTeamSummary = () => (
    <div className="bg-surface-elevated rounded-lg p-4">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xl font-bold">Tag Team Battle Summary</h3>
        <span className="text-xs px-2 py-1 rounded bg-purple-900/40 text-purple-300 font-semibold">2v2</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-primary">Team 1</h4>
            {teams?.team1.league && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">{teams.team1.league}</span>
            )}
          </div>
          {teams?.team1 ? (
            <>
              {renderTeamMember(teams.team1.activeRobot, 'Active', 'text-primary')}
              {renderTeamMember(teams.team1.reserveRobot, 'Reserve', 'text-primary')}
            </>
          ) : (
            <div className="bg-surface rounded p-3">
              <div className="text-sm text-primary mb-1">{battle.robot1.name}</div>
              <div className="text-xs text-secondary">Active robot (team data unavailable)</div>
            </div>
          )}
          {/* Tag-out info */}
          {battle.team1TagOutTime !== null && battle.team1TagOutTime !== undefined && (
            <div className="text-xs text-secondary">🔄 Tag-out at {battle.team1TagOutTime.toFixed(1)}s</div>
          )}
        </div>

        {/* Team 2 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-purple-400">Team 2</h4>
            {teams?.team2?.league && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300">{teams.team2.league}</span>
            )}
          </div>
          {teams?.team2 ? (
            <>
              {renderTeamMember(teams.team2.activeRobot, 'Active', 'text-purple-400')}
              {renderTeamMember(teams.team2.reserveRobot, 'Reserve', 'text-purple-400')}
            </>
          ) : (
            <div className="bg-surface rounded p-3">
              <div className="text-sm text-purple-400 mb-1">{battle.robot2.name}</div>
              <div className="text-xs text-secondary">Active robot (team data unavailable)</div>
            </div>
          )}
          {battle.team2TagOutTime !== null && battle.team2TagOutTime !== undefined && (
            <div className="text-xs text-secondary">🔄 Tag-out at {battle.team2TagOutTime.toFixed(1)}s</div>
          )}
        </div>
      </div>

      {/* Winner / Draw - compare with team IDs for tag team battles (Requirements 2.6, 2.8) */}
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold">
          {/* For tag team battles, winnerId should be team ID (after Task 3 fix) */}
          {teams?.team1 && battle.winnerId === teams.team1.id && (
            <span className="text-primary">🏆 Team 1 Wins!</span>
          )}
          {teams?.team2 && battle.winnerId === teams.team2.id && (
            <span className="text-purple-400">🏆 Team 2 Wins!</span>
          )}
          {/* Fallback for legacy data where winnerId might still be robot ID */}
          {!teams?.team1 && battle.winnerId === battle.robot1.id && (
            <span className="text-primary">🏆 Team 1 Wins!</span>
          )}
          {!teams?.team2 && battle.winnerId === battle.robot2.id && (
            <span className="text-purple-400">🏆 Team 2 Wins!</span>
          )}
          {!battle.winnerId && <span className="text-secondary">⚖️ Draw</span>}
        </div>
        <div className="text-sm text-secondary mt-2">
          Duration: {battle.durationSeconds}s | League: {battle.leagueType}
        </div>
      </div>

      {/* Team Rewards from participants - use team IDs for winner highlighting (Requirements 2.6, 2.8) */}
      {participants.length > 0 && (
        <div className="mt-4 bg-surface rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-3 text-warning">💰 Battle Rewards</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Team 1 Rewards - highlight if team1 won (winnerId === team1.id) */}
            <div className={`p-3 rounded ${(teams?.team1 && battle.winnerId === teams.team1.id) || (!teams?.team1 && battle.winnerId === battle.robot1.id) ? 'bg-green-900/30 border border-green-700' : 'bg-surface-elevated'}`}>
              <div className="font-semibold text-primary mb-2">Team 1</div>
              <div className="space-y-1">
                {participants.filter((p: BattleParticipant) => p.team === 1).map((p: BattleParticipant) => (
                  <div key={p.robotId} className="flex justify-between">
                    <span className="text-secondary">Credits:</span>
                    <span className="text-success">+₡{(p.credits ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Team 2 Rewards - highlight if team2 won (winnerId === team2.id) */}
            <div className={`p-3 rounded ${(teams?.team2 && battle.winnerId === teams.team2.id) || (!teams?.team2 && battle.winnerId === battle.robot2.id) ? 'bg-green-900/30 border border-green-700' : 'bg-surface-elevated'}`}>
              <div className="font-semibold text-purple-400 mb-2">Team 2</div>
              <div className="space-y-1">
                {participants.filter((p: BattleParticipant) => p.team === 2).map((p: BattleParticipant) => (
                  <div key={p.robotId} className="flex justify-between">
                    <span className="text-secondary">Credits:</span>
                    <span className="text-success">+₡{(p.credits ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Battle Details #{battleId}</h2>
            {isTagTeam && (
              <span className="text-xs px-2 py-1 rounded bg-purple-900/40 text-purple-300 font-semibold">2v2 Tag Team</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-primary text-xl">Loading battle details...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-900 text-red-200 p-4 rounded mb-4">{error}</div>
          )}

          {battle && (
            <div className="space-y-6">
              {/* Battle Summary — conditional on format */}
              {isTagTeam ? renderTagTeamSummary() : (
              <div className="bg-surface-elevated rounded-lg p-4">
                <h3 className="text-xl font-bold mb-3">Battle Summary</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Robot 1 */}
                  <div className="bg-surface rounded p-3">
                    <h4 className="text-lg font-semibold text-primary mb-2">
                      {battle.robot1.name}
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>
                        HP: {battle.robot1FinalHP} / {battle.robot1.maxHP}
                        {battle.robot1Destroyed && (
                          <span className="ml-2 text-error">💀 Destroyed</span>
                        )}
                        {battle.robot1Yielded && (
                          <span className="ml-2 text-warning">🏳️ Yielded</span>
                        )}
                      </p>
                      <p>Shield: {battle.robot1FinalShield}</p>
                      <p>Damage Dealt: {battle.robot1DamageDealt}</p>
                      <p>
                        ELO: {battle.robot1ELOBefore} →{' '}
                        <span
                          className={
                            battle.robot1ELOAfter > battle.robot1ELOBefore
                              ? 'text-success'
                              : 'text-error'
                          }
                        >
                          {battle.robot1ELOAfter}
                        </span>
                        {' ('}
                        {battle.robot1ELOAfter > battle.robot1ELOBefore ? '+' : ''}
                        {battle.robot1ELOAfter - battle.robot1ELOBefore})
                      </p>
                      <p>Loadout: {battle.robot1.loadout}</p>
                      <p>Stance: {battle.robot1.stance}</p>
                    </div>
                  </div>

                  {/* Robot 2 */}
                  <div className="bg-surface rounded p-3">
                    <h4 className="text-lg font-semibold text-purple-400 mb-2">
                      {battle.robot2.name}
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>
                        HP: {battle.robot2FinalHP} / {battle.robot2.maxHP}
                        {battle.robot2Destroyed && (
                          <span className="ml-2 text-error">💀 Destroyed</span>
                        )}
                        {battle.robot2Yielded && (
                          <span className="ml-2 text-warning">🏳️ Yielded</span>
                        )}
                      </p>
                      <p>Shield: {battle.robot2FinalShield}</p>
                      <p>Damage Dealt: {battle.robot2DamageDealt}</p>
                      <p>
                        ELO: {battle.robot2ELOBefore} →{' '}
                        <span
                          className={
                            battle.robot2ELOAfter > battle.robot2ELOBefore
                              ? 'text-success'
                              : 'text-error'
                          }
                        >
                          {battle.robot2ELOAfter}
                        </span>
                        {' ('}
                        {battle.robot2ELOAfter > battle.robot2ELOBefore ? '+' : ''}
                        {battle.robot2ELOAfter - battle.robot2ELOBefore})
                      </p>
                      <p>Loadout: {battle.robot2.loadout}</p>
                      <p>Stance: {battle.robot2.stance}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold">
                    {battle.winnerId === battle.robot1.id && (
                      <span className="text-primary">🏆 {battle.robot1.name} Wins!</span>
                    )}
                    {battle.winnerId === battle.robot2.id && (
                      <span className="text-purple-400">🏆 {battle.robot2.name} Wins!</span>
                    )}
                    {!battle.winnerId && <span className="text-secondary">⚖️ Draw</span>}
                  </div>
                  <div className="text-sm text-secondary mt-2">
                    Duration: {battle.durationSeconds}s | League: {battle.leagueType}
                  </div>
                </div>

                {/* Battle Rewards */}
                <div className="mt-4 bg-surface rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3 text-warning">💰 Battle Rewards</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* Robot 1 Rewards */}
                    <div className={`p-3 rounded ${battle.winnerId === battle.robot1.id ? 'bg-green-900/30 border border-green-700' : 'bg-surface-elevated'}`}>
                      <div className="font-semibold text-primary mb-2">{battle.robot1.name}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-secondary">Credits:</span>
                          <span className="text-success">
                            +₡{(battle.winnerId === battle.robot1.id ? battle.winnerReward : battle.loserReward)?.toLocaleString() || 0}
                          </span>
                        </div>
                        {battle.winnerId === battle.robot1.id && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-secondary">Prestige:</span>
                              <span className="text-purple-400">+{battle.robot1PrestigeAwarded || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-secondary">Fame:</span>
                              <span className="text-warning">+{battle.robot1FameAwarded || 0}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Robot 2 Rewards */}
                    <div className={`p-3 rounded ${battle.winnerId === battle.robot2.id ? 'bg-green-900/30 border border-green-700' : 'bg-surface-elevated'}`}>
                      <div className="font-semibold text-purple-400 mb-2">{battle.robot2.name}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-secondary">Credits:</span>
                          <span className="text-success">
                            +₡{(battle.winnerId === battle.robot2.id ? battle.winnerReward : battle.loserReward)?.toLocaleString() || 0}
                          </span>
                        </div>
                        {battle.winnerId === battle.robot2.id && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-secondary">Prestige:</span>
                              <span className="text-purple-400">+{battle.robot2PrestigeAwarded || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-secondary">Fame:</span>
                              <span className="text-warning">+{battle.robot2FameAwarded || 0}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Attribute Comparison */}
              <div className="bg-surface-elevated rounded-lg p-4">
                <h3 className="text-xl font-bold mb-3">Attribute Comparison</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Object.keys(battle.robot1.attributes).map((attr) => {
                    const val1 = Number(battle.robot1.attributes[attr]);
                    const val2 = Number(battle.robot2.attributes[attr]);
                    const diff = val1 - val2;
                    return (
                      <div key={attr} className="bg-surface rounded p-2">
                        <div className="text-secondary text-xs truncate" title={attr}>
                          {attr
                            .replace(/([A-Z])/g, ' $1')
                            .trim()
                            .replace(/^./, (str) => str.toUpperCase())}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-primary">{val1.toFixed(1)}</span>
                          <span
                            className={`text-xs ${
                              Math.abs(diff) < 0.5
                                ? 'text-tertiary'
                                : diff > 0
                                ? 'text-success'
                                : 'text-error'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {diff.toFixed(1)}
                          </span>
                          <span className="text-purple-400">{val2.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Combat Events */}
              {detailedEvents.length > 0 && (
                <div className="bg-surface-elevated rounded-lg p-4">
                  <h3 className="text-xl font-bold mb-3">
                    Combat Log ({detailedEvents.length} events)
                  </h3>
                  <div className="space-y-2 max-h-[48rem] overflow-y-auto">
                    {detailedEvents.map((event, idx) => (
                      <div key={idx} className="bg-surface rounded p-3">
                        <div
                          className="flex items-start cursor-pointer"
                          onClick={() =>
                            setExpandedEvent(expandedEvent === idx ? null : idx)
                          }
                        >
                          <span className="text-2xl mr-2">{getEventIcon(event.type)}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="text-sm">
                                <span className="text-secondary">
                                  [{event.timestamp.toFixed(1)}s]
                                </span>{' '}
                                <span>{event.message}</span>
                              </div>
                              {event.formulaBreakdown && (
                                <button className="text-primary text-xs hover:text-blue-300">
                                  {expandedEvent === idx ? '▼ Hide' : '▶ Details'}
                                </button>
                              )}
                            </div>

                            {/* HP/Shield State — uses robotHP map for correct values */}
                            {(event.robotHP || event.robot1HP !== undefined ||
                              event.robot2HP !== undefined) && (
                              <div className="text-xs text-secondary mt-1 flex gap-4 flex-wrap">
                                {(() => {
                                  // For N-robot battles (KotH, future modes), iterate over all robots in the map
                                  if (event.robotHP && Object.keys(event.robotHP).length > 0) {
                                    return Object.entries(event.robotHP).map(([name, hp]) => (
                                      <span key={name}>
                                        {name}: {hp}HP / {event.robotShield?.[name] ?? 0}S
                                      </span>
                                    ));
                                  }
                                  
                                  // Legacy fallback for old 1v1 battle data only
                                  const r1 = getEventHP(event, battle.robot1.name, battle.robot1.name, battle.robot2.name);
                                  const r2 = getEventHP(event, battle.robot2.name, battle.robot1.name, battle.robot2.name);
                                  return (
                                    <>
                                      {r1.hp !== undefined && (
                                        <span>
                                          {battle.robot1.name}: {r1.hp}HP / {r1.shield ?? 0}S
                                        </span>
                                      )}
                                      {r2.hp !== undefined && (
                                        <span>
                                          {battle.robot2.name}: {r2.hp}HP / {r2.shield ?? 0}S
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Formula Breakdown */}
                            {expandedEvent === idx && event.formulaBreakdown && (
                              <div className="mt-3 bg-background rounded p-3">
                                <div className="text-xs font-mono text-success mb-2 whitespace-pre-line">
                                  {event.formulaBreakdown.calculation}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {Object.entries(event.formulaBreakdown.components).map(
                                    ([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-secondary">{key}:</span>
                                        <span
                                          className={
                                            value > 0
                                              ? 'text-success'
                                              : value < 0
                                              ? 'text-error'
                                              : 'text-secondary'
                                          }
                                        >
                                          {typeof value === 'number'
                                            ? value.toFixed(2)
                                            : value}
                                        </span>
                                      </div>
                                    )
                                  )}
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
              )}

              {/* No detailed events warning */}
              {detailedEvents.length === 0 && (
                <div className="bg-yellow-900 text-yellow-200 p-4 rounded">
                  <p className="font-semibold">⚠️ No Detailed Combat Events</p>
                  <p className="text-sm mt-1">
                    This battle was fought using the old system or is a bye-match. Detailed
                    combat logs with formula breakdowns are only available for battles
                    fought with the new combat simulator.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-surface-elevated px-6 py-2 rounded font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BattleDetailsModal;
