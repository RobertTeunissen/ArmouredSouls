import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TournamentMatchWithRobots, getRoundLabel } from '../../utils/bracketUtils';
import { useBracketLayout, CARD_HEIGHT, COLUMN_GAP, COLUMN_WIDTH, LABEL_HEIGHT } from '../../hooks/useBracketLayout';
import { useZoomPan } from '../../hooks/useZoomPan';
import MatchCard from './MatchCard';

interface DesktopBracketProps {
  matches: TournamentMatchWithRobots[];
  maxRounds: number;
  currentRound: number;
  status: string;
  seedMap: Map<number, number>;
  userRobotIds: Set<number>;
  futurePathMatchIds: Set<number>;
  focusRobotId: number | null;
  showOnlyMyBots: boolean;
  startRound: number;
  endRound: number;
}

const DesktopBracket: React.FC<DesktopBracketProps> = ({
  matches, maxRounds, currentRound, status, seedMap,
  userRobotIds, futurePathMatchIds, focusRobotId, showOnlyMyBots,
  startRound, endRound,
}) => {
  const {
    bracketTree, visibleRounds, matchPositions,
    visibleHeight, totalWidth, connectorLines,
  } = useBracketLayout(matches, maxRounds, startRound, endRound);

  const zp = useZoomPan([startRound, endRound]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedMatchId, setHighlightedMatchId] = useState<number | null>(null);

  // Scroll to focused robot
  useEffect(() => {
    if (focusRobotId === null || !containerRef.current) return;
    const card = containerRef.current.querySelector(
      `[data-robot1-id="${focusRobotId}"], [data-robot2-id="${focusRobotId}"]`
    ) as HTMLElement | null;
    if (!card) return;
    const testId = card.getAttribute('data-testid') ?? '';
    const matchId = parseInt(testId.replace('match-card-', ''), 10);
    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    setHighlightedMatchId(matchId);
    const timer = setTimeout(() => setHighlightedMatchId(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRobotId]);

  const isUserRelated = useCallback((match: TournamentMatchWithRobots): boolean => {
    return (
      (match.robot1Id !== null && userRobotIds.has(match.robot1Id)) ||
      (match.robot2Id !== null && userRobotIds.has(match.robot2Id)) ||
      futurePathMatchIds.has(match.id)
    );
  }, [userRobotIds, futurePathMatchIds]);

  return (
    <div
      ref={containerRef}
      data-testid="desktop-bracket"
      className="overflow-auto relative bg-background rounded-lg border border-white/10"
      style={{
        maxHeight: '80vh',
        cursor: zp.isPanning ? 'grabbing' : 'grab',
      }}
      onWheel={zp.handleWheel}
      onMouseDown={zp.handleMouseDown}
      onMouseMove={zp.handleMouseMove}
      onMouseUp={zp.handleMouseUp}
      onMouseLeave={zp.handleMouseUp}
      onTouchMove={zp.handleTouchMove}
      onTouchEnd={zp.handleTouchEnd}
    >
      {/* Zoom controls */}
      <div className="sticky top-0 left-0 z-10 flex items-center gap-2 p-2 bg-background/90 backdrop-blur-sm text-xs text-secondary">
        <button className="px-2 py-0.5 bg-surface-elevated rounded hover:bg-gray-600" onClick={zp.zoomOut}>−</button>
        <span>{Math.round(zp.scale * 100)}%</span>
        <button className="px-2 py-0.5 bg-surface-elevated rounded hover:bg-gray-600" onClick={zp.zoomIn}>+</button>
        <button className="px-2 py-0.5 bg-surface-elevated rounded hover:bg-gray-600 ml-2" onClick={zp.reset}>Reset</button>
        <span className="ml-2 text-tertiary">Ctrl+scroll to zoom · Drag to pan</span>
      </div>

      <div
        className="relative p-3"
        style={{
          width: `${totalWidth}px`,
          height: `${visibleHeight + LABEL_HEIGHT}px`,
          transform: `scale(${zp.scale}) translate(${zp.translate.x / zp.scale}px, ${zp.translate.y / zp.scale}px)`,
          transformOrigin: 'top left',
        }}
      >
        <svg className="absolute inset-0 pointer-events-none"
          width={totalWidth} height={visibleHeight + LABEL_HEIGHT}>
          {connectorLines}
        </svg>

        {visibleRounds.map((round, vi) => {
          const roundMatches = bracketTree.get(round) ?? [];
          const isCurrentRound = status === 'active' && round === currentRound;
          const x = vi * (COLUMN_WIDTH + COLUMN_GAP) + 12;

          return (
            <React.Fragment key={round}>
              <div
                className={`absolute text-xs font-semibold text-center py-1 ${
                  isCurrentRound ? 'text-warning' : 'text-secondary'
                }`}
                style={{ left: `${x}px`, top: 0, width: `${COLUMN_WIDTH}px` }}
              >
                {getRoundLabel(round, maxRounds)}
              </div>

              {roundMatches.map((match) => {
                const yCenter = matchPositions.get(match.id) ?? 0;
                const yTop = yCenter - CARD_HEIGHT / 2 + LABEL_HEIGHT;
                const isDimmed = showOnlyMyBots && !isUserRelated(match);

                return (
                  <div key={match.id} className="absolute"
                    style={{ left: `${x}px`, top: `${yTop}px` }}>
                    <MatchCard
                      match={match} seedMap={seedMap} userRobotIds={userRobotIds}
                      isUserFuturePath={futurePathMatchIds.has(match.id)}
                      dimmed={isDimmed} highlighted={highlightedMatchId === match.id}
                    />
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default DesktopBracket;
