/**
 * Response shapes of the admin Battles endpoints (`/api/admin/battles*`).
 * The frontend mirrors these in `app/frontend/src/components/admin/battles/types.ts`.
 */
import type { BattleResult, EndedBy } from './battleOutcome';

export type StableKind = 'human' | 'generated' | 'automaton';

export interface StableRef {
  userId: number;
  /** Stable name, or the username when the stable has none. */
  name: string;
  stableType: StableKind;
}

/** One side of a two-sided battle, or the winner of a placement battle. */
export interface BattleSideSummary {
  team: number;
  /** Team name for team modes, robot name otherwise; "Unknown" when the rows are gone. */
  label: string;
  robotCount: number;
  stable: StableRef | null;
  isWinner: boolean;
}

export interface PlacementFieldSummary {
  /** Robots in the field besides the winner. */
  others: number;
  othersByStableType: Record<StableKind, number>;
}

export interface BattleListRow {
  id: number;
  battleType: string;
  leagueType: string;
  leagueInstanceId: string | null;
  tournament: { id: number; name: string; round: number | null } | null;
  /** Two-sided modes: side 1 then side 2 (one entry for a bye). Placement modes: the winner only. */
  sides: BattleSideSummary[];
  field: PlacementFieldSummary | null;
  participantCount: number;
  result: BattleResult;
  endedBy: EndedBy | null;
  eloSwing: number | null;
  durationSeconds: number;
  createdAt: string;
}

export interface BattleListResponse {
  battles: BattleListRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface BattleParticipantDetail {
  robotId: number;
  robotName: string;
  stable: StableRef | null;
  team: number;
  role: string | null;
  placement: number | null;
  finalHP: number;
  maxHP: number | null;
  damageDealt: number;
  damageReceived: number | null;
  criticalHits: number | null;
  eloBefore: number;
  eloAfter: number;
  credits: number;
  streamingRevenue: number;
  prestigeAwarded: number;
  fameAwarded: number;
  destroyed: boolean;
  yielded: boolean;
  forfeited: boolean;
  /** Seconds the robot was active in the fight (from entering to leaving), from `battle_summaries`. */
  survivalSeconds: number | null;
  /** Battle time at which the robot was destroyed, yielded or tagged out (`perRobot.exitTime`); null when it stayed to the end. */
  exitSeconds: number | null;
  /** KotH zone score, from `battle_summaries`. */
  zoneScore: number | null;
  kills: number | null;
}

export interface BattleSideDetail {
  team: number;
  label: string;
  stable: StableRef | null;
  isWinner: boolean;
}

/**
 * One robot's placement award in a KotH / Grand Melee `battle.placement_income`
 * entry (`placementRewardComponents`):
 * credits = tierBaseReward × modeBaseMultiplier × placementMultiplier (× bonus), rounded.
 */
export interface PlacementPayoutComponent {
  robotId: number;
  robotName: string | null;
  mode: string;
  tier: string;
  placement: number;
  credits: number;
  tierBaseReward: number;
  modeBaseMultiplier: number;
  placementMultiplier: number;
  /** KotH zone dominance (×1.25) when it applied. */
  bonus: { label: string; multiplier: number } | null;
  /** Grand Melee: the participation-floor multiplier was used for this placement. */
  participationFloorApplied: boolean;
}

export interface PayoutInputs {
  participationFloor: number | null;
  winComponent: number | null;
  teamSize: number | null;
  modifiers: unknown[];
  formula: string | null;
  formulaVersion: string | null;
  outcome: string | null;
  /** Per-robot placement awards (KotH / Grand Melee); null for side-based income. */
  placementComponents: PlacementPayoutComponent[] | null;
}

export interface StablePayoutCheck {
  stable: StableRef;
  battleIncome: { participants: number; ledger: number | null };
  streaming: { participants: number; ledger: number | null };
  status: 'match' | 'mismatch' | 'missing';
  /** `battle_income` formula inputs for this stable, from the ledger metadata. */
  inputs: PayoutInputs | null;
}

export interface PayoutCheck {
  status: 'match' | 'mismatch' | 'missing' | 'unavailable';
  stables: StablePayoutCheck[];
  ledgerEntries: number;
}

export interface CombatLogStatus {
  /** True while `battle_log` is still stored. */
  available: boolean;
  /** When the nightly retention job removes (or removed) the log. */
  removesOn: string;
  /** False for KotH / Grand Melee logs stored before formulas were kept. */
  hasFormulas: boolean;
  /** True when high-frequency events (movement, range, shield regen) were thinned before storage. */
  movementSampled: boolean;
}

export interface BattleDetailResponse {
  id: number;
  battleType: string;
  leagueType: string;
  leagueInstanceId: string | null;
  tournament: { id: number; name: string; round: number | null } | null;
  scheduledMatchId: number | null;
  tournamentMatchId: number | null;
  cycleNumber: number | null;
  createdAt: string;
  durationSeconds: number;
  timeLimitSeconds: number;
  result: BattleResult;
  endedBy: EndedBy | null;
  winningSide: 1 | 2 | null;
  winnerRobotId: number | null;
  sides: BattleSideDetail[];
  participants: BattleParticipantDetail[];
  payout: PayoutCheck;
  combatLog: CombatLogStatus;
}

/** A stored combat event as the admin log returns it (shape varies per event type). */
export type AdminCombatEvent = Record<string, unknown> & { timestamp: number; type: string; message?: string };

export interface BattleLogResponse {
  battleId: number;
  status: CombatLogStatus;
  events: AdminCombatEvent[];
}
