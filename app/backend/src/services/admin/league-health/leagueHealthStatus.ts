/**
 * Pure League Health status rules and the "Needs attention" list.
 *
 * Status rules, first match wins:
 *  1. empty          — no standings rows.
 *  2. cohort_blocked — structure: the tier above is empty and this tier has fewer
 *                      promotion places than the cohort an empty tier needs, so
 *                      it can never open it. (A tier with enough places whose
 *                      candidates keep falling short shows up as no_promotions.)
 *  3. frozen         — structure: every instance is below the minimum size, so no
 *                      instance has promotion or demotion zones.
 *  4. no_promotions  — flow: the tier has promotion places but nobody was promoted
 *                      in the mode's last `LEAGUE_HISTORY_WINDOW` rebalances.
 *  5. low_promotion  — flow: on average fewer than `LEAGUE_LOW_MOVEMENT_SHARE` of
 *                      the promotion places were filled.
 *  6. ok
 * Flow rules need the full history window; before that a tier is not judged.
 * Two notices are not statuses: unsubscribed rows (`unsubscribedNotice`) and few
 * demotions (`lowDemotionNotice`).
 *
 * Why flow comes from history: a league rebalances right after its event's
 * battles, so a snapshot taken after a rebalance shows almost nobody qualifying.
 *
 * @module services/admin/league-health/leagueHealthStatus
 */

import type { LeagueRuleSet } from '../../league/league-rules';
import { LEAGUE_HISTORY_WINDOW, LEAGUE_LOW_MOVEMENT_SHARE } from '../adminThresholds';
import type {
  AttentionCode,
  AttentionEntry,
  AttentionSeverity,
  LeagueHealthAttentionItem,
  LeagueHealthModeSummary,
  LeagueHealthTier,
  TierStatusCode,
  TierStatusLevel,
} from './leagueHealthTypes';

type TierFacts = Omit<LeagueHealthTier, 'status'>;

/** Classify one tier. */
export function classifyTierStatus(
  tier: TierFacts,
  rules: LeagueRuleSet,
): { level: TierStatusLevel; code: TierStatusCode } {
  if (tier.total === 0) return { level: 'empty', code: 'empty' };

  const { promotion } = tier;
  if (tier.nextTier !== null && tier.destinationPopulation === 0 && promotion.slots < rules.minCohortForNewTier) {
    return { level: 'blocked', code: 'cohort_blocked' };
  }

  if (tier.instances.length > 0 && tier.instances.every((instance) => !instance.hasEnoughEntities)) {
    return { level: 'warning', code: 'frozen' };
  }

  if (promotion.flow !== null && promotion.slots > 0) {
    if (promotion.flow.total === 0) return { level: 'warning', code: 'no_promotions' };
    if (promotion.flow.total / LEAGUE_HISTORY_WINDOW < promotion.slots * LEAGUE_LOW_MOVEMENT_SHARE) {
      return { level: 'warning', code: 'low_promotion' };
    }
  }

  return { level: 'ok', code: 'ok' };
}

const SEVERITY_BY_CODE: Record<AttentionCode, AttentionSeverity> = {
  cohort_blocked: 'error',
  frozen: 'warning',
  no_promotions: 'warning',
  low_promotion: 'warning',
  low_demotion: 'notice',
  unsubscribed: 'notice',
};

const CODE_ORDER: AttentionCode[] = ['cohort_blocked', 'frozen', 'no_promotions', 'low_promotion', 'low_demotion', 'unsubscribed'];

/** Codes collected into one item across all tiers. */
const SINGLE_ITEM_CODES: ReadonlySet<AttentionCode> = new Set(['low_demotion', 'unsubscribed']);

function entryFor(mode: LeagueHealthModeSummary, tier: LeagueHealthTier): AttentionEntry {
  return {
    mode: mode.mode,
    tier: tier.tier,
    total: tier.total,
    unsubscribed: tier.unsubscribed,
    promotionSlots: tier.promotion.slots,
    promotionAverage: tier.promotion.flow?.average ?? null,
    demotionSlots: tier.demotion.slots,
    demotionAverage: tier.demotion.flow?.average ?? null,
    minLp: tier.promotion.minLp,
  };
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/**
 * Build the "Needs attention" list. Identical tier problems are grouped across
 * modes; few demotions and unsubscribed rows each form one item. Order: errors,
 * then warnings, then notices; within a code, higher tiers first.
 */
export function buildAttention(modes: readonly LeagueHealthModeSummary[]): LeagueHealthAttentionItem[] {
  const items = new Map<string, LeagueHealthAttentionItem>();
  const tierOrder = modes[0]?.tiers.map((tier) => tier.tier) ?? [];

  const add = (code: AttentionCode, mode: LeagueHealthModeSummary, tier: LeagueHealthTier): void => {
    const single = SINGLE_ITEM_CODES.has(code);
    const key = single ? code : `${code}:${tier.tier}`;
    let item = items.get(key);
    if (!item) {
      item = {
        code,
        severity: SEVERITY_BY_CODE[code],
        tier: single ? null : tier.tier,
        nextTier: single ? null : tier.nextTier,
        minCohortForNewTier: mode.rules.minCohortForNewTier,
        minEntitiesPerInstance: mode.rules.minEntitiesPerInstance,
        historyWindow: LEAGUE_HISTORY_WINDOW,
        entries: [],
      };
      items.set(key, item);
    }
    item.entries.push(entryFor(mode, tier));
  };

  for (const mode of modes) {
    for (const tier of mode.tiers) {
      if (tier.status.code !== 'ok' && tier.status.code !== 'empty') add(tier.status.code, mode, tier);
      if (tier.lowDemotionNotice) add('low_demotion', mode, tier);
      if (tier.unsubscribedNotice) add('unsubscribed', mode, tier);
    }
  }

  // Worst first, so the sentence leads with it.
  items.get('unsubscribed')?.entries.sort((a, b) => share(b.unsubscribed, b.total) - share(a.unsubscribed, a.total));
  // Lowest share first; on a tie the tier with more places (the clearer case) first.
  items.get('low_demotion')?.entries.sort((a, b) =>
    (share(a.demotionAverage ?? 0, a.demotionSlots) - share(b.demotionAverage ?? 0, b.demotionSlots))
    || (b.demotionSlots - a.demotionSlots));

  const tierRank = (tier: string | null): number => (tier === null ? -1 : tierOrder.indexOf(tier));
  return [...items.values()].sort((a, b) =>
    (CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code)) || (tierRank(b.tier) - tierRank(a.tier)));
}
