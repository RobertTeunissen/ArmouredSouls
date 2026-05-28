/**
 * EventBadge Component
 *
 * Compact event badge for robot cards on the Robots page.
 * Renders a small colored pill with the event label, color-coded per event type.
 *
 * Requirements: R9.6
 */

interface EventBadgeProps {
  /** The event type identifier (e.g. 'league', 'tournament', 'tag_team', 'koth') */
  eventType: string;
}

interface EventBadgeConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

const EVENT_BADGE_CONFIG: Record<string, EventBadgeConfig> = {
  league: {
    label: 'League',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-300',
  },
  tournament: {
    label: 'Tournament',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-300',
  },
  tag_team: {
    label: 'Tag Team',
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-300',
  },
  koth: {
    label: 'KotH',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-300',
  },
};

const DEFAULT_CONFIG: EventBadgeConfig = {
  label: 'Unknown',
  bgColor: 'bg-gray-500/20',
  textColor: 'text-gray-300',
};

function EventBadge({ eventType }: EventBadgeProps) {
  const config = EVENT_BADGE_CONFIG[eventType] || { ...DEFAULT_CONFIG, label: eventType };

  return (
    <span
      className={`
        inline-flex items-center
        ${config.bgColor} ${config.textColor}
        text-xs px-2 py-0.5
        rounded-full font-medium
      `}
    >
      {config.label}
    </span>
  );
}

export default EventBadge;
