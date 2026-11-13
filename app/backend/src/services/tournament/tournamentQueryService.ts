/**
 * Read models for the player tournament routes (`GET /api/tournaments`,
 * `GET /api/tournaments/:id`). These queries used to live inline in
 * `routes/tournaments.ts`; the response shapes are unchanged.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { Prisma } from '../../../generated/prisma';
import { TournamentError, TournamentErrorCode } from '../../errors';
import { computeSeedings } from './tournamentBracket';
import { resolveParticipantsBatch } from './tournamentParticipantResolver';

export type TournamentParticipantType = 'robot' | 'team_2v2' | 'team_3v3';

export interface TournamentListFilters {
  status?: string;
  participantType?: TournamentParticipantType;
}

export interface TournamentWinnerView {
  id: number;
  name: string;
  /** Robot winners only, and only in the detail view (unchanged response shape). */
  elo?: number;
  user?: { id: number; username: string; stableName: string | null };
}

const LIST_LIMIT = 20;
const MATCH_ORDER: Prisma.ScheduledTournamentMatchOrderByWithRelationInput[] = [{ round: 'asc' }, { matchNumber: 'asc' }];

function isTeamType(participantType: string): boolean {
  return participantType === 'team_2v2' || participantType === 'team_3v3';
}

/**
 * Winners of robot and team tournaments in two batched reads (robot and team
 * ids may collide, so they are keyed by kind).
 */
async function loadWinners(
  tournaments: ReadonlyArray<{ winnerId: number | null; participantType: string }>,
): Promise<{ robots: Map<number, TournamentWinnerView>; teams: Map<number, TournamentWinnerView> }> {
  const robotIds = new Set<number>();
  const teamIds = new Set<number>();
  for (const t of tournaments) {
    if (t.winnerId === null) continue;
    if (t.participantType === 'robot') robotIds.add(t.winnerId);
    else if (isTeamType(t.participantType)) teamIds.add(t.winnerId);
  }
  const [robots, teams] = await Promise.all([
    robotIds.size > 0
      ? prisma.robot.findMany({
          where: { id: { in: [...robotIds] } },
          select: { id: true, name: true, elo: true, user: { select: { id: true, username: true, stableName: true } } },
        })
      : [],
    teamIds.size > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: [...teamIds] } },
          select: { id: true, teamName: true, stable: { select: { id: true, username: true, stableName: true } } },
        })
      : [],
  ]);
  return {
    robots: new Map(robots.map((r) => [r.id, { id: r.id, name: r.name, elo: r.elo, user: r.user }])),
    teams: new Map(teams.map((t) => [t.id, {
      id: t.id,
      name: t.teamName,
      user: t.stable ? { id: t.stable.id, username: t.stable.username, stableName: t.stable.stableName } : undefined,
    }])),
  };
}

function winnerOf(
  tournament: { winnerId: number | null; participantType: string },
  winners: { robots: Map<number, TournamentWinnerView>; teams: Map<number, TournamentWinnerView> },
): TournamentWinnerView | null {
  if (tournament.winnerId === null) return null;
  if (tournament.participantType === 'robot') return winners.robots.get(tournament.winnerId) ?? null;
  if (isTeamType(tournament.participantType)) return winners.teams.get(tournament.winnerId) ?? null;
  return null;
}

/** The list view never carried the robot winner's ELO. */
function withoutElo(winner: TournamentWinnerView | null): TournamentWinnerView | null {
  if (!winner) return null;
  const { elo: _elo, ...rest } = winner;
  return rest;
}

/**
 * The 20 newest tournaments (`status=active|pending` means both), each with
 * its bracket rows (all of them for running ones, the first 50 otherwise), its
 * winner once completed, and the names of every bracket participant keyed
 * `robot:<id>` / `team:<id>`.
 */
export async function listTournamentsForPlayers(filters: TournamentListFilters) {
  const { status, participantType } = filters;
  const running = status === 'active' || status === 'pending';
  const where: Prisma.TournamentWhereInput = {};
  if (running) where.status = { in: ['active', 'pending'] };
  else if (status) where.status = status;
  if (participantType) where.participantType = participantType;

  const tournaments = await prisma.tournament.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: { matches: running ? { orderBy: MATCH_ORDER } : { orderBy: MATCH_ORDER, take: 50 } },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
  });

  const completed = tournaments.filter((t) => t.status === 'completed');
  const winners = await loadWinners(completed);
  const tournamentsWithWinners = tournaments.map((tournament) => ({
    ...tournament,
    winner: tournament.status === 'completed' ? withoutElo(winnerOf(tournament, winners)) : null,
  }));

  const participantIds = new Set<number>();
  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (match.participant1Id) participantIds.add(match.participant1Id);
      if (match.participant2Id) participantIds.add(match.participant2Id);
    }
  }

  const participantNames: Record<string, string> = {};
  if (participantIds.size > 0) {
    const ids = [...participantIds];
    const [robots, teams] = await Promise.all([
      tournaments.some((t) => t.participantType === 'robot')
        ? prisma.robot.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
        : [],
      tournaments.some((t) => isTeamType(t.participantType))
        ? prisma.teamBattle.findMany({ where: { id: { in: ids } }, select: { id: true, teamName: true } })
        : [],
    ]);
    for (const r of robots) participantNames[`robot:${r.id}`] = r.name;
    for (const t of teams) participantNames[`team:${t.id}`] = t.teamName;
  }

  return { tournaments: tournamentsWithWinners, participantNames };
}

type ResolvedParticipantMap = Record<number, Awaited<ReturnType<typeof resolveParticipantsBatch>> extends Map<number, infer V> ? V : never>;

/**
 * One tournament with all bracket rows, its seedings (empty when they cannot be
 * computed), its winner and every participant resolved for display. Seeding
 * and participant failures are logged and degrade to empty values; a missing
 * tournament is a 404.
 */
export async function getTournamentDetailView(tournamentId: number) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { matches: { orderBy: MATCH_ORDER } },
  });
  if (!tournament) {
    throw new TournamentError(TournamentErrorCode.TOURNAMENT_NOT_FOUND, 'Tournament not found', 404);
  }

  let seedings: ReturnType<typeof computeSeedings> = [];
  try {
    seedings = await computeTournamentSeedings(tournament);
  } catch (seedError) {
    logger.error(`[Tournaments] Failed to compute seedings for tournament ${tournamentId}:`, seedError);
  }

  const winner = tournament.winnerId !== null ? winnerOf(tournament, await loadWinners([tournament])) : null;

  let resolvedParticipants: ResolvedParticipantMap = {};
  const participantIds = new Set<number>();
  for (const m of tournament.matches) {
    if (m.participant1Id) participantIds.add(m.participant1Id);
    if (m.participant2Id) participantIds.add(m.participant2Id);
  }
  if (participantIds.size > 0) {
    try {
      const resolved = await resolveParticipantsBatch([...participantIds], tournament.participantType as TournamentParticipantType);
      resolvedParticipants = Object.fromEntries(resolved);
    } catch (resolveErr) {
      logger.error(`[Tournaments] Failed to resolve participants for tournament ${tournamentId}:`, resolveErr);
    }
  }

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      tournamentType: tournament.tournamentType,
      participantType: tournament.participantType,
      status: tournament.status,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
      totalParticipants: tournament.totalParticipants,
      winnerId: tournament.winnerId,
      createdAt: tournament.createdAt,
      startedAt: tournament.startedAt,
      completedAt: tournament.completedAt,
      winner,
      matches: tournament.matches,
      resolvedParticipants,
    },
    seedings,
  };
}

async function computeTournamentSeedings(tournament: {
  participantType: string;
  maxRounds: number;
  matches: ReadonlyArray<{ round: number; matchNumber: number; participant1Id: number | null; participant2Id: number | null; winnerId: number | null; status: string }>;
}): Promise<ReturnType<typeof computeSeedings>> {
  const round1MatchesRaw = tournament.matches
    .filter((m) => m.round === 1)
    .sort((a, b) => a.matchNumber - b.matchNumber);
  const participantIds = round1MatchesRaw
    .flatMap((m) => [m.participant1Id, m.participant2Id])
    .filter((id): id is number => id !== null);

  let participantMap: Map<number, { id: number; name: string; elo: number }>;
  if (tournament.participantType === 'robot') {
    const robots = participantIds.length > 0
      ? await prisma.robot.findMany({ where: { id: { in: participantIds } }, select: { id: true, name: true, elo: true } })
      : [];
    participantMap = new Map(robots.map((r) => [r.id, r]));
  } else {
    // Team tournaments: a team's seeding ELO is its members' combined ELO.
    const teams = participantIds.length > 0
      ? await prisma.teamBattle.findMany({
          where: { id: { in: participantIds } },
          include: { members: { include: { robot: { select: { elo: true } } } } },
        })
      : [];
    participantMap = new Map(teams.map((t) => [t.id, {
      id: t.id,
      name: t.teamName,
      elo: t.members.reduce((sum, m) => sum + m.robot.elo, 0),
    }]));
  }

  const round1Matches = round1MatchesRaw.map((m) => ({
    matchNumber: m.matchNumber,
    participant1Id: m.participant1Id,
    participant2Id: m.participant2Id,
    robot1: m.participant1Id ? participantMap.get(m.participant1Id) ?? null : null,
    robot2: m.participant2Id ? participantMap.get(m.participant2Id) ?? null : null,
  }));

  const bracketSize = Math.pow(2, tournament.maxRounds);
  // Pass every match: computeSeedings owns the terminal-status rule
  // (completed, forfeit and cancelled eliminate; queued rows are ignored).
  const completedMatches = tournament.matches.map((m) => ({
    winnerId: m.winnerId,
    participant1Id: m.participant1Id,
    participant2Id: m.participant2Id,
    status: m.status,
  }));
  return computeSeedings(round1Matches, bracketSize, completedMatches);
}
