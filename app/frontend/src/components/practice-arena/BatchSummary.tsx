import { useState } from 'react';
import { BattlePlaybackViewer } from '../BattlePlaybackViewer/BattlePlaybackViewer';
import type { PracticeBatchResult } from './types';

export interface BatchSummaryProps {
  batch: PracticeBatchResult;
  ownedRobotName?: string;
}

export function BatchSummary({ batch, ownedRobotName }: BatchSummaryProps) {
  const { aggregate } = batch;
  const robot1Name = batch.results[0]?.robot1Info.name || 'Robot 1';
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Determine win counts from player's perspective
  const playerName = ownedRobotName || robot1Name;
  const playerWins = batch.results.filter(r => {
    if (r.combatResult.isDraw) return false;
    const r1Won = r.combatResult.robot1FinalHP > r.combatResult.robot2FinalHP;
    const winner = r1Won ? r.robot1Info.name : r.robot2Info.name;
    return winner === playerName;
  }).length;
  const opponentWins = aggregate.totalBattles - playerWins - aggregate.draws;

  return (
    <div className="space-y-3">
      <div className="bg-surface rounded-lg p-3">
        <h3 className="text-lg font-semibold text-primary mb-2">
          📊 Batch Results ({aggregate.totalBattles} simulations)
        </h3>
        <div className="grid grid-cols-3 gap-3 text-sm text-center">
          <div className="bg-green-900/20 rounded p-2">
            <p className="text-success font-bold text-xl">{playerWins}</p>
            <p className="text-xs text-secondary">Wins</p>
          </div>
          <div className="bg-red-900/20 rounded p-2">
            <p className="text-error font-bold text-xl">{opponentWins}</p>
            <p className="text-xs text-secondary">Losses</p>
          </div>
          <div className="bg-surface-elevated rounded p-2">
            <p className="text-secondary font-bold text-xl">{aggregate.draws}</p>
            <p className="text-xs text-secondary">Draws</p>
          </div>
        </div>
        <p className="text-xs text-secondary text-center mt-2">
          Avg duration: {aggregate.avgDurationSeconds.toFixed(1)}s
        </p>
      </div>

      {/* Individual results — expandable, each shows the full BattlePlaybackViewer */}
      <div className="space-y-1">
        {batch.results.map((r, idx) => {
          const r1Won = r.combatResult.robot1FinalHP > r.combatResult.robot2FinalHP;
          const winnerIsPlayer = !r.combatResult.isDraw && (r1Won ? r.robot1Info.name : r.robot2Info.name) === playerName;
          return (
            <div key={idx} className="border border-white/10 rounded">
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              >
                <span>
                  {r.combatResult.isDraw ? '🤝' : winnerIsPlayer ? '🏆' : '💀'} Battle {idx + 1}
                </span>
                <span className="text-secondary">{r.combatResult.durationSeconds}s {expandedIdx === idx ? '▼' : '▶'}</span>
              </button>
              {expandedIdx === idx && (
                <div className="p-3 border-t border-white/10">
                  <BattlePlaybackViewer
                    battleResult={r.combatResult}
                    robot1Info={{
                      name: r.robot1Info.name,
                      teamIndex: 0,
                      maxHP: r.robot1Info.maxHP,
                      maxShield: r.robot1Info.maxShield,
                    }}
                    robot2Info={{
                      name: r.robot2Info.name,
                      teamIndex: 1,
                      maxHP: r.robot2Info.maxHP,
                      maxShield: r.robot2Info.maxShield,
                    }}
                    narrativeEvents={r.battleLog}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
