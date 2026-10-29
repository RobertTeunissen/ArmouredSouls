/**
 * Labels, URL state and sentences of the admin League Health page.
 *
 * Status and attention codes come from the backend
 * (`services/admin/league-health/leagueHealthStatus.ts`); this module only
 * words them.
 */
import type {
  AttentionEntry,
  LeagueHealthAttentionItem,
  LeagueHealthMode,
  LeagueHealthModeSummary,
  LeagueHealthTier,
} from './adminLeagueHealthApi';

export const LEAGUE_HEALTH_MODES: readonly LeagueHealthMode[] = [
  'league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth', 'grand_melee',
];

export const DEFAULT_LEAGUE_HEALTH_MODE: LeagueHealthMode = 'league_1v1';

export const LEAGUE_TIER_ORDER: readonly string[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

const MODE_LABELS: Readonly<Record<LeagueHealthMode, string>> = {
  league_1v1: '1v1 League',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  tag_team: 'Tag Team',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
};

const MODE_SHORT_LABELS: Readonly<Record<LeagueHealthMode, string>> = {
  league_1v1: '1v1',
  league_2v2: '2v2',
  league_3v3: '3v3',
  tag_team: 'Tag Team',
  koth: 'KotH',
  grand_melee: 'Grand Melee',
};

/** `?mode=` values of the player League Standings page (`/league-standings`). */
const STANDINGS_MODE: Readonly<Record<LeagueHealthMode, string>> = {
  league_1v1: '1v1',
  league_2v2: '2v2',
  league_3v3: '3v3',
  tag_team: 'tag_team',
  koth: 'koth',
  grand_melee: 'grand_melee',
};

export function modeLabel(mode: LeagueHealthMode): string {
  return MODE_LABELS[mode];
}

export function modeShortLabel(mode: LeagueHealthMode): string {
  return MODE_SHORT_LABELS[mode];
}

/** Label of the narrow mobile grid strips ("Melee", as the player standings tabs say). */
export function modeStripLabel(mode: LeagueHealthMode): string {
  return mode === 'grand_melee' ? 'Melee' : MODE_SHORT_LABELS[mode];
}

export function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** The mode in `?mode=`, or the default for a missing or unknown value. */
export function readLeagueHealthMode(value: string | null): LeagueHealthMode {
  return LEAGUE_HEALTH_MODES.includes(value as LeagueHealthMode) ? value as LeagueHealthMode : DEFAULT_LEAGUE_HEALTH_MODE;
}

/** The expanded tier in `?tier=`, or null. */
export function readLeagueHealthTier(value: string | null): string | null {
  return value && LEAGUE_TIER_ORDER.includes(value) ? value : null;
}

/** Page URL of one mode, optionally with a tier expanded. */
export function leagueHealthHref(mode: LeagueHealthMode, tier: string | null = null): string {
  const params = new URLSearchParams();
  if (mode !== DEFAULT_LEAGUE_HEALTH_MODE) params.set('mode', mode);
  if (tier) params.set('tier', tier);
  const query = params.toString();
  return `/admin/league-health${query ? `?${query}` : ''}`;
}

/** Player standings of one instance (`/league-standings?mode=&tier=&instance=`). */
export function standingsHref(mode: LeagueHealthMode, tier: string, instance?: string): string {
  const params = new URLSearchParams({ mode: STANDINGS_MODE[mode], tier });
  if (instance) params.set('instance', instance);
  return `/league-standings?${params.toString()}`;
}

/** Integer with thousands separators ("2,744"). */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Short count for tight cells ("2.7k", "576"). */
export function formatShortCount(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : Math.floor(thousands * 10) / 10}k`;
}

/** Whole percent ("8%"); under 1% but above 0 reads "<1%". */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const percent = (part / whole) * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

export function entityNoun(entityType: 'robot' | 'team', count: number): string {
  if (entityType === 'team') return count === 1 ? 'team' : 'teams';
  return count === 1 ? 'robot' : 'robots';
}

/** "LP" in the LP leagues, "points" in the placement modes. */
export function pointsUnit(mode: LeagueHealthModeSummary): string {
  return mode.rules.lpGated ? 'LP' : 'points';
}

/** "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Active count, with the total when some rows are unsubscribed ("2,744 / 2,978"). */
export function activeOfTotal(tier: Pick<LeagueHealthTier, 'active' | 'total'>): string {
  return tier.active === tier.total ? formatCount(tier.total) : `${formatCount(tier.active)} / ${formatCount(tier.total)}`;
}

export function instanceSummary(tier: LeagueHealthTier): string {
  if (!tier.instanceSize) return '—';
  const { min, max } = tier.instanceSize;
  return `${tier.instances.length} · ${min === max ? min : `${min}–${max}`}`;
}

export interface TierStatusText {
  /** Short status ("OK", "Promotion blocked"). */
  label: string;
  /** Why, in a few words, or null. */
  reason: string | null;
}

/** One decimal without a trailing ".0" ("1.6", "4"). */
export function formatAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The notice of an OK tier: unsubscribed rows first, then few demotions. */
function okNotice(tier: LeagueHealthTier, short: boolean): string | null {
  if (tier.unsubscribedNotice) {
    return short ? `${formatShare(tier.unsubscribed, tier.total)} unsubscribed` : `${formatCount(tier.unsubscribed)} unsubscribed`;
  }
  if (tier.lowDemotionNotice) return 'few demotions';
  return null;
}

/** Status words of a tier for the detail table. */
export function tierStatusText(tier: LeagueHealthTier, mode: LeagueHealthModeSummary): TierStatusText {
  const { promotion } = tier;
  const window = mode.rebalanceCycles.length;
  switch (tier.status.code) {
    case 'empty':
      return { label: 'Empty', reason: null };
    case 'cohort_blocked':
      return { label: 'Promotion blocked', reason: `${tierLabel(tier.nextTier ?? '')} can't open` };
    case 'frozen':
      return { label: 'Frozen', reason: `below ${mode.rules.minEntitiesPerInstance} ${entityNoun(mode.entityType, 2)}` };
    case 'no_promotions':
      return { label: 'No promotions', reason: `none in the last ${window} rebalances` };
    case 'low_promotion':
      return { label: 'Low promotion', reason: `avg ${formatAverage(promotion.flow?.average ?? 0)} of ${promotion.slots} places` };
    default:
      return { label: 'OK', reason: okNotice(tier, false) };
  }
}

/** One-line status of a grid cell ("Promotion blocked", "OK · 8% unsubscribed"). */
export function gridStatusText(tier: LeagueHealthTier, mode: LeagueHealthModeSummary): string {
  const { promotion } = tier;
  switch (tier.status.code) {
    case 'empty':
      return 'Empty';
    case 'cohort_blocked':
      return 'Promotion blocked';
    case 'frozen':
      return `Frozen · below ${mode.rules.minEntitiesPerInstance}`;
    case 'no_promotions':
      return 'No promotions';
    case 'low_promotion':
      return `Avg ${formatAverage(promotion.flow?.average ?? 0)} of ${promotion.slots} promote`;
    default: {
      const notice = okNotice(tier, true);
      return notice ? `OK · ${notice}` : 'OK';
    }
  }
}

export interface MovementText {
  /** "7 of 27" (moved in the last rebalance of the places), or the places alone. */
  value: string;
  caption: string;
}

/** Promotion cell: moved in the last rebalance of the places, the average and the gate. */
export function promotionText(tier: LeagueHealthTier, mode: LeagueHealthModeSummary): MovementText {
  const { promotion } = tier;
  if (tier.nextTier === null) return { value: '—', caption: 'top tier' };
  if (tier.total === 0) return { value: '—', caption: 'empty' };
  if (promotion.slots === 0) {
    return { value: '0 places', caption: `below ${mode.rules.minEntitiesPerInstance} ${entityNoun(mode.entityType, 2)}` };
  }
  const gate = promotion.minLp !== null ? ` · needs ${formatCount(promotion.minLp)} LP` : mode.rules.lpGated ? '' : ' · no LP gate';
  if (!promotion.flow) return { value: `${formatCount(promotion.slots)} places`, caption: `not judged yet${gate}` };
  return {
    value: `${formatCount(promotion.flow.last)} of ${formatCount(promotion.slots)}`,
    caption: `avg ${formatAverage(promotion.flow.average)}${gate}`,
  };
}

/** Demotion cell: moved in the last rebalance of the places and the average. */
export function demotionText(tier: LeagueHealthTier, mode: LeagueHealthModeSummary): MovementText {
  const { demotion } = tier;
  if (LEAGUE_TIER_ORDER.indexOf(tier.tier) === 0) return { value: '—', caption: 'lowest tier' };
  if (tier.total === 0) return { value: '—', caption: 'empty' };
  if (demotion.slots === 0) {
    return { value: '0 places', caption: `below ${mode.rules.minEntitiesPerInstance} ${entityNoun(mode.entityType, 2)}` };
  }
  if (!demotion.flow) return { value: `${formatCount(demotion.slots)} places`, caption: 'not judged yet' };
  return {
    value: `${formatCount(demotion.flow.last)} of ${formatCount(demotion.slots)}`,
    caption: `avg ${formatAverage(demotion.flow.average)}`,
  };
}

/** The rules line of a mode. */
export function rulesSummary(mode: LeagueHealthModeSummary): string {
  const share = Math.round(mode.rules.promotionPercentage * 100);
  const parts = [
    `Top and bottom ${share}% of each instance`,
    `instance needs ${mode.rules.minEntitiesPerInstance} ${entityNoun(mode.entityType, 2)}`,
    `${mode.rules.minCyclesInTier} cycles in tier`,
    mode.rules.lpGated ? 'LP line rises per tier' : 'no LP gate (ranked by points)',
    `an empty tier opens with ${mode.rules.minCohortForNewTier} promotions`,
  ];
  return parts.join(' · ');
}

export interface AttentionText {
  title: string;
  detail: string;
  /** Where the item links: the first tier it is about. */
  href: string;
  destination: string;
}

function entryNoun(entry: AttentionEntry): string {
  return entityNoun(entry.mode === 'league_1v1' || entry.mode === 'koth' || entry.mode === 'grand_melee' ? 'robot' : 'team', 2);
}

function modesOf(entries: readonly AttentionEntry[]): string {
  return joinList(entries.map((entry) => modeShortLabel(entry.mode)));
}

/** "1.6 of 7" or, across modes, "1.6 of 7 (1v1) and 4.2 of 18 (Grand Melee)". */
function averagesOf(entries: readonly AttentionEntry[], pick: (entry: AttentionEntry) => [number | null, number]): string {
  const parts = entries.map((entry) => {
    const [average, slots] = pick(entry);
    const text = `${formatAverage(average ?? 0)} of ${slots}`;
    return entries.length > 1 ? `${text} (${modeShortLabel(entry.mode)})` : text;
  });
  return joinList(parts);
}

function shareWords(share: number): string {
  if (share === 0.25) return 'a quarter';
  if (share === 0.5) return 'half';
  return `${Math.round(share * 100)}%`;
}

/** Title and detail sentence of an attention item. */
export function attentionText(item: LeagueHealthAttentionItem, lowMovementShare = 0.25): AttentionText {
  const [first] = item.entries;
  const tier = tierLabel(item.tier ?? first?.tier ?? '');
  const href = first ? leagueHealthHref(first.mode, first.tier) : leagueHealthHref(DEFAULT_LEAGUE_HEALTH_MODE);
  const destination = first ? `${modeShortLabel(first.mode)} ${tierLabel(first.tier)}` : 'League Health';
  const sizes = joinList(item.entries.map((entry) => formatCount(entry.total)));
  const sameSlots = item.entries.every((entry) => entry.promotionSlots === first?.promotionSlots);
  const window = item.historyWindow;

  switch (item.code) {
    case 'cohort_blocked': {
      const slots = sameSlots && first
        ? `${first.promotionSlots} promotion place${first.promotionSlots === 1 ? '' : 's'}${item.entries.length > 1 ? ' each' : ''}`
        : `${joinList(item.entries.map((entry) => String(entry.promotionSlots)))} promotion places`;
      return {
        title: `${tierLabel(item.nextTier ?? '')} can't open in ${modesOf(item.entries)}`,
        detail: `${tier} has ${sizes} ${first ? entryNoun(first) : ''}: ${slots}. Opening an empty tier needs ${item.minCohortForNewTier} promotions at once.`,
        href,
        destination,
      };
    }
    case 'frozen':
      return {
        title: `${modesOf(item.entries)} ${tier} is frozen`,
        detail: `${sizes} ${first ? entryNoun(first) : ''}, below the ${item.minEntitiesPerInstance} an instance needs for promotion or demotion zones. Nobody moves in or out.`,
        href,
        destination,
      };
    case 'no_promotions':
      return {
        title: `No promotions out of ${modesOf(item.entries)} ${tier}`,
        detail: `None in the last ${window} rebalances, with ${joinList(item.entries.map((entry) => String(entry.promotionSlots)))} promotion places.`,
        href,
        destination,
      };
    case 'low_promotion':
      return {
        title: `Few promotions out of ${modesOf(item.entries)} ${tier}`,
        detail: `On average ${averagesOf(item.entries, (entry) => [entry.promotionAverage, entry.promotionSlots])} promotion places were filled over the last ${window} rebalances.`,
        href,
        destination,
      };
    case 'low_demotion': {
      const shown = item.entries.slice(0, 4).map((entry) =>
        `${modeShortLabel(entry.mode)} ${tierLabel(entry.tier)} ${formatAverage(entry.demotionAverage ?? 0)} of ${entry.demotionSlots}`);
      const more = item.entries.length > 4 ? `, and ${item.entries.length - 4} more` : '';
      return {
        title: 'Demotion rarely moves',
        detail: `In ${item.entries.length} tier${item.entries.length === 1 ? '' : 's'} fewer than ${shareWords(lowMovementShare)} of the demotion places are filled on average (last ${window} rebalances): ${shown.join(', ')}${more}.`,
        href,
        destination,
      };
    }
    case 'unsubscribed': {
      const shown = item.entries.slice(0, 4).map((entry) =>
        `${modeShortLabel(entry.mode)} ${tierLabel(entry.tier)} ${formatCount(entry.unsubscribed)} (${formatShare(entry.unsubscribed, entry.total)})`);
      const more = item.entries.length > 4 ? `, and ${item.entries.length - 4} more` : '';
      return {
        title: 'Unsubscribed standings rows',
        detail: `${shown.join(', ')}${more}. They keep their seat and count toward zone sizes.`,
        href,
        destination,
      };
    }
  }
}

/** "15 human · 981 automaton · 1,982 generated", skipping zero counts. */
export function stableMixText(mix: { human: number; automaton: number; generated: number }): string {
  const parts = (['human', 'automaton', 'generated'] as const)
    .filter((key) => mix[key] > 0)
    .map((key) => `${formatCount(mix[key])} ${key}`);
  return parts.length > 0 ? parts.join(' · ') : 'no stables';
}

/** "Season 1 · cycle 87 of 100", or the preparation phase. */
export function seasonLabel(season: { number: number; phase: string; cycle: number; lengthCycles: number } | null): string | null {
  if (!season) return null;
  if (season.phase !== 'competitive') return `Season ${season.number} · preparation`;
  return `Season ${season.number} · cycle ${season.cycle} of ${season.lengthCycles}`;
}
