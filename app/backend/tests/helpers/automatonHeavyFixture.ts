/**
 * Spec #55 task 12.1, changed by Spec #57 R5.4 (design D18) — the heavy-test
 * population and the bulk data the heavy simulation needs.
 *
 * Population: every Catalogue_Entry of the repository Automaton_Catalogue
 * (`app/backend/prisma/automaton-catalogue/`), the Starter_Stables plus the
 * Expansion_Stables, whatever their number. There is no fixed population size
 * and there are no generated entries; the heavy test's duration grows with
 * the catalogue. `STARTER_CATALOGUE_KEYS` stays for the starter checks.
 *
 * Only tests use this.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../../src/lib/prisma';
import {
  CATALOGUE_DIRECTORY,
  catalogueEntryShape,
  compareCatalogueKeys,
  type CatalogueEntry,
} from '../../src/services/automaton/automatonCatalogueService';

/** The starter stables (spec-55 review/CATALOGUE.md §3–§13), fixed by decision 39. */
export const STARTER_CATALOGUE_KEYS = [
  'clone-legion',
  'dalek-empire',
  'robocop-precinct',
  'skynet-terminators',
  'jaeger-corps',
  'light-labs',
  'decepticon-armada',
  'white-base',
  'planet-express',
  'world-robot-boxing',
  'autobots-ark',
] as const;

export const HEAVY_STRATEGY_KEYS = ['swarm', 'paragon', 'duo', 'trio', 'tycoon', 'generalist'] as const;

/**
 * ACC battle volume for the Strategy_Comparison timing (R11.14). No measured
 * ACC battle count exists in the repository, so it is derived: the `battles`
 * table grows by ~85 MB/day on ACC (docs/guides/operations/MAINTENANCE.md),
 * and a stored `battle_log` averages ~112 KB (`avg(pg_column_size(battle_log))`
 * over the local dev database, 992 battles), i.e. ~760 battles/day; rounded up
 * to 1,000. One full season is the configured default of 100 cycles
 * (`SEASON_LENGTH_CYCLES`), not the shortened test season.
 */
export const ACC_DAILY_BATTLES = 1_000;
export const FULL_SEASON_CYCLES = 100;

/** Battle-type mix per 100 battles, with participants per battle (local dev distribution plus the team modes). */
const BATTLE_MIX: readonly { battleType: string; share: number; sideSize: number; freeForAll?: number }[] = [
  { battleType: 'league_1v1', share: 35, sideSize: 1 },
  { battleType: 'tournament_1v1', share: 12, sideSize: 1 },
  { battleType: 'league_2v2', share: 10, sideSize: 2 },
  { battleType: 'tournament_2v2', share: 4, sideSize: 2 },
  { battleType: 'tag_team', share: 10, sideSize: 2 },
  { battleType: 'league_3v3', share: 8, sideSize: 3 },
  { battleType: 'tournament_3v3', share: 3, sideSize: 3 },
  { battleType: 'koth', share: 10, sideSize: 0, freeForAll: 6 },
  { battleType: 'grand_melee', share: 8, sideSize: 0, freeForAll: 8 },
];

/** The starter entries, read by Catalogue_Key from the repository catalogue (structure checked; context rules run in Catalogue_Sync). */
export function loadStarterEntries(directory: string = CATALOGUE_DIRECTORY): CatalogueEntry[] {
  return STARTER_CATALOGUE_KEYS.map((key) => {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(directory, `${key}.json`), 'utf8'));
    return catalogueEntryShape.parse(raw);
  });
}

/**
 * Every Catalogue_Entry of the repository catalogue (Spec #57 R5.4), sorted by
 * Catalogue_Key (structure checked; context rules run in Catalogue_Sync).
 */
export function loadRepositoryEntries(directory: string = CATALOGUE_DIRECTORY): CatalogueEntry[] {
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const raw: unknown = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      return catalogueEntryShape.parse(raw);
    })
    .sort((a, b) => compareCatalogueKeys(a.catalogueKey, b.catalogueKey));
}

/**
 * Delete stables and everything they own, in batches. Mirrors
 * `deleteGeneratedStables`: standings have no FK, and battle participants
 * and team members reference robots through RESTRICT keys, so they go
 * first; Automaton_Profiles (RESTRICT on the user) go before the users; the
 * rest cascades from `users`.
 */
export async function deleteStables(userIds: readonly number[]): Promise<void> {
  const BATCH = 25;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH);
    await prisma.$transaction(async (tx) => {
      const robotIds = (await tx.robot.findMany({ where: { userId: { in: batch } }, select: { id: true } })).map((r) => r.id);
      const teamIds = (await tx.teamBattle.findMany({ where: { stableId: { in: batch } }, select: { id: true } })).map((t) => t.id);
      if (robotIds.length > 0) {
        await tx.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
        await tx.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
        await tx.teamBattleMember.deleteMany({ where: { robotId: { in: robotIds } } });
      }
      if (teamIds.length > 0) await tx.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
      await tx.automatonProfile.deleteMany({ where: { userId: { in: batch } } });
      await tx.user.deleteMany({ where: { id: { in: batch } } });
    }, { timeout: 120_000 });
  }
}

/** Remove the profiles (and their users) of the given Catalogue_Keys, e.g. leftovers of an aborted run. */
export async function deletePopulation(catalogueKeys: readonly string[]): Promise<void> {
  const profiles = await prisma.automatonProfile.findMany({ where: { catalogueKey: { in: [...catalogueKeys] } }, select: { userId: true } });
  await deleteStables(profiles.flatMap((p) => (p.userId === null ? [] : [p.userId])));
  await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { in: [...catalogueKeys] } } });
}

/** A seeded PRNG (mulberry32), so the bulk battles are the same every run. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BulkBattleResult {
  firstBattleId: number;
  lastBattleId: number;
  battles: number;
  participants: number;
  durationMs: number;
}

interface PlannedBattle {
  battleType: string;
  winnerId: number | null;
  winningSide: number | null;
  createdAt: Date;
  sides: number[][];
}

/**
 * Bulk-insert one full season of `battles` / `battle_participants` at ACC
 * daily volume (task 12.2): `ACC_DAILY_BATTLES × FULL_SEASON_CYCLES` battles
 * in the `BATTLE_MIX`; head-to-head sides are Automaton vs human (45%),
 * Automaton vs Automaton (35%) or human vs human (20%), with wins, losses and
 * draws. Ids are reserved from the sequence first, so each batch is two
 * `INSERT … SELECT FROM unnest(…)` statements.
 */
export async function insertSeasonOfBattles(automatonRobotIds: readonly number[], humanRobotIds: readonly number[], seed: number): Promise<BulkBattleResult> {
  if (automatonRobotIds.length < 6 || humanRobotIds.length < 6) throw new Error('Bulk battles need at least 6 Automaton and 6 human robots');
  const started = Date.now();
  const random = prng(seed);
  const total = ACC_DAILY_BATTLES * FULL_SEASON_CYCLES;
  const all = [...automatonRobotIds, ...humanRobotIds];
  const seasonStart = Date.now() - FULL_SEASON_CYCLES * 86_400_000;
  const pick = (pool: readonly number[], count: number, exclude: ReadonlySet<number> = new Set()): number[] => {
    const out: number[] = [];
    let cursor = Math.floor(random() * pool.length);
    while (out.length < count) {
      const id = pool[cursor % pool.length];
      if (!exclude.has(id) && !out.includes(id)) out.push(id);
      cursor += 1;
    }
    return out;
  };
  const shares = BATTLE_MIX.flatMap((mode) => Array.from({ length: mode.share }, () => mode));

  const plan = (index: number): PlannedBattle => {
    const mode = shares[index % shares.length];
    const createdAt = new Date(seasonStart + Math.floor(index / ACC_DAILY_BATTLES) * 86_400_000 + (index % ACC_DAILY_BATTLES) * 60_000);
    if (mode.freeForAll) {
      const robots = pick(all, mode.freeForAll);
      return { battleType: mode.battleType, winnerId: robots[0], winningSide: null, createdAt, sides: robots.map((id) => [id]) };
    }
    const roll = random();
    let sideA: number[];
    let sideB: number[];
    if (roll < 0.45) {
      sideA = pick(automatonRobotIds, mode.sideSize);
      sideB = pick(humanRobotIds, mode.sideSize);
    } else if (roll < 0.8) {
      sideA = pick(automatonRobotIds, mode.sideSize);
      sideB = pick(automatonRobotIds, mode.sideSize, new Set(sideA));
    } else {
      sideA = pick(humanRobotIds, mode.sideSize);
      sideB = pick(humanRobotIds, mode.sideSize, new Set(sideA));
    }
    const outcome = random();
    const winningTeam = outcome < 0.47 ? 1 : outcome < 0.94 ? 2 : null;
    const oneVsOne = mode.sideSize === 1;
    const winnerId = winningTeam === null ? null : oneVsOne ? (winningTeam === 1 ? sideA[0] : sideB[0]) : null;
    return { battleType: mode.battleType, winnerId, winningSide: oneVsOne ? null : winningTeam, createdAt, sides: [sideA, sideB] };
  };

  const BATCH = 5_000;
  let firstBattleId = 0;
  let lastBattleId = 0;
  let participants = 0;
  for (let offset = 0; offset < total; offset += BATCH) {
    const size = Math.min(BATCH, total - offset);
    const reserved = await prisma.$queryRaw<{ id: number }[]>`
      SELECT nextval(pg_get_serial_sequence('battles', 'id'))::int AS id FROM generate_series(1, ${size}::int)`;
    const ids = reserved.map((r) => r.id);
    if (offset === 0) firstBattleId = ids[0];
    lastBattleId = ids[ids.length - 1];
    const battles = Array.from({ length: size }, (_, i) => plan(offset + i));
    const participantBattle: number[] = [];
    const participantRobot: number[] = [];
    const participantTeam: number[] = [];
    const participantAt: Date[] = [];
    battles.forEach((battle, i) => {
      battle.sides.forEach((side, sideIndex) => {
        for (const robotId of side) {
          participantBattle.push(ids[i]);
          participantRobot.push(robotId);
          participantTeam.push(sideIndex + 1);
          participantAt.push(battle.createdAt);
        }
      });
    });
    await prisma.$executeRaw`
      INSERT INTO "battles" ("id", "battle_type", "league_type", "winner_id", "winning_side", "duration_seconds", "created_at")
      SELECT b.id, b.battle_type, 'bronze', b.winner_id, b.winning_side, 60, b.created_at
      FROM unnest(${ids}::int[], ${battles.map((b) => b.battleType)}::text[], ${battles.map((b) => b.winnerId)}::int[],
                  ${battles.map((b) => b.winningSide)}::int[], ${battles.map((b) => b.createdAt)}::timestamp[])
        AS b(id, battle_type, winner_id, winning_side, created_at)`;
    await prisma.$executeRaw`
      INSERT INTO "battle_participants" ("battle_id", "robot_id", "team", "credits", "elo_before", "elo_after", "final_hp", "created_at")
      SELECT p.battle_id, p.robot_id, p.team, 0, 1200, 1200, 0, p.created_at
      FROM unnest(${participantBattle}::int[], ${participantRobot}::int[], ${participantTeam}::int[], ${participantAt}::timestamp[])
        AS p(battle_id, robot_id, team, created_at)`;
    participants += participantBattle.length;
  }
  return { firstBattleId, lastBattleId, battles: total, participants, durationMs: Date.now() - started };
}
