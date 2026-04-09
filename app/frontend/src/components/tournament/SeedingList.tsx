import React, { useState } from 'react';
import type { SeedEntry } from '../../utils/tournamentApi';

interface SeedingListProps {
  seedings: SeedEntry[];
  userRobotIds: Set<number>;
  /** Called when a seed entry is clicked — scrolls bracket to that robot */
  onRobotClick?: (robotId: number) => void;
}

/**
 * Collapsible side panel listing the top 32 seeded tournament participants.
 * Clicking an entry scrolls the bracket to that robot's match.
 * User's robots beyond top 32 are shown in a separate section.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
const SeedingList: React.FC<SeedingListProps> = ({ seedings, userRobotIds, onRobotClick }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const top32 = seedings.filter((s) => s.seed <= 32);
  const userSeedings = seedings.filter((s) => userRobotIds.has(s.robotId) && s.seed > 32);

  const handleClick = (robotId: number): void => {
    onRobotClick?.(robotId);
  };

  return (
    <div className="bg-surface rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated hover:bg-gray-600 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="seeding-list-content"
      >
        <span className="text-sm font-semibold text-white">Top Seeds</span>
        <svg
          className={`w-4 h-4 text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <ul id="seeding-list-content" className="divide-y divide-gray-700/50 max-h-96 overflow-y-auto">
          {top32.length === 0 && (
            <li className="px-4 py-3 text-sm text-tertiary text-center">
              No seeding data available
            </li>
          )}
          {top32.map((entry) => (
            <SeedRow
              key={entry.robotId}
              entry={entry}
              isUserRobot={userRobotIds.has(entry.robotId)}
              onClick={() => handleClick(entry.robotId)}
            />
          ))}

          {userSeedings.length > 0 && (
            <>
              <li className="px-4 py-1.5 text-[10px] text-tertiary uppercase tracking-wider bg-background/50">
                Your robots
              </li>
              {userSeedings.map((entry) => (
                <SeedRow
                  key={entry.robotId}
                  entry={entry}
                  isUserRobot={true}
                  onClick={() => handleClick(entry.robotId)}
                />
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
};

/** Single seed row — clickable to scroll bracket to that robot */
function SeedRow({
  entry,
  isUserRobot,
  onClick,
}: {
  entry: SeedEntry;
  isUserRobot: boolean;
  onClick: () => void;
}): React.ReactElement {
  const isEliminated = entry.eliminated;

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`px-4 py-2 flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-elevated/50 transition-colors ${
        isUserRobot ? 'border-l-2 border-blue-500 bg-blue-900/20' : ''
      } ${isEliminated ? 'opacity-50' : ''}`}
    >
      <span className={`font-mono text-xs shrink-0 w-6 text-right ${
        isEliminated ? 'text-gray-600' : entry.seed <= 32 ? 'text-warning' : 'text-tertiary'
      }`}>
        #{entry.seed}
      </span>
      <span className={`truncate ${
        isEliminated ? 'text-tertiary line-through' : isUserRobot ? 'text-blue-300' : 'text-white'
      }`}>
        {entry.robotName}
      </span>
      <span className={`ml-auto text-xs shrink-0 ${isEliminated ? 'text-gray-600' : 'text-secondary'}`}>
        {entry.elo}
      </span>
      {isUserRobot && (
        <span className="text-[9px] text-primary font-medium shrink-0">YOU</span>
      )}
    </li>
  );
}

export default SeedingList;
