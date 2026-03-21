/**
 * Helper utilities for BattleLogsTab — outcome display and row highlighting.
 */
import type { Battle } from './types';

/** Battle outcome icon, label, and colour based on winner / HP. */
export const getBattleOutcome = (battle: Battle): { icon: string; label: string; color: string } => {
  if (battle.battleType === 'koth') {
    return { icon: '👑', label: 'King of the Hill', color: 'text-orange-400' };
  }

  if (battle.winnerId === null) {
    return { icon: '⚖️', label: 'Draw', color: 'text-secondary' };
  }

  const winnerHP =
    battle.winnerId === battle.robot1.id ? battle.robot1FinalHP : battle.robot2FinalHP;

  if (winnerHP > 50) {
    return { icon: '🏆', label: 'Clear Victory', color: 'text-success' };
  } else if (winnerHP > 0) {
    return { icon: '💪', label: 'Narrow Victory', color: 'text-warning' };
  }

  return { icon: '🏆', label: 'Victory', color: 'text-primary' };
};

/** Left-border highlight for unusual battles (draw, long, big ELO swing). */
export const getBattleHighlight = (battle: Battle): string => {
  if (battle.battleType === 'koth') {
    return 'border-l-4 border-orange-500';
  }
  if (battle.winnerId === null) {
    return 'border-l-4 border-red-500';
  }
  if (battle.durationSeconds > 90) {
    return 'border-l-4 border-yellow-500';
  }
  const eloSwing = Math.abs(battle.robot1ELOAfter - battle.robot1ELOBefore);
  if (eloSwing > 50) {
    return 'border-l-4 border-blue-500';
  }
  return '';
};
