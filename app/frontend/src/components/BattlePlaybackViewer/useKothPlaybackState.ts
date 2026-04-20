import { useMemo } from 'react';
import type {
  PlaybackCombatEvent,
  Position,
  KothZoneState,
  KothPlaybackData,
} from './types';

export interface KothScoreEntry {
  robotName: string;
  zoneScore: number;
  isEliminated: boolean;
}

export interface KothPlaybackState {
  zone: KothZoneState;
  scores: KothScoreEntry[];
}

/**
 * Derives KotH zone state and scores from battle events up to the current event index.
 *
 * Reads scores from kpiData.zoneScores (keyed by robot ID) on score_tick,
 * kill_bonus, and match_end events, using the robotIdToName mapping from
 * kothData to resolve IDs to display names. Falls back to event.damage
 * for the zone holder if kpiData is unavailable.
 */
export function useKothPlaybackState(
  kothData: KothPlaybackData | undefined,
  currentEventIndex: number,
  events: PlaybackCombatEvent[],
): KothPlaybackState | undefined {
  return useMemo(() => {
    if (!kothData?.isKoth) return undefined;

    // Robot ID → name mapping from placements data
    const idToName: Record<string, string> = kothData.robotIdToName ?? {};

    let zoneCenter: Position = { x: 0, y: 0 };
    const zoneRadius = kothData.zoneRadius;
    let zoneState: 'uncontested' | 'contested' | 'empty' | 'inactive' = 'empty';
    let controllingRobotName: string | undefined;
    const occupantNames: Set<string> = new Set();
    const scores: Map<string, number> = new Map();
    const eliminated: Set<string> = new Set();

    // Track zone transition: previous center and timestamps for animation
    let previousCenter: Position | undefined;
    let zoneMovingTimestamp: number | undefined;
    let zoneActiveTimestamp: number | undefined;

    for (let i = 0; i <= Math.min(currentEventIndex, events.length - 1); i++) {
      const event = events[i];

      if (event.type === 'zone_defined' && event.positions?.zone_center) {
        zoneCenter = event.positions.zone_center;
      }
      if (event.type === 'zone_moving') {
        // Save the current center as the previous position before the zone moves
        previousCenter = { ...zoneCenter };
        zoneMovingTimestamp = event.timestamp;
        zoneActiveTimestamp = undefined;
        zoneState = 'inactive';
        occupantNames.clear();

        // Look ahead to find the next zone_active event to get the new center
        // so we can show the destination during the moving phase
        for (let j = i + 1; j < events.length; j++) {
          if (events[j].type === 'zone_active' && events[j].positions?.zone_center) {
            zoneActiveTimestamp = events[j].timestamp;
            break;
          }
        }
      }
      if (event.type === 'zone_active' && event.positions?.zone_center) {
        previousCenter = previousCenter ?? { ...zoneCenter };
        zoneCenter = event.positions.zone_center;
        zoneActiveTimestamp = event.timestamp;
        zoneState = 'empty';
      }
      if (event.type === 'zone_enter' && event.attacker) {
        occupantNames.add(event.attacker);
      }
      if (event.type === 'zone_exit' && event.attacker) {
        occupantNames.delete(event.attacker);
      }
      if (event.type === 'robot_eliminated' && event.attacker) {
        eliminated.add(event.attacker);
        occupantNames.delete(event.attacker);
      }

      // Update scores from kpiData.zoneScores (all robots) or fallback to event.damage
      if (event.type === 'score_tick' || event.type === 'kill_bonus' || event.type === 'match_end') {
        const zoneScores = event.kpiData?.zoneScores as Record<string, number> | undefined;
        if (zoneScores) {
          for (const [robotId, score] of Object.entries(zoneScores)) {
            const name = idToName[robotId];
            if (name) {
              scores.set(name, score);
            }
          }
        } else if (event.damage !== undefined && event.attacker) {
          scores.set(event.attacker, event.damage);
        }
      }
    }

    // Determine zone state from occupants
    const activeOccupants = [...occupantNames].filter(n => !eliminated.has(n));
    if (zoneState !== 'inactive') {
      if (activeOccupants.length === 0) {
        zoneState = 'empty';
        controllingRobotName = undefined;
      } else if (activeOccupants.length === 1) {
        zoneState = 'uncontested';
        controllingRobotName = activeOccupants[0];
      } else {
        zoneState = 'contested';
        controllingRobotName = undefined;
      }
    }

    // Compute transition progress for zone movement animation
    let transitionProgress: number | undefined;
    if (zoneMovingTimestamp !== undefined && previousCenter) {
      if (zoneActiveTimestamp !== undefined && zoneActiveTimestamp > zoneMovingTimestamp) {
        // We know both timestamps — compute progress based on current event's timestamp
        const currentEvent = events[Math.min(currentEventIndex, events.length - 1)];
        const currentTs = currentEvent?.timestamp ?? zoneMovingTimestamp;
        const duration = zoneActiveTimestamp - zoneMovingTimestamp;
        if (duration > 0) {
          transitionProgress = Math.max(0, Math.min(1, (currentTs - zoneMovingTimestamp) / duration));
        } else {
          transitionProgress = 1;
        }
      } else if (zoneState === 'inactive') {
        // Still in moving state, no zone_active seen yet — show early transition
        transitionProgress = 0;
      }
    }

    // Clear previousCenter once the transition is fully complete (progress = 1 and zone is active)
    const finalPreviousCenter =
      previousCenter && transitionProgress !== undefined && transitionProgress < 1
        ? previousCenter
        : zoneState === 'inactive'
          ? previousCenter
          : undefined;
    const finalTransitionProgress =
      finalPreviousCenter !== undefined ? transitionProgress : undefined;

    return {
      zone: {
        center: zoneCenter,
        radius: zoneRadius,
        state: zoneState,
        controllingRobotName,
        occupantNames: activeOccupants,
        previousCenter: finalPreviousCenter,
        transitionProgress: finalTransitionProgress,
      } as KothZoneState,
      scores: Array.from(scores.entries()).map(([robotName, zoneScore]) => ({
        robotName,
        zoneScore,
        isEliminated: eliminated.has(robotName),
      })),
    };
  }, [kothData, currentEventIndex, events]);
}
