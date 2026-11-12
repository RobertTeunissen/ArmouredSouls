/**
 * Wire contracts for the admin League Health page: `GET /api/admin/league-health`
 * (backend `services/admin/league-health`) and `/league-health/season`.
 */

/** The tiered standings modes (`TIERED_LEAGUE_MODES` in backend `services/league/league-rules.ts` satisfies it). */
export type TieredLeagueMode = 'league_1v1' | 'league_2v2' | 'league_3v3' | 'tag_team' | 'koth' | 'grand_melee';

export type LeagueHealthEntityType = 'robot' | 'team';

/** One standings row with what the page needs to know about its owner. */
export interface LeagueHealthRow {
  entityId: number;
  entityType: LeagueHealthEntityType;
  mode: TieredLeagueMode;
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  cyclesInTier: number;
  /** `users.stable_type` of the owning stable; null when the robot/team row is gone. */
  stableType: 'human' | 'generated' | 'automaton' | null;
  /** Robot: an active subscription to this event. Team: every member subscribed. */
  active: boolean;
  /** Robot ELO, or the team's combined ELO (sum of members) as the league pages show it. */
  elo: number | null;
}

/** Moves out of one tier in one rebalance (`league_history`, grouped). */
export interface LeagueMoveCount {
  mode: TieredLeagueMode;
  cycleNumber: number;
  sourceTier: string;
  changeType: 'promotion' | 'demotion';
  moved: number;
}

/** A mode's recent rebalances: the cycles observed, newest first, and their moves. */
export interface ModeRebalanceHistory {
  cycles: number[];
  moves: LeagueMoveCount[];
}

export type TierStatusLevel = 'ok' | 'warning' | 'blocked' | 'empty';

export type TierStatusCode =
  | 'ok'
  | 'empty'
  | 'cohort_blocked'
  | 'frozen'
  | 'no_promotions'
  | 'low_promotion';

export interface LeagueHealthInstance {
  id: string;
  total: number;
  active: number;
  human: number;
  topLp: number | null;
  hasEnoughEntities: boolean;
  promotionSlots: number;
  /** Qualify right now (snapshot), before the empty-tier cohort rule. */
  promotionCandidates: number;
  /** LP of the last promotion place (rank = promotionSlots); null without a zone. */
  promotionLineLp: number | null;
  promotionLineRank: number | null;
  demotionSlots: number;
  /** Qualify right now (snapshot). */
  demotionCandidates: number;
  /** LP of the first demotion place (rank = total - demotionSlots + 1); null without a zone. */
  demotionLineLp: number | null;
  demotionLineRank: number | null;
}

/** Moves out of a tier over the mode's last rebalances. */
export interface TierFlow {
  /** Moved in the most recent rebalance. */
  last: number;
  /** Average per rebalance over the window, one decimal. */
  average: number;
  total: number;
}

export interface LeagueHealthTier {
  tier: string;
  nextTier: string | null;
  total: number;
  active: number;
  unsubscribed: number;
  /** True when unsubscribed rows are at least the notice share of the tier. */
  unsubscribedNotice: boolean;
  stableMix: { human: number; automaton: number; generated: number };
  /** Robot modes: average robot ELO. Team modes: average combined team ELO. */
  averageElo: number | null;
  /** Rows with enough cycles in tier to be promoted or demoted. */
  eligible: number;
  instanceSize: { min: number; max: number } | null;
  instances: LeagueHealthInstance[];
  /** Entities in the tier above (0 when it is empty). */
  destinationPopulation: number;
  promotion: {
    slots: number;
    /** Qualify right now, before the empty-tier cohort rule (snapshot). */
    qualifyingNow: number;
    /** LP gate for this tier; null in placement modes (no LP gate) and the top tier. */
    minLp: number | null;
    bestLp: number | null;
    blockReason: 'destination_cohort_too_small' | null;
    /** Null until the mode has the full history window. */
    flow: TierFlow | null;
  };
  demotion: {
    slots: number;
    qualifyingNow: number;
    flow: TierFlow | null;
  };
  /** Demotion places exist but fewer than the low-movement share move on average. */
  lowDemotionNotice: boolean;
  status: { level: TierStatusLevel; code: TierStatusCode };
}

export interface LeagueHealthRules {
  promotionPercentage: number;
  demotionPercentage: number;
  minCyclesInTier: number;
  minEntitiesPerInstance: number;
  minCohortForNewTier: number;
  lpGated: boolean;
}

export interface LeagueHealthModeSummary {
  mode: TieredLeagueMode;
  entityType: LeagueHealthEntityType;
  rules: LeagueHealthRules;
  total: number;
  active: number;
  /** Rebalances in the flow window (newest first); fewer than the window = not judged. */
  rebalanceCycles: number[];
  tiers: LeagueHealthTier[];
}

export type AttentionSeverity = 'error' | 'warning' | 'notice';

export type AttentionCode =
  | 'cohort_blocked'
  | 'frozen'
  | 'no_promotions'
  | 'low_promotion'
  | 'low_demotion'
  | 'unsubscribed';

/** One tier that an attention item is about, with the numbers its sentence needs. */
export interface AttentionEntry {
  mode: TieredLeagueMode;
  tier: string;
  total: number;
  unsubscribed: number;
  promotionSlots: number;
  promotionAverage: number | null;
  demotionSlots: number;
  demotionAverage: number | null;
  minLp: number | null;
}

/**
 * A problem shared by one or more tiers. `cohort_blocked`, `frozen`,
 * `no_promotions` and `low_promotion` group the same tier across modes;
 * `low_demotion` and `unsubscribed` each collect every affected tier in one item.
 */
export interface LeagueHealthAttentionItem {
  code: AttentionCode;
  severity: AttentionSeverity;
  tier: string | null;
  nextTier: string | null;
  minCohortForNewTier: number;
  minEntitiesPerInstance: number;
  historyWindow: number;
  entries: AttentionEntry[];
}

export interface LeagueHealthOverview {
  generatedAt: string;
  season: { number: number; phase: string; cycle: number; lengthCycles: number } | null;
  thresholds: { historyWindow: number; lowMovementShare: number; unsubscribedNoticeShare: number };
  modes: LeagueHealthModeSummary[];
  attention: LeagueHealthAttentionItem[];
}

export type LeagueSeasonStableFilter = 'all' | 'human' | 'automaton' | 'generated';

export interface SeasonCycleMoves {
  cycle: number;
  promoted: number;
  demoted: number;
}

export interface SeasonBoundary {
  lower: string;
  upper: string;
  /** Promotions lower → upper this season. */
  promoted: number;
  /** Demotions upper → lower this season. */
  demoted: number;
  /** Promotions old enough to judge (at most `judgedThroughCycle`). */
  judged: number;
  /** Of those, demoted back across the boundary within the window. */
  back: number;
  /** back / judged, or null with nothing to judge. */
  share: number | null;
  /** Share above the note threshold, with at least the minimum sample. */
  noted: boolean;
}

export interface LeagueSeasonOverview {
  mode: TieredLeagueMode;
  stable: LeagueSeasonStableFilter;
  window: number;
  noteShare: number;
  minSample: number;
  /** First and last cycle with moves in this mode (any stable); null when none. */
  firstCycle: number | null;
  lastCycle: number | null;
  /** Promotions judged for bounce-back are at or before this cycle; null when none can be. */
  judgedThroughCycle: number | null;
  /** Every cycle from firstCycle to lastCycle, zeros included. */
  cycles: SeasonCycleMoves[];
  /** Cycles between first and last in which the mode recorded no moves at all. */
  quietCycles: number[];
  totals: { promoted: number; demoted: number };
  boundaries: SeasonBoundary[];
}
