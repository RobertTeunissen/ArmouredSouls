/**
 * Hall of Records view model.
 *
 * Turns the `GET /api/records` payload into one uniform list of record
 * definitions (title, scope, ranked rows per mode) so the board, the tiles and
 * the full top-10 view render every record the same way, and finds the places
 * the viewer's stable holds.
 *
 * Pure functions only; the page and components own fetching and rendering.
 */
import {
  DAMAGE_RECORD_MODES,
  WIN_STREAK_MODES,
  type MyPlace,
  type RecordDefinition,
  type RecordGroupKey,
  type RecordHolder,
  type RecordOwner,
  type RecordRobot,
  type RecordRow,
  type RecordsData,
  type RecordVariant,
  type RobotRecordBase,
  type TournamentChampionRecord,
  type DamageRecordMode,
  type WinStreakMode,
} from '../components/hall-of-records/types';
import { PLACEMENT_MODES_RECORD_NOTE } from '../components/PlacementModesRecordNote';
import { formatCurrency } from './formatters';

/** Mirrors the backend `KOTH_AVG_ZONE_SCORE_MIN_MATCHES` (recordsQueryService). */
const KOTH_AVG_ZONE_SCORE_MIN_MATCHES = 10;

/** Mirrors the backend `WIN_RATE_MIN_BATTLES` (recordsQueryService). */
const WIN_RATE_MIN_BATTLES = 50;

export const RECORD_GROUP_LABELS: Record<RecordGroupKey, string> = {
  robots: 'Robots',
  battles: 'Single battles',
  streaks: 'Streaks',
  'koth-melee': 'KotH & Melee',
  stables: 'Stables',
};

/** Heading and one-line note per group on the board. */
export const RECORD_GROUP_HEADINGS: Record<RecordGroupKey, { title: string; note: string }> = {
  robots: { title: 'Robots', note: 'Career counters this season' },
  battles: { title: 'Single battles', note: 'Every record opens its battle report' },
  streaks: { title: 'Streaks', note: 'Wins in a row; a running streak is marked' },
  'koth-melee': { title: 'King of the Hill & Grand Melee', note: 'Placement events' },
  stables: { title: 'Stables', note: 'Whole-stable records' },
};

export const DAMAGE_MODE_LABELS: Record<DamageRecordMode, string> = {
  league_1v1: '1v1 League',
  tournament_1v1: '1v1 Tournament',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
};

export const WIN_STREAK_MODE_LABELS: Record<WinStreakMode, string> = {
  league_1v1: '1v1 League',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  tag_team: 'Tag Team',
};

const TEAM_TOURNAMENT_LABELS: Record<string, string> = {
  tournament_2v2: '2v2 tournament',
  tournament_3v3: '3v3 tournament',
};

// ─── Formatting ─────────────────────────────────────────────────────

/** Whole number with thousands separators ("373,601"). */
export function formatCount(value: number): string {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

/** One decimal with thousands separators ("1,163.1"). */
function formatOneDecimal(value: number): string {
  return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Seconds as "45.0s" under a minute, otherwise "60m 32s". */
export function formatRecordDuration(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  if (safe < 60) return `${safe.toFixed(1)}s`;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}m ${rest}s`;
}

/** "Mar 15, 2026". */
function formatRecordDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}


// ─── Holders and ranks ──────────────────────────────────────────────

function stableRef(owner: RecordOwner | undefined): RecordHolder['stable'] {
  return {
    name: owner?.username || 'Unknown',
    userId: owner?.userId ?? null,
    stableType: owner?.stableType ?? null,
  };
}

function robotEntryHolder(entry: RobotRecordBase): RecordHolder {
  return { subjectName: entry.robotName, robotId: entry.robotId, stable: stableRef(entry) };
}

function robotHolder(robot: RecordRobot): RecordHolder {
  return { subjectName: robot.name, robotId: robot.id, stable: stableRef(robot) };
}

/** A team line-up: the robots' names, owned by the first robot's stable. */
function lineUpHolder(robots: RecordRobot[]): RecordHolder {
  return {
    subjectName: robots.map((r) => r.name).join(', ') || 'Unknown',
    stable: stableRef(robots[0]),
  };
}

function stableHolder(owner: RecordOwner): RecordHolder {
  return { subjectName: null, stable: stableRef(owner) };
}

type UnrankedRow = Omit<RecordRow, 'rank'> & { sortValue: number; place?: number };

/**
 * Assign shared ranks in list order: a row whose value equals the previous
 * row's gets the same rank ("1, 1, 3"). The API already sends rows best first.
 * A players' list (#595) sends each row's place among every stable instead,
 * and that place is the rank.
 */
export function rankRows(rows: UnrankedRow[]): RecordRow[] {
  let rank = 0;
  let previous: number | null = null;
  return rows.map(({ sortValue, place, ...row }, index) => {
    if (previous === null || sortValue !== previous) rank = index + 1;
    previous = sortValue;
    return { ...row, rank: place ?? rank };
  });
}

/** Rows numbered in list order, for logs that are not a ranking. */
function numberRows(rows: Array<Omit<RecordRow, 'rank'>>): RecordRow[] {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function single(rows: RecordRow[]): RecordVariant[] {
  return [{ key: 'all', label: '', rows }];
}

// ─── Catalogue ──────────────────────────────────────────────────────

interface DefinitionInput extends Omit<RecordDefinition, 'ranked'> {
  ranked?: boolean;
}

function definition(input: DefinitionInput): RecordDefinition {
  return {
    ...input,
    ranked: input.ranked ?? true,
    variants: input.variants.filter((variant) => variant.rows.length > 0),
  };
}

function champions(list: TournamentChampionRecord[] | undefined): RecordRow[] {
  return numberRows((list ?? []).map((c) => ({
    value: c.tournamentName,
    holder: {
      subjectName: c.championName,
      ...(c.championRobotId !== undefined ? { robotId: c.championRobotId } : {}),
      stable: { name: c.ownerStableName || 'Unknown', userId: c.ownerUserId ?? null, stableType: c.ownerStableType ?? null },
    },
    detail: [formatRecordDate(c.completedAt), c.memberRobots?.length ? c.memberRobots.join(', ') : null]
      .filter(Boolean)
      .join(' · '),
  })));
}

/**
 * Every Hall of Records record as a uniform definition, in board order.
 * Variants without rows are dropped; a record with no variant left has
 * `variants: []` and is hidden by the board.
 */
export function buildRecordCatalogue(data: RecordsData): RecordDefinition[] {
  const career = data.career ?? { mostBattles: [], highestWinRate: [], mostLifetimeDamage: [], highestElo: [], mostKills: [] };
  const economic = data.economic ?? { highestFame: [], richestStables: [] };
  const prestige = data.prestige ?? { highestPrestige: [], mostTitles: [] };
  const koth = data.koth ?? { mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [], longestWinStreak: [], mostZoneTime: [], zoneDominator: [] };
  const melee = data.grandMelee ?? { mostWins: [], mostKillsCareer: [] };
  const damage = data.combat?.mostDamageInBattle ?? {};
  const streaks = data.winStreaks ?? {};
  const upsets = data.upsets ?? { biggestUpset: [], biggestTeamUpset: [] };

  return [
    // ── Robots ──
    definition({
      key: 'mostBattles', group: 'robots', title: 'Most battles', valueLabel: 'Battles',
      scope: `Battles in every mode, KotH and Grand Melee included. ${PLACEMENT_MODES_RECORD_NOTE}`,
      variants: single(rankRows(career.mostBattles.map((e) => ({
        place: e.place, sortValue: e.allModesBattleCount, value: formatCount(e.allModesBattleCount), holder: robotEntryHolder(e),
        detail: `${e.wins}-${e.losses}-${e.draws} in win/loss modes`,
      })))),
    }),
    definition({
      key: 'highestWinRate', group: 'robots', title: 'Highest win rate', valueLabel: 'Win rate',
      scope: `Wins in 1v1 League, 1v1 Tournament, Tag Team and 2v2/3v3 League, minimum ${WIN_RATE_MIN_BATTLES} battles. KotH and Grand Melee are placement events.`,
      variants: single(rankRows(career.highestWinRate.map((e) => ({
        place: e.place, sortValue: e.winRate, value: `${e.winRate}%`, holder: robotEntryHolder(e),
        detail: `${formatCount(e.wins)} of ${plural(e.totalBattles, 'battle', 'battles')}`,
      })))),
    }),
    definition({
      key: 'highestElo', group: 'robots', title: 'Highest ELO', valueLabel: 'ELO',
      scope: 'ELO is a 1v1 rating, earned in 1v1 League and 1v1 Tournament.',
      variants: single(rankRows(career.highestElo.map((e) => ({
        place: e.place, sortValue: e.elo, value: formatCount(e.elo), holder: robotEntryHolder(e),
        detail: `${e.wins}-${e.losses}-${e.draws} record`,
      })))),
    }),
    definition({
      key: 'mostLifetimeDamage', group: 'robots', title: 'Most lifetime damage', valueLabel: 'Damage',
      scope: 'Damage dealt in every mode, KotH and Grand Melee included.',
      variants: single(rankRows(career.mostLifetimeDamage.map((e) => ({
        place: e.place, sortValue: e.damageDealt, value: formatCount(e.damageDealt), holder: robotEntryHolder(e),
        detail: `${formatCount(e.avgDamagePerBattle)} per battle`,
      })))),
    }),
    definition({
      key: 'mostKills', group: 'robots', title: 'Most destructions', valueLabel: 'Destroyed',
      scope: 'Opponents destroyed in every mode, KotH and Grand Melee included.',
      leaderboard: { href: '/leaderboards/losses', label: 'Destructions Leaderboard' },
      variants: single(rankRows(career.mostKills.map((e) => ({
        place: e.place, sortValue: e.kills, value: formatCount(e.kills), holder: robotEntryHolder(e),
        ...(e.killsPerBattle !== undefined ? { detail: `${e.killsPerBattle.toFixed(2)} per battle` } : {}),
      })))),
    }),
    definition({
      key: 'highestFame', group: 'robots', title: 'Highest fame', valueLabel: 'Fame',
      scope: 'Robot fame.',
      leaderboard: { href: '/leaderboards/fame', label: 'Fame Leaderboard' },
      variants: single(rankRows(economic.highestFame.map((e) => ({
        place: e.place, sortValue: e.fame, value: formatCount(e.fame), holder: robotEntryHolder(e),
        detail: `${formatCount(e.elo)} ELO`,
      })))),
    }),

    // ── Single battles ──
    definition({
      key: 'mostDamageInBattle', group: 'battles', title: 'Most damage in one battle', valueLabel: 'Damage',
      scope: 'Damage one robot dealt in a single battle, ranked per mode.',
      variants: DAMAGE_RECORD_MODES.map((mode) => ({
        key: mode,
        label: DAMAGE_MODE_LABELS[mode],
        rows: rankRows((damage[mode] ?? []).map((e) => ({
          place: e.place, sortValue: e.damageDealt, value: formatCount(e.damageDealt), holder: robotHolder(e.robot),
          detail: e.opponent ? `vs ${e.opponent.name}` : formatRecordDuration(e.durationSeconds),
          battleId: e.battleId,
        }))),
      })),
    }),
    definition({
      key: 'biggestUpset', group: 'battles', title: 'Biggest upset', valueLabel: 'ELO overcome',
      scope: '1v1 tournaments only: league matchmaking pairs robots of similar standing, tournament brackets do not.',
      variants: single(rankRows(upsets.biggestUpset.map((e) => ({
        place: e.place, sortValue: e.eloDifference, value: `+${formatCount(e.eloDifference)} ELO`, holder: robotHolder(e.underdog),
        detail: `${formatCount(e.underdog.eloBefore)} beat ${e.favorite.name} (${formatCount(e.favorite.eloBefore)})`,
        battleId: e.battleId,
      })))),
    }),
    definition({
      key: 'biggestTeamUpset', group: 'battles', title: 'Biggest team upset', valueLabel: 'ELO overcome',
      scope: '2v2 and 3v3 tournaments, from the summed ELO of each side.',
      variants: single(rankRows((upsets.biggestTeamUpset ?? []).map((e) => ({
        place: e.place, sortValue: e.eloDifference, value: `+${formatCount(e.eloDifference)} ELO`, holder: lineUpHolder(e.underdog.robots),
        detail: `${TEAM_TOURNAMENT_LABELS[e.battleType] ?? 'Team tournament'} · beat ${e.favorite.robots[0]?.username || 'Unknown'}`,
        battleId: e.battleId,
      })))),
    }),
    definition({
      key: 'mostDecisiveVictory', group: 'battles', title: 'Most decisive team victory', valueLabel: 'HP margin',
      scope: 'HP left on the winning side minus the losing side at the end of a 2v2 or 3v3 League battle.',
      variants: (['2v2', '3v3'] as const).map((size) => ({
        key: size,
        label: `${size} League`,
        rows: rankRows((data.teamBattle?.[size]?.mostDecisiveVictory ?? []).map((e) => ({
          place: e.place, sortValue: e.hpDifference, value: `${formatCount(e.hpDifference)} HP`, holder: lineUpHolder(e.winners),
          detail: `beat ${e.losers[0]?.username || 'Unknown'}`,
          battleId: e.battleId,
        }))),
      })),
    }),

    // ── Streaks ──
    definition({
      key: 'leagueWinStreak', group: 'streaks', title: 'Longest league win streak', valueLabel: 'Wins in a row',
      scope: 'Wins in a row in league play. A bye counts as a win, as it does for league points.',
      variants: WIN_STREAK_MODES.map((mode) => ({
        key: mode,
        label: WIN_STREAK_MODE_LABELS[mode],
        rows: rankRows((streaks[mode] ?? []).map((e) => {
          const running = e.isActive && e.currentWinStreak > 0;
          return {
            place: e.place, sortValue: e.bestWinStreak, value: formatCount(e.bestWinStreak),
            holder: {
              subjectName: e.entityName,
              ...(mode === 'league_1v1' ? { robotId: e.entityId } : {}),
              stable: stableRef(e),
            },
            detail: running ? 'still running' : `current streak ${e.currentWinStreak}`,
            running,
          };
        })),
      })),
    }),
    definition({
      key: 'kothWinStreak', group: 'streaks', title: 'KotH win streak', valueLabel: 'First places in a row',
      scope: 'First places in a row in King of the Hill; any other finish ends the streak.',
      variants: single(rankRows(koth.longestWinStreak.map((e) => {
        const running = Boolean(e.isActive) && (e.currentWinStreak ?? 0) > 0;
        return {
          place: e.place, sortValue: e.bestWinStreak, value: formatCount(e.bestWinStreak), holder: robotEntryHolder(e),
          detail: running ? 'still running' : `${plural(e.kothWins, 'first place', 'first places')} in total`,
          running,
        };
      }))),
    }),

    // ── KotH & Grand Melee ──
    definition({
      key: 'kothMostWins', group: 'koth-melee', title: 'Most KotH wins', valueLabel: 'First places',
      scope: 'First places in King of the Hill.',
      variants: single(rankRows(koth.mostWins.map((e) => ({
        place: e.place, sortValue: e.kothWins, value: formatCount(e.kothWins), holder: robotEntryHolder(e),
        detail: `in ${plural(e.kothMatches, 'match', 'matches')}`,
      })))),
    }),
    definition({
      key: 'kothAvgZoneScore', group: 'koth-melee', title: 'Highest avg zone score', valueLabel: 'Avg per match',
      scope: `Average zone score per King of the Hill match, minimum ${KOTH_AVG_ZONE_SCORE_MIN_MATCHES} matches.`,
      variants: single(rankRows(koth.highestAvgZoneScore.map((e) => ({
        place: e.place, sortValue: e.avgZoneScore, value: e.avgZoneScore.toFixed(1), holder: robotEntryHolder(e),
        detail: plural(e.kothMatches, 'match', 'matches'),
      })))),
    }),
    definition({
      key: 'kothZoneTime', group: 'koth-melee', title: 'Most zone time', valueLabel: 'Time in zone',
      scope: 'Total time held in the King of the Hill zone.',
      variants: single(rankRows(koth.mostZoneTime.map((e) => ({
        place: e.place, sortValue: e.totalZoneTime, value: formatRecordDuration(e.totalZoneTime), holder: robotEntryHolder(e),
        detail: plural(e.kothMatches, 'match', 'matches'),
      })))),
    }),
    definition({
      key: 'kothZoneDominator', group: 'koth-melee', title: 'Zone dominator', valueLabel: 'Zone score',
      scope: 'Total King of the Hill zone score.',
      variants: single(rankRows(koth.zoneDominator.map((e) => ({
        place: e.place, sortValue: e.totalZoneScore, value: formatOneDecimal(e.totalZoneScore), holder: robotEntryHolder(e),
        detail: plural(e.kothMatches, 'match', 'matches'),
      })))),
    }),
    definition({
      key: 'kothKills', group: 'koth-melee', title: 'KotH destructions', valueLabel: 'Destroyed',
      scope: 'Opponents destroyed in King of the Hill.',
      variants: single(rankRows(koth.mostKillsCareer.map((e) => ({
        place: e.place, sortValue: e.kothKills, value: formatCount(e.kothKills), holder: robotEntryHolder(e),
        detail: `in ${plural(e.kothMatches, 'match', 'matches')}`,
      })))),
    }),
    definition({
      key: 'meleeWins', group: 'koth-melee', title: 'Grand Melee wins', valueLabel: 'First places',
      scope: 'First places in Grand Melee.',
      variants: single(rankRows(melee.mostWins.map((e) => ({
        place: e.place, sortValue: e.grandMeleeWins, value: formatCount(e.grandMeleeWins), holder: robotEntryHolder(e),
      })))),
    }),
    definition({
      key: 'meleeKills', group: 'koth-melee', title: 'Grand Melee destructions', valueLabel: 'Destroyed',
      scope: 'Opponents destroyed in Grand Melee.',
      variants: single(rankRows(melee.mostKillsCareer.map((e) => ({
        place: e.place, sortValue: e.totalKills, value: formatCount(e.totalKills), holder: robotEntryHolder(e),
        detail: `${e.killsPerMatch.toFixed(2)} per match`,
      })))),
    }),

    // ── Stables ──
    definition({
      key: 'highestPrestige', group: 'stables', title: 'Highest prestige', valueLabel: 'Prestige',
      scope: 'Stable prestige.',
      leaderboard: { href: '/leaderboards/prestige', label: 'Prestige Leaderboard' },
      variants: single(rankRows(prestige.highestPrestige.map((e) => ({
        place: e.place, sortValue: e.prestige, value: formatCount(e.prestige), holder: stableHolder(e),
        detail: plural(e.championshipTitles, 'championship title', 'championship titles'),
      })))),
    }),
    definition({
      key: 'mostTitles', group: 'stables', title: 'Most championship titles', valueLabel: 'Titles',
      scope: 'Tournament championships won.',
      variants: single(rankRows(prestige.mostTitles.map((e) => ({
        place: e.place, sortValue: e.championshipTitles, value: formatCount(e.championshipTitles), holder: stableHolder(e),
        detail: `${formatCount(e.prestige)} prestige`,
      })))),
    }),
    definition({
      key: 'richestStable', group: 'stables', title: 'Richest stable', valueLabel: 'Credits',
      scope: 'Credits on hand. Generated bot stables are not ranked: they never spend.',
      variants: single(rankRows(economic.richestStables.map((e) => ({
        place: e.place, sortValue: e.currency, value: formatCurrency(e.currency), holder: stableHolder(e),
        detail: plural(e.robotCount, 'robot', 'robots'),
      })))),
    }),
    definition({
      key: 'tournamentChampions', group: 'stables', title: 'Latest champions', valueLabel: 'Tournament',
      scope: 'The most recent winners of each tournament type, newest first.',
      ranked: false,
      variants: [
        { key: '1v1', label: '1v1', rows: champions(data.tournamentChampions1v1) },
        { key: '2v2', label: '2v2', rows: champions(data.tournamentChampions2v2) },
        { key: '3v3', label: '3v3', rows: champions(data.tournamentChampions3v3) },
      ],
    }),
  ];
}

// ─── Board layout ───────────────────────────────────────────────────

export interface TileFootprint {
  /** Grid columns from `md` up. */
  cols: 1 | 2;
  /** Grid rows from `xl` up. */
  rows: 1 | 2;
}

/**
 * How much of the board grid a record's tile takes. Per-mode records list one
 * line per mode, so they span two columns; with four or more modes they also
 * take two rows on wide screens, so the single tiles beside them keep their
 * own height. The champions log stacks its entries and fits one column.
 */
export function tileFootprint(record: RecordDefinition): TileFootprint {
  if (!record.ranked || record.variants.length <= 1) return { cols: 1, rows: 1 };
  return { cols: 2, rows: record.variants.length >= 4 ? 2 : 1 };
}

/**
 * Grid columns for one group on wide screens: four, unless three leaves fewer
 * empty cells (six robot records fill two rows of three, not one and a half of
 * four).
 */
export function boardColumns(records: RecordDefinition[]): 3 | 4 {
  const cells = records.reduce((sum, record) => {
    const { cols, rows } = tileFootprint(record);
    return sum + cols * rows;
  }, 0);
  const empty = (columns: number): number => (Math.ceil(cells / columns) * columns) - cells;
  return empty(3) < empty(4) ? 3 : 4;
}

// ─── The viewer's places ────────────────────────────────────────────

/** Every row the viewer's stable holds in a ranked record, best rank first. */
export function findMyPlaces(catalogue: RecordDefinition[], userId: number | null | undefined): MyPlace[] {
  if (userId == null) return [];
  const places: MyPlace[] = [];
  for (const record of catalogue) {
    if (!record.ranked) continue;
    for (const variant of record.variants) {
      for (const row of variant.rows) {
        if (row.holder.stable.userId !== userId) continue;
        places.push({
          recordKey: record.key,
          recordTitle: record.title,
          variantKey: variant.key,
          variantLabel: variant.label || null,
          row,
        });
      }
    }
  }
  return places.sort((a, b) => a.row.rank - b.row.rank);
}

/** The viewer's best place in one record (any variant), or null. */
export function bestPlaceIn(record: RecordDefinition, places: MyPlace[]): MyPlace | null {
  return places.find((place) => place.recordKey === record.key) ?? null;
}

export interface MyPlacesSummary {
  /** Records (or record modes) the viewer's stable holds outright. */
  held: MyPlace[];
  /** Top-10 places in total, held records included. */
  placeCount: number;
  /** Best place that is not a held record, when nothing is held. */
  best: MyPlace | null;
}

export function summariseMyPlaces(places: MyPlace[]): MyPlacesSummary {
  // Two of the viewer's robots tied at #1 hold one record (mode), not two.
  const seen = new Set<string>();
  const held = places.filter((place) => {
    if (place.row.rank !== 1) return false;
    const key = `${place.recordKey}\u0000${place.variantKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { held, placeCount: places.length, best: places[0] ?? null };
}
