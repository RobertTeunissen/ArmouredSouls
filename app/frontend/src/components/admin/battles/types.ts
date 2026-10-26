/**
 * Shapes of the admin Battles API (`/api/admin/battles*`). Mirrors
 * `app/backend/src/services/admin/battles/battleTypes.ts`.
 */

export const BATTLE_MODES = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
  'koth',
  'grand_melee',
] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];

export type StableKind = 'human' | 'generated' | 'automaton';
export type BattleResult = 'win' | 'draw' | 'bye' | 'forfeit';
export type EndedBy = 'destroyed' | 'yield' | 'team_eliminated' | 'time_limit' | 'score_reached' | 'last_standing';

export type BattleModeFilter = BattleMode | 'all';
export type BattleStableFilter = 'all' | StableKind;
export type BattleOutcomeFilter = 'all' | 'draw' | 'bye' | 'forfeit' | 'time_limit';
export type BattleRangeFilter = '24h' | '7d' | '30d' | 'season';

export interface BattleFilters {
  mode: BattleModeFilter;
  stable: BattleStableFilter;
  outcome: BattleOutcomeFilter;
  range: BattleRangeFilter;
  q: string;
  page: number;
}

export interface StableRef {
  userId: number;
  name: string;
  stableType: StableKind;
}

export interface BattleSideSummary {
  team: number;
  label: string;
  robotCount: number;
  stable: StableRef | null;
  isWinner: boolean;
}

export interface BattleListRow {
  id: number;
  battleType: string;
  leagueType: string;
  leagueInstanceId: string | null;
  tournament: { id: number; name: string; round: number | null } | null;
  sides: BattleSideSummary[];
  field: { others: number; othersByStableType: Record<StableKind, number> } | null;
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
  survivalSeconds: number | null;
  zoneScore: number | null;
  kills: number | null;
}

export interface BattleSideDetail {
  team: number;
  label: string;
  stable: StableRef | null;
  isWinner: boolean;
}

export interface PayoutInputs {
  participationFloor: number | null;
  winComponent: number | null;
  teamSize: number | null;
  modifiers: unknown[];
  formula: string | null;
  formulaVersion: string | null;
  outcome: string | null;
}

export type PayoutStatus = 'match' | 'mismatch' | 'missing';

export interface StablePayoutCheck {
  stable: StableRef;
  battleIncome: { participants: number; ledger: number | null };
  streaming: { participants: number; ledger: number | null };
  status: PayoutStatus;
  inputs: PayoutInputs | null;
}

export interface PayoutCheck {
  status: PayoutStatus | 'unavailable';
  stables: StablePayoutCheck[];
  ledgerEntries: number;
}

export interface CombatLogStatus {
  available: boolean;
  removesOn: string;
  hasFormulas: boolean;
  movementSampled: boolean;
}

export interface BattleDetail {
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

export interface FormulaBreakdown {
  calculation?: string;
  components?: Record<string, number>;
  result?: number;
}

/** A stored combat event; fields vary per event type. */
export interface CombatEvent {
  timestamp: number;
  type: string;
  message?: string;
  attacker?: string;
  defender?: string;
  distance?: number;
  rangeBand?: string;
  formulaBreakdown?: FormulaBreakdown;
  robotHP?: Record<string, number>;
  robotShield?: Record<string, number>;
  [key: string]: unknown;
}

export interface BattleLogResponse {
  battleId: number;
  status: CombatLogStatus;
  events: CombatEvent[];
}
