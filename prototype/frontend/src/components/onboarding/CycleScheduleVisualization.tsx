/**
 * CycleScheduleVisualization component
 * Displays daily cycle timeline with battle types and scheduling information.
 * Shows cycle times in player's timezone with visual timeline representation.
 * 
 * Features:
 * - Display daily cycle timeline
 * - Show cycle times in player's timezone
 * - Highlight different battle types
 * 
 * Requirements: 15.1-15.11
 */

import { useMemo } from 'react';
import type { BattleType } from './BattleTypeCard';

interface CycleEvent {
  type: BattleType | 'settlement';
  name: string;
  utcTime: string; // HH:MM format
  icon: string;
  color: string;
  description: string;
}

interface CycleScheduleVisualizationProps {
  compact?: boolean;
  highlightedTypes?: BattleType[];
  showTimezone?: boolean;
}

// Cycle events in UTC time
const CYCLE_EVENTS: CycleEvent[] = [
  {
    type: 'tag_team',
    name: 'Tag Team Cycle',
    utcTime: '12:00',
    icon: '🤝',
    color: 'bg-blue-500',
    description: '2v2 team battles',
  },
  {
    type: 'league',
    name: 'League Cycle',
    utcTime: '20:00',
    icon: '🏆',
    color: 'bg-yellow-500',
    description: 'Standard competitive matches',
  },
  {
    type: 'settlement',
    name: 'Settlement Cycle',
    utcTime: '23:00',
    icon: '💰',
    color: 'bg-green-500',
    description: 'Process rewards and income',
  },
  {
    type: 'tournament',
    name: 'Tournament Cycle',
    utcTime: '08:00',
    icon: '🥇',
    color: 'bg-purple-500',
    description: 'Special competitive events (periodic)',
  },
];

/**
 * Convert UTC time to local time
 */
const convertToLocalTime = (utcTime: string): string => {
  const [hours, minutes] = utcTime.split(':').map(Number);
  const utcDate = new Date();
  utcDate.setUTCHours(hours, minutes, 0, 0);
  
  return utcDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

/**
 * Get timezone abbreviation
 */
const getTimezoneAbbreviation = (): string => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = new Date();
  const shortFormat = date.toLocaleTimeString('en-US', { 
    timeZoneName: 'short',
    timeZone: timezone 
  });
  const match = shortFormat.match(/\b[A-Z]{3,4}\b/);
  return match ? match[0] : timezone;
};

/**
 * Get UTC offset
 */
const getUTCOffset = (): string => {
  const offset = -new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Calculate position on 24-hour timeline (0-100%)
 */
const calculateTimelinePosition = (utcTime: string): number => {
  const [hours, minutes] = utcTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  return (totalMinutes / (24 * 60)) * 100;
};

/**
 * TimelineEvent component
 * Displays a single event on the timeline.
 */
const TimelineEvent = ({ 
  event, 
  localTime, 
  highlighted 
}: { 
  event: CycleEvent; 
  localTime: string;
  highlighted: boolean;
}) => {
  const position = calculateTimelinePosition(event.utcTime);
  
  return (
    <div
      className="absolute transform -translate-x-1/2"
      style={{ left: `${position}%` }}
    >
      {/* Marker line */}
      <div className={`w-0.5 h-8 ${event.color} mx-auto`} />
      
      {/* Event card */}
      <div
        className={`
          mt-2 p-3 rounded-lg border-2 min-w-[140px] transition-all duration-200
          ${highlighted 
            ? `${event.color} border-white shadow-lg scale-110` 
            : 'bg-gray-800 border-gray-600'
          }
        `}
      >
        <div className="text-center">
          <div className="text-2xl mb-1">{event.icon}</div>
          <div className={`text-xs font-bold mb-1 ${highlighted ? 'text-white' : 'text-gray-300'}`}>
            {event.name}
          </div>
          <div className={`text-xs ${highlighted ? 'text-white' : 'text-gray-400'}`}>
            {localTime}
          </div>
          <div className={`text-xs mt-1 ${highlighted ? 'text-white text-opacity-90' : 'text-gray-400'}`}>
            {event.description}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * TimelineAxis component
 * Displays the 24-hour timeline axis with hour markers.
 */
const TimelineAxis = () => {
  const hours = Array.from({ length: 25 }, (_, i) => i);
  
  return (
    <div className="relative w-full h-12 bg-gray-800 rounded-full">
      {/* Hour markers */}
      {hours.map((hour) => {
        const position = (hour / 24) * 100;
        const showLabel = hour % 6 === 0; // Show label every 6 hours
        
        return (
          <div
            key={hour}
            className="absolute transform -translate-x-1/2"
            style={{ left: `${position}%` }}
          >
            {/* Marker tick */}
            <div className={`w-0.5 ${showLabel ? 'h-4 bg-gray-400' : 'h-2 bg-gray-600'} mx-auto`} />
            
            {/* Hour label */}
            {showLabel && hour < 24 && (
              <div className="text-xs text-gray-400 mt-1 text-center">
                {hour.toString().padStart(2, '0')}:00
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * CompactSchedule component
 * Displays schedule in a compact list format.
 */
const CompactSchedule = ({ 
  events, 
  highlightedTypes 
}: { 
  events: Array<CycleEvent & { localTime: string }>;
  highlightedTypes?: BattleType[];
}) => {
  return (
    <div className="space-y-2">
      {events.map((event) => {
        const highlighted = highlightedTypes?.includes(event.type as BattleType) ?? false;
        
        return (
          <div
            key={event.name}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
              ${highlighted 
                ? `${event.color} border-white shadow-md` 
                : 'bg-gray-800 border-gray-700'
              }
            `}
          >
            <div className="text-2xl">{event.icon}</div>
            <div className="flex-1">
              <div className={`font-semibold text-sm ${highlighted ? 'text-white' : 'text-gray-300'}`}>
                {event.name}
              </div>
              <div className={`text-xs ${highlighted ? 'text-white text-opacity-90' : 'text-gray-400'}`}>
                {event.description}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${highlighted ? 'text-white' : 'text-gray-300'}`}>
                {event.localTime}
              </div>
              <div className={`text-xs ${highlighted ? 'text-white text-opacity-75' : 'text-gray-400'}`}>
                {event.utcTime} UTC
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * CycleScheduleVisualization component
 * Main component for displaying cycle schedule.
 */
const CycleScheduleVisualization = ({
  compact = false,
  highlightedTypes = [],
  showTimezone = true,
}: CycleScheduleVisualizationProps) => {
  // Convert all events to local time
  const eventsWithLocalTime = useMemo(() => {
    return CYCLE_EVENTS.map((event) => ({
      ...event,
      localTime: convertToLocalTime(event.utcTime),
    }));
  }, []);

  // Sort events by local time for compact view
  const sortedEvents = useMemo(() => {
    return [...eventsWithLocalTime].sort((a, b) => {
      const [aHours, aMinutes] = a.localTime.split(':').map(Number);
      const [bHours, bMinutes] = b.localTime.split(':').map(Number);
      return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
    });
  }, [eventsWithLocalTime]);

  const timezoneInfo = useMemo(() => ({
    abbreviation: getTimezoneAbbreviation(),
    offset: getUTCOffset(),
  }), []);

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-200 mb-1">Daily Cycle Schedule</h3>
          {showTimezone && (
            <p className="text-sm text-gray-400">
              Times shown in your timezone: {timezoneInfo.abbreviation} ({timezoneInfo.offset})
            </p>
          )}
        </div>

        {/* Compact list */}
        <CompactSchedule events={sortedEvents} highlightedTypes={highlightedTypes} />

        {/* Info note */}
        <div className="text-xs text-gray-400 text-center p-3 bg-gray-800 bg-opacity-50 rounded-lg">
          <p>Robots are automatically matched during cycle times.</p>
          <p className="mt-1">Check battle results after each cycle completes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-200 mb-2">Daily Cycle Schedule</h3>
        {showTimezone && (
          <p className="text-sm text-gray-400">
            Times shown in your timezone: <span className="font-semibold">{timezoneInfo.abbreviation}</span> ({timezoneInfo.offset})
          </p>
        )}
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Timeline axis */}
        <TimelineAxis />

        {/* Events on timeline */}
        <div className="relative h-40 mt-4">
          {eventsWithLocalTime.map((event) => (
            <TimelineEvent
              key={event.name}
              event={event}
              localTime={event.localTime}
              highlighted={highlightedTypes.includes(event.type as BattleType)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 mt-8">
        {eventsWithLocalTime.map((event) => (
          <div
            key={event.name}
            className="flex items-center gap-2 p-2 bg-gray-800 bg-opacity-50 rounded"
          >
            <div className={`w-3 h-3 rounded-full ${event.color}`} />
            <div className="text-xs text-gray-400">{event.name}</div>
          </div>
        ))}
      </div>

      {/* Info section */}
      <div className="p-4 bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          How Cycles Work
        </h4>
        <ul className="space-y-1 text-xs text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Robots are automatically matched during cycle times</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>No manual battle initiation required</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Check battle results after cycle completes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>Repair robots between battles to maintain readiness</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CycleScheduleVisualization;
export { CYCLE_EVENTS, convertToLocalTime, getTimezoneAbbreviation, getUTCOffset };
export type { CycleEvent };
