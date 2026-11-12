/**
 * Wire contract for `GET /api/matches/battles/:id/log`: the player battle
 * report of one battle (backend `services/match/battleLogService.ts`).
 *
 * Which blocks are present depends on the battle type: `robot1`/`robot2`
 * for two-participant battles, `tagTeam` and the team summaries for tag team,
 * `kothParticipants` and `kothData` for KotH and Grand Melee. `participants`
 * is the same for every type.
 */
import type { DamageFlow, RobotCombatStats } from '../utils/battleStatistics';
import type { StableType } from './stable';

export interface ArenaPoint {
  x: number;
  y: number;
}

/**
 * One event of the stored battle log. Which of the optional fields are set
 * depends on the event type (attacks carry attacker, damage, positions…);
 * other event-specific fields pass through untyped.
 */
export interface BattleLogEvent {
  timestamp: number;
  type: string;
  message: string;
  attacker?: string;
  defender?: string;
  weapon?: string;
  damage?: number;
  hit?: boolean;
  critical?: boolean;
  positions?: Record<string, ArenaPoint>;
  facingDirections?: Record<string, number>;
  distance?: number;
  rangeBand?: 'melee' | 'short' | 'mid' | 'long';
  backstab?: boolean;
  flanking?: boolean;
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
  /** Per-robot HP / shield maps for N-robot (KotH, team) playback. */
  robotHP?: Record<string, number>;
  robotShield?: Record<string, number>;
  /** KotH-specific event data (zone scores, kill bonuses, etc.). */
  kpiData?: { zoneScores?: Record<string | number, number>; [key: string]: unknown };
  [key: string]: unknown;
}

/** Per-team aggregated metric (team1 vs team2). */
export interface TeamMetricPair {
  team1: number;
  team2: number;
}

/** Individual robot performance within a team battle (2v2 / 3v3). */
export interface TeamBattleParticipantResult {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  damageTaken: number;
  finalHP: number;
  survivalSeconds: number;
}

/** A focus-fire occurrence, aggregated for the team battle metrics. */
export interface TeamBattleFocusFireEvent {
  tick: number;
  targetRobotId: number;
  contributorRobotIds: number[];
  contributorCount: number;
  bonusApplied: number;
}

/**
 * A structured team battle event (damage, focus_fire, elimination,
 * shield_regen, formation_defence, draw_timeout). No message: the report
 * builds one from the type-specific fields.
 */
export interface TeamBattleLogEvent {
  type: string;
  tick: number;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * The stored log of a team battle (`battleType` league_2v2 / league_3v3 and the
 * team tournaments), recognised by `teamBattle: true`.
 */
export interface TeamBattleLog {
  teamBattle: true;
  teamSize: 2 | 3;
  winningSide: 1 | 2 | null;
  isDraw: boolean;
  isByeMatch: boolean;
  durationSeconds: number;
  participants: TeamBattleParticipantResult[];
  events: TeamBattleLogEvent[];
  detailedCombatEvents?: BattleLogEvent[];
  focusFireEvents: TeamBattleFocusFireEvent[];
  focusFireMetrics: TeamMetricPair;
  allySupportMetrics: TeamMetricPair;
  formationDefenceMetrics: TeamMetricPair;
  arenaRadius?: number;
  startingPositions?: Record<string, ArenaPoint>;
  endingPositions?: Record<string, ArenaPoint>;
}

/** KotH placement as stored in the battle log. */
export interface KothLogPlacement {
  robotId: number;
  robotName: string;
  zoneScore: number;
  zoneTime: number;
  kills: number;
  destroyed: boolean;
}

/**
 * The stored battle log, with admin-only debug fields removed. Which metadata
 * fields are set depends on the battle type.
 */
export interface BattleLogPayload {
  events: BattleLogEvent[];
  /** Raw simulator events with full spatial data (positions, HP, shields). */
  detailedCombatEvents?: BattleLogEvent[];
  isTournament?: boolean;
  round?: number;
  maxRounds?: number;
  isFinals?: boolean;
  isKothMatch?: boolean;
  participantCount?: number;
  arenaRadius?: number;
  startingPositions?: Record<string, ArenaPoint>;
  endingPositions?: Record<string, ArenaPoint>;
  placements?: KothLogPlacement[];
}

/** Pre-computed battle statistics (`battle_summaries`, Spec #39). */
export interface BattleSummaryView {
  perRobot: RobotCombatStats[];
  /** Team totals; `robots` lists robot names. */
  perTeam: Array<{
    teamName: string;
    robots: string[];
    totalDamageDealt: number;
    totalDamageReceived: number;
    totalHits: number;
    totalMisses: number;
    totalCriticals: number;
  }> | null;
  damageFlows: DamageFlow[];
  participants: Array<{ robotId: number; team: number; survivalSeconds: number }>;
  kothPlacements: unknown[] | null;
  kothData: { participantCount: number; scoreThreshold: number } | null;
  startingPositions: Record<string, ArenaPoint> | null;
  endingPositions: Record<string, ArenaPoint> | null;
  arenaRadius: number | null;
  battleDuration: number;
  totalEvents: number;
  hasData: boolean;
}

/** One participant; the same shape for every battle type. */
export interface BattleLogParticipant {
  robotId: number;
  robotName: string;
  owner: string;
  ownerId: number;
  /** Spec #55: drives the Automaton_Badge. */
  ownerStableType: StableType;
  imageUrl: string | null;
  /** 0-based team index (`team - 1`). */
  teamIndex: number;
  team: number;
  role: string | null;
  placement: number | null;
  finalHP: number;
  maxHP: number;
  maxShield: number;
  destroyed: boolean;
  yielded: boolean;
  damageDealt: number;
  eloBefore: number;
  eloAfter: number;
  credits: number;
  streamingRevenue: number;
  prestigeAwarded: number;
  fameAwarded: number;
  stance: string;
  loadoutType: string;
  mainWeaponName: string | null;
  mainWeaponRangeBand: string | null;
  offhandWeaponName: string | null;
  offhandWeaponRangeBand: string | null;
}

/** `robot1` / `robot2` of a two-participant battle. */
export interface BattleLogRobot {
  id: number;
  name: string;
  owner: string;
  ownerId: number;
  ownerStableType: StableType;
  maxHP: number;
  maxShield: number;
  eloBefore: number;
  eloAfter: number;
  finalHP: number;
  damageDealt: number;
  reward: number;
  prestige: number;
  fame: number;
  streamingRevenue: number;
  yielded: boolean;
  destroyed: boolean;
  imageUrl: string | null;
  loadoutType: string;
  rangeBand: string | null;
  stance: string;
  mainWeaponName: string | null;
  offhandWeaponName: string | null;
  offhandRangeBand: string | null;
}

export interface TagTeamLogRobot {
  id: number;
  name: string;
  owner: string;
  ownerStableType: StableType;
  maxHP: number;
  maxShield: number;
  damageDealt: number;
  fameAwarded: number;
  imageUrl: string | null;
}

export interface TagTeamLogSide {
  teamId: number | null;
  stableName: string | null;
  stableType: StableType | null;
  activeRobot: TagTeamLogRobot | null;
  reserveRobot: TagTeamLogRobot | null;
  /** Seconds into the battle the reserve tagged in; null when it never did. */
  tagOutTime: number | null;
}

export interface TagTeamLogSummary {
  reward: number;
  prestige: number;
  totalDamage: number;
  totalFame: number;
  streamingRevenue: number;
}

export interface KothLogParticipant {
  robotId: number;
  robotName: string;
  owner: string;
  ownerId: number;
  ownerStableType: StableType;
  placement: number;
  zoneScore: number;
  zoneTime: number;
  kills: number;
  damageDealt: number;
  finalHP: number;
  destroyed: boolean;
  credits: number;
  fame: number;
  prestige: number;
  streamingRevenue: number;
  imageUrl: string | null;
}

/** KotH playback metadata as stored in the battle log. */
export interface KothPlaybackMetadata {
  isKoth: boolean;
  participantCount: number;
  scoreThreshold: number;
  zoneRadius: number;
  colorPalette: string[];
}

export interface BattleLogResponse {
  battleId: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
  battleType: string;
  leagueType: string;
  leagueInstanceId: string | null;
  tournamentId: number | null;
  duration: number;
  /** False once the stored log was pruned (`BATTLE_LOG_RETENTION_DAYS`). */
  playbackAvailable: boolean;
  /**
   * Null once pruned; the report then relies on `summary` and `participants`.
   * A team battle stores a `TeamBattleLog` (`teamBattle: true`).
   */
  battleLog: BattleLogPayload | null;
  summary?: BattleSummaryView;
  participants: BattleLogParticipant[];
  /** No battle was fought: a side forfeited for having no main weapon. */
  isForfeit: boolean;
  /** Robots that forfeited (also set for forfeiters placed last in a fought KotH / Grand Melee). */
  forfeitedRobotIds: number[];
  winner: 'robot1' | 'robot2' | null;
  robot1?: BattleLogRobot | null;
  robot2?: BattleLogRobot | null;
  tagTeam?: { team1: TagTeamLogSide; team2: TagTeamLogSide };
  team1Summary?: TagTeamLogSummary;
  team2Summary?: TagTeamLogSummary;
  kothParticipants?: KothLogParticipant[];
  kothData?: KothPlaybackMetadata;
}
