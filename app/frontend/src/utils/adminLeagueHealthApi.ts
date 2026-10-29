/**
 * Typed API of the admin League Health page (`/admin/league-health`).
 *
 * Mirrors `app/backend/src/services/admin/league-health/leagueHealthTypes.ts`.
 * Structure (places, zones, who qualifies right now) comes from the
 * rebalancer's own planner on the current standings. Flow (how many actually
 * moved) comes from the mode's last rebalances in `league_history`: a league
 * rebalances right after its battles, so a snapshot alone always looks empty.
 */
import { api } from './api';

export type LeagueHealthMode = 'league_1v1' | 'league_2v2' | 'league_3v3' | 'tag_team' | 'koth' | 'grand_melee';
export type LeagueHealthEntityType = 'robot' | 'team';
export type TierStatusLevel = 'ok' | 'warning' | 'blocked' | 'empty';
export type TierStatusCode = 'ok' | 'empty' | 'cohort_blocked' | 'frozen' | 'no_promotions' | 'low_promotion';

export interface TierFlow {
  /** Moved in the most recent rebalance. */
  last: number;
  /** Average per rebalance over the window, one decimal. */
  average: number;
  total: number;
}

export interface LeagueHealthInstance {
  id: string;
  total: number;
  active: number;
  human: number;
  topLp: number | null;
  hasEnoughEntities: boolean;
  promotionSlots: number;
  promotionCandidates: number;
  promotionLineLp: number | null;
  promotionLineRank: number | null;
  demotionSlots: number;
  demotionCandidates: number;
  demotionLineLp: number | null;
  demotionLineRank: number | null;
}

export interface LeagueHealthTier {
  tier: string;
  nextTier: string | null;
  total: number;
  active: number;
  unsubscribed: number;
  unsubscribedNotice: boolean;
  stableMix: { human: number; automaton: number; generated: number };
  averageElo: number | null;
  eligible: number;
  instanceSize: { min: number; max: number } | null;
  instances: LeagueHealthInstance[];
  destinationPopulation: number;
  promotion: {
    slots: number;
    /** Qualify right now (snapshot), before the empty-tier cohort rule. */
    qualifyingNow: number;
    minLp: number | null;
    bestLp: number | null;
    blockReason: 'destination_cohort_too_small' | null;
    /** Null until the mode has the full history window. */
    flow: TierFlow | null;
  };
  demotion: { slots: number; qualifyingNow: number; flow: TierFlow | null };
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
  mode: LeagueHealthMode;
  entityType: LeagueHealthEntityType;
  rules: LeagueHealthRules;
  total: number;
  active: number;
  /** Rebalances in the flow window, newest first. */
  rebalanceCycles: number[];
  tiers: LeagueHealthTier[];
}

export type AttentionSeverity = 'error' | 'warning' | 'notice';
export type AttentionCode = 'cohort_blocked' | 'frozen' | 'no_promotions' | 'low_promotion' | 'low_demotion' | 'unsubscribed';

export interface AttentionEntry {
  mode: LeagueHealthMode;
  tier: string;
  total: number;
  unsubscribed: number;
  promotionSlots: number;
  promotionAverage: number | null;
  demotionSlots: number;
  demotionAverage: number | null;
  minLp: number | null;
}

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

export function getLeagueHealth(signal?: AbortSignal): Promise<LeagueHealthOverview> {
  return api.get<LeagueHealthOverview>('/api/admin/league-health', { signal });
}
