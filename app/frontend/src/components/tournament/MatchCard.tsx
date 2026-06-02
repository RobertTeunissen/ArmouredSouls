import React, { useState } from 'react';
import { TournamentMatchWithRobots } from '../../utils/bracketUtils';
import type { ResolvedParticipant } from '../../utils/tournamentApi';

interface MatchCardProps {
  match: TournamentMatchWithRobots;
  seedMap: Map<number, number>;
  userParticipantIds: Set<number>;
  isUserFuturePath: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  resolvedParticipants?: Record<number, ResolvedParticipant>;
}

function getMatchState(match: TournamentMatchWithRobots): 'completed' | 'bye' | 'pending' | 'placeholder' {
  if (match.isByeMatch) return 'bye';
  if (match.status === 'completed' && match.winnerId !== null) return 'completed';
  if (match.participant1Id !== null && match.participant2Id !== null) return 'pending';
  return 'placeholder';
}

/**
 * Renders a participant slot. Seed number is rendered as a separate colored span
 * so it visually stands out from the participant name.
 */
function ParticipantSlot({
  participant,
  seed,
  isWinner,
  isLoser,
  isUserParticipant,
  resolvedParticipant,
  isTeamTournament,
}: {
  participant: { id: number; name: string } | null;
  seed: number | undefined;
  isWinner: boolean;
  isLoser: boolean;
  isUserParticipant: boolean;
  resolvedParticipant?: ResolvedParticipant;
  isTeamTournament: boolean;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  // Use resolvedParticipant as fallback when participant relation is null
  const effectiveParticipant = participant ?? (resolvedParticipant ? { id: resolvedParticipant.id, name: resolvedParticipant.displayName } : null);

  if (!effectiveParticipant) {
    return <span className="text-gray-600 italic text-xs">TBD</span>;
  }

  let nameClass = 'text-secondary';
  if (isWinner) nameClass = 'text-success font-semibold';
  else if (isLoser) nameClass = 'text-tertiary line-through';
  else if (isUserParticipant) nameClass = 'text-blue-300 font-medium';

  const showSeed = seed !== undefined && seed <= 32;
  const displayName = resolvedParticipant?.displayName ?? effectiveParticipant.name;
  const members = resolvedParticipant?.members;

  return (
    <span className="text-xs truncate max-w-[130px] flex flex-col">
      <span className="flex items-center gap-1">
        {showSeed && (
          <span className="text-warning font-mono font-semibold shrink-0">#{seed}</span>
        )}
        <span className={nameClass + ' truncate'}>{displayName}</span>
        {isTeamTournament && members && members.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-[8px] text-tertiary hover:text-secondary shrink-0 ml-0.5"
            aria-label={expanded ? 'Collapse team members' : 'Expand team members'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </span>
      {isTeamTournament && expanded && members && (
        <span className="flex flex-col gap-0.5 mt-0.5 pl-3 text-[10px] text-tertiary">
          {members.map((m) => (
            <span key={m.robotId} className="truncate">
              {m.robotName} ({m.elo})
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

const MatchCard: React.FC<MatchCardProps> = ({
  match, seedMap, userParticipantIds, isUserFuturePath, dimmed, highlighted, resolvedParticipants,
}) => {
  const matchState = getMatchState(match);
  const isTeamTournament = match.participantType === 'team_2v2' || match.participantType === 'team_3v3';

  const isP1User = match.participant1Id !== null && userParticipantIds.has(match.participant1Id);
  const isP2User = match.participant2Id !== null && userParticipantIds.has(match.participant2Id);
  const hasUserParticipant = isP1User || isP2User;

  let borderClass = 'border-white/10';
  let bgClass = 'bg-surface';
  if (hasUserParticipant) { borderClass = 'border-blue-500'; bgClass = 'bg-blue-900/20'; }
  else if (isUserFuturePath) { borderClass = 'border-blue-500/30'; }
  if (matchState === 'bye' && !hasUserParticipant) { borderClass = 'border-yellow-600/40'; }
  if (highlighted) { borderClass = 'border-yellow-400'; bgClass = 'bg-yellow-900/30'; }

  const p1Seed = match.participant1Id !== null ? seedMap.get(match.participant1Id) : undefined;
  const p2Seed = match.participant2Id !== null ? seedMap.get(match.participant2Id) : undefined;

  const isByeMatch = matchState === 'bye';
  const isP1Win = isByeMatch ? true : match.status === 'completed' && match.winnerId === match.participant1Id;
  const isP2Win = !isByeMatch && match.status === 'completed' && match.winnerId === match.participant2Id;
  const isP1Loss = !isByeMatch && match.status === 'completed' && !isP1Win && match.participant1Id !== null;
  const isP2Loss = !isByeMatch && match.status === 'completed' && !isP2Win && match.participant2Id !== null;

  const resolvedP1 = match.participant1Id && resolvedParticipants ? resolvedParticipants[match.participant1Id] : undefined;
  const resolvedP2 = match.participant2Id && resolvedParticipants ? resolvedParticipants[match.participant2Id] : undefined;

  return (
    <div
      data-testid={`match-card-${match.id}`}
      data-participant1-id={match.participant1Id ?? undefined}
      data-participant2-id={match.participant2Id ?? undefined}
      className={`${bgClass} border ${borderClass} rounded px-2 py-1.5 w-44 transition-opacity duration-200 ${
        hasUserParticipant ? 'ring-1 ring-blue-500/50 shadow-md shadow-blue-500/10' : ''
      } ${highlighted ? 'ring-2 ring-yellow-400/70' : ''} ${dimmed ? 'opacity-25' : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <ParticipantSlot
          participant={match.robot1}
          seed={p1Seed}
          isWinner={isP1Win}
          isLoser={isP1Loss}
          isUserParticipant={isP1User}
          resolvedParticipant={resolvedP1}
          isTeamTournament={isTeamTournament}
        />
        {isP1User && <span className="text-[9px] text-primary font-medium shrink-0">YOU</span>}
      </div>
      <div className="border-t border-white/10/50 my-0.5" />
      <div className="flex items-center justify-between gap-1">
        {isByeMatch ? (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-warning">BYE</span>
        ) : (
          <>
            <ParticipantSlot
              participant={match.robot2}
              seed={p2Seed}
              isWinner={isP2Win}
              isLoser={isP2Loss}
              isUserParticipant={isP2User}
              resolvedParticipant={resolvedP2}
              isTeamTournament={isTeamTournament}
            />
            {isP2User && <span className="text-[9px] text-primary font-medium shrink-0">YOU</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
