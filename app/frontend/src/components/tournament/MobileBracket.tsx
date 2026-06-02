import React, { useState, useMemo } from 'react';
import {
  TournamentMatchWithRobots,
  getRoundLabel,
  buildBracketTree,
} from '../../utils/bracketUtils';
import type { ParticipantType, ResolvedParticipant } from '../../utils/tournamentApi';
import MatchCard from './MatchCard';

interface MobileBracketProps {
  matches: TournamentMatchWithRobots[];
  maxRounds: number;
  currentRound: number;
  status: string;
  seedMap: Map<number, number>;
  userParticipantIds: Set<number>;
  futurePathMatchIds: Set<number>;
  resolvedParticipants?: Record<number, ResolvedParticipant>;
  participantType: ParticipantType;
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
  userParticipantIds,
  futurePathMatchIds,
  resolvedParticipants,
  participantType,
}) => {
  const hasUserParticipant = userParticipantIds.size > 0;

  const [viewMode, setViewMode] = useState<ViewMode>(
    hasUserParticipant ? 'myPath' : 'roundList',
  );

  return (
    <div className="flex flex-col gap-3">
      {/* View mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-white/10">
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            viewMode === 'myPath'
              ? 'bg-primary text-white'
              : 'bg-surface text-secondary hover:text-gray-200'
          }`}
          onClick={() => setViewMode('myPath')}
        >
          My Path
        </button>
        <button
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
            viewMode === 'roundList'
              ? 'bg-primary text-white'
              : 'bg-surface text-secondary hover:text-gray-200'
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
          userParticipantIds={userParticipantIds}
          futurePathMatchIds={futurePathMatchIds}
          resolvedParticipants={resolvedParticipants}
          participantType={participantType}
        />
      ) : (
        <RoundListView
          matches={matches}
          maxRounds={maxRounds}
          currentRound={currentRound}
          status={status}
          seedMap={seedMap}
          userParticipantIds={userParticipantIds}
          futurePathMatchIds={futurePathMatchIds}
          resolvedParticipants={resolvedParticipants}
          participantType={participantType}
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
  userParticipantIds: Set<number>;
  futurePathMatchIds: Set<number>;
  resolvedParticipants?: Record<number, ResolvedParticipant>;
  participantType: ParticipantType;
}

/**
 * Shows only matches involving the user's participant(s) plus connected
 * future-path matches, rendered as a vertical timeline grouped by round.
 *
 * Validates: Requirement 9.2
 */
const MyPathView: React.FC<MyPathViewProps> = ({
  matches,
  maxRounds,
  seedMap,
  userParticipantIds,
  futurePathMatchIds,
  resolvedParticipants,
  participantType,
}) => {
  const pathMatches = useMemo(() => {
    const filtered = matches.filter((m) => {
      const hasUser =
        (m.participant1Id !== null && userParticipantIds.has(m.participant1Id)) ||
        (m.participant2Id !== null && userParticipantIds.has(m.participant2Id));
      return hasUser || futurePathMatchIds.has(m.id);
    });
    // Sort by round ascending, then matchNumber ascending
    return filtered.sort(
      (a, b) => a.round - b.round || a.matchNumber - b.matchNumber,
    );
  }, [matches, userParticipantIds, futurePathMatchIds]);

  if (pathMatches.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-6 text-center">
        <p className="text-tertiary text-sm">
          No matches found for your {participantType === 'robot' ? 'robots' : 'teams'}. Switch to Round List to browse all matches.
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
              <div className="text-xs font-semibold text-secondary uppercase tracking-wide pt-2 pb-1 border-b border-white/10/50">
                {getRoundLabel(match.round, maxRounds)}
              </div>
            )}
            <MatchCard
              match={match}
              seedMap={seedMap}
              userParticipantIds={userParticipantIds}
              isUserFuturePath={futurePathMatchIds.has(match.id)}
              resolvedParticipants={resolvedParticipants}
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
  userParticipantIds: Set<number>;
  futurePathMatchIds: Set<number>;
  resolvedParticipants?: Record<number, ResolvedParticipant>;
  participantType: ParticipantType;
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
  userParticipantIds,
  futurePathMatchIds,
  resolvedParticipants,
  participantType: _participantType,
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
      <div className="flex items-center justify-between bg-surface rounded-lg border border-white/10 px-3 py-2">
        <button
          className="text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
          className="flex items-center gap-2 text-sm font-medium min-h-[44px]"
          onClick={() => toggleCollapse(selectedRound)}
        >
          <span
            className={
              isCurrentRound ? 'text-primary' : 'text-gray-200'
            }
          >
            {getRoundLabel(selectedRound, maxRounds)}
          </span>
          {isCurrentRound && (
            <span className="text-[10px] bg-primary/30 text-primary px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
          <svg
            className={`w-4 h-4 text-tertiary transition-transform ${
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
          className="text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
            <p className="text-tertiary text-sm text-center py-4">
              No matches in this round
            </p>
          ) : (
            roundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                seedMap={seedMap}
                userParticipantIds={userParticipantIds}
                isUserFuturePath={futurePathMatchIds.has(match.id)}
                resolvedParticipants={resolvedParticipants}
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
                ? 'bg-primary-dark'
                : round === currentRound && status === 'active'
                  ? 'bg-primary-dark/40'
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
