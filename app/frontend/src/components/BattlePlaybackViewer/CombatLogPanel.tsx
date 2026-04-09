import React, { useRef, useEffect } from 'react';
import { PlaybackCombatEvent } from './types';

interface CombatLogPanelProps {
  events: PlaybackCombatEvent[];
  currentEventIndex: number;
  onSeekToEvent: (timestamp: number) => void;
}

/** Map event type to a Tailwind text color class */
function getEventColor(type: string): string {
  switch (type) {
    case 'attack':
    case 'critical':
      return 'text-red-400';
    case 'miss':
    case 'out_of_range':
    case 'counter_out_of_range':
      return 'text-gray-400';
    case 'movement':
    case 'range_transition':
      return 'text-blue-400';
    case 'counter':
      return 'text-orange-400';
    case 'backstab':
    case 'flanking':
      return 'text-yellow-400';
    case 'shield_break':
    case 'shield_regen':
      return 'text-cyan-400';
    case 'yield':
    case 'destroyed':
      return 'text-purple-400';
    case 'tag_out':
      return 'text-orange-400';
    case 'tag_in':
      return 'text-cyan-400';
    case 'malfunction':
      return 'text-red-300';
    default:
      return 'text-gray-300';
  }
}

/** Format timestamp as MM:SS.s */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const tenths = Math.floor((secs - whole) * 10);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`;
}

/**
 * Synchronized combat log panel that auto-scrolls to the current event
 * and highlights it during playback.
 *
 * Validates: Requirement 17.6
 */
export const CombatLogPanel: React.FC<CombatLogPanelProps> = ({
  events,
  currentEventIndex,
  onSeekToEvent,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll within the log panel to keep the current event visible
  // Uses scrollTop on the container to avoid scrolling the outer page
  useEffect(() => {
    if (activeRef.current && listRef.current) {
      const container = listRef.current;
      const element = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Only scroll if the element is outside the visible area of the container
      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        const scrollOffset = element.offsetTop - container.offsetTop - container.clientHeight / 2 + element.clientHeight / 2;
        container.scrollTop = scrollOffset;
      }
    }
  }, [currentEventIndex]);

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-gray-750 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">Combat Log</h3>
      </div>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-1"
        role="log"
        aria-label="Combat event log"
        aria-live="polite"
      >
        {events.length === 0 && (
          <p className="text-xs text-gray-500 p-2">No events</p>
        )}
        {events.map((event, index) => {
          const isActive = index === currentEventIndex;
          const colorClass = getEventColor(event.type);

          return (
            <button
              key={`${event.timestamp}-${index}`}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSeekToEvent(event.timestamp)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-900/50 ring-1 ring-blue-500'
                  : 'hover:bg-gray-700/50'
              }`}
              aria-label={`Event at ${formatTimestamp(event.timestamp)}: ${event.message}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="text-gray-500 font-mono mr-2">
                {formatTimestamp(event.timestamp)}
              </span>
              <span className={colorClass}>{event.message}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
