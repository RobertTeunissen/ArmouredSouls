/**
 * The Hall of Records "Stables" filter (#595): every record either lists the
 * top 10 of all stables, or the top 10 human players' entries with each
 * entry's place among all stables. Filtering never re-ranks; the gaps in the
 * places are Automatons and generated stables.
 *
 * A players' list carries `place` on every entry: the entry's shared rank among
 * all entries (equal values share the place of the first of them, as on the
 * board). An all-stables list carries no `place`; its position is the place.
 */
import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { PLAYER_STABLE } from '../standings/playerStables';

/** Entries per record list, in either filter. */
export const RECORD_LIST_SIZE = 10;

/**
 * Everything a player stable owns, loaded once per build. Players are a small
 * share of the field (15 of 1,130 robots on ACC at the Season 2 start), so the
 * sets are small and membership checks are cheap.
 */
export interface PlayerSets {
  userIds: ReadonlySet<number>;
  robotIds: ReadonlySet<number>;
  teamIds: ReadonlySet<number>;
}

export async function loadPlayerSets(): Promise<PlayerSets> {
  const [users, robots, teams] = await Promise.all([
    prisma.user.findMany({ where: PLAYER_STABLE, select: { id: true } }),
    prisma.robot.findMany({ where: { user: PLAYER_STABLE }, select: { id: true } }),
    prisma.teamBattle.findMany({ where: { stable: PLAYER_STABLE }, select: { id: true } }),
  ]);
  return {
    userIds: new Set(users.map((u) => u.id)),
    robotIds: new Set(robots.map((r) => r.id)),
    teamIds: new Set(teams.map((t) => t.id)),
  };
}

/** A ranked entry and, in a players' list, its place among all entries. */
export interface Placed<T> {
  row: T;
  place?: number;
}

/**
 * The first `limit` player entries of a ranking that holds every entry, best
 * first, each with its shared place among all of them.
 */
export function pickPlayerPlaces<T>(
  ordered: readonly T[],
  value: (row: T) => number,
  isPlayer: (row: T) => boolean,
  limit: number = RECORD_LIST_SIZE,
): Array<Required<Placed<T>>> {
  const picked: Array<Required<Placed<T>>> = [];
  let place = 0;
  let previous: number | null = null;
  for (let index = 0; index < ordered.length && picked.length < limit; index += 1) {
    const row = ordered[index];
    const current = value(row);
    if (previous === null || current !== previous) place = index + 1;
    previous = current;
    if (isPlayer(row)) picked.push({ row, place });
  }
  return picked;
}

/**
 * One record list from a ranking that can be read in full.
 *
 * `fetchRanked(take)` returns the ranking best first: its first `take` rows, or
 * every row when `take` is undefined. All stables: the top 10. Players: the
 * whole ranking is read (robots, stables and standings rows: about a thousand
 * on ACC) and the first 10 player entries keep their place among all.
 */
export async function topPlaced<T>(
  fetchRanked: (take: number | undefined) => Promise<T[]>,
  value: (row: T) => number,
  isPlayer: (row: T, players: PlayerSets) => boolean,
  players: PlayerSets | undefined,
): Promise<Array<Placed<T>>> {
  if (!players) return (await fetchRanked(RECORD_LIST_SIZE)).map((row) => ({ row }));
  return pickPlayerPlaces(await fetchRanked(undefined), value, (row) => isPlayer(row, players));
}

/** `LIMIT take`, or no limit when `take` is undefined (a players' list reads the whole ranking). */
export function limitClause(take: number | undefined): Prisma.Sql {
  return take === undefined ? Prisma.empty : Prisma.sql`LIMIT ${take}`;
}

/** `{ place }` for a players' list entry; nothing for an all-stables entry. */
export function placeField(place: number | undefined): { place?: number } {
  return place === undefined ? {} : { place };
}

/** The rows of `rows` in the order of `ids` (rows loaded by id come back unordered). */
export function inIdOrder<T extends { id: number }>(ids: readonly number[], rows: readonly T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/**
 * One raw-SQL ranking, cut to a record list.
 *
 * `ranking` selects every entry with a numeric `rank_value` column, a unique
 * `tiebreak` column (ascending) and the entry holder's `owner_user_id`. All
 * stables: its top 10. Players: the top 10 entries held by a player stable,
 * each with `place`, the shared rank on `rank_value` among every entry. Used for the
 * battle records, whose universe is every battle (no in-memory pass).
 */
export function cutRanking(ranking: Prisma.Sql, players: PlayerSets | undefined): Prisma.Sql {
  if (!players) {
    return Prisma.sql`
      SELECT ranked.* FROM (${ranking}) ranked
      ORDER BY ranked.rank_value DESC, ranked.tiebreak ASC
      LIMIT ${RECORD_LIST_SIZE}
    `;
  }
  return Prisma.sql`
    SELECT placed.* FROM (
      SELECT ranked.*, (RANK() OVER (ORDER BY ranked.rank_value DESC))::int AS place
      FROM (${ranking}) ranked
    ) placed
    JOIN users u ON u.id = placed.owner_user_id
    WHERE u.stable_type = 'human' AND u.is_generated = false
    ORDER BY placed.rank_value DESC, placed.tiebreak ASC
    LIMIT ${RECORD_LIST_SIZE}
  `;
}
