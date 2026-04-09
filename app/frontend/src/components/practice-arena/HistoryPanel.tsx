import type { PracticeHistoryEntry } from '../../hooks/usePracticeHistory';

export interface HistoryPanelProps {
  results: PracticeHistoryEntry[];
  onClear: () => void;
  ownedRobotName?: string;
}

export function HistoryPanel({ results, onClear, ownedRobotName }: HistoryPanelProps) {
  if (results.length === 0) {
    return (
      <div className="text-sm text-secondary text-center py-4">
        No recent simulations
      </div>
    );
  }

  const getWinnerName = (entry: PracticeHistoryEntry): string | null => {
    if (entry.combatResult.isDraw) return null;
    // Use winnerId if available, fall back to HP comparison
    if (entry.combatResult.winnerId != null) {
      // winnerId is the robot's actual ID — negative for sparring partners
      // Since we don't store IDs in history, use HP comparison
    }
    if (entry.combatResult.robot1FinalHP > entry.combatResult.robot2FinalHP) return entry.robot1.name;
    if (entry.combatResult.robot2FinalHP > entry.combatResult.robot1FinalHP) return entry.robot2.name;
    // Both 0 or equal — treat as draw
    return null;
  };

  const getResultIcon = (entry: PracticeHistoryEntry): string => {
    if (entry.combatResult.isDraw) return '🤝';
    const winner = getWinnerName(entry);
    if (!winner) return '🤝';
    if (!ownedRobotName) return '🏆';
    return winner === ownedRobotName ? '🏆' : '💀';
  };

  const getResultColor = (entry: PracticeHistoryEntry): string => {
    if (entry.combatResult.isDraw) return 'text-secondary';
    const winner = getWinnerName(entry);
    if (!winner) return 'text-secondary';
    if (!ownedRobotName) return 'text-success';
    return winner === ownedRobotName ? 'text-success' : 'text-error';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide">
          Recent Simulations
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-error hover:text-red-400 transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {[...results].reverse().map((entry, idx) => {
          const icon = getResultIcon(entry);
          const color = getResultColor(entry);
          const opponent = entry.robot1.name === ownedRobotName ? entry.robot2.name : entry.robot1.name;
          return (
            <div
              key={idx}
              className="bg-surface rounded p-2 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={color}>{icon}</span>
                <span className="text-primary truncate">vs {opponent}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-tertiary">{entry.combatResult.durationSeconds}s</span>
                <span className="text-secondary">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
