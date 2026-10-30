/**
 * Pure assembly of the admin Tournaments overview: the running tournament of
 * each type with its schedule state, and this season's completed tournaments.
 *
 * @module services/admin/tournaments/tournamentOverview
 */

import { parseDailyCron } from '../../cycle/schedulerMissedRuns';
import {
  TOURNAMENT_DOMINANCE_MIN_COMPLETED,
  TOURNAMENT_DOMINANCE_SHARE,
  TOURNAMENT_STALLED_AFTER_MS,
} from '../adminThresholds';
import {
  TOURNAMENT_TYPES,
  type ChampionStable,
  type CurrentTournament,
  type MatchGroupRow,
  type TournamentOverview,
  type TournamentRow,
  type TournamentType,
  type TournamentTypeSeason,
} from './tournamentOverviewTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_CHAMPIONS = 5;
const DONE_STATUSES: ReadonlySet<string> = new Set(['completed', 'forfeit']);
const OPEN_STATUSES: ReadonlySet<string> = new Set(['pending', 'scheduled']);

/** "Final", "Semi-finals", "Quarter-finals" or "Round of N" for a single-elimination round. */
export function stageName(round: number, maxRounds: number): string {
  const matches = 2 ** Math.max(0, maxRounds - round);
  if (matches === 1) return 'Final';
  if (matches === 2) return 'Semi-finals';
  if (matches === 4) return 'Quarter-finals';
  return `Round of ${matches * 2}`;
}

/** Next UTC occurrence of a daily cron strictly after `now`, or null. */
export function nextDailyRun(schedule: string, now: Date): Date | null {
  const time = parseDailyCron(schedule);
  if (!time) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), time.hour, time.minute);
  return new Date(today > now.getTime() ? today : today + DAY_MS);
}

function jobTime(schedule: string): string | null {
  const time = parseDailyCron(schedule);
  if (!time) return null;
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function buildCurrent(
  row: TournamentRow,
  groups: readonly MatchGroupRow[],
  schedule: string,
  now: Date,
  seasonPhase: string | null,
): CurrentTournament {
  let currentMatches = 0;
  let currentDone = 0;
  let firstMatches = 0;
  let firstByes = 0;
  let leftBehind = 0;
  let lastCompleted: number | null = null;
  for (const group of groups) {
    if (group.round === row.currentRound) {
      currentMatches += group.count;
      if (DONE_STATUSES.has(group.status)) currentDone += group.count;
    }
    if (group.round === 1) {
      firstMatches += group.count;
      if (group.isBye) firstByes += group.count;
    }
    if (group.round < row.currentRound && OPEN_STATUSES.has(group.status)) leftBehind += group.count;
    if (group.lastCompletedAt) lastCompleted = Math.max(lastCompleted ?? 0, group.lastCompletedAt.getTime());
  }

  const lastProgress = lastCompleted ?? row.startedAt?.getTime() ?? row.createdAt.getTime();
  const reasons: CurrentTournament['status']['reasons'] = [];
  if (seasonPhase !== null && seasonPhase !== 'competitive') {
    reasons.push('paused');
  } else {
    if (now.getTime() - lastProgress > TOURNAMENT_STALLED_AFTER_MS) reasons.push('stalled');
    if (leftBehind > 0) reasons.push('left_behind');
  }
  const level: CurrentTournament['status']['level'] = reasons.includes('paused')
    ? 'info'
    : reasons.length > 0 ? 'warning' : 'ok';

  const nextRun = nextDailyRun(schedule, now);
  const roundsLeft = Math.max(0, row.maxRounds - row.currentRound);
  const finish = nextRun ? new Date(nextRun.getTime() + roundsLeft * DAY_MS) : null;

  return {
    id: row.id,
    name: row.name,
    round: row.currentRound,
    maxRounds: row.maxRounds,
    stage: stageName(row.currentRound, row.maxRounds),
    participants: row.totalParticipants,
    startedAt: toIso(row.startedAt),
    expectedFinish: finish ? finish.toISOString().slice(0, 10) : null,
    nextRunAt: toIso(nextRun),
    currentRound: { matches: currentMatches, done: currentDone },
    firstRound: { matches: firstMatches, byes: firstByes },
    leftBehind,
    lastProgressAt: new Date(lastProgress).toISOString(),
    status: { level, reasons },
  };
}

function buildSeason(rows: readonly TournamentRow[], current: TournamentRow | null): TournamentTypeSeason {
  const completed = rows.filter((row) => row.status === 'completed');
  const byStable = new Map<string, ChampionStable>();
  const byType = { human: 0, automaton: 0, generated: 0, unknown: 0 };
  for (const row of completed) {
    const champion = row.champion;
    const kind = champion?.stableType ?? 'unknown';
    byType[kind] += 1;
    if (!champion) continue;
    const key = champion.stableId === null ? `unknown:${champion.id}` : String(champion.stableId);
    const entry = byStable.get(key) ?? { stableId: champion.stableId, stableName: champion.stableName, titles: 0 };
    entry.titles += 1;
    byStable.set(key, entry);
  }
  const championStables = [...byStable.values()]
    .sort((a, b) => (b.titles - a.titles) || (a.stableName ?? '').localeCompare(b.stableName ?? ''));
  const top = championStables[0] ?? null;
  const dominantStable = top
    && completed.length >= TOURNAMENT_DOMINANCE_MIN_COMPLETED
    && top.titles / completed.length > TOURNAMENT_DOMINANCE_SHARE
    ? top
    : null;

  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const recent = [...completed]
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, RECENT_CHAMPIONS);

  return {
    completed: completed.length,
    averageDays: completed.length > 0
      ? Math.round((completed.reduce((sum, row) => sum + row.maxRounds, 0) / completed.length) * 10) / 10
      : null,
    sizes: ordered.map((row) => ({ tournamentId: row.id, participants: row.totalParticipants, current: row.id === current?.id })),
    championsByStableType: byType,
    championStables,
    recentChampions: recent.map((row) => ({
      tournamentId: row.id,
      name: row.name,
      completedAt: toIso(row.completedAt),
      champion: row.champion?.name ?? null,
      stableId: row.champion?.stableId ?? null,
      stableName: row.champion?.stableName ?? null,
      stableType: row.champion?.stableType ?? null,
    })),
    dominantStable,
  };
}

export interface TournamentOverviewInput {
  tournaments: readonly TournamentRow[];
  matchGroups: readonly MatchGroupRow[];
  schedules: Readonly<Record<TournamentType, string>>;
  seasonPhase: string | null;
  now: Date;
}

/** Build the overview: one entry per type in fixed order. */
export function buildTournamentOverview(input: TournamentOverviewInput): TournamentOverview {
  const { tournaments, matchGroups, schedules, seasonPhase, now } = input;
  return {
    generatedAt: now.toISOString(),
    seasonPhase,
    thresholds: {
      stalledAfterHours: TOURNAMENT_STALLED_AFTER_MS / (60 * 60 * 1000),
      dominanceShare: TOURNAMENT_DOMINANCE_SHARE,
      dominanceMinCompleted: TOURNAMENT_DOMINANCE_MIN_COMPLETED,
    },
    types: TOURNAMENT_TYPES.map((type) => {
      const rows = tournaments.filter((row) => row.type === type);
      // The newest tournament that is not completed (one runs per type at a time).
      const running = rows
        .filter((row) => row.status !== 'completed')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
      return {
        type,
        jobTime: jobTime(schedules[type]),
        current: running
          ? buildCurrent(running, matchGroups.filter((group) => group.tournamentId === running.id), schedules[type], now, seasonPhase)
          : null,
        season: buildSeason(rows, running),
      };
    }),
  };
}
