/**
 * League Standings view model (`/league-standings`, PRD_LEAGUE_STANDINGS v2.0).
 *
 * The six tiered leagues, the viewer's league cards (from
 * `GET /api/leagues/my-standings`), the opening view, and the wording of the
 * status chip and instance summary. Pure, so the page and its tests share it.
 */
import { LEAGUE_TIERS, getTierName } from './tierHelpers';
import type { MyStandingEntry, StandingStatus } from '@shared/types';

// ─── Modes ──────────────────────────────────────────────────────────

/** `?mode=` values; kept from the old page so existing links still land. */
export type LeagueModeKey = '1v1' | '2v2' | '3v3' | 'tag_team' | 'koth' | 'grand_melee';
export type LeagueApiMode = 'league_1v1' | 'league_2v2' | 'league_3v3' | 'tag_team' | 'koth' | 'grand_melee';

export interface LeagueModeInfo {
  key: LeagueModeKey;
  apiMode: LeagueApiMode;
  label: string;
  entity: 'robot' | 'team';
  /** Placement modes rank by wins out of matches; no W-D-L, no ELO. */
  placement: boolean;
}

export const LEAGUE_MODES: readonly LeagueModeInfo[] = [
  { key: '1v1', apiMode: 'league_1v1', label: '1v1 League', entity: 'robot', placement: false },
  { key: '2v2', apiMode: 'league_2v2', label: '2v2 League', entity: 'team', placement: false },
  { key: '3v3', apiMode: 'league_3v3', label: '3v3 League', entity: 'team', placement: false },
  { key: 'tag_team', apiMode: 'tag_team', label: 'Tag Team', entity: 'team', placement: false },
  { key: 'koth', apiMode: 'koth', label: 'King of the Hill', entity: 'robot', placement: true },
  { key: 'grand_melee', apiMode: 'grand_melee', label: 'Grand Melee', entity: 'robot', placement: true },
];

export function modeInfo(key: LeagueModeKey): LeagueModeInfo {
  return LEAGUE_MODES.find((m) => m.key === key) ?? LEAGUE_MODES[0];
}

export function modeFromParam(value: string | null): LeagueModeKey {
  return LEAGUE_MODES.find((m) => m.key === value)?.key ?? '1v1';
}

export function tierFromParam(value: string | null): string | null {
  return value !== null && (LEAGUE_TIERS as readonly string[]).includes(value) ? value : null;
}

const tierIndex = (tier: string): number => (LEAGUE_TIERS as readonly string[]).indexOf(tier);

/** "Diamond 1" for `diamond_1`. */
export function instanceLabel(instanceId: string): string {
  const [tier, number] = instanceId.split('_');
  return number ? `${getTierName(tier)} ${number}` : instanceId;
}

// ─── Status ─────────────────────────────────────────────────────────

export type StatusTone = 'success' | 'error' | 'warning' | 'neutral';

export interface StatusChipText {
  label: string;
  tone: StatusTone;
  /** Full sentence for screen readers and the title tooltip. */
  description: string;
}

/** What the chip says. `tierAbove` names the tier a promotion would open. */
export function statusText(status: StandingStatus, tierAbove: string | null): StatusChipText {
  switch (status.kind) {
    case 'promotes':
      return { label: 'Promotes', tone: 'success', description: 'Moves up at the next rebalance.' };
    case 'demotes':
      return { label: 'Demotes', tone: 'error', description: 'Moves down at the next rebalance.' };
    case 'held_lp':
      return {
        label: `Needs ${status.minLP} LP`,
        tone: 'warning',
        description: `In a promotion place, but going up needs ${status.minLP} LP.`,
      };
    case 'held_cohort':
      return {
        label: `Held: ${tierAbove ? getTierName(tierAbove) : 'next tier'} is empty`,
        tone: 'warning',
        description: 'Qualifies, but an empty tier only opens when at least 3 qualify across the tier.',
      };
    case 'held_cycles': {
      const n = status.cyclesToGo ?? 1;
      const cycles = `${n} ${n === 1 ? 'cycle' : 'cycles'} to go`;
      return {
        label: cycles,
        tone: 'neutral',
        description: `In a ${status.zone} place, but not long enough in this tier yet: ${cycles}.`,
      };
    }
  }
}

export function tierAbove(tier: string): string | null {
  const next = tierIndex(tier) + 1;
  return next > 0 && next < LEAGUE_TIERS.length ? LEAGUE_TIERS[next] : null;
}

function tierBelow(tier: string): string | null {
  const below = tierIndex(tier) - 1;
  return below >= 0 ? LEAGUE_TIERS[below] : null;
}

// ─── The viewer's entries ───────────────────────────────────────────

/** Entries of one mode, best first: highest tier, then best place. */
export function entriesForMode(entries: readonly MyStandingEntry[], mode: LeagueModeKey): MyStandingEntry[] {
  const apiMode = modeInfo(mode).apiMode;
  return entries
    .filter((e) => e.mode === apiMode)
    .sort((a, b) => tierIndex(b.tier) - tierIndex(a.tier) || a.place - b.place || a.entityId - b.entityId);
}

export interface LeagueCardSummary {
  mode: LeagueModeInfo;
  count: number;
  tierCount: number;
  best: MyStandingEntry | null;
  /** One line about what moves, e.g. "2 promote", "1 held: the tier above is empty" or "3 held below the LP minimum". */
  movement: { text: string; tone: StatusTone } | null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The line under a league card: the most important movement first. */
function movementLine(entries: readonly MyStandingEntry[]): LeagueCardSummary['movement'] {
  const count = (pred: (s: StandingStatus) => boolean): number => entries.filter((e) => e.status && pred(e.status)).length;
  const promotes = count((s) => s.kind === 'promotes');
  const demotes = count((s) => s.kind === 'demotes');
  const heldLp = count((s) => s.kind === 'held_lp');
  // Qualifies on LP and cycles; waits for enough qualifiers to open an empty tier.
  const heldCohort = count((s) => s.kind === 'held_cohort');
  const upPlaces = count((s) => s.kind === 'held_cycles' && s.zone === 'promotion');
  const downPlaces = count((s) => s.kind === 'held_cycles' && s.zone === 'demotion');

  const parts: Array<{ text: string; tone: StatusTone }> = [];
  if (promotes) parts.push({ text: plural(promotes, 'promotes', 'promote'), tone: 'success' });
  if (demotes) parts.push({ text: plural(demotes, 'demotes', 'demote'), tone: 'error' });
  if (parts.length > 0) {
    return { text: parts.map((p) => p.text).join(' · '), tone: parts[0].tone };
  }
  if (heldCohort) return { text: `${heldCohort} held: the tier above is empty`, tone: 'warning' };
  if (heldLp) return { text: `${heldLp} held below the LP minimum`, tone: 'warning' };
  if (upPlaces) return { text: `${plural(upPlaces, 'in a promotion place', 'in promotion places')}`, tone: 'success' };
  if (downPlaces) return { text: `${plural(downPlaces, 'in a demotion place', 'in demotion places')}`, tone: 'warning' };
  return { text: 'Nobody in a zone', tone: 'neutral' };
}

/** One card per league the viewer has an entry in, in league order. */
export function summariseLeagues(entries: readonly MyStandingEntry[]): LeagueCardSummary[] {
  return LEAGUE_MODES.map((mode) => {
    const own = entriesForMode(entries, mode.key);
    return {
      mode,
      count: own.length,
      tierCount: new Set(own.map((e) => e.tier)).size,
      best: own[0] ?? null,
      movement: own.length > 0 ? movementLine(own) : null,
    };
  }).filter((card) => card.count > 0);
}

/** Robots or teams, counted: "11 robots", "1 team". */
export function entityCount(mode: LeagueModeInfo, n: number): string {
  return mode.entity === 'robot' ? plural(n, 'robot', 'robots') : plural(n, 'team', 'teams');
}

export interface StandingsView {
  tier: string;
  /** null = every instance of the tier. */
  instance: string | null;
}

/**
 * Where the page opens for a mode: the viewer's best instance (highest tier,
 * best place), or all of Bronze when they have nothing in that league.
 */
export function openingView(entries: readonly MyStandingEntry[], mode: LeagueModeKey): StandingsView {
  const best = entriesForMode(entries, mode)[0];
  return best ? { tier: best.tier, instance: best.leagueInstanceId } : { tier: 'bronze', instance: null };
}

/** The viewer's best instance in one tier of a mode, if they have one there. */
export function bestInstanceIn(entries: readonly MyStandingEntry[], mode: LeagueModeKey, tier: string): string | null {
  return entriesForMode(entries, mode).find((e) => e.tier === tier)?.leagueInstanceId ?? null;
}

/** How many of the viewer's entries sit in each tier / instance of a mode. */
export function countBy(entries: readonly MyStandingEntry[], mode: LeagueModeKey, key: 'tier' | 'leagueInstanceId'): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entriesForMode(entries, mode)) counts.set(e[key], (counts.get(e[key]) ?? 0) + 1);
  return counts;
}

// ─── Instance summary ───────────────────────────────────────────────

export interface ZoneMeta {
  tier: string;
  minLP: number | null;
  minCycles: number;
  minRobotsRequired: number;
  hasEnoughRobots: boolean;
  promotionSlots: number;
  demotionSlots: number;
  promotionBlockReason: 'destination_cohort_too_small' | null;
  totalEntities: number;
  totalInstances: number;
  activeInstances: number;
  instancesBelowMinimum: number;
  smallestInstancePopulation: number;
  isChampion: boolean;
  isBronze: boolean;
}

/**
 * The line under the instance heading, e.g. "67 robots · top 6 go up to
 * Champion, bottom 6 down to Platinum · moving needs 5 cycles in Diamond;
 * going up also needs 125 LP".
 */
export function zoneSummary(meta: ZoneMeta, mode: LeagueModeInfo, wholeTier: boolean): string[] {
  const tierName = getTierName(meta.tier);
  const parts: string[] = [entityCount(mode, meta.totalEntities)];
  if (wholeTier && meta.totalInstances > 1) parts[0] += ` in ${meta.totalInstances} instances`;

  if (!meta.hasEnoughRobots && meta.totalInstances > 0 && meta.activeInstances === 0) {
    parts.push(`nobody moves until an instance has ${meta.minRobotsRequired}`);
    return parts;
  }

  const up = meta.isChampion ? null : tierAbove(meta.tier);
  const down = meta.isBronze ? null : tierBelow(meta.tier);
  const moves: string[] = [];
  if (wholeTier) {
    // Zones are counted per instance, so a tier-wide total would mislead.
    if (up) moves.push(`top 10% of each instance go up to ${getTierName(up)}`);
    if (down) moves.push(`bottom 10% down to ${getTierName(down)}`);
  } else {
    if (up && meta.promotionSlots > 0) moves.push(`top ${meta.promotionSlots} go up to ${getTierName(up)}`);
    if (down && meta.demotionSlots > 0) moves.push(`bottom ${meta.demotionSlots} down to ${getTierName(down)}`);
  }
  if (moves.length > 0) parts.push(moves.join(', '));

  const gate = `moving needs ${meta.minCycles} cycles in ${tierName}`;
  parts.push(up && meta.minLP !== null && meta.minLP > 0 ? `${gate}; going up also needs ${meta.minLP} LP` : gate);
  return parts;
}

/** A line about a held tier or paused instances, or null. */
export function zoneWarning(meta: ZoneMeta, mode: LeagueModeInfo): string | null {
  const unit = mode.entity === 'robot' ? 'robots' : 'teams';
  if (meta.promotionBlockReason === 'destination_cohort_too_small') {
    const up = tierAbove(meta.tier);
    return `Promotion is held: ${up ? getTierName(up) : 'the next tier'} is empty and opens only when at least 3 qualify across ${getTierName(meta.tier)}.`;
  }
  if (meta.totalInstances > 0 && meta.instancesBelowMinimum > 0 && meta.activeInstances > 0) {
    return `${plural(meta.instancesBelowMinimum, 'instance has', 'instances have')} fewer than ${meta.minRobotsRequired} ${unit}: nobody moves there yet.`;
  }
  if (meta.totalInstances === 1 && !meta.hasEnoughRobots) {
    return `Fewer than ${meta.minRobotsRequired} ${unit} here: nobody moves until it fills up.`;
  }
  return null;
}
