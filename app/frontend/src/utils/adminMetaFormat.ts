/**
 * Pure helpers of the admin Meta page: shares of a distribution and the
 * yield-threshold summary, plus the labels of the build sections.
 * Unit-tested without rendering.
 */
import { EVENT_LABELS } from '../components/admin/automatons/automatonText';
import { FORGE_EFFECT_LABEL, SHARPEN_EFFECT_LABEL } from '../components/weapon-refinement/refinementCopy';
import type { RefinementKind } from '@shared/types';

export interface ShareItem {
  label: string;
  value: number;
  /** Percentage of the distribution's total, unrounded. */
  share: number;
}

export interface YieldBar {
  threshold: number;
  count: number;
  share: number;
}

export interface YieldSummary {
  total: number;
  bars: YieldBar[];
  /** Highest count; the lowest threshold wins a tie. Null without robots. */
  mostCommon: YieldBar | null;
  /** Threshold of the middle robot (lower middle for an even total). */
  median: number | null;
  /** Robots with a threshold above 20%. */
  above20: { count: number; share: number };
}

/** "weapon_shield" → "Weapon shield"; the acronym "ai" stays "AI". */
export function humanizeKey(raw: string): string {
  const spaced = raw.replace(/_/g, ' ').replace(/\bai\b/gi, 'AI');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function percentage(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** Whole-number percentage of `part` in `whole` ("98%"), "0%" for an empty whole. */
export function formatPercentOf(part: number, whole: number): string {
  return `${Math.round(percentage(part, whole))}%`;
}

const REFINEMENT_KIND_LABELS: Record<RefinementKind, string> = {
  hone: 'Hone',
  augment: 'Augment',
  sharpen: 'Sharpen',
  forge: 'Forge',
};

/** What one refinement of the kind does (Sharpen and Forge from the shared constants). */
const REFINEMENT_KIND_EFFECTS: Record<RefinementKind, string> = {
  hone: '+1–5 to an attribute the weapon has',
  augment: '+1–5 to an attribute it lacks',
  sharpen: SHARPEN_EFFECT_LABEL,
  forge: FORGE_EFFECT_LABEL,
};

export function refinementKindLabel(kind: RefinementKind): string {
  return REFINEMENT_KIND_LABELS[kind];
}

export function refinementKindEffect(kind: RefinementKind): string {
  return REFINEMENT_KIND_EFFECTS[kind];
}

/** Display label of a subscribable event ("King of the Hill"), humanized when unknown. */
export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? humanizeKey(eventType);
}

/** Shares of a distribution, largest first (label order breaks ties). */
export function toShares(items: ReadonlyArray<{ label: string; value: number }>): ShareItem[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items
    .map((item) => ({ ...item, share: percentage(item.value, total) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Bars in threshold order plus the most common, the median and the tail above 20%. */
export function summarizeYield(distribution: ReadonlyArray<{ threshold: number; count: number }>): YieldSummary {
  const sorted = [...distribution].filter((entry) => entry.count > 0).sort((a, b) => a.threshold - b.threshold);
  const total = sorted.reduce((sum, entry) => sum + entry.count, 0);
  const bars = sorted.map((entry) => ({ ...entry, share: percentage(entry.count, total) }));

  let mostCommon: YieldBar | null = null;
  for (const bar of bars) {
    if (mostCommon === null || bar.count > mostCommon.count) mostCommon = bar;
  }

  let median: number | null = null;
  if (total > 0) {
    const middle = Math.ceil(total / 2);
    let seen = 0;
    for (const bar of bars) {
      seen += bar.count;
      if (seen >= middle) {
        median = bar.threshold;
        break;
      }
    }
  }

  const above20Count = bars.filter((bar) => bar.threshold > 20).reduce((sum, bar) => sum + bar.count, 0);
  return { total, bars, mostCommon, median, above20: { count: above20Count, share: percentage(above20Count, total) } };
}
