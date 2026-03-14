import { useMemo } from 'react';
import React from 'react';
import { TournamentMatchWithRobots, buildBracketTree } from '../utils/bracketUtils';

const CARD_HEIGHT = 48;
const BASE_GAP = 12;
const COLUMN_GAP = 56;
const COLUMN_WIDTH = 184;
const LABEL_HEIGHT = 32;

export { CARD_HEIGHT, BASE_GAP, COLUMN_GAP, COLUMN_WIDTH, LABEL_HEIGHT };

interface BracketLayoutResult {
  bracketTree: Map<number, TournamentMatchWithRobots[]>;
  visibleRounds: number[];
  matchPositions: Map<number, number>;
  visibleHeight: number;
  totalWidth: number;
  connectorLines: React.ReactElement[];
}

/**
 * Computes layout positions for the visible portion of a tournament bracket.
 *
 * When startRound > 1, positions are recalculated so the earliest visible
 * round is laid out compactly (as if it were round 1), and subsequent rounds
 * derive their Y from the midpoint of their two feeder matches. This keeps
 * the filtered view tight and readable instead of preserving the full-bracket
 * spacing which creates huge vertical gaps.
 */
export function useBracketLayout(
  matches: TournamentMatchWithRobots[],
  maxRounds: number,
  startRound: number,
  endRound: number,
): BracketLayoutResult {
  const bracketTree = buildBracketTree(matches, maxRounds);

  const visibleRounds = Array.from(
    { length: endRound - startRound + 1 },
    (_, i) => startRound + i,
  );

  /**
   * Compute Y-center positions for every visible match.
   * The earliest visible round is spaced evenly (stride = CARD_HEIGHT + BASE_GAP).
   * Later rounds center between their two feeder matches from the previous round.
   */
  const matchPositions = useMemo((): Map<number, number> => {
    const positions = new Map<number, number>();
    const stride = CARD_HEIGHT + BASE_GAP;

    for (const round of visibleRounds) {
      const roundMatches = bracketTree.get(round) ?? [];

      if (round === startRound) {
        // Base round: lay out compactly
        for (let i = 0; i < roundMatches.length; i++) {
          positions.set(roundMatches[i].id, i * stride + CARD_HEIGHT / 2);
        }
      } else {
        const prevMatches = bracketTree.get(round - 1) ?? [];
        for (let i = 0; i < roundMatches.length; i++) {
          const f1 = prevMatches[i * 2];
          const f2 = prevMatches[i * 2 + 1];
          const y1 = f1 ? (positions.get(f1.id) ?? 0) : 0;
          const y2 = f2 ? (positions.get(f2.id) ?? y1) : y1;
          positions.set(roundMatches[i].id, (y1 + y2) / 2);
        }
      }
    }
    return positions;
  }, [bracketTree, visibleRounds, startRound]);

  const visibleHeight = useMemo((): number => {
    const baseMatches = bracketTree.get(startRound) ?? [];
    if (baseMatches.length === 0) return 200;
    let maxY = 0;
    for (const m of baseMatches) {
      const y = matchPositions.get(m.id) ?? 0;
      if (y > maxY) maxY = y;
    }
    return maxY + CARD_HEIGHT / 2 + 20;
  }, [bracketTree, startRound, matchPositions]);

  const numVisible = visibleRounds.length;
  const totalWidth = numVisible * COLUMN_WIDTH + (numVisible - 1) * COLUMN_GAP + 24;

  const connectorLines = useMemo((): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    for (let vi = 0; vi < visibleRounds.length - 1; vi++) {
      const round = visibleRounds[vi];
      const nextRound = visibleRounds[vi + 1];
      if (nextRound !== round + 1) continue;

      const roundMatches = bracketTree.get(round) ?? [];
      const nextMatches = bracketTree.get(nextRound) ?? [];

      const colLeft = vi * (COLUMN_WIDTH + COLUMN_GAP) + 12;
      const sourceX = colLeft + COLUMN_WIDTH;
      const targetX = colLeft + COLUMN_WIDTH + COLUMN_GAP;
      const midX = sourceX + COLUMN_GAP / 2;

      for (let i = 0; i < nextMatches.length; i++) {
        const nextMatch = nextMatches[i];
        const f1 = roundMatches[i * 2];
        const f2 = roundMatches[i * 2 + 1];
        const nextY = (matchPositions.get(nextMatch.id) ?? 0) + LABEL_HEIGHT;

        if (f1) {
          const y1 = (matchPositions.get(f1.id) ?? 0) + LABEL_HEIGHT;
          lines.push(
            React.createElement('path', {
              key: `c-${f1.id}-${nextMatch.id}`,
              d: `M ${sourceX} ${y1} H ${midX} V ${nextY} H ${targetX}`,
              fill: 'none', stroke: '#4b5563', strokeWidth: 1.5,
            }),
          );
        }
        if (f2) {
          const y2 = (matchPositions.get(f2.id) ?? 0) + LABEL_HEIGHT;
          lines.push(
            React.createElement('path', {
              key: `c-${f2.id}-${nextMatch.id}`,
              d: `M ${sourceX} ${y2} H ${midX} V ${nextY} H ${targetX}`,
              fill: 'none', stroke: '#4b5563', strokeWidth: 1.5,
            }),
          );
        }
      }
    }
    return lines;
  }, [visibleRounds, bracketTree, matchPositions]);

  return {
    bracketTree,
    visibleRounds,
    matchPositions,
    visibleHeight,
    totalWidth,
    connectorLines,
  };
}
