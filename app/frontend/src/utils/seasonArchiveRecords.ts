/**
 * Season Archive records in the Hall of Records shape.
 *
 * A completed season's records are the accolades captured at rollover (one row
 * per category, mode and rank). This turns them into the same record
 * definitions the Hall of Records builds from the live API, so the archive
 * renders them with the same tiles and top-10 list.
 *
 * Accolades keep no robot or stable id (the rows outlive the purge), so names
 * do not link, except the viewer's own stable, which is matched on its name the
 * way the archive always has and links to the viewer's stable page.
 */
import type { SeasonDetail } from './seasonApi';
import { categoryLabel } from './seasonFormat';
import { formatCurrency } from './formatters';
import {
  DAMAGE_MODE_LABELS,
  WIN_STREAK_MODE_LABELS,
  formatCount,
  formatRecordDuration,
} from './hallOfRecords';
import type {
  DamageRecordMode,
  RecordDefinition,
  RecordGroupKey,
  RecordRow,
  WinStreakMode,
} from '../components/hall-of-records/types';
import type { StableType } from '../types/stable';

type ArchivedRecord = SeasonDetail['accolades'][number];

interface CategoryMeta {
  /** Record key shared with the live Hall of Records where one exists. */
  key: string;
  group: RecordGroupKey;
  title: string;
  valueLabel: string;
  format: (value: number) => string;
  /** Stable records name no robot or team. */
  stableSubject?: boolean;
  /** A log, not a ranking (tournament champions). */
  log?: boolean;
}

const oneDecimal = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Archived categories in board order. Narrowest Victory and Grand Melee LP were
 * removed from the live Hall in Nov 2026 but stay readable for the seasons that
 * captured them.
 */
const CATEGORIES: Array<[string, CategoryMeta]> = [
  ['mostBattles', { key: 'mostBattles', group: 'robots', title: 'Most battles', valueLabel: 'Battles', format: formatCount }],
  ['highestWinRate', { key: 'highestWinRate', group: 'robots', title: 'Highest win rate', valueLabel: 'Win rate', format: (v) => `${v}%` }],
  ['highestElo', { key: 'highestElo', group: 'robots', title: 'Highest ELO', valueLabel: 'ELO', format: formatCount }],
  ['mostLifetimeDamage', { key: 'mostLifetimeDamage', group: 'robots', title: 'Most lifetime damage', valueLabel: 'Damage', format: formatCount }],
  ['mostKills', { key: 'mostKills', group: 'robots', title: 'Most destructions', valueLabel: 'Destroyed', format: formatCount }],
  ['highestFame', { key: 'highestFame', group: 'robots', title: 'Highest fame', valueLabel: 'Fame', format: formatCount }],
  ['mostDamageInBattle', { key: 'mostDamageInBattle', group: 'battles', title: 'Most damage in one battle', valueLabel: 'Damage', format: formatCount }],
  ['biggestUpset', { key: 'biggestUpset', group: 'battles', title: 'Biggest upset', valueLabel: 'ELO overcome', format: (v) => `+${formatCount(v)} ELO` }],
  ['narrowestVictory', { key: 'narrowestVictory', group: 'battles', title: 'Narrowest victory', valueLabel: 'HP left', format: (v) => `${formatCount(v)} HP` }],
  ['longestWinStreak', { key: 'leagueWinStreak', group: 'streaks', title: 'Longest league win streak', valueLabel: 'Wins in a row', format: formatCount }],
  ['kothLongestWinStreak', { key: 'kothWinStreak', group: 'streaks', title: 'KotH win streak', valueLabel: 'First places in a row', format: formatCount }],
  ['kothMostWins', { key: 'kothMostWins', group: 'koth-melee', title: 'Most KotH wins', valueLabel: 'First places', format: formatCount }],
  ['kothAvgZoneScore', { key: 'kothAvgZoneScore', group: 'koth-melee', title: 'Highest avg zone score', valueLabel: 'Avg per match', format: (v) => v.toFixed(1) }],
  ['kothMostZoneTime', { key: 'kothZoneTime', group: 'koth-melee', title: 'Most zone time', valueLabel: 'Time in zone', format: formatRecordDuration }],
  ['kothZoneDominator', { key: 'kothZoneDominator', group: 'koth-melee', title: 'Zone dominator', valueLabel: 'Zone score', format: oneDecimal }],
  ['kothMostKills', { key: 'kothKills', group: 'koth-melee', title: 'KotH destructions', valueLabel: 'Destroyed', format: formatCount }],
  ['grandMeleeMostWins', { key: 'meleeWins', group: 'koth-melee', title: 'Grand Melee wins', valueLabel: 'First places', format: formatCount }],
  ['grandMeleeHighestLp', { key: 'meleeLp', group: 'koth-melee', title: 'Grand Melee LP', valueLabel: 'LP', format: formatCount }],
  ['grandMeleeMostKills', { key: 'meleeKills', group: 'koth-melee', title: 'Grand Melee destructions', valueLabel: 'Destroyed', format: formatCount }],
  ['highestPrestige', { key: 'highestPrestige', group: 'stables', title: 'Highest prestige', valueLabel: 'Prestige', format: formatCount, stableSubject: true }],
  ['mostTitles', { key: 'mostTitles', group: 'stables', title: 'Most championship titles', valueLabel: 'Titles', format: formatCount, stableSubject: true }],
  ['richestStable', { key: 'richestStable', group: 'stables', title: 'Richest stable', valueLabel: 'Credits', format: formatCurrency, stableSubject: true }],
  ['tournamentChampion', { key: 'tournamentChampions', group: 'stables', title: 'Champions', valueLabel: 'Tournament', format: formatCount, log: true }],
];

const CATEGORY_ORDER = new Map(CATEGORIES.map(([category], index) => [category, index]));
const CATEGORY_META = new Map(CATEGORIES);

const TOURNAMENT_LABELS: Record<string, string> = {
  tournament_1v1: '1v1',
  tournament_2v2: '2v2',
  tournament_3v3: '3v3',
};

function variantLabel(category: string, mode: string | null): string {
  if (!mode) return '';
  if (category === 'mostDamageInBattle') return DAMAGE_MODE_LABELS[mode as DamageRecordMode] ?? mode;
  if (category === 'longestWinStreak') return WIN_STREAK_MODE_LABELS[mode as WinStreakMode] ?? mode;
  if (category === 'tournamentChampion') return TOURNAMENT_LABELS[mode] ?? mode;
  // Single-mode categories (KotH, Grand Melee, 1v1 tournament upsets) need no switcher label.
  return '';
}

/** Categories whose mode splits the record into per-mode lists. */
const PER_MODE = new Set(['mostDamageInBattle', 'longestWinStreak', 'tournamentChampion']);

function stableTypeOf(row: ArchivedRecord): StableType {
  return row.subjectStableType ?? (row.isGeneratedSubject ? 'generated' : 'human');
}

export interface ArchiveViewer {
  /** The viewer's stable name as archived rows carry it. */
  stableName: string | null;
  userId: number | null;
}

/**
 * One season's records as Hall of Records definitions, in board order. The
 * viewer's own rows carry the viewer's id, so "You" places and highlights work
 * the same as on the live board.
 */
export function archiveRecordCatalogue(records: ArchivedRecord[], viewer: ArchiveViewer): RecordDefinition[] {
  const byRecord = new Map<string, Map<string, RecordRow[]>>();

  for (const row of records) {
    const variantKey = PER_MODE.has(row.category) ? (row.mode ?? 'all') : 'all';
    const lists = byRecord.get(row.category) ?? new Map<string, RecordRow[]>();
    byRecord.set(row.category, lists);
    const meta = CATEGORY_META.get(row.category);
    const mine = viewer.stableName != null && viewer.userId != null && !row.isGeneratedSubject && row.stableName === viewer.stableName;
    const list = lists.get(variantKey) ?? [];
    lists.set(variantKey, list);
    list.push({
      rank: row.rank,
      // A champions log carries the tournament name in the label and no metric.
      value: meta?.log ? row.valueLabel : meta ? meta.format(row.value) : `${formatCount(row.value)} ${row.valueLabel}`,
      holder: {
        subjectName: meta?.stableSubject ? null : row.subjectName,
        stable: { name: row.stableName || 'Unknown', userId: mine ? viewer.userId : null, stableType: stableTypeOf(row) },
      },
    });
  }

  const categories = [...byRecord.keys()].sort(
    (a, b) => (CATEGORY_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) - (CATEGORY_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER),
  );

  return categories.map((category) => {
    const meta = CATEGORY_META.get(category);
    const lists = byRecord.get(category)!;
    const modeOrder = category === 'mostDamageInBattle' ? Object.keys(DAMAGE_MODE_LABELS)
      : category === 'longestWinStreak' ? Object.keys(WIN_STREAK_MODE_LABELS)
        : Object.keys(TOURNAMENT_LABELS);
    const variantKeys = [...lists.keys()].sort((a, b) => {
      const ia = modeOrder.indexOf(a);
      const ib = modeOrder.indexOf(b);
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
    });
    return {
      key: meta?.key ?? category,
      group: meta?.group ?? 'robots',
      title: meta?.title ?? categoryLabel(category).label,
      scope: 'Final placings, captured when the season ended.',
      valueLabel: meta?.valueLabel ?? 'Value',
      ranked: !meta?.log,
      variants: variantKeys.map((key) => {
        const sample = records.find((r) => r.category === category && (r.mode ?? 'all') === key);
        return {
          key,
          label: variantLabel(category, sample?.mode ?? null),
          rows: [...lists.get(key)!].sort((a, b) => a.rank - b.rank),
        };
      }),
    };
  });
}
