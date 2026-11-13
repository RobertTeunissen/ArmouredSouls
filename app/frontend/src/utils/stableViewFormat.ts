/**
 * Pure derivations for the public stable page and its season history.
 *
 * A robot's "highest tier" is its best tier over every tiered mode, not just
 * league 1v1: robots specialise (2v2, Grand Melee…). LP is not comparable
 * across modes (Grand Melee runs to several hundred, 1v1 to ~130), so a tie
 * between modes is shown as a count ("Champion ×3") instead of naming one.
 */
import {
  TIERED_STANDINGS_MODES,
  isPlacementMode,
  tierRank,
  type TieredStandingsMode,
} from '@shared/utils/automatonStandingsTier';
import type { PublicRobotStanding, RecentResultEntry } from '../components/stable-view/types';
import { getTierName } from './tierHelpers';
import type { ArchivedAccolade, ArchivedRobot } from '@shared/types';

export const ROSTER_MODES: readonly TieredStandingsMode[] = TIERED_STANDINGS_MODES;

export const MODE_SHORT_LABELS: Readonly<Record<TieredStandingsMode, string>> = {
  league_1v1: '1v1',
  league_2v2: '2v2',
  league_3v3: '3v3',
  tag_team: 'Tag',
  koth: 'KotH',
  grand_melee: 'Melee',
};

export const MODE_LONG_LABELS: Readonly<Record<TieredStandingsMode, string>> = {
  league_1v1: 'League 1v1',
  league_2v2: 'League 2v2',
  league_3v3: 'League 3v3',
  tag_team: 'Tag Team',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
};

const BATTLE_TYPE_LABELS: Readonly<Record<string, string>> = {
  ...MODE_LONG_LABELS,
  tournament_1v1: 'Tournament 1v1',
  tournament_2v2: 'Tournament 2v2',
  tournament_3v3: 'Tournament 3v3',
};

/** One mode of a robot's tier strip; `tier` null means it has not played that mode. */
export interface ModeCell {
  mode: TieredStandingsMode;
  tier: string | null;
  /** Record and LP for the cell's tooltip and accessible label. */
  detail: string | null;
}

export interface TierSummary {
  tier: string;
  /** Modes the robot holds that tier in. */
  modeCount: number;
}

function record(wins: number, losses: number, draws: number): string {
  return `${wins}–${losses}–${draws}`;
}

/** "56–39–0 · 130 LP", "14 first places in 50 · 718 LP", prefixed with the team for team modes. */
function standingDetail(s: PublicRobotStanding): string {
  const result = isPlacementMode(s.mode)
    ? `${s.wins} first ${s.wins === 1 ? 'place' : 'places'} in ${s.totalMatches ?? 0}`
    : record(s.wins, s.losses, s.draws);
  const parts = [result, `${s.leaguePoints} LP`];
  return s.teamName ? [`Team ${s.teamName}`, ...parts].join(' · ') : parts.join(' · ');
}

/** The six-mode strip for a live robot. */
export function liveModeCells(standings: readonly PublicRobotStanding[] = []): ModeCell[] {
  return ROSTER_MODES.map((mode) => {
    const standing = standings.find((s) => s.mode === mode);
    return standing
      ? { mode, tier: standing.tier, detail: standingDetail(standing) }
      : { mode, tier: null, detail: null };
  });
}

/**
 * The six-mode strip for an archived robot. Archives keep no match count, so
 * a robot row counts as played when it has a result or LP, and a team row
 * when it has LP or climbed above Bronze; the untouched Bronze row a
 * subscription creates is left out, as on the live page.
 */
export function archivedModeCells(robot: ArchivedRobot): ModeCell[] {
  const best = new Map<string, { tier: string; detail: string; lp: number }>();
  const offer = (mode: string, tier: string, lp: number, detail: string): void => {
    const current = best.get(mode);
    if (!current || tierRank(tier) > tierRank(current.tier) || (tier === current.tier && lp > current.lp)) {
      best.set(mode, { tier, detail, lp });
    }
  };
  for (const s of robot.standings ?? []) {
    if (s.wins + s.losses + s.draws === 0 && s.leaguePoints === 0) continue;
    const result = isPlacementMode(s.mode) ? `${s.wins} first ${s.wins === 1 ? 'place' : 'places'}` : record(s.wins, s.losses, s.draws);
    offer(s.mode, s.tier, s.leaguePoints, `${result} · ${s.leaguePoints} LP · #${s.instanceRank}`);
  }
  for (const team of robot.teams ?? []) {
    for (const m of team.modes) {
      if (m.leaguePoints === 0 && m.tier === 'bronze') continue;
      offer(m.mode, m.tier, m.leaguePoints, `Team ${team.teamName} · ${m.leaguePoints} LP · #${m.instanceRank}`);
    }
  }
  return ROSTER_MODES.map((mode) => {
    const cell = best.get(mode);
    return { mode, tier: cell?.tier ?? null, detail: cell?.detail ?? null };
  });
}

/** Highest tier over the strip and how many modes hold it; null when nothing was played. */
export function tierSummary(cells: readonly ModeCell[]): TierSummary | null {
  let top = -1;
  for (const cell of cells) {
    if (cell.tier !== null) top = Math.max(top, tierRank(cell.tier));
  }
  if (top < 0) return null;
  const tier = cells.find((c) => c.tier !== null && tierRank(c.tier) === top)?.tier ?? null;
  if (tier === null) return null;
  return { tier, modeCount: cells.filter((c) => c.tier === tier).length };
}

/** "Champion ×3"; a single mode needs no count. */
export function tierSummaryLabel(summary: TierSummary): string {
  const name = getTierName(summary.tier);
  return summary.modeCount > 1 ? `${name} ×${summary.modeCount}` : name;
}

/** Robots per highest tier, best tier first; robots that have not played are left out. */
export function tierDistribution(summaries: ReadonlyArray<TierSummary | null>): Array<{ tier: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of summaries) {
    if (s) counts.set(s.tier, (counts.get(s.tier) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier));
}

/** The stable's best tier in each mode over all its robots; null for a mode nobody played. */
export function bestTierPerMode(strips: ReadonlyArray<readonly ModeCell[]>): Array<{ mode: TieredStandingsMode; tier: string | null }> {
  return ROSTER_MODES.map((mode) => {
    let tier: string | null = null;
    for (const strip of strips) {
      const cell = strip.find((c) => c.mode === mode);
      if (cell?.tier && (tier === null || tierRank(cell.tier) > tierRank(tier))) tier = cell.tier;
    }
    return { mode, tier };
  });
}

/** First letter of the tier for the compact strip cell. */
export function tierLetter(tier: string): string {
  return getTierName(tier).charAt(0).toUpperCase();
}

export type RosterSortKey = 'elo' | 'name' | 'tier' | 'fame' | 'kills';
export type SortDirection = 'asc' | 'desc';

export interface RosterRow {
  id: number;
  name: string;
  elo: number;
  fame: number;
  kills: number;
  summary: TierSummary | null;
}

/** Highest tier, then more modes at that tier; robots that have not played sort lowest. */
function tierScore(summary: TierSummary | null): number {
  return summary ? tierRank(summary.tier) * 10 + summary.modeCount : -1;
}

/** Sorted copy; ties fall back to ELO, then name, so the order is stable. */
export function sortRoster<T extends RosterRow>(rows: readonly T[], key: RosterSortKey, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  const value = (row: T): number | string => {
    switch (key) {
      case 'name': return row.name.toLowerCase();
      case 'tier': return tierScore(row.summary);
      case 'fame': return row.fame;
      case 'kills': return row.kills;
      case 'elo': return row.elo;
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const primary = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : Number(va) - Number(vb);
    return sign * primary || b.elo - a.elo || a.name.localeCompare(b.name);
  });
}

/** 1st, 2nd, 3rd, 4th, 11th, 21st… */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function battleTypeLabel(battleType: string): string {
  return BATTLE_TYPE_LABELS[battleType] ?? battleType;
}

/** "1st", "Win", "Loss", "Draw", or an em dash when the outcome is unknown. */
export function resultLabel(entry: RecentResultEntry): string {
  if (entry.placement !== null) return ordinal(entry.placement);
  switch (entry.outcome) {
    case 'win': return 'Win';
    case 'loss': return 'Loss';
    case 'draw': return 'Draw';
    default: return '—';
  }
}

/** A first place or a win reads as a success. */
export function isSuccess(entry: RecentResultEntry): boolean {
  return entry.placement === 1 || entry.outcome === 'win';
}

/** "March 2026". */
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** An archived robot's best finish: its highest tier, then its best rank in that tier. */
export function bestFinish(robot: ArchivedRobot): { tier: string; mode: string; rank: number } | null {
  const finishes = [
    ...(robot.standings ?? [])
      .filter((s) => s.wins + s.losses + s.draws > 0 || s.leaguePoints > 0)
      .map((s) => ({ tier: s.tier, mode: s.mode, rank: s.instanceRank })),
    ...(robot.teams ?? []).flatMap((t) =>
      t.modes
        .filter((m) => m.leaguePoints > 0 || m.tier !== 'bronze')
        .map((m) => ({ tier: m.tier, mode: m.mode, rank: m.instanceRank }))),
  ];
  if (finishes.length === 0) return null;
  return finishes.reduce((best, f) => {
    const byTier = tierRank(f.tier) - tierRank(best.tier);
    return byTier > 0 || (byTier === 0 && f.rank < best.rank) ? f : best;
  });
}

export function modeShortLabel(mode: string): string {
  return (MODE_SHORT_LABELS as Readonly<Record<string, string>>)[mode] ?? mode;
}

/** Teams of an archived season with their members, in first-seen order. */
export function seasonTeams(robots: readonly ArchivedRobot[]): Array<{ teamName: string; teamSize: number; members: string[] }> {
  const teams = new Map<string, { teamName: string; teamSize: number; members: string[] }>();
  for (const robot of robots) {
    for (const team of robot.teams ?? []) {
      const entry = teams.get(team.teamName) ?? { teamName: team.teamName, teamSize: team.teamSize, members: [] };
      if (!entry.members.includes(robot.robotName)) entry.members.push(robot.robotName);
      teams.set(team.teamName, entry);
    }
  }
  return [...teams.values()];
}

/** Hall of Records placements, best rank first, without tournament wins (those are titles). */
export function recordPlacements(accolades: readonly ArchivedAccolade[]): ArchivedAccolade[] {
  return accolades
    .filter((a) => a.category !== 'tournamentChampion')
    .sort((a, b) => a.rank - b.rank || a.category.localeCompare(b.category));
}

/** Tournament wins recorded as accolades ("1v1 Tournament #8" and similar). */
export function tournamentWins(accolades: readonly ArchivedAccolade[]): ArchivedAccolade[] {
  return accolades.filter((a) => a.category === 'tournamentChampion');
}
