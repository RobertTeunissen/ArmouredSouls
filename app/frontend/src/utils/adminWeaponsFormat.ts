/**
 * Labels, formatting and URL state of the admin Weapons page.
 */
import { ANALYSIS_COLUMNS, ANALYSIS_RANGES, type EffectEstimate } from '../components/admin/attributes/types';
import { TONE_CLASSES, effectTone } from './adminAttributesFormat';
import {
  ANALYSIS_STRENGTHS,
  MATCHUP_VIEWS,
  type AnalysisColumn,
  type AnalysisRange,
  type AnalysisStrength,
  type ArchetypeKey,
  type Loadout,
  type MatchupView,
  type RangeBand,
  type UsageTier,
  type WeaponFilters,
  type WeaponRow,
} from '../components/admin/weapons/types';

export const DEFAULT_WEAPON_FILTERS: WeaponFilters = { range: '7d', column: 'all', strength: 'all', matchups: 'bands' };

export const STRENGTH_OPTIONS: ReadonlyArray<{ key: AnalysisStrength; label: string; description: string }> = [
  { key: 'all', label: 'All robots', description: 'Every robot that fought' },
  { key: 'top10', label: 'Top 10%', description: 'Only fights where every robot is in the top 10% of points invested in its mode' },
];

export const MATCHUP_VIEW_OPTIONS: ReadonlyArray<{ key: MatchupView; label: string }> = [
  { key: 'bands', label: 'Range bands' },
  { key: 'loadouts', label: 'Loadouts' },
  { key: 'archetypes', label: 'Top archetypes' },
];

const BAND_LABELS: Record<RangeBand, string> = { melee: 'Melee', short: 'Short', mid: 'Mid', long: 'Long' };
const LOADOUT_LABELS: Record<Loadout, string> = { single: 'Single', weapon_shield: 'Weapon + shield', two_handed: 'Two-handed', dual_wield: 'Dual wield' };
const LOADOUT_SHORT: Record<Loadout, string> = { single: 'Single', weapon_shield: '+ Shield', two_handed: '2-handed', dual_wield: 'Dual' };
const TIER_LABELS: Record<UsageTier, string> = {
  bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond', champion: 'Champion', tournament: 'Tournaments',
};

export function bandLabel(band: string): string {
  return BAND_LABELS[band as RangeBand] ?? band;
}

export function loadoutLabel(loadout: string, short = false): string {
  return (short ? LOADOUT_SHORT : LOADOUT_LABELS)[loadout as Loadout] ?? loadout;
}

/** 'melee+weapon_shield' → "Melee + shield", 'long+single' → "Long single". */
export function archetypeLabel(key: string): string {
  const [band, loadout] = key.split('+');
  const b = bandLabel(band);
  if (loadout === 'weapon_shield') return `${b} + shield`;
  return `${b} ${(LOADOUT_LABELS[loadout as Loadout] ?? loadout).toLowerCase()}`;
}

/** A matchup label of any view (band, loadout or archetype key). */
export function matchupLabel(view: MatchupView, label: string): string {
  if (view === 'bands') return bandLabel(label);
  if (view === 'loadouts') return loadoutLabel(label);
  return archetypeLabel(label);
}

export function tierLabel(tier: UsageTier): string {
  return TIER_LABELS[tier];
}

export function handsLabel(hands: string): string {
  if (hands === 'one') return '1H';
  if (hands === 'two') return '2H';
  if (hands === 'shield') return 'Shield';
  return hands;
}

/** 286000 → "₡286k", 1200000 → "₡1.2M". */
export function formatCost(cost: number): string {
  if (cost >= 1_000_000) return `₡${(cost / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (cost >= 1_000) return `₡${Math.round(cost / 1_000)}k`;
  return `₡${cost}`;
}

/** 0.761 → "76%". */
export function formatWinRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** 0.0567 → "5.7%", tiny shares keep one significant digit ("<0.1%"). */
export function formatUsage(share: number | null): string {
  if (share === null) return '—';
  if (share > 0 && share < 0.001) return '<0.1%';
  return `${(share * 100).toFixed(1)}%`;
}

/** Strongest effect first; weapons without an estimate after them, most used first. */
export function sortWeapons(rows: readonly WeaponRow[], column: AnalysisColumn): WeaponRow[] {
  return [...rows].sort((a, b) => {
    const ea = a.results[column].effect.effect;
    const eb = b.results[column].effect.effect;
    if (ea !== null && eb !== null) return eb - ea || a.name.localeCompare(b.name);
    if (ea !== null) return -1;
    if (eb !== null) return 1;
    return b.results[column].robots - a.results[column].robots || a.name.localeCompare(b.name);
  });
}

/** Grid cell colour: by tone when significant, a quiet grey within noise, darker without an estimate. */
export function effectCellClass(estimate: EffectEstimate): string {
  if (estimate.effect === null) return 'bg-background';
  if (!estimate.significant) return 'bg-surface-elevated text-secondary';
  return TONE_CLASSES[effectTone(estimate)];
}

/** A matchup win rate as an effect around 50%, for the same colour scale. */
export function matchupEstimate(winRate: number | null, se: number | null, significant: boolean): EffectEstimate {
  return winRate === null ? { effect: null, se: null, significant: false } : { effect: (winRate - 0.5) * 100, se, significant };
}

/** Visible weapon rows before "Show all". */
export const WEAPONS_COLLAPSED = 12;

// ── URL state ────────────────────────────────────────────────────────

function isOneOf<T extends string>(values: readonly T[], value: string | null): value is T {
  return value !== null && (values as readonly string[]).includes(value);
}

/** `?range=&column=&strength=&matchups=`. */
export function readWeaponFilters(params: URLSearchParams): WeaponFilters {
  const range = params.get('range');
  const column = params.get('column');
  const strength = params.get('strength');
  const matchups = params.get('matchups');
  return {
    range: isOneOf<AnalysisRange>(ANALYSIS_RANGES, range) ? range : DEFAULT_WEAPON_FILTERS.range,
    column: isOneOf<AnalysisColumn>(ANALYSIS_COLUMNS, column) ? column : DEFAULT_WEAPON_FILTERS.column,
    strength: isOneOf<AnalysisStrength>(ANALYSIS_STRENGTHS, strength) ? strength : DEFAULT_WEAPON_FILTERS.strength,
    matchups: isOneOf<MatchupView>(MATCHUP_VIEWS, matchups) ? matchups : DEFAULT_WEAPON_FILTERS.matchups,
  };
}

export function writeWeaponFilters(current: URLSearchParams, filters: WeaponFilters): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ['range', 'column', 'strength', 'matchups'] as const) {
    if (filters[key] === DEFAULT_WEAPON_FILTERS[key]) next.delete(key);
    else next.set(key, filters[key]);
  }
  return next;
}

export function isDefaultWeaponFilters(filters: WeaponFilters): boolean {
  return (Object.keys(DEFAULT_WEAPON_FILTERS) as Array<keyof WeaponFilters>).every((key) => filters[key] === DEFAULT_WEAPON_FILTERS[key]);
}

export type { ArchetypeKey };
