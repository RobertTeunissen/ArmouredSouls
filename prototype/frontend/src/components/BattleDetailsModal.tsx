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
  message: string;
  formulaBreakdown?: {
    calculation: string;
    components: Record<string, number>;
    result: number;
  };
}

function BattleDetailsModal({ isOpen, onClose, battleId }: BattleDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [battle, setBattle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && battleId) {
      fetchBattleDetails();
    }
  }, [isOpen, battleId]);

  const fetchBattleDetails = async () => {
    if (!battleId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/admin/battles/${battleId}`);
      setBattle(response.data);
    } catch (err: any) {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Battle Details #{battleId}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-blue-400 text-xl">Loading battle details...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-900 text-red-200 p-4 rounded mb-4">{error}</div>
          )}

          {battle && (
            <div className="space-y-6">
              {/* Battle Summary */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-xl font-bold mb-3">Battle Summary</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Robot 1 */}
                  <div className="bg-gray-800 rounded p-3">
                    <h4 className="text-lg font-semibold text-blue-400 mb-2">
                      {battle.robot1.name}
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>
                        HP: {battle.robot1FinalHP} / {battle.robot1.maxHP}
                        {battle.robot1Destroyed && (
                          <span className="ml-2 text-red-400">💀 Destroyed</span>
                        )}
                        {battle.robot1Yielded && (
                          <span className="ml-2 text-yellow-400">🏳️ Yielded</span>
                        )}
                      </p>
                      <p>Shield: {battle.robot1FinalShield}</p>
                      <p>Damage Dealt: {battle.robot1DamageDealt}</p>
                      <p>
                        ELO: {battle.robot1ELOBefore} →{' '}
                        <span
                          className={
                            battle.robot1ELOAfter > battle.robot1ELOBefore
                              ? 'text-green-400'
                              : 'text-red-400'
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
                  <div className="bg-gray-800 rounded p-3">
                    <h4 className="text-lg font-semibold text-purple-400 mb-2">
                      {battle.robot2.name}
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>
                        HP: {battle.robot2FinalHP} / {battle.robot2.maxHP}
                        {battle.robot2Destroyed && (
                          <span className="ml-2 text-red-400">💀 Destroyed</span>
                        )}
                        {battle.robot2Yielded && (
                          <span className="ml-2 text-yellow-400">🏳️ Yielded</span>
                        )}
                      </p>
                      <p>Shield: {battle.robot2FinalShield}</p>
                      <p>Damage Dealt: {battle.robot2DamageDealt}</p>
                      <p>
                        ELO: {battle.robot2ELOBefore} →{' '}
                        <span
                          className={
                            battle.robot2ELOAfter > battle.robot2ELOBefore
                              ? 'text-green-400'
                              : 'text-red-400'
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
                      <span className="text-blue-400">🏆 {battle.robot1.name} Wins!</span>
                    )}
                    {battle.winnerId === battle.robot2.id && (
                      <span className="text-purple-400">🏆 {battle.robot2.name} Wins!</span>
                    )}
                    {!battle.winnerId && <span className="text-gray-400">⚖️ Draw</span>}
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    Duration: {battle.durationSeconds}s | League: {battle.leagueType}
                  </div>
                </div>
              </div>

              {/* Attribute Comparison */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-xl font-bold mb-3">Attribute Comparison</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Object.keys(battle.robot1.attributes).map((attr) => {
                    const val1 = Number(battle.robot1.attributes[attr]);
                    const val2 = Number(battle.robot2.attributes[attr]);
                    const diff = val1 - val2;
                    return (
                      <div key={attr} className="bg-gray-800 rounded p-2">
                        <div className="text-gray-400 text-xs truncate" title={attr}>
                          {attr
                            .replace(/([A-Z])/g, ' $1')
                            .trim()
                            .replace(/^./, (str) => str.toUpperCase())}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-blue-400">{val1.toFixed(1)}</span>
                          <span
                            className={`text-xs ${
                              Math.abs(diff) < 0.5
                                ? 'text-gray-500'
                                : diff > 0
                                ? 'text-green-400'
                                : 'text-red-400'
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
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-xl font-bold mb-3">
                    Combat Log ({detailedEvents.length} events)
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {detailedEvents.map((event, idx) => (
                      <div key={idx} className="bg-gray-800 rounded p-3">
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
                                <span className="text-gray-400">
                                  [{event.timestamp.toFixed(1)}s]
                                </span>{' '}
                                <span>{event.message}</span>
                              </div>
                              {event.formulaBreakdown && (
                                <button className="text-blue-400 text-xs hover:text-blue-300">
                                  {expandedEvent === idx ? '▼ Hide' : '▶ Details'}
                                </button>
                              )}
                            </div>

                            {/* HP/Shield State */}
                            {(event.robot1HP !== undefined ||
                              event.robot2HP !== undefined) && (
                              <div className="text-xs text-gray-400 mt-1 flex gap-4">
                                {event.robot1HP !== undefined && (
                                  <span>
                                    {battle.robot1.name}: {event.robot1HP}HP /{' '}
                                    {event.robot1Shield}S
                                  </span>
                                )}
                                {event.robot2HP !== undefined && (
                                  <span>
                                    {battle.robot2.name}: {event.robot2HP}HP /{' '}
                                    {event.robot2Shield}S
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Formula Breakdown */}
                            {expandedEvent === idx && event.formulaBreakdown && (
                              <div className="mt-3 bg-gray-900 rounded p-3">
                                <div className="text-xs font-mono text-green-400 mb-2">
                                  {event.formulaBreakdown.calculation}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {Object.entries(event.formulaBreakdown.components).map(
                                    ([key, value]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-gray-400">{key}:</span>
                                        <span
                                          className={
                                            value > 0
                                              ? 'text-green-400'
                                              : value < 0
                                              ? 'text-red-400'
                                              : 'text-gray-300'
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
                                <div className="mt-2 text-xs text-yellow-400">
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
        <div className="border-t border-gray-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default BattleDetailsModal;
