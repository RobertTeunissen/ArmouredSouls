import type { BattleLogEvent } from '../../utils/matchmakingApi';
import type { CombatMessagesProps } from './types';

export function CombatMessages({ battleLog }: CombatMessagesProps) {
  return (
    <div className="bg-surface p-3 rounded-lg">
      <h2 className="text-lg font-bold mb-2">Combat Messages</h2>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {battleLog.battleLog.events && battleLog.battleLog.events.length > 0 ? (
          battleLog.battleLog.events
            .filter((event: BattleLogEvent) => {
              if (event.type === 'tournament_reward' || event.type === 'reward_summary' ||
                  event.type === 'reward_detail' || event.type === 'reward_breakdown') {
                return false;
              }
              const message = event.message.toLowerCase();
              return !message.includes('financial') &&
                     !message.includes('₡') &&
                     !message.includes('credits') &&
                     !message.includes('winner (') &&
                     !message.includes('loser (') &&
                     !message.includes('league base') &&
                     !message.includes('participation') &&
                     !message.includes('prestige:') &&
                     !message.includes('fame:') &&
                     !message.includes('tournament size') &&
                     !message.includes('round progress') &&
                     !message.includes('championship finals');
            })
            .map((event: BattleLogEvent, index: number) => {
              const { bgColor, eventColor, icon } = getEventStyle(event);

              return (
                <div
                  key={index}
                  className={`${bgColor} p-3 rounded border-l-4 ${eventColor} flex items-start gap-3 transition-colors hover:bg-gray-600/50`}
                >
                  <div className="text-secondary text-sm font-mono whitespace-nowrap flex-shrink-0 min-w-[50px]">
                    {event.timestamp.toFixed(1)}s
                  </div>
                  {icon && <div className="text-lg flex-shrink-0">{icon}</div>}
                  <div className="flex-1 text-sm leading-relaxed">{event.message}</div>
                </div>
              );
            })
        ) : (
          <p className="text-secondary">No combat messages available for this battle.</p>
        )}
      </div>
    </div>
  );
}

function getEventStyle(event: BattleLogEvent): { bgColor: string; eventColor: string; icon: string } {
  let eventColor = 'border-gray-600';
  let bgColor = 'bg-surface-elevated';
  let icon = '';

  if (event.type === 'battle_start') {
    eventColor = 'border-blue-500';
    bgColor = 'bg-blue-900/20';
  } else if (event.type === 'battle_end') {
    eventColor = 'border-green-500';
    bgColor = 'bg-green-900/20';
  } else if (event.type === 'stance') {
    eventColor = 'border-purple-500';
    bgColor = 'bg-purple-900/20';
  } else if (event.type === 'tag_out') {
    eventColor = 'border-orange-500';
    bgColor = 'bg-orange-900/20';
    icon = '🔄';
  } else if (event.type === 'tag_in') {
    eventColor = 'border-cyan-500';
    bgColor = 'bg-cyan-900/20';
    icon = '⚡';
  } else if (event.type === 'critical') {
    eventColor = 'border-red-500';
    bgColor = 'bg-red-900/20';
  } else if (event.type === 'attack' && event.message.includes('CRITICAL')) {
    eventColor = 'border-red-500';
    bgColor = 'bg-red-900/20';
  } else if (event.type === 'counter') {
    eventColor = 'border-yellow-500';
    bgColor = 'bg-yellow-900/20';
  } else if (event.type === 'miss') {
    eventColor = 'border-gray-500';
    bgColor = 'bg-surface';
  } else if (event.type === 'malfunction') {
    eventColor = 'border-amber-500';
    bgColor = 'bg-amber-900/20';
  } else if (event.type === 'shield_break') {
    eventColor = 'border-red-400';
    bgColor = 'bg-red-900/15';
  } else if (event.type === 'shield_regen') {
    eventColor = 'border-teal-500';
    bgColor = 'bg-teal-900/20';
  } else if (event.type === 'yield') {
    eventColor = 'border-yellow-400';
    bgColor = 'bg-yellow-900/20';
  } else if (event.type === 'destroyed') {
    eventColor = 'border-red-600';
    bgColor = 'bg-red-900/30';
  } else if (event.type === 'damage_status') {
    eventColor = 'border-orange-400';
    bgColor = 'bg-orange-900/15';
  } else if (event.type === 'draw') {
    eventColor = 'border-gray-400';
    bgColor = 'bg-surface-elevated/50';
  }

  return { bgColor, eventColor, icon };
}
