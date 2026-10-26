/**
 * Labels, formatting and URL state of the admin Attributes page.
 */
import {
  ANALYSIS_COLUMNS,
  ANALYSIS_RANGES,
  LAYER_KEYS,
  type AnalysisColumn,
  type AnalysisRange,
  type AttributeFilters,
  type AttributeGroup,
  type EffectEstimate,
  type LayerKey,
  type LayerStep,
  type LayerToggles,
} from '../components/admin/attributes/types';

export const ALL_LAYERS_ON: LayerToggles = { tuning: true, weapons: true, refinements: true, loadout: true, stance: true };

export const DEFAULT_ATTRIBUTE_FILTERS: AttributeFilters = { range: '7d', toggles: { ...ALL_LAYERS_ON }, column: 'all' };

export const RANGE_OPTIONS: ReadonlyArray<{ key: AnalysisRange; label: string }> = [
  { key: '7d', label: 'Last 7 days' },
  { key: '14d', label: 'Last 14 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'season', label: 'This season' },
];

const COLUMN_LABELS: Record<AnalysisColumn, string> = { all: 'All modes', duel: '1v1', team: 'Team', multi: 'Multi-robot' };
const COLUMN_DETAILS: Record<AnalysisColumn, string> = {
  all: 'Every mode together',
  duel: 'League and tournament 1v1',
  team: '2v2, 3v3, tag team and team tournaments',
  multi: 'King of the Hill and Grand Melee, by placement',
};

export function columnLabel(column: AnalysisColumn): string {
  return COLUMN_LABELS[column];
}

export function columnDetail(column: AnalysisColumn): string {
  return COLUMN_DETAILS[column];
}

export const LAYER_OPTIONS: ReadonlyArray<{ key: LayerKey; label: string; description: string }> = [
  { key: 'tuning', label: 'Tuning', description: 'Tuning pool bonuses.' },
  { key: 'weapons', label: 'Weapon bonuses', description: 'Attribute bonuses of the equipped weapons (catalog values).' },
  { key: 'refinements', label: 'Refinements', description: 'Hone and Augment bonuses on the weapons.' },
  { key: 'loadout', label: 'Loadout', description: 'The loadout multiplier (single, two-handed, dual wield, weapon and shield).' },
  { key: 'stance', label: 'Stance', description: 'The stance as its own effect (offensive / defensive vs balanced). Combat applies stance in its hit, damage, counter and regen formulas, never to attribute values.' },
];

const LAYER_STEP_LABELS: Record<LayerStep, string> = {
  base: 'Base attributes',
  tuning: '+ Tuning',
  weapons: '+ Weapon bonuses',
  refinements: '+ Refinements',
  loadout: '+ Loadout',
  stance: '+ Stance (effect)',
};

export function layerStepLabel(step: LayerStep): string {
  return LAYER_STEP_LABELS[step];
}

const GROUP_LABELS: Record<AttributeGroup, string> = {
  combat: 'Combat',
  defence: 'Defence',
  chassis: 'Chassis',
  ai: 'AI',
  team: 'Team',
};

const GROUP_FULL_LABELS: Record<AttributeGroup, string> = {
  combat: 'Combat Systems',
  defence: 'Defensive Systems',
  chassis: 'Chassis & Mobility',
  ai: 'AI Processing',
  team: 'Team Coordination',
};

export function groupLabel(group: AttributeGroup): string {
  return GROUP_LABELS[group];
}

export function groupFullLabel(group: AttributeGroup): string {
  return GROUP_FULL_LABELS[group];
}

/** `combatPower` → "Combat Power", `adaptiveAI` → "Adaptive AI". */
export function attributeLabel(attribute: string): string {
  return attribute
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** 'balanced' → "Balanced", 'combat' → "Combat-heavy", 'combat+defence' → "Combat + Defence". */
export function profileLabel(profile: string): string {
  if (profile === 'balanced') return 'Balanced';
  const groups = profile.split('+') as AttributeGroup[];
  if (groups.length === 1) return `${groupLabel(groups[0])}-heavy`;
  return groups.map(groupLabel).join(' + ');
}

const MINUS = '\u2212';

/** "+1.2 pp", "−0.8 pp", "—". */
export function formatEffect(effect: number | null, digits = 1): string {
  if (effect === null) return '—';
  const rounded = Number(effect.toFixed(digits));
  if (rounded === 0) return `0.${'0'.repeat(digits)} pp`;
  return `${rounded > 0 ? '+' : MINUS}${Math.abs(rounded).toFixed(digits)} pp`;
}

/** "±0.4". */
export function formatSe(se: number | null): string {
  return se === null ? '' : `±${se.toFixed(1)}`;
}

/** 0.0567 → "5.7%". */
export function formatShare(share: number | null, digits = 1): string {
  return share === null ? '—' : `${(share * 100).toFixed(digits)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export type EffectTone = 'strong-up' | 'up' | 'weak-up' | 'strong-down' | 'down' | 'weak-down' | 'neutral' | 'none';

/** Strength bands for colour; |effect| in pp. Not significant → neutral. */
export function effectTone(estimate: EffectEstimate): EffectTone {
  if (estimate.effect === null) return 'none';
  if (!estimate.significant) return 'neutral';
  const size = Math.abs(estimate.effect);
  const up = estimate.effect > 0;
  if (size >= 3) return up ? 'strong-up' : 'strong-down';
  if (size >= 1) return up ? 'up' : 'down';
  return up ? 'weak-up' : 'weak-down';
}

export const TONE_CLASSES: Record<EffectTone, string> = {
  'strong-up': 'bg-success/40 text-white',
  up: 'bg-success/25 text-white',
  'weak-up': 'bg-success/10 text-success',
  'strong-down': 'bg-error/40 text-white',
  down: 'bg-error/25 text-white',
  'weak-down': 'bg-error/10 text-error',
  neutral: 'text-secondary',
  none: 'text-tertiary',
};

/** Screen-reader wording for a cell. */
export function effectDescription(estimate: EffectEstimate): string {
  if (estimate.effect === null) return 'not enough data';
  const text = `${formatEffect(estimate.effect)} ${formatSe(estimate.se)}`.trim();
  return estimate.significant ? text : `${text}, not significant`;
}

export function formatUtcDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ── URL state ────────────────────────────────────────────────────────

function isRange(value: string | null): value is AnalysisRange {
  return value !== null && (ANALYSIS_RANGES as readonly string[]).includes(value);
}

function isColumn(value: string | null): value is AnalysisColumn {
  return value !== null && (ANALYSIS_COLUMNS as readonly string[]).includes(value);
}

/** `?range=&column=&off=stance,loadout`. */
export function readAttributeFilters(params: URLSearchParams): AttributeFilters {
  const off = new Set((params.get('off') ?? '').split(',').filter(Boolean));
  const toggles = { ...ALL_LAYERS_ON };
  for (const key of LAYER_KEYS) if (off.has(key)) toggles[key] = false;
  const range = params.get('range');
  const column = params.get('column');
  return {
    range: isRange(range) ? range : DEFAULT_ATTRIBUTE_FILTERS.range,
    toggles,
    column: isColumn(column) ? column : DEFAULT_ATTRIBUTE_FILTERS.column,
  };
}

export function writeAttributeFilters(current: URLSearchParams, filters: AttributeFilters): URLSearchParams {
  const next = new URLSearchParams(current);
  if (filters.range === DEFAULT_ATTRIBUTE_FILTERS.range) next.delete('range');
  else next.set('range', filters.range);
  if (filters.column === DEFAULT_ATTRIBUTE_FILTERS.column) next.delete('column');
  else next.set('column', filters.column);
  const off = LAYER_KEYS.filter((key) => !filters.toggles[key]);
  if (off.length === 0) next.delete('off');
  else next.set('off', off.join(','));
  return next;
}

export function layersSummary(toggles: LayerToggles): string {
  const off = LAYER_OPTIONS.filter((o) => !toggles[o.key]);
  if (off.length === 0) return 'Effective values (all layers)';
  if (off.length === LAYER_OPTIONS.length) return 'Base attributes only';
  return `Without ${off.map((o) => o.label.toLowerCase()).join(', ')}`;
}
