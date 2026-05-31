import type { BattleLogEvent } from '../../utils/matchmakingApi';
import { isTeamBattleLog, isTeamBattleType } from '../../utils/matchmakingApi';
import type { CombatMessagesProps } from './types';

export function CombatMessages({ battleLog }: CombatMessagesProps) {
  // Team battle events use a different structured format
  if (isTeamBattleType(battleLog.battleType) && isTeamBattleLog(battleLog.battleLog)) {
    return <TeamBattleCombatMessages battleLog={battleLog} />;
  }

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">Combat Messages</h3>
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
                  className={`${bgColor} p-3 rounded border-l-4 ${eventColor} flex items-start gap-3 transition-colors duration-150 ease-out motion-reduce:transition-none hover:brightness-125`}
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
  let eventColor = 'border-tertiary';
  let bgColor = 'bg-surface-elevated';
  let icon = '';

  if (event.type === 'battle_start') {
    eventColor = 'border-primary';
    bgColor = 'bg-primary/10';
  } else if (event.type === 'battle_end') {
    eventColor = 'border-success';
    bgColor = 'bg-success/10';
  } else if (event.type === 'stance') {
    eventColor = 'border-info';
    bgColor = 'bg-info/10';
  } else if (event.type === 'tag_out') {
    eventColor = 'border-warning';
    bgColor = 'bg-warning/10';
    icon = '🔄';
  } else if (event.type === 'tag_in') {
    eventColor = 'border-primary';
    bgColor = 'bg-primary/10';
    icon = '⚡';
  } else if (event.type === 'critical') {
    eventColor = 'border-error';
    bgColor = 'bg-error/10';
  } else if (event.type === 'attack' && event.message.includes('CRITICAL')) {
    eventColor = 'border-error';
    bgColor = 'bg-error/10';
  } else if (event.type === 'counter') {
    eventColor = 'border-warning';
    bgColor = 'bg-warning/10';
  } else if (event.type === 'miss') {
    eventColor = 'border-tertiary';
    bgColor = 'bg-surface';
  } else if (event.type === 'malfunction') {
    eventColor = 'border-warning';
    bgColor = 'bg-warning/10';
  } else if (event.type === 'shield_break') {
    eventColor = 'border-error';
    bgColor = 'bg-error/10';
  } else if (event.type === 'shield_regen') {
    eventColor = 'border-success';
    bgColor = 'bg-success/10';
  } else if (event.type === 'yield') {
    eventColor = 'border-warning';
    bgColor = 'bg-warning/10';
  } else if (event.type === 'destroyed') {
    eventColor = 'border-error';
    bgColor = 'bg-error/15';
  } else if (event.type === 'damage_status') {
    eventColor = 'border-warning';
    bgColor = 'bg-warning/10';
  } else if (event.type === 'draw') {
    eventColor = 'border-secondary';
    bgColor = 'bg-surface-elevated/50';
  }

  return { bgColor, eventColor, icon };
}

// ── Team Battle Combat Messages ──────────────────────────────────────

interface TeamBattleEvent {
  type: string;
  tick: number;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * Renders team battle events from the structured TeamBattleCombatEvent format.
 * Converts structured events into human-readable messages with appropriate styling.
 */
function TeamBattleCombatMessages({ battleLog }: CombatMessagesProps) {
  const log = battleLog.battleLog as unknown as { events?: TeamBattleEvent[]; detailedCombatEvents?: BattleLogEvent[] };
  const teamEvents = log.events ?? [];
  const detailedEvents = log.detailedCombatEvents ?? [];

  // Build robot name lookup from participants
  const participants = battleLog.participants ?? [];
  const robotNameMap = new Map(participants.map(p => [p.robotId, p.robotName]));
  const getRobotName = (id: number): string => robotNameMap.get(id) ?? `Robot #${id}`;

  // Use detailed combat events (with messages) if available — same as 1v1/tag team
  if (detailedEvents.length > 0) {
    const filteredEvents = detailedEvents.filter((event: BattleLogEvent) => {
      if (!event.message) return false;
      if (event.type === 'reward_summary' || event.type === 'reward_detail' || event.type === 'reward_breakdown') return false;
      const message = event.message.toLowerCase();
      return !message.includes('financial') && !message.includes('₡') && !message.includes('credits');
    });

    return (
      <div className="bg-surface rounded-lg mb-3 p-3">
        <h3 className="text-lg font-bold mb-3">Combat Messages</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event: BattleLogEvent, index: number) => {
              const { bgColor, eventColor } = getEventStyle(event);
              return (
                <div
                  key={index}
                  className={`${bgColor} p-3 rounded border-l-4 ${eventColor} flex items-start gap-3 transition-colors duration-150 ease-out motion-reduce:transition-none hover:brightness-125`}
                >
                  <div className="text-secondary text-sm font-mono whitespace-nowrap flex-shrink-0 min-w-[50px]">
                    {event.timestamp.toFixed(1)}s
                  </div>
                  <div className="flex-1 text-sm leading-relaxed">{event.message}</div>
                </div>
              );
            })
          ) : (
            <p className="text-secondary">No combat events recorded for this battle.</p>
          )}
        </div>
      </div>
    );
  }

  // Fallback: render team-specific structured events (eliminations, focus fire)
  const significantEvents = teamEvents.filter(e =>
    e.type === 'elimination' || e.type === 'focus_fire' || e.type === 'draw_timeout'
  );

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">Combat Messages</h3>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {significantEvents.length > 0 ? (
          significantEvents.map((event, index) => {
            const { bgColor, eventColor, icon, message } = getTeamBattleEventStyle(event, getRobotName);

            return (
              <div
                key={index}
                className={`${bgColor} p-3 rounded border-l-4 ${eventColor} flex items-start gap-3 transition-colors duration-150 ease-out motion-reduce:transition-none hover:brightness-125`}
              >
                <div className="text-secondary text-sm font-mono whitespace-nowrap flex-shrink-0 min-w-[50px]">
                  {event.timestamp.toFixed(1)}s
                </div>
                {icon && <div className="text-lg flex-shrink-0">{icon}</div>}
                <div className="flex-1 text-sm leading-relaxed">{message}</div>
              </div>
            );
          })
        ) : (
          <p className="text-secondary">No significant combat events recorded for this battle.</p>
        )}
      </div>
    </div>
  );
}

function getTeamBattleEventStyle(
  event: TeamBattleEvent,
  getRobotName: (id: number) => string,
): { bgColor: string; eventColor: string; icon: string; message: string } {
  switch (event.type) {
    case 'elimination': {
      const robotName = getRobotName(event.robotId as number);
      const killerName = event.eliminatedByRobotId
        ? getRobotName(event.eliminatedByRobotId as number)
        : 'unknown';
      const teamLabel = `Team ${event.team as number}`;
      return {
        bgColor: 'bg-error/15',
        eventColor: 'border-error',
        icon: '💀',
        message: `${robotName} (${teamLabel}) was eliminated${event.eliminatedByRobotId ? ` by ${killerName}` : ''}`,
      };
    }
    case 'focus_fire': {
      const targetName = getRobotName(event.targetRobotId as number);
      const contributors = (event.contributorRobotIds as number[]).map(getRobotName);
      const bonus = ((event.bonusApplied as number) * 100).toFixed(1);
      return {
        bgColor: 'bg-warning/10',
        eventColor: 'border-warning',
        icon: '🎯',
        message: `Focus fire on ${targetName} by ${contributors.join(', ')} (+${bonus}% damage bonus)`,
      };
    }
    case 'draw_timeout': {
      const duration = event.durationSeconds as number;
      return {
        bgColor: 'bg-surface-elevated/50',
        eventColor: 'border-secondary',
        icon: '⏱️',
        message: `Battle ended in a draw after ${duration.toFixed(0)}s (time limit reached)`,
      };
    }
    default:
      return {
        bgColor: 'bg-surface-elevated',
        eventColor: 'border-tertiary',
        icon: '',
        message: `${event.type} event at tick ${event.tick}`,
      };
  }
}
