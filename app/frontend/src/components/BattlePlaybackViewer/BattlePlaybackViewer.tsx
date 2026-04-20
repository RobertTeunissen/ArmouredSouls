import React, { useMemo, useRef, useEffect } from 'react';
import {
  PlaybackCombatResult,
  PlaybackRobotInfo,
  PlaybackCombatEvent,
  AttackIndicator,
  RangeBand,
  KothPlaybackData,
} from './types';
import { usePlaybackEngine } from './usePlaybackEngine';
import { useKothPlaybackState } from './useKothPlaybackState';
import { ArenaCanvas } from './ArenaCanvas';
import { PlaybackControls } from './PlaybackControls';
import { CombatLogPanel } from './CombatLogPanel';

interface BattlePlaybackViewerProps {
  battleResult: PlaybackCombatResult;
  robot1Info: PlaybackRobotInfo;
  robot2Info: PlaybackRobotInfo;
  /** Additional robots for tag team battles (reserve robots that enter mid-battle) */
  extraRobots?: PlaybackRobotInfo[];
  /** Narrative events for the combat log text display (optional, falls back to battleResult.events) */
  narrativeEvents?: PlaybackCombatEvent[];
  /** Whether this is a tag team battle (affects HP mapping strategy) */
  isTagTeam?: boolean;
  /** KotH-specific playback data */
  kothData?: KothPlaybackData;
}

const ATTACK_INDICATOR_DURATION = 0.6; // seconds

/** Attack-like event types that produce visual indicators */
const ATTACK_EVENT_TYPES = new Set([
  'attack', 'critical', 'miss', 'malfunction', 'counter', 'backstab', 'flanking',
]);

/** Melee weapon types for indicator style */
const MELEE_WEAPON_KEYWORDS = [
  'sword', 'knife', 'blade', 'axe', 'hammer', 'fist',
];

function isRangedAttack(weaponName?: string): boolean {
  if (!weaponName) return false;
  const lower = weaponName.toLowerCase();
  return !MELEE_WEAPON_KEYWORDS.some((kw) => lower.includes(kw));
}

function mapEventToIndicatorType(
  event: { hit?: boolean; critical?: boolean; malfunction?: boolean }
): 'hit' | 'miss' | 'critical' | 'malfunction' {
  if (event.malfunction) return 'malfunction';
  if (event.critical) return 'critical';
  if (event.hit === false) return 'miss';
  return 'hit';
}

/**
 * Main container component composing ArenaCanvas, PlaybackControls, and CombatLogPanel.
 * Graceful degradation: if no arenaRadius in data, shows text-based combat log only.
 *
 * Validates: Requirements 17.11, 17.12
 */
export const BattlePlaybackViewer: React.FC<BattlePlaybackViewerProps> = ({
  battleResult,
  robot1Info,
  robot2Info,
  extraRobots,
  narrativeEvents,
  isTagTeam,
  kothData,
}) => {
  const hasSpatialData = battleResult.arenaRadius !== undefined && battleResult.arenaRadius > 0;
  const robots = useMemo(
    () => [robot1Info, robot2Info, ...(extraRobots ?? [])],
    [robot1Info, robot2Info, extraRobots],
  );

  // Use battleResult.events for animation (these should have position data)
  // Use narrativeEvents for the combat log text display (falls back to battleResult.events)
  // Filter out financial reward events (already shown in the battle summary above)
  // and movement/range_transition events when spatial view is active (they're visualized in the arena)
  const logEvents = useMemo((): PlaybackCombatEvent[] => {
    const source = narrativeEvents ?? battleResult.events;
    const financialTypes = new Set(['reward_summary', 'reward_detail', 'reward_breakdown', 'tournament_reward']);
    const spatialOnlyTypes = new Set(['movement', 'range_transition']);
    return source.filter(e => {
      if (financialTypes.has(e.type)) return false;
      if (hasSpatialData && spatialOnlyTypes.has(e.type)) return false;
      return true;
    });
  }, [narrativeEvents, battleResult.events, hasSpatialData]);

  // Collect all robot names for the playback engine (needed for tag team sideline positions)
  const allRobotNames = useMemo(
    () => robots.map(r => r.name),
    [robots],
  );

  const {
    state,
    frame,
    currentEventIndex,
    play,
    pause,
    togglePlayPause,
    setSpeed,
    seekTo,
    skipToNextEvent,
  } = usePlaybackEngine({
    events: battleResult.events,
    duration: battleResult.durationSeconds,
    startingPositions: battleResult.startingPositions,
    robot1Name: robot1Info.name,
    robot2Name: robot2Info.name,
    allRobotNames,
    arenaRadius: battleResult.arenaRadius,
    isTagTeam,
  });

  // Build attack indicators from events that have position data
  const attackIndicators = useMemo((): AttackIndicator[] => {
    const indicators: AttackIndicator[] = [];
    for (const event of battleResult.events) {
      if (!ATTACK_EVENT_TYPES.has(event.type)) continue;
      if (!event.positions || !event.attacker || !event.defender) continue;

      const from = event.positions[event.attacker];
      const to = event.positions[event.defender];
      if (!from || !to) continue;

      indicators.push({
        timestamp: event.timestamp,
        from,
        to,
        type: mapEventToIndicatorType(event),
        isRanged: isRangedAttack(event.weapon),
        duration: ATTACK_INDICATOR_DURATION,
      });
    }
    return indicators;
  }, [battleResult.events]);

  // Determine focused range band from the most recent event with rangeBand data
  const focusedRangeBand = useMemo((): RangeBand | undefined => {
    for (let i = Math.min(currentEventIndex, battleResult.events.length - 1); i >= 0; i--) {
      const rb = battleResult.events[i].rangeBand;
      if (rb) return rb;
    }
    return undefined;
  }, [currentEventIndex, battleResult.events]);

  // Determine the two currently active (fighting) robots from the most recent position event.
  // In tag team battles the active pair changes between phases.
  // For 1v1 battles, always use the canonical robot1/robot2 names to avoid
  // JSONB key-order instability causing visual swaps.
  const activeRobotNames = useMemo((): [string, string] | undefined => {
    if (!isTagTeam && !kothData) {
      // 1v1: canonical order, never changes
      return [robot1Info.name, robot2Info.name];
    }
    for (let i = Math.min(currentEventIndex, battleResult.events.length - 1); i >= 0; i--) {
      const pos = battleResult.events[i].positions;
      if (pos) {
        const names = Object.keys(pos);
        if (names.length >= 2) return [names[0], names[1]];
      }
    }
    return undefined;
  }, [currentEventIndex, battleResult.events, isTagTeam, kothData, robot1Info.name, robot2Info.name]);

  // Derive KotH zone state and scores from events up to currentEventIndex
  const kothState = useKothPlaybackState(kothData, currentEventIndex, battleResult.events);

  // Build a map of each robot's most recent target from attack events.
  // For KotH: uses kothState.scores isEliminated flags (tracks yield/destroyed via robot_eliminated events).
  // For 1v1/tag team: uses frame HP values (destroyed = HP 0).
  const robotTargets = useMemo((): Record<string, string> => {
    const targets: Record<string, string> = {};
    const eliminated = new Set<string>();

    // KotH: use the authoritative eliminated set from kothState
    if (kothState?.scores) {
      for (const entry of kothState.scores) {
        if (entry.isEliminated) {
          eliminated.add(entry.robotName);
        }
      }
    }

    // Also check frame HP for destroyed robots (works for all battle types)
    for (const robot of robots) {
      const hp = frame.hpValues[robot.name];
      if (hp !== undefined && hp <= 0) {
        eliminated.add(robot.name);
      }
    }

    // Backward pass to find most recent target per robot
    for (let i = Math.min(currentEventIndex, battleResult.events.length - 1); i >= 0; i--) {
      const evt = battleResult.events[i];
      if (evt.attacker && evt.defender && !targets[evt.attacker]) {
        targets[evt.attacker] = evt.defender;
      }
    }

    // Remove eliminated robots and targets pointing to eliminated robots
    for (const name of eliminated) {
      delete targets[name];
    }
    for (const [attacker, defender] of Object.entries(targets)) {
      if (eliminated.has(defender)) {
        delete targets[attacker];
      }
    }

    return targets;
  }, [currentEventIndex, battleResult.events, robots, frame.hpValues, kothState]);

  // Compute the current log event index from playback time against the logEvents array,
  // since logEvents and battleResult.events are different arrays (narrative vs spatial).
  // Scan all events to find the last one at or before currentTime (don't break early
  // in case events aren't perfectly sorted by timestamp).
  const currentLogEventIndex = useMemo((): number => {
    let result = -1;
    for (let i = 0; i < logEvents.length; i++) {
      if (logEvents[i].timestamp <= state.currentTime) {
        result = i;
      }
    }
    return result;
  }, [logEvents, state.currentTime]);

  const handleSeekToEvent = (timestamp: number): void => {
    seekTo(timestamp);
  };

  // Fallback: no spatial data — show text-based combat log only
  if (!hasSpatialData) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="h-96">
          <CombatLogPanel
            events={logEvents}
            currentEventIndex={currentLogEventIndex}
            onSeekToEvent={handleSeekToEvent}
          />
        </div>
        <div className="mt-2">
          <PlaybackControls
            state={state}
            onPlay={play}
            onPause={pause}
            onTogglePlayPause={togglePlayPause}
            onSetSpeed={setSpeed}
            onSeekTo={seekTo}
            onSkipToNextEvent={skipToNextEvent}
          />
        </div>
      </div>
    );
  }

  // Full spatial playback view
  return (
    <div className="flex flex-col lg:flex-row gap-3 w-full">
      {/* Left: Arena + Controls */}
      <div className="flex flex-col gap-2 flex-shrink-0 w-full max-w-[500px]">
        <ArenaCanvas
          arenaRadius={battleResult.arenaRadius!}
          frame={frame}
          robots={robots}
          attackIndicators={attackIndicators}
          currentTime={state.currentTime}
          focusedRangeBand={focusedRangeBand}
          activeRobotNames={activeRobotNames}
          robotTargets={robotTargets}
          kothZone={kothState?.zone}
          kothScores={kothState?.scores}
          kothScoreThreshold={kothData?.scoreThreshold}
        />
        <PlaybackControls
          state={state}
          onPlay={play}
          onPause={pause}
          onTogglePlayPause={togglePlayPause}
          onSetSpeed={setSpeed}
          onSeekTo={seekTo}
          onSkipToNextEvent={skipToNextEvent}
        />
      </div>

      {/* Right: Combat Log — height adapts to match arena column */}
      <div className="flex-1 min-w-0 lg:max-h-[540px] h-96 lg:h-auto lg:self-stretch">
        <CombatLogPanel
          events={logEvents}
          currentEventIndex={currentLogEventIndex}
          onSeekToEvent={handleSeekToEvent}
        />
      </div>
    </div>
  );
};
