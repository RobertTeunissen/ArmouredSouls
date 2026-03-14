import React from 'react';
import { TournamentMatchWithRobots } from '../../utils/bracketUtils';

interface MatchCardProps {
  match: TournamentMatchWithRobots;
  seedMap: Map<number, number>;
  userRobotIds: Set<number>;
  isUserFuturePath: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
}

function getMatchState(match: TournamentMatchWithRobots): 'completed' | 'bye' | 'pending' | 'placeholder' {
  if (match.isByeMatch) return 'bye';
  if (match.status === 'completed' && match.winnerId !== null) return 'completed';
  if (match.robot1 !== null && match.robot2 !== null) return 'pending';
  return 'placeholder';
}

/**
 * Renders a robot slot. Seed number is rendered as a separate colored span
 * so it visually stands out from the robot name.
 */
function RobotSlot({
  robot,
  seed,
  isWinner,
  isLoser,
  isUserRobot,
}: {
  robot: { id: number; name: string } | null;
  seed: number | undefined;
  isWinner: boolean;
  isLoser: boolean;
  isUserRobot: boolean;
}): React.ReactElement {
  if (!robot) {
    return <span className="text-gray-600 italic text-xs">TBD</span>;
  }

  let nameClass = 'text-secondary';
  if (isWinner) nameClass = 'text-success font-semibold';
  else if (isLoser) nameClass = 'text-tertiary line-through';
  else if (isUserRobot) nameClass = 'text-blue-300 font-medium';

  const showSeed = seed !== undefined && seed <= 32;

  return (
    <span className="text-xs truncate max-w-[130px] flex items-center gap-1">
      {showSeed && (
        <span className="text-warning font-mono font-semibold shrink-0">#{seed}</span>
      )}
      <span className={nameClass + ' truncate'}>{robot.name}</span>
    </span>
  );
}

const MatchCard: React.FC<MatchCardProps> = ({
  match, seedMap, userRobotIds, isUserFuturePath, dimmed, highlighted,
}) => {
  const matchState = getMatchState(match);
  const isRobot1User = match.robot1Id !== null && userRobotIds.has(match.robot1Id);
  const isRobot2User = match.robot2Id !== null && userRobotIds.has(match.robot2Id);
  const hasUserRobot = isRobot1User || isRobot2User;

  let borderClass = 'border-white/10';
  let bgClass = 'bg-surface';
  if (hasUserRobot) { borderClass = 'border-blue-500'; bgClass = 'bg-blue-900/20'; }
  else if (isUserFuturePath) { borderClass = 'border-blue-500/30'; }
  if (matchState === 'bye' && !hasUserRobot) { borderClass = 'border-yellow-600/40'; }
  if (highlighted) { borderClass = 'border-yellow-400'; bgClass = 'bg-yellow-900/30'; }

  const robot1Seed = match.robot1Id !== null ? seedMap.get(match.robot1Id) : undefined;
  const robot2Seed = match.robot2Id !== null ? seedMap.get(match.robot2Id) : undefined;

  const isByeMatch = matchState === 'bye';
  const isR1Win = isByeMatch ? true : match.status === 'completed' && match.winnerId === match.robot1Id;
  const isR2Win = !isByeMatch && match.status === 'completed' && match.winnerId === match.robot2Id;
  const isR1Loss = !isByeMatch && match.status === 'completed' && !isR1Win && match.robot1 !== null;
  const isR2Loss = !isByeMatch && match.status === 'completed' && !isR2Win && match.robot2 !== null;

  return (
    <div
      data-testid={`match-card-${match.id}`}
      data-robot1-id={match.robot1Id ?? undefined}
      data-robot2-id={match.robot2Id ?? undefined}
      className={`${bgClass} border ${borderClass} rounded px-2 py-1.5 w-44 transition-opacity duration-200 ${
        hasUserRobot ? 'ring-1 ring-blue-500/50 shadow-md shadow-blue-500/10' : ''
      } ${highlighted ? 'ring-2 ring-yellow-400/70' : ''} ${dimmed ? 'opacity-25' : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <RobotSlot robot={match.robot1} seed={robot1Seed}
          isWinner={isR1Win} isLoser={isR1Loss} isUserRobot={isRobot1User} />
        {isRobot1User && <span className="text-[9px] text-primary font-medium shrink-0">YOU</span>}
      </div>
      <div className="border-t border-white/10/50 my-0.5" />
      <div className="flex items-center justify-between gap-1">
        {isByeMatch ? (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-warning">BYE</span>
        ) : (
          <>
            <RobotSlot robot={match.robot2} seed={robot2Seed}
              isWinner={isR2Win} isLoser={isR2Loss} isUserRobot={isRobot2User} />
            {isRobot2User && <span className="text-[9px] text-primary font-medium shrink-0">YOU</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
