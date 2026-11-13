/**
 * Pure derivations for the public robot profile (#504).
 */
import { LEAGUE_TIER_ORDER, tierRank, isPlacementMode } from '@shared/utils/automatonStandingsTier';
import { ordinal } from './stableViewFormat';
import type { RecentResult } from '@shared/types';

export interface HistoryEntry {
  cycleNumber: number;
  destinationTier: string;
  changeType: 'promotion' | 'demotion';
  leaguePoints: number;
  mode?: string | null;
}

export interface TierBand {
  tier: string;
  fromCycle: number;
  /** Exclusive end cycle. */
  toCycle: number;
  /** LP at the change that started this band; null for the first band. */
  leaguePoints: number | null;
}

/** The tier a robot or team was in before a recorded change. */
function tierBefore(entry: HistoryEntry): string {
  const i = tierRank(entry.destinationTier);
  const before = entry.changeType === 'promotion' ? i - 1 : i + 1;
  return LEAGUE_TIER_ORDER[Math.max(0, Math.min(LEAGUE_TIER_ORDER.length - 1, before))];
}

/**
 * Tier bands over the season from promotions and demotions (league history
 * is per season: it is purged at rollover). Without changes, one band of the
 * current tier. The current standing's tier wins for the last band.
 */
export function tierBands(history: readonly HistoryEntry[], currentTier: string | null, currentCycle: number): TierBand[] {
  const sorted = [...history].sort((a, b) => a.cycleNumber - b.cycleNumber);
  const end = Math.max(currentCycle, (sorted.at(-1)?.cycleNumber ?? 0) + 1, 2);
  if (sorted.length === 0) {
    return currentTier ? [{ tier: currentTier, fromCycle: 1, toCycle: end, leaguePoints: null }] : [];
  }
  const bands: TierBand[] = [{ tier: tierBefore(sorted[0]), fromCycle: 1, toCycle: Math.max(1, sorted[0].cycleNumber), leaguePoints: null }];
  sorted.forEach((entry, i) => {
    const toCycle = i + 1 < sorted.length ? sorted[i + 1].cycleNumber : end;
    bands.push({ tier: entry.destinationTier, fromCycle: entry.cycleNumber, toCycle, leaguePoints: entry.leaguePoints });
  });
  if (currentTier) bands[bands.length - 1] = { ...bands[bands.length - 1], tier: currentTier };
  return bands.filter((b) => b.toCycle > b.fromCycle);
}

export interface FormItem {
  battleId: number;
  battleType: string;
  tier: string | null;
  kind: 'win' | 'loss' | 'draw' | 'first' | 'placement' | 'unknown';
  label: string;
  eloChange: number;
}

/** One robot's view of its recent battles (the profile form strip and list). */
export function formItems(results: readonly RecentResult[], robotId: number): FormItem[] {
  return results.flatMap((r) => {
    const e = r.entries.find((x) => x.robotId === robotId) ?? r.entries[0];
    if (!e) return [];
    let kind: FormItem['kind'] = 'unknown';
    let label = '—';
    if (isPlacementMode(r.battleType) && e.placement !== null) {
      kind = e.placement === 1 ? 'first' : 'placement';
      label = ordinal(e.placement);
    } else if (e.outcome) {
      kind = e.outcome;
      label = e.outcome === 'win' ? 'Win' : e.outcome === 'loss' ? 'Loss' : 'Draw';
    }
    return [{ battleId: r.battleId, battleType: r.battleType, tier: r.tier, kind, label, eloChange: e.eloChange ?? 0 }];
  });
}

/** Win share for head-to-head modes, first-place share for placement modes; 0 with no matches. */
export function successRate(s: { mode: string; wins: number; losses: number; draws: number; totalMatches: number | null }): number {
  const played = isPlacementMode(s.mode) ? s.totalMatches ?? 0 : s.wins + s.losses + s.draws;
  return played > 0 ? s.wins / played : 0;
}
