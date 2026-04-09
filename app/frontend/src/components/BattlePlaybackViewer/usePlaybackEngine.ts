import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PlaybackState,
  PlaybackSpeed,
  PlaybackCombatEvent,
  InterpolatedFrame,
  Position,
} from './types';

interface UsePlaybackEngineProps {
  events: PlaybackCombatEvent[];
  duration: number;
  startingPositions?: Record<string, Position>;
  robot1Name?: string;
  robot2Name?: string;
  /** All robot names (including reserves) for tag team battles */
  allRobotNames?: string[];
  /** Arena radius for computing sideline positions */
  arenaRadius?: number;
  /** Whether this is a tag team battle (affects HP mapping strategy) */
  isTagTeam?: boolean;
}

interface UsePlaybackEngineReturn {
  state: PlaybackState;
  frame: InterpolatedFrame;
  currentEventIndex: number;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  seekTo: (time: number) => void;
  skipToNextEvent: () => void;
}

/** Linear interpolation between two values */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Interpolate a Position between two positions */
function lerpPosition(a: Position, b: Position, t: number): Position {
  const clamped = clamp(t, 0, 1);
  return {
    x: lerp(a.x, b.x, clamped),
    y: lerp(a.y, b.y, clamped),
  };
}

/**
 * Find the index of the last event at or before the given time.
 * Returns -1 if no events exist before the time.
 */
function findEventIndex(events: PlaybackCombatEvent[], time: number): number {
  let lo = 0;
  let hi = events.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (events[mid].timestamp <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

/**
 * Find the two nearest events with position data bracketing the given time.
 * Returns [prevIndex, nextIndex] where prev has positions and timestamp <= time,
 * and next has positions and timestamp > time.
 */
function findBracketingPositionEvents(
  events: PlaybackCombatEvent[],
  time: number
): [number, number] {
  let prevIdx = -1;
  let nextIdx = -1;

  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].positions && events[i].timestamp <= time) {
      prevIdx = i;
      break;
    }
  }

  for (let i = (prevIdx >= 0 ? prevIdx + 1 : 0); i < events.length; i++) {
    if (events[i].positions && events[i].timestamp > time) {
      nextIdx = i;
      break;
    }
  }

  return [prevIdx, nextIdx];
}

/**
 * Get the most recent HP/shield values from events at or before the given time.
 *
 * For standard 1v1 battles, robot1Name/robot2Name map directly to the backend's
 * robot1HP/robot2HP fields (positional: always state1/state2 in the simulator).
 *
 * For tag team battles the active robots change between phases, so we detect the
 * current phase's robot pair from the event's `positions` keys and map
 * robot1HP/robot2HP to the first/second position key respectively.
 *
 * IMPORTANT: We use robot1Name/robot2Name as the canonical mapping rather than
 * relying on Object.keys(positions) order, because JSON key order is not
 * guaranteed to survive PostgreSQL JSONB round-trips. Positions key order is
 * only used for tag team phase transitions where the active pair changes.
 */
function getLatestHPShield(
  events: PlaybackCombatEvent[],
  eventIndex: number,
  robot1Name?: string,
  robot2Name?: string,
  isTagTeam?: boolean
): { hp: Record<string, number>; shield: Record<string, number> } {
  const hp: Record<string, number> = {};
  const shield: Record<string, number> = {};

  // KotH path: events carry robotHP and robotShield maps with all participants' data
  const hasRobotHPMap = events.some(e => e.robotHP);
  if (hasRobotHPMap) {
    for (let i = 0; i <= eventIndex && i < events.length; i++) {
      const evt = events[i];
      if (evt.robotHP) {
        for (const [name, hpVal] of Object.entries(evt.robotHP)) {
          hp[name] = hpVal;
        }
      }
      if (evt.robotShield) {
        for (const [name, shieldVal] of Object.entries(evt.robotShield)) {
          shield[name] = shieldVal;
        }
      }
    }
    return { hp, shield };
  }

  // Track the current phase's robot pair
  // For 1v1: always robot1Name/robot2Name (stable, never changes)
  // For tag team: derived from positions keys (changes on phase transitions)
  let phaseRobot1 = robot1Name;
  let phaseRobot2 = robot2Name;

  for (let i = 0; i <= eventIndex && i < events.length; i++) {
    const evt = events[i];

    // Only update phase mapping from positions for tag team battles
    // (1v1 battles always use robot1Name/robot2Name directly)
    if (isTagTeam && evt.positions) {
      const posNames = Object.keys(evt.positions);
      if (posNames.length >= 2) {
        const newR1 = posNames[0];
        const newR2 = posNames[1];

        // Phase transition: robots that left the arena were defeated/yielded.
        // The backend strips yield/destroyed events before tag-out, so we
        // mark departed robots as HP=0 here.
        if (phaseRobot1 && newR1 !== phaseRobot1 && newR2 !== phaseRobot1) {
          hp[phaseRobot1] = 0;
          shield[phaseRobot1] = 0;
        }
        if (phaseRobot2 && newR2 !== phaseRobot2 && newR1 !== phaseRobot2) {
          hp[phaseRobot2] = 0;
          shield[phaseRobot2] = 0;
        }

        phaseRobot1 = newR1;
        phaseRobot2 = newR2;
      }
    }

    if (phaseRobot1 && phaseRobot2) {
      if (evt.robot1HP !== undefined) {
        hp[phaseRobot1] = evt.robot1HP;
      }
      if (evt.robot2HP !== undefined) {
        hp[phaseRobot2] = evt.robot2HP;
      }
      if (evt.robot1Shield !== undefined) {
        shield[phaseRobot1] = evt.robot1Shield;
      }
      if (evt.robot2Shield !== undefined) {
        shield[phaseRobot2] = evt.robot2Shield;
      }
    }
  }

  return { hp, shield };
}

/** Compute initial facing directions from starting positions (each robot faces the other) */
function computeInitialFacing(startingPositions: Record<string, Position>): Record<string, number> {
  const names = Object.keys(startingPositions);
  const facing: Record<string, number> = {};

  if (names.length === 2) {
    const [n1, n2] = names;
    const p1 = startingPositions[n1];
    const p2 = startingPositions[n2];
    facing[n1] = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
    facing[n2] = Math.atan2(p1.y - p2.y, p1.x - p2.x) * (180 / Math.PI);
  } else if (names.length > 2) {
    // N-robot (KotH): each robot faces toward arena center (0,0)
    for (const name of names) {
      const p = startingPositions[name];
      facing[name] = Math.atan2(-p.y, -p.x) * (180 / Math.PI);
    }
  }

  return facing;
}

/**
 * Compute sideline positions for reserve robots waiting outside the arena.
 * Places them just outside the arena boundary on their team's side.
 * allRobotNames order: [team1Active, team2Active, team1Reserve, team2Reserve]
 */
function computeSidelinePositions(
  allRobotNames: string[],
  startingPositions: Record<string, Position>,
  arenaRadius: number
): Record<string, Position> {
  const sideline: Record<string, Position> = {};
  const sidelineY = arenaRadius * 0.78; // Inside visible canvas area (room for name labels above)
  const activeNames = new Set(Object.keys(startingPositions));
  const activeList = [...activeNames];

  for (const name of allRobotNames) {
    if (activeNames.has(name)) continue;

    // Reserve at allRobotNames index 2 → paired with active at index 0 (team 0)
    // Reserve at allRobotNames index 3 → paired with active at index 1 (team 1)
    const idx = allRobotNames.indexOf(name);
    const pairedActiveIdx = idx % 2; // 0 or 1

    if (pairedActiveIdx < activeList.length) {
      const activePos = startingPositions[activeList[pairedActiveIdx]];
      if (activePos) {
        // Place on the same X side as the active robot, but above the arena
        sideline[name] = { x: activePos.x, y: sidelineY };
        continue;
      }
    }

    // Fallback: left or right side
    const teamSide = idx % 2 === 0 ? -1 : 1;
    sideline[name] = { x: teamSide * arenaRadius * 0.5, y: sidelineY };
  }

  return sideline;
}

/**
 * Scan events up to the given index and collect the last known position
 * for every robot that has ever appeared in position data.
 */
function collectLastKnownPositions(
  events: PlaybackCombatEvent[],
  upToIndex: number
): Record<string, Position> {
  const lastKnown: Record<string, Position> = {};
  for (let i = 0; i <= upToIndex && i < events.length; i++) {
    const pos = events[i].positions;
    if (pos) {
      for (const [name, p] of Object.entries(pos)) {
        lastKnown[name] = p;
      }
    }
  }
  return lastKnown;
}

/**
 * Interpolate robot positions between event snapshots for smooth animation.
 * Falls back to startingPositions when no prior position events exist.
 * For tag team battles, places reserve robots at sideline positions until they enter.
 */
function interpolateFrame(
  events: PlaybackCombatEvent[],
  time: number,
  eventIndex: number,
  startingPositions?: Record<string, Position>,
  robot1Name?: string,
  robot2Name?: string,
  allRobotNames?: string[],
  arenaRadius?: number,
  isTagTeam?: boolean
): InterpolatedFrame {
  const positions: Record<string, Position> = {};
  const facingDirections: Record<string, number> = {};

  const [prevIdx, nextIdx] = findBracketingPositionEvents(events, time);

  if (prevIdx >= 0 && nextIdx >= 0) {
    const prevEvent = events[prevIdx];
    const nextEvent = events[nextIdx];
    const timeDelta = nextEvent.timestamp - prevEvent.timestamp;
    const t = timeDelta > 0 ? (time - prevEvent.timestamp) / timeDelta : 0;

    // Interpolate positions for all robots present in both events
    const prevPositions = prevEvent.positions!;
    const nextPositions = nextEvent.positions!;

    for (const robotName of Object.keys(prevPositions)) {
      if (nextPositions[robotName]) {
        positions[robotName] = lerpPosition(
          prevPositions[robotName],
          nextPositions[robotName],
          t
        );
      } else {
        positions[robotName] = prevPositions[robotName];
      }
    }

    // Use facing from the most recent event (no interpolation for facing)
    if (prevEvent.facingDirections) {
      Object.assign(facingDirections, prevEvent.facingDirections);
    } else if (startingPositions) {
      // Fallback for old battles where the first event lacks facingDirections
      Object.assign(facingDirections, computeInitialFacing(startingPositions));
    }
  } else if (prevIdx >= 0) {
    // Past the last position event — use the last known positions
    const prevEvent = events[prevIdx];
    if (prevEvent.positions) {
      Object.assign(positions, prevEvent.positions);
    }
    if (prevEvent.facingDirections) {
      Object.assign(facingDirections, prevEvent.facingDirections);
    } else if (startingPositions) {
      Object.assign(facingDirections, computeInitialFacing(startingPositions));
    }
  } else if (prevIdx < 0 && nextIdx >= 0 && startingPositions) {
    // Before the first position event — interpolate from starting positions to first event
    const nextEvent = events[nextIdx];
    const t = nextEvent.timestamp > 0 ? time / nextEvent.timestamp : 0;
    const nextPositions = nextEvent.positions!;

    for (const robotName of Object.keys(startingPositions)) {
      if (nextPositions[robotName]) {
        positions[robotName] = lerpPosition(
          startingPositions[robotName],
          nextPositions[robotName],
          t
        );
      } else {
        positions[robotName] = startingPositions[robotName];
      }
    }

    if (nextEvent.facingDirections) {
      Object.assign(facingDirections, nextEvent.facingDirections);
    } else if (startingPositions) {
      Object.assign(facingDirections, computeInitialFacing(startingPositions));
    }
  } else if (startingPositions) {
    // No position events at all — use starting positions
    Object.assign(positions, startingPositions);
    Object.assign(facingDirections, computeInitialFacing(startingPositions));
  }

  // HP/shield: use the most recent event's values (no interpolation)
  const idx = eventIndex >= 0 ? eventIndex : 0;
  const { hp: hpValues, shield: shieldValues } = getLatestHPShield(events, idx, robot1Name, robot2Name, isTagTeam);

  // For tag team battles: ensure all robots have positions
  // - Reserves waiting: place at sideline
  // - Tagged-out robots: keep at last known position
  if (allRobotNames && allRobotNames.length > 0 && arenaRadius) {
    const sidelinePositions = startingPositions
      ? computeSidelinePositions(allRobotNames, startingPositions, arenaRadius)
      : {};
    const lastKnown = collectLastKnownPositions(events, idx);

    for (const name of allRobotNames) {
      if (positions[name]) continue; // Already has an interpolated position

      // Use last known position (robot was tagged out and stays at final spot)
      if (lastKnown[name]) {
        positions[name] = lastKnown[name];
      }
      // Use sideline position (reserve hasn't entered yet)
      else if (sidelinePositions[name]) {
        positions[name] = sidelinePositions[name];
      }
    }
  }

  return { positions, facingDirections, hpValues, shieldValues };
}

/**
 * Custom hook that manages playback state for the Battle Playback Viewer.
 *
 * Uses requestAnimationFrame for smooth time advancement.
 * Interpolates robot positions between event snapshots.
 * Tracks HP/shield from the most recent event (no interpolation).
 *
 * Validates: Requirements 17.3, 17.7
 */
export function usePlaybackEngine({
  events,
  duration,
  startingPositions,
  robot1Name,
  robot2Name,
  allRobotNames,
  arenaRadius,
  isTagTeam,
}: UsePlaybackEngineProps): UsePlaybackEngineReturn {
  const [state, setState] = useState<PlaybackState>({
    currentTime: 0,
    isPlaying: false,
    speed: 1,
    duration,
  });

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Update duration if it changes
  useEffect(() => {
    setState(prev => ({ ...prev, duration }));
  }, [duration]);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    if (!state.isPlaying) {
      lastFrameTimeRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number): void => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const deltaMs = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      // Advance currentTime by deltaTime * speed
      const deltaSec = (deltaMs / 1000) * stateRef.current.speed;

      setState(prev => {
        const newTime = prev.currentTime + deltaSec;

        // Stop at the end of the battle duration
        if (newTime >= prev.duration) {
          return { ...prev, currentTime: prev.duration, isPlaying: false };
        }

        return { ...prev, currentTime: newTime };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state.isPlaying]);

  const play = useCallback((): void => {
    setState(prev => {
      // If at the end, restart from beginning
      if (prev.currentTime >= prev.duration) {
        return { ...prev, currentTime: 0, isPlaying: true };
      }
      return { ...prev, isPlaying: true };
    });
  }, []);

  const pause = useCallback((): void => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const togglePlayPause = useCallback((): void => {
    setState(prev => {
      if (prev.isPlaying) {
        return { ...prev, isPlaying: false };
      }
      // If at the end, restart from beginning
      if (prev.currentTime >= prev.duration) {
        return { ...prev, currentTime: 0, isPlaying: true };
      }
      return { ...prev, isPlaying: true };
    });
  }, []);

  const setSpeed = useCallback((speed: PlaybackSpeed): void => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const seekTo = useCallback((time: number): void => {
    setState(prev => ({
      ...prev,
      currentTime: clamp(time, 0, prev.duration),
    }));
  }, []);

  const skipToNextEvent = useCallback((): void => {
    setState(prev => {
      // Find the next event after currentTime
      const nextIdx = events.findIndex(e => e.timestamp > prev.currentTime);
      if (nextIdx === -1) {
        // No more events — jump to end
        return { ...prev, currentTime: prev.duration };
      }
      return { ...prev, currentTime: events[nextIdx].timestamp };
    });
  }, [events]);

  // Compute derived values
  const currentEventIndex = findEventIndex(events, state.currentTime);
  const frame = interpolateFrame(events, state.currentTime, currentEventIndex, startingPositions, robot1Name, robot2Name, allRobotNames, arenaRadius, isTagTeam);

  return {
    state,
    frame,
    currentEventIndex,
    play,
    pause,
    togglePlayPause,
    setSpeed,
    seekTo,
    skipToNextEvent,
  };
}
