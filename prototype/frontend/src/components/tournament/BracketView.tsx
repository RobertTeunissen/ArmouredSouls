import React, { useMemo, useState, useCallback } from 'react';
import { TournamentMatchWithRobots, getUserFuturePath, getRoundLabel } from '../../utils/bracketUtils';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { SeedEntry } from '../../utils/tournamentApi';
import DesktopBracket from './DesktopBracket';
import MobileBracket from './MobileBracket';
import SeedingList from './SeedingList';

interface BracketViewProps {
  matches: TournamentMatchWithRobots[];
  seedings: SeedEntry[];
  maxRounds: number;
  currentRound: number;
  status: string;
  userRobotIds: Set<number>;
}

const BracketView: React.FC<BracketViewProps> = ({
  matches, seedings, maxRounds, currentRound, status, userRobotIds,
}) => {
  const isMobile = useIsMobile();
  const [focusRobotId, setFocusRobotId] = useState<number | null>(null);
  const [showOnlyMyBots, setShowOnlyMyBots] = useState(false);
  const [startRound, setStartRound] = useState(1);
  const [endRound, setEndRound] = useState(maxRounds);

  const seedMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of seedings) map.set(entry.robotId, entry.seed);
    return map;
  }, [seedings]);

  const futurePathMatchIds = useMemo(
    () => getUserFuturePath(matches, userRobotIds, maxRounds),
    [matches, userRobotIds, maxRounds],
  );

  /** Find all user robots that appear in this tournament's matches */
  const userRobotsInTournament = useMemo(() => {
    const robots: Array<{ id: number; name: string }> = [];
    const seen = new Set<number>();
    for (const m of matches) {
      if (m.robot1Id !== null && userRobotIds.has(m.robot1Id) && !seen.has(m.robot1Id) && m.robot1) {
        seen.add(m.robot1Id);
        robots.push({ id: m.robot1.id, name: m.robot1.name });
      }
      if (m.robot2Id !== null && userRobotIds.has(m.robot2Id) && !seen.has(m.robot2Id) && m.robot2) {
        seen.add(m.robot2Id);
        robots.push({ id: m.robot2.id, name: m.robot2.name });
      }
    }
    return robots;
  }, [matches, userRobotIds]);

  const handleRobotFocus = useCallback((robotId: number) => {
    setFocusRobotId(null);
    setTimeout(() => setFocusRobotId(robotId), 0);
  }, []);

  const handleMyBotSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setShowOnlyMyBots(false);
      setFocusRobotId(null);
    } else {
      const robotId = parseInt(val, 10);
      setShowOnlyMyBots(true);
      handleRobotFocus(robotId);
    }
  }, [handleRobotFocus]);

  if (matches.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-500">No matches available</p>
      </div>
    );
  }

  const roundOptions = Array.from({ length: maxRounds }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* My Bots picker */}
        {userRobotsInTournament.length > 0 && (
          <select
            onChange={handleMyBotSelect}
            defaultValue=""
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-3 py-1.5 hover:border-gray-500 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All matches</option>
            {userRobotsInTournament.map((r) => (
              <option key={r.id} value={r.id}>🤖 {r.name}</option>
            ))}
          </select>
        )}

        {/* Round range filter */}
        {!isMobile && maxRounds > 2 && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>From</span>
            <select
              value={startRound}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setStartRound(v);
                if (v > endRound) setEndRound(v);
              }}
              className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
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
              className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
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
              status={status} seedMap={seedMap} userRobotIds={userRobotIds}
              futurePathMatchIds={futurePathMatchIds}
            />
          ) : (
            <DesktopBracket
              matches={matches} maxRounds={maxRounds} currentRound={currentRound}
              status={status} seedMap={seedMap} userRobotIds={userRobotIds}
              futurePathMatchIds={futurePathMatchIds} focusRobotId={focusRobotId}
              showOnlyMyBots={showOnlyMyBots}
              startRound={startRound} endRound={endRound}
            />
          )}
        </div>
        <div className="lg:w-64 shrink-0">
          <SeedingList seedings={seedings} userRobotIds={userRobotIds}
            onRobotClick={handleRobotFocus} />
        </div>
      </div>
    </div>
  );
};

export default BracketView;
