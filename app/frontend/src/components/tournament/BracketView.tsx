import React, { useMemo, useState, useCallback } from 'react';
import { TournamentMatchWithRobots, getUserFuturePath, getRoundLabel } from '../../utils/bracketUtils';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { SeedEntry, ParticipantType, ResolvedParticipant } from '../../utils/tournamentApi';
import DesktopBracket from './DesktopBracket';
import MobileBracket from './MobileBracket';
import SeedingList from './SeedingList';

interface BracketViewProps {
  matches: TournamentMatchWithRobots[];
  seedings: SeedEntry[];
  maxRounds: number;
  currentRound: number;
  status: string;
  participantType: ParticipantType;
  userParticipantIds: Set<number>;
  resolvedParticipants?: Record<number, ResolvedParticipant>;
  /** @deprecated Use userParticipantIds */
  userRobotIds?: Set<number>;
}

const BracketView: React.FC<BracketViewProps> = ({
  matches, seedings, maxRounds, currentRound, status,
  participantType, userParticipantIds, resolvedParticipants,
  userRobotIds,
}) => {
  const isMobile = useIsMobile();
  const [focusParticipantId, setFocusParticipantId] = useState<number | null>(null);
  const [showOnlyMyParticipants, setShowOnlyMyParticipants] = useState(false);
  const [startRound, setStartRound] = useState(1);
  const [endRound, setEndRound] = useState(maxRounds);

  // Support legacy userRobotIds prop for backward compatibility
  const effectiveUserParticipantIds = useMemo(
    () => userParticipantIds ?? userRobotIds ?? new Set<number>(),
    [userParticipantIds, userRobotIds],
  );

  const isTeamTournament = participantType === 'team_2v2' || participantType === 'team_3v3';

  const seedMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of seedings) map.set(entry.robotId, entry.seed);
    return map;
  }, [seedings]);

  const futurePathMatchIds = useMemo(
    () => getUserFuturePath(matches, effectiveUserParticipantIds, maxRounds),
    [matches, effectiveUserParticipantIds, maxRounds],
  );

  /** Find all user participants that appear in this tournament's matches */
  const userParticipantsInTournament = useMemo(() => {
    const participants: Array<{ id: number; name: string }> = [];
    const seen = new Set<number>();
    for (const m of matches) {
      if (m.participant1Id !== null && effectiveUserParticipantIds.has(m.participant1Id) && !seen.has(m.participant1Id)) {
        seen.add(m.participant1Id);
        const resolved = resolvedParticipants?.[m.participant1Id];
        const name = resolved?.displayName ?? m.robot1?.name ?? `Participant #${m.participant1Id}`;
        participants.push({ id: m.participant1Id, name });
      }
      if (m.participant2Id !== null && effectiveUserParticipantIds.has(m.participant2Id) && !seen.has(m.participant2Id)) {
        seen.add(m.participant2Id);
        const resolved = resolvedParticipants?.[m.participant2Id];
        const name = resolved?.displayName ?? m.robot2?.name ?? `Participant #${m.participant2Id}`;
        participants.push({ id: m.participant2Id, name });
      }
    }
    return participants;
  }, [matches, effectiveUserParticipantIds, resolvedParticipants]);

  const handleParticipantFocus = useCallback((participantId: number) => {
    setFocusParticipantId(null);
    setTimeout(() => setFocusParticipantId(participantId), 0);
  }, []);

  const handleMyParticipantSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setShowOnlyMyParticipants(false);
      setFocusParticipantId(null);
    } else {
      const participantId = parseInt(val, 10);
      setShowOnlyMyParticipants(true);
      handleParticipantFocus(participantId);
    }
  }, [handleParticipantFocus]);

  if (matches.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-8 text-center">
        <p className="text-tertiary">No matches available</p>
      </div>
    );
  }

  const roundOptions = Array.from({ length: maxRounds }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* My Participants picker */}
        {userParticipantsInTournament.length > 0 && (
          <select
            onChange={handleMyParticipantSelect}
            defaultValue=""
            className="bg-surface border border-white/10 text-sm text-secondary rounded px-3 py-1.5 hover:border-gray-500 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All matches</option>
            {userParticipantsInTournament.map((p) => (
              <option key={p.id} value={p.id}>{isTeamTournament ? '⚔️' : '🤖'} {p.name}</option>
            ))}
          </select>
        )}

        {/* Round range filter */}
        {!isMobile && maxRounds > 2 && (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span>From</span>
            <select
              value={startRound}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setStartRound(v);
                if (v > endRound) setEndRound(v);
              }}
              className="bg-surface border border-white/10 text-secondary rounded px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            >
              {roundOptions.map((r) => (
                <option key={r} value={r}>{getRoundLabel(r, maxRounds)}</option>
              ))}
            </select>
            <span>to</span>
            <select
              value={endRound}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setEndRound(v);
                if (v < startRound) setStartRound(v);
              }}
              className="bg-surface border border-white/10 text-secondary rounded px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            >
              {roundOptions.filter((r) => r >= startRound).map((r) => (
                <option key={r} value={r}>{getRoundLabel(r, maxRounds)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          {isMobile ? (
            <MobileBracket
              matches={matches} maxRounds={maxRounds} currentRound={currentRound}
              status={status} seedMap={seedMap} userParticipantIds={effectiveUserParticipantIds}
              futurePathMatchIds={futurePathMatchIds}
              resolvedParticipants={resolvedParticipants}
              participantType={participantType}
            />
          ) : (
            <DesktopBracket
              matches={matches} maxRounds={maxRounds} currentRound={currentRound}
              status={status} seedMap={seedMap} userParticipantIds={effectiveUserParticipantIds}
              futurePathMatchIds={futurePathMatchIds} focusParticipantId={focusParticipantId}
              showOnlyMyParticipants={showOnlyMyParticipants}
              startRound={startRound} endRound={endRound}
              resolvedParticipants={resolvedParticipants}
              participantType={participantType}
            />
          )}
        </div>
        <div className="lg:w-64 shrink-0">
          <SeedingList seedings={seedings} userRobotIds={effectiveUserParticipantIds}
            onRobotClick={handleParticipantFocus} />
        </div>
      </div>
    </div>
  );
};

export default BracketView;
