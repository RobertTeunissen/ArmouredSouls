import React from 'react';
import { TournamentMatchWithRobots, getRoundLabel } from '../../utils/bracketUtils';
import MatchCard from './MatchCard';

interface RoundColumnProps {
  round: number;
  maxRounds: number;
  matches: TournamentMatchWithRobots[];
  seedMap: Map<number, number>;
  userRobotIds: Set<number>;
  futurePathMatchIds: Set<number>;
  isCurrentRound: boolean;
}

/**
 * Renders a single round column in the bracket view.
 * Contains a round label and vertically-spaced MatchCard components.
 * Spacing grows exponentially per round so that round N+1 matches
 * align between their two feeder matches from round N.
 *
 * Validates: Requirements 7.1, 7.2, 3.2
 */
const RoundColumn: React.FC<RoundColumnProps> = ({
  round,
  maxRounds,
  matches,
  seedMap,
  userRobotIds,
  futurePathMatchIds,
  isCurrentRound,
}) => {
  const label = getRoundLabel(round, maxRounds);

  // Exponential spacing: round 1 = base, round 2 = 2x, round N = 2^(N-1)x
  // We use padding/gap to push later-round cards so they center between feeders.
  const spacingMultiplier = Math.pow(2, round - 1);
  const baseGap = 8; // px — gap between cards in round 1
  const gap = baseGap * spacingMultiplier;

  // Top padding offsets later rounds so the first card centers between its two feeders.
  // Round 1: 0, Round 2: half a card+gap, etc.
  const topPadding = round === 1 ? 0 : (gap - baseGap) / 2;

  const columnClass = isCurrentRound
    ? 'border-l-2 border-yellow-500 bg-yellow-900/10'
    : '';

  return (
    <div
      data-testid={`round-column-${round}`}
      className={`flex flex-col items-center min-w-[11rem] ${columnClass}`}
    >
      <div className="text-sm font-semibold text-secondary text-center mb-2 px-2">
        {label}
      </div>
      <div
        className="flex flex-col items-center"
        style={{ gap: `${gap}px`, paddingTop: `${topPadding}px` }}
      >
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            seedMap={seedMap}
            userRobotIds={userRobotIds}
            isUserFuturePath={futurePathMatchIds.has(match.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default RoundColumn;
