/** Position in 2D arena space */
export interface Position {
  x: number;
  y: number;
}

/** Range band classification */
export type RangeBand = 'melee' | 'short' | 'mid' | 'long';

/** Playback speed options */
export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

/** Playback state */
export interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  duration: number;
}

/** Interpolated frame for smooth animation */
export interface InterpolatedFrame {
  positions: Record<string, Position>;
  facingDirections: Record<string, number>;
  hpValues: Record<string, number>;
  shieldValues: Record<string, number>;
}

/** Combat event from the backend (subset of fields needed for playback) */
export interface PlaybackCombatEvent {
  timestamp: number;
  type: string;
  attacker?: string;
  defender?: string;
  weapon?: string;
  damage?: number;
  hit?: boolean;
  critical?: boolean;
  message: string;
  positions?: Record<string, Position>;
  facingDirections?: Record<string, number>;
  distance?: number;
  rangeBand?: RangeBand;
  backstab?: boolean;
  flanking?: boolean;
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
}

/** Combat result from the backend (subset of fields needed for playback) */
export interface PlaybackCombatResult {
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  durationSeconds: number;
  isDraw: boolean;
  events: PlaybackCombatEvent[];
  arenaRadius?: number;
  startingPositions?: Record<string, Position>;
  endingPositions?: Record<string, Position>;
}

/** Robot info for display */
export interface PlaybackRobotInfo {
  name: string;
  teamIndex: number;
  maxHP: number;
  maxShield: number;
}

/** Attack indicator for rendering */
export interface AttackIndicator {
  timestamp: number;
  from: Position;
  to: Position;
  type: 'hit' | 'miss' | 'critical' | 'malfunction';
  isRanged: boolean;
  duration: number; // seconds to display
}
