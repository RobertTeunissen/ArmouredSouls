import type { BattleLogParticipant } from '../../utils/matchmakingApi';

/**
 * RobotSelector — horizontal pill bar for selecting which robot to view on mobile.
 * Shows all participants as tappable pills. Active pill is highlighted.
 */
export function RobotSelector({
  participants,
  selectedIndex,
  onSelect,
}: {
  participants: BattleLogParticipant[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (participants.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {participants.map((p, i) => (
        <button
          key={p.robotId}
          type="button"
          onClick={() => onSelect(i)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-150 ease-out ${
            i === selectedIndex
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white'
          }`}
        >
          {truncName(p.robotName, 16)}
        </button>
      ))}
    </div>
  );
}

function truncName(name: string, max: number): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}
