import React, { useState, useMemo } from 'react';
import {
  TournamentMatchWithRobots,
  getRoundLabel,
  buildBracketTree,
} from '../../utils/bracketUtils';
import MatchCard from './MatchCard';

interface MobileBracketProps {
  matches: TournamentMatchWithRobots[];
  maxRounds: number;
  currentRound: number;
  status: string;
  seedMap: Map<number, number>;
  userRobotIds: Set<number>;
  futurePathMatchIds: Set<number>;
}

type ViewMode = 'myPath' | 'roundList';

/**
 * Mobile-optimised bracket view with two modes:
 * - "My Path": vertical timeline of the user's matches + future path
 * - "Round List": one round at a time with prev/next navigation
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6
 */
const MobileBracket: React.FC<MobileBracketProps> = ({
  matches,
  maxRounds,
  currentRound,
  status,
  seedMap,
  userRobotIds,
  futurePathMatchIds,
}) => {
  const hasUserRobot = userRobotIds.size > 0;

  const [viewMode, setViewMode] = useState<ViewMode>(
    hasUserRobot ? 'myPath' : 'roundList',
  );

  return (
    <div className="flex flex-col gap-3">
      {/* View mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            viewMode === 'myPath'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setViewMode('myPath')}
        >
          My Path
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            viewMode === 'roundList'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setViewMode('roundList')}
        >
          Round List
        </button>
      </div>

      {viewMode === 'myPath' ? (
        <MyPathView
          matches={matches}
          maxRounds={maxRounds}
          seedMap={seedMap}
          userRobotIds={userRobotIds}
          futurePathMatchIds={futurePathMatchIds}
        />
      ) : (
        <RoundListView
          matches={matches}
          maxRounds={maxRounds}
          currentRound={currentRound}
          status={status}
          seedMap={seedMap}
          userRobotIds={userRobotIds}
          futurePathMatchIds={futurePathMatchIds}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  My Path View                                                       */
/* ------------------------------------------------------------------ */

interface MyPathViewProps {
  matches: TournamentMatchWithRobots[];
  maxRounds: number;
  seedMap: Map<number, number>;
  userRobotIds: Set<number>;
  futurePathMatchIds: Set<number>;
}

/**
 * Shows only matches involving the user's robot(s) plus connected
 * future-path matches, rendered as a vertical timeline grouped by round.
 *
 * Validates: Requirement 9.2
 */
const MyPathView: React.FC<MyPathViewProps> = ({
  matches,
  maxRounds,
  seedMap,
  userRobotIds,
  futurePathMatchIds,
}) => {
  const pathMatches = useMemo(() => {
    const filtered = matches.filter((m) => {
      const hasUser =
        (m.robot1Id !== null && userRobotIds.has(m.robot1Id)) ||
        (m.robot2Id !== null && userRobotIds.has(m.robot2Id));
      return hasUser || futurePathMatchIds.has(m.id);
    });
    // Sort by round ascending, then matchNumber ascending
    return filtered.sort(
      (a, b) => a.round - b.round || a.matchNumber - b.matchNumber,
    );
  }, [matches, userRobotIds, futurePathMatchIds]);

  if (pathMatches.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
        <p className="text-gray-500 text-sm">
          No matches found for your robots. Switch to Round List to browse all matches.
        </p>
      </div>
    );
  }

  // Group by round for dividers
  let lastRound = -1;

  return (
    <div className="flex flex-col gap-2">
      {pathMatches.map((match) => {
        const showRoundLabel = match.round !== lastRound;
        lastRound = match.round;

        return (
          <React.Fragment key={match.id}>
            {showRoundLabel && (
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1 border-b border-gray-700/50">
                {getRoundLabel(match.round, maxRounds)}
              </div>
            )}
            <MatchCard
              match={match}
              seedMap={seedMap}
              userRobotIds={userRobotIds}
              isUserFuturePath={futurePathMatchIds.has(match.id)}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Round List View                                                    */
/* ------------------------------------------------------------------ */

interface RoundListViewProps {
  matches: TournamentMatchWithRobots[];
  maxRounds: number;
  currentRound: number;
  status: string;
  seedMap: Map<number, number>;
  userRobotIds: Set<number>;
  futurePathMatchIds: Set<number>;
}

/**
 * Displays one round at a time with prev/next navigation.
 * Each round section is collapsible.
 *
 * Validates: Requirements 9.3, 9.6
 */
const RoundListView: React.FC<RoundListViewProps> = ({
  matches,
  maxRounds,
  currentRound,
  status,
  seedMap,
  userRobotIds,
  futurePathMatchIds,
}) => {
  const [selectedRound, setSelectedRound] = useState<number>(currentRound);
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(
    new Set(),
  );

  const bracketTree = useMemo(
    () => buildBracketTree(matches, maxRounds),
    [matches, maxRounds],
  );

  const roundMatches = bracketTree.get(selectedRound) ?? [];
  const isCurrentRound = status === 'active' && selectedRound === currentRound;

  const toggleCollapse = (round: number): void => {
    setCollapsedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(round)) {
        next.delete(round);
      } else {
        next.add(round);
      }
      return next;
    });
  };

  const isCollapsed = collapsedRounds.has(selectedRound);

  return (
    <div className="flex flex-col gap-3">
      {/* Round navigation */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg border border-gray-700 px-3 py-2">
        <button
          className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1"
          disabled={selectedRound <= 1}
          onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
          aria-label="Previous round"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => toggleCollapse(selectedRound)}
        >
          <span
            className={
              isCurrentRound ? 'text-blue-400' : 'text-gray-200'
            }
          >
            {getRoundLabel(selectedRound, maxRounds)}
          </span>
          {isCurrentRound && (
            <span className="text-[10px] bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${
              isCollapsed ? '' : 'rotate-180'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <button
          className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1"
          disabled={selectedRound >= maxRounds}
          onClick={() =>
            setSelectedRound((r) => Math.min(maxRounds, r + 1))
          }
          aria-label="Next round"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Round matches */}
      {!isCollapsed && (
        <div className="flex flex-col gap-2">
          {roundMatches.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No matches in this round
            </p>
          ) : (
            roundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                seedMap={seedMap}
                userRobotIds={userRobotIds}
                isUserFuturePath={futurePathMatchIds.has(match.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Round indicator dots */}
      <div className="flex justify-center gap-1.5 pt-1">
        {Array.from({ length: maxRounds }, (_, i) => i + 1).map((round) => (
          <button
            key={round}
            className={`w-2 h-2 rounded-full transition-colors ${
              round === selectedRound
                ? 'bg-blue-500'
                : round === currentRound && status === 'active'
                  ? 'bg-blue-500/40'
                  : 'bg-gray-600'
            }`}
            onClick={() => setSelectedRound(round)}
            aria-label={`Go to ${getRoundLabel(round, maxRounds)}`}
          />
        ))}
      </div>
    </div>
  );
};

export default MobileBracket;
