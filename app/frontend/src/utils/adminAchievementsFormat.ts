/**
 * Pure helpers of the admin Achievements page: labels, the URL state, the
 * per-tier strip data, the "easier / harder than its tier" notes and table
 * sorting. Unit-tested without rendering.
 */
import {
  ACHIEVEMENT_STABLES,
  type AchievementCategory,
  type AchievementRow,
  type AchievementStables,
  type AchievementTier,
} from './adminAchievementsApi';

export const TIER_ORDER: readonly AchievementTier[] = ['easy', 'medium', 'hard', 'very_hard', 'secret'];
export const CATEGORY_ORDER: readonly AchievementCategory[] = ['combat', 'league', 'economy', 'prestige', 'style'];

/** A hard or very hard achievement unlocked by at least this share of the population looks too easy. */
export const EASIER_THAN_TIER_RATE = 80;
/** An easy or medium achievement unlocked by at most this share looks too hard. */
export const HARDER_THAN_TIER_RATE = 25;
/** Rows listed per note. */
export const NOTE_LIMIT = 6;

const TIER_LABELS: Record<AchievementTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very hard',
  secret: 'Secret',
};

export function tierLabel(tier: AchievementTier): string {
  return TIER_LABELS[tier];
}

export function categoryLabel(category: AchievementCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/** `?stables=` → a known scope, Players by default. */
export function readAchievementStables(params: URLSearchParams): AchievementStables {
  const raw = params.get('stables');
  return (ACHIEVEMENT_STABLES as readonly string[]).includes(raw ?? '') ? (raw as AchievementStables) : 'players';
}

/** Players are the default, so they leave the URL clean. */
export function writeAchievementStables(params: URLSearchParams, stables: AchievementStables): URLSearchParams {
  const next = new URLSearchParams(params);
  if (stables === 'players') next.delete('stables');
  else next.set('stables', stables);
  return next;
}

/** "day 12", "before start" (preparation or rollover re-award), or "—". */
export function medianDayLabel(day: number | null): string {
  if (day === null) return '—';
  return day <= 0 ? 'before start' : `day ${day}`;
}

/** "72.3%" → "72%"; keeps one decimal under 10% so small rates stay distinguishable. */
export function formatRate(rate: number): string {
  return rate > 0 && rate < 10 ? `${rate.toFixed(1)}%` : `${Math.round(rate)}%`;
}

export interface TierStrip {
  tier: AchievementTier;
  count: number;
  /** Unlock rates of the tier's achievements, lowest first. */
  rates: number[];
  /** Lower median of the rates, or null for an empty tier. */
  median: number | null;
}

/** One strip per tier in tier order, with every achievement's rate and the tier median. */
export function tierStrips(rows: ReadonlyArray<AchievementRow>): TierStrip[] {
  return TIER_ORDER.map((tier) => {
    const rates = rows.filter((row) => row.tier === tier).map((row) => row.rate).sort((a, b) => a - b);
    return { tier, count: rates.length, rates, median: rates.length > 0 ? rates[Math.floor((rates.length - 1) / 2)] : null };
  });
}

/** Hard or very hard, yet unlocked by most of the population: highest rate first. */
export function easierThanTier(rows: ReadonlyArray<AchievementRow>): AchievementRow[] {
  return rows
    .filter((row) => (row.tier === 'hard' || row.tier === 'very_hard') && row.rate >= EASIER_THAN_TIER_RATE)
    .sort((a, b) => b.rate - a.rate || a.achievementId.localeCompare(b.achievementId))
    .slice(0, NOTE_LIMIT);
}

/** Easy or medium, yet rarely unlocked: lowest rate first. */
export function harderThanTier(rows: ReadonlyArray<AchievementRow>): AchievementRow[] {
  return rows
    .filter((row) => (row.tier === 'easy' || row.tier === 'medium') && row.rate <= HARDER_THAN_TIER_RATE)
    .sort((a, b) => a.rate - b.rate || a.achievementId.localeCompare(b.achievementId))
    .slice(0, NOTE_LIMIT);
}

export type AchievementSortKey = 'name' | 'category' | 'tier' | 'unlocked' | 'medianDay' | 'unlockedAll';
export type SortDirection = 'asc' | 'desc';

/** Text columns start A→Z, number columns highest first. */
export function defaultDirection(key: AchievementSortKey): SortDirection {
  return key === 'name' || key === 'category' || key === 'tier' ? 'asc' : 'desc';
}

function compareBy(key: AchievementSortKey, a: AchievementRow, b: AchievementRow): number {
  switch (key) {
    case 'name': return a.name.localeCompare(b.name);
    case 'category': return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    case 'tier': return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    case 'unlocked': return a.unlocked - b.unlocked;
    case 'unlockedAll': return a.unlockedAll - b.unlockedAll;
    case 'medianDay': return (a.medianDay ?? Number.POSITIVE_INFINITY) - (b.medianDay ?? Number.POSITIVE_INFINITY);
  }
}

/**
 * Sorted copy. Ties fall back to the achievement id; achievements nobody
 * unlocked stay last when sorting by median day in either direction.
 */
export function sortAchievements(rows: ReadonlyArray<AchievementRow>, key: AchievementSortKey, direction: SortDirection): AchievementRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'medianDay' && (a.medianDay === null) !== (b.medianDay === null)) return a.medianDay === null ? 1 : -1;
    return sign * compareBy(key, a, b) || a.achievementId.localeCompare(b.achievementId, undefined, { numeric: true });
  });
}
