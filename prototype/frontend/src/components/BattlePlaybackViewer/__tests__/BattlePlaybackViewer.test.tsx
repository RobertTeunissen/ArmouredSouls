import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { BattlePlaybackViewer } from '../BattlePlaybackViewer';
import { usePlaybackEngine } from '../usePlaybackEngine';
import type {
  PlaybackCombatResult,
  PlaybackRobotInfo,
  PlaybackCombatEvent,
} from '../types';

// --- Mock scrollIntoView (not available in jsdom) ---
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// --- Mock canvas getContext so ArenaCanvas doesn't blow up in jsdom ---
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 40 }),
    canvas: { width: 400, height: 400 },
  } as unknown as CanvasRenderingContext2D);
});

// --- Helpers ---

const robot1Info: PlaybackRobotInfo = {
  name: 'Alpha',
  teamIndex: 0,
  maxHP: 100,
  maxShield: 50,
};

const robot2Info: PlaybackRobotInfo = {
  name: 'Bravo',
  teamIndex: 1,
  maxHP: 100,
  maxShield: 50,
};

function makeEvent(overrides: Partial<PlaybackCombatEvent> = {}): PlaybackCombatEvent {
  return {
    timestamp: 0,
    type: 'attack',
    message: 'Alpha attacks Bravo',
    ...overrides,
  };
}

function makeSpatialResult(overrides: Partial<PlaybackCombatResult> = {}): PlaybackCombatResult {
  return {
    winnerId: 1,
    robot1FinalHP: 30,
    robot2FinalHP: 0,
    durationSeconds: 10,
    isDraw: false,
    arenaRadius: 16,
    startingPositions: { Alpha: { x: -14, y: 0 }, Bravo: { x: 14, y: 0 } },
    endingPositions: { Alpha: { x: 2, y: 1 }, Bravo: { x: 3, y: -1 } },
    events: [
      makeEvent({
        timestamp: 0,
        type: 'movement',
        message: 'Battle begins',
        positions: { Alpha: { x: -14, y: 0 }, Bravo: { x: 14, y: 0 } },
        facingDirections: { Alpha: 0, Bravo: 180 },
      }),
      makeEvent({
        timestamp: 2,
        type: 'movement',
        message: 'Alpha advances',
        positions: { Alpha: { x: -5, y: 0 }, Bravo: { x: 10, y: 0 } },
        facingDirections: { Alpha: 0, Bravo: 180 },
      }),
      makeEvent({
        timestamp: 5,
        type: 'attack',
        attacker: 'Alpha',
        defender: 'Bravo',
        message: 'Alpha strikes Bravo',
        positions: { Alpha: { x: 1, y: 0 }, Bravo: { x: 3, y: 0 } },
        robot1HP: 100,
        robot2HP: 70,
      }),
      makeEvent({
        timestamp: 10,
        type: 'destroyed',
        message: 'Bravo is destroyed',
        robot1HP: 30,
        robot2HP: 0,
      }),
    ],
    ...overrides,
  };
}

function makeNonSpatialResult(overrides: Partial<PlaybackCombatResult> = {}): PlaybackCombatResult {
  return {
    winnerId: 1,
    robot1FinalHP: 50,
    robot2FinalHP: 0,
    durationSeconds: 8,
    isDraw: false,
    // No arenaRadius — pre-2D battle
    events: [
      makeEvent({ timestamp: 1, message: 'Alpha attacks Bravo' }),
      makeEvent({ timestamp: 3, message: 'Bravo attacks Alpha' }),
      makeEvent({ timestamp: 8, type: 'destroyed', message: 'Bravo is destroyed' }),
    ],
    ...overrides,
  };
}

// ============================================================
// 1. Graceful Degradation (Requirement 17.12)
// ============================================================
describe('BattlePlaybackViewer — graceful degradation', () => {
  it('should render CombatLogPanel and PlaybackControls without ArenaCanvas when arenaRadius is undefined', () => {
    const result = makeNonSpatialResult();
    render(
      <BattlePlaybackViewer
        battleResult={result}
        robot1Info={robot1Info}
        robot2Info={robot2Info}
      />,
    );

    // Combat log panel should be present
    expect(screen.getByRole('log')).toBeInTheDocument();
    // Playback controls should be present
    expect(screen.getByLabelText('Play playback')).toBeInTheDocument();
    // Arena canvas should NOT be rendered
    expect(screen.queryByLabelText('Battle arena playback canvas')).not.toBeInTheDocument();
  });

  it('should render CombatLogPanel and PlaybackControls without ArenaCanvas when arenaRadius is 0', () => {
    const result = makeNonSpatialResult({ arenaRadius: 0 });
    render(
      <BattlePlaybackViewer
        battleResult={result}
        robot1Info={robot1Info}
        robot2Info={robot2Info}
      />,
    );

    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByLabelText('Play playback')).toBeInTheDocument();
    expect(screen.queryByLabelText('Battle arena playback canvas')).not.toBeInTheDocument();
  });

  it('should render ArenaCanvas when arenaRadius is present and positive', () => {
    const result = makeSpatialResult();
    render(
      <BattlePlaybackViewer
        battleResult={result}
        robot1Info={robot1Info}
        robot2Info={robot2Info}
      />,
    );

    expect(screen.getByLabelText('Battle arena playback canvas')).toBeInTheDocument();
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('should still show all combat log events in degraded mode', () => {
    const result = makeNonSpatialResult();
    render(
      <BattlePlaybackViewer
        battleResult={result}
        robot1Info={robot1Info}
        robot2Info={robot2Info}
      />,
    );

    expect(screen.getByText('Alpha attacks Bravo')).toBeInTheDocument();
    expect(screen.getByText('Bravo attacks Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo is destroyed')).toBeInTheDocument();
  });
});

// ============================================================
// 2. Playback Engine Interpolation (Requirement 17.3)
// ============================================================
describe('usePlaybackEngine — interpolation', () => {
  const eventsWithPositions: PlaybackCombatEvent[] = [
    makeEvent({
      timestamp: 0,
      type: 'movement',
      message: 'Start',
      positions: { Alpha: { x: 0, y: 0 }, Bravo: { x: 10, y: 0 } },
      facingDirections: { Alpha: 0, Bravo: 180 },
    }),
    makeEvent({
      timestamp: 4,
      type: 'movement',
      message: 'Mid',
      positions: { Alpha: { x: 4, y: 4 }, Bravo: { x: 6, y: -4 } },
      facingDirections: { Alpha: 45, Bravo: 135 },
    }),
    makeEvent({
      timestamp: 8,
      type: 'attack',
      attacker: 'Alpha',
      defender: 'Bravo',
      message: 'Alpha attacks Bravo',
      positions: { Alpha: { x: 5, y: 5 }, Bravo: { x: 5, y: -5 } },
      robot1HP: 90,
      robot2HP: 60,
    }),
  ];

  it('should produce positions at the start of the timeline (t=0)', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: eventsWithPositions, duration: 10 }),
    );

    // At t=0 the frame should use the first event's positions
    const frame = result.current.frame;
    expect(frame.positions.Alpha).toEqual({ x: 0, y: 0 });
    expect(frame.positions.Bravo).toEqual({ x: 10, y: 0 });
  });

  it('should interpolate positions at the midpoint between two position events', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: eventsWithPositions, duration: 10 }),
    );

    // Seek to t=2 — midpoint between event at t=0 and t=4
    act(() => { result.current.seekTo(2); });

    const frame = result.current.frame;
    // Alpha: lerp({0,0}, {4,4}, 0.5) = {2, 2}
    expect(frame.positions.Alpha.x).toBeCloseTo(2, 1);
    expect(frame.positions.Alpha.y).toBeCloseTo(2, 1);
    // Bravo: lerp({10,0}, {6,-4}, 0.5) = {8, -2}
    expect(frame.positions.Bravo.x).toBeCloseTo(8, 1);
    expect(frame.positions.Bravo.y).toBeCloseTo(-2, 1);
  });

  it('should interpolate positions at 75% between two position events', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: eventsWithPositions, duration: 10 }),
    );

    // Seek to t=3 — 75% between event at t=0 and t=4
    act(() => { result.current.seekTo(3); });

    const frame = result.current.frame;
    // Alpha: lerp({0,0}, {4,4}, 0.75) = {3, 3}
    expect(frame.positions.Alpha.x).toBeCloseTo(3, 1);
    expect(frame.positions.Alpha.y).toBeCloseTo(3, 1);
  });

  it('should use last known positions when seeked past the last position event', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: eventsWithPositions, duration: 10 }),
    );

    // Seek past the last event with positions (t=8)
    act(() => { result.current.seekTo(9); });

    const frame = result.current.frame;
    expect(frame.positions.Alpha).toEqual({ x: 5, y: 5 });
    expect(frame.positions.Bravo).toEqual({ x: 5, y: -5 });
  });

  it('should produce valid finite positions for any seek time within duration', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: eventsWithPositions, duration: 10 }),
    );

    const testTimes = [0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const t of testTimes) {
      act(() => { result.current.seekTo(t); });
      const frame = result.current.frame;
      for (const name of Object.keys(frame.positions)) {
        expect(Number.isFinite(frame.positions[name].x)).toBe(true);
        expect(Number.isFinite(frame.positions[name].y)).toBe(true);
      }
    }
  });

  it('should return empty positions when no events have position data', () => {
    const noPositionEvents: PlaybackCombatEvent[] = [
      makeEvent({ timestamp: 1, message: 'Alpha attacks Bravo' }),
      makeEvent({ timestamp: 3, message: 'Bravo attacks Alpha' }),
    ];

    const { result } = renderHook(() =>
      usePlaybackEngine({ events: noPositionEvents, duration: 5 }),
    );

    act(() => { result.current.seekTo(2); });
    expect(Object.keys(result.current.frame.positions)).toHaveLength(0);
  });
});

// ============================================================
// 3. Playback Controls State Transitions (Requirement 17.7)
// ============================================================
describe('usePlaybackEngine — playback controls', () => {
  const simpleEvents: PlaybackCombatEvent[] = [
    makeEvent({ timestamp: 1, message: 'Event 1' }),
    makeEvent({ timestamp: 3, message: 'Event 2' }),
    makeEvent({ timestamp: 7, message: 'Event 3' }),
  ];

  it('should start in paused state at time 0', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.speed).toBe(1);
  });

  it('should transition to playing state when play is called', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.play(); });
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('should transition to paused state when pause is called', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.play(); });
    expect(result.current.state.isPlaying).toBe(true);

    act(() => { result.current.pause(); });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('should toggle between play and pause with togglePlayPause', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    // Initially paused
    expect(result.current.state.isPlaying).toBe(false);

    // Toggle → playing
    act(() => { result.current.togglePlayPause(); });
    expect(result.current.state.isPlaying).toBe(true);

    // Toggle → paused
    act(() => { result.current.togglePlayPause(); });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('should change speed when setSpeed is called', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.setSpeed(0.5); });
    expect(result.current.state.speed).toBe(0.5);

    act(() => { result.current.setSpeed(2); });
    expect(result.current.state.speed).toBe(2);

    act(() => { result.current.setSpeed(4); });
    expect(result.current.state.speed).toBe(4);

    act(() => { result.current.setSpeed(1); });
    expect(result.current.state.speed).toBe(1);
  });

  it('should seek to the specified time', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.seekTo(5); });
    expect(result.current.state.currentTime).toBe(5);
  });

  it('should clamp seek to 0 when given a negative time', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.seekTo(-5); });
    expect(result.current.state.currentTime).toBe(0);
  });

  it('should clamp seek to duration when given a time beyond duration', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.seekTo(999); });
    expect(result.current.state.currentTime).toBe(10);
  });

  it('should skip to the next event timestamp', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    // At t=0, next event is at t=1
    act(() => { result.current.skipToNextEvent(); });
    expect(result.current.state.currentTime).toBe(1);

    // At t=1, next event is at t=3
    act(() => { result.current.skipToNextEvent(); });
    expect(result.current.state.currentTime).toBe(3);

    // At t=3, next event is at t=7
    act(() => { result.current.skipToNextEvent(); });
    expect(result.current.state.currentTime).toBe(7);
  });

  it('should skip to duration when no more events remain', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    // Seek past all events
    act(() => { result.current.seekTo(8); });
    act(() => { result.current.skipToNextEvent(); });
    expect(result.current.state.currentTime).toBe(10);
  });

  it('should restart from beginning when play is called at the end of duration', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    // Seek to end
    act(() => { result.current.seekTo(10); });
    expect(result.current.state.currentTime).toBe(10);

    // Play should restart from 0
    act(() => { result.current.play(); });
    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('should restart from beginning when togglePlayPause is called at the end', () => {
    const { result } = renderHook(() =>
      usePlaybackEngine({ events: simpleEvents, duration: 10 }),
    );

    act(() => { result.current.seekTo(10); });
    act(() => { result.current.togglePlayPause(); });
    expect(result.current.state.currentTime).toBe(0);
    expect(result.current.state.isPlaying).toBe(true);
  });
});
