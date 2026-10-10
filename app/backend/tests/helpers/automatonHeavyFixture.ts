/**
 * Spec #55 task 12.1 — the heavy-test population of 100 Active_Automatons
 * (R14.4, design §21 Heavy row, decision 39) and the bulk data the heavy
 * simulation needs.
 *
 * Population: the 11 starter Catalogue_Entries, selected by the fixed
 * `STARTER_CATALOGUE_KEYS` list (never "every file in the repository
 * Automaton_Catalogue", so later catalogue additions do not change the
 * population), plus 89 generated entries that cycle through all six
 * Upgrade_Strategies and all six Build_Focus presets. Every generated entry
 * has exactly enough buildable blueprints for its robots Goal_Targets (R3.7;
 * every fourth one has one spare), the Team_Names counts
 * `requiredTeamNameCountsFor` requires (R3.6) and a 9-type Event_Order.
 * Generated blueprints reuse the starter blueprints' loadouts, Weapon_Paths
 * and Refinement_Plans, which the catalogue rules already accept.
 *
 * Only tests use this.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../../src/lib/prisma';
import {
  BUILD_FOCUS_KEYS,
  CATALOGUE_DIRECTORY,
  CATALOGUE_SCHEMA_VERSION,
  MAX_BLUEPRINTS,
  catalogueEntryShape,
  requiredTeamNameCountsFor,
  type CatalogueBlueprint,
  type CatalogueEntry,
} from '../../src/services/automaton/automatonCatalogueService';
import { defaultParameters, highestRobotsTarget } from '../../src/services/automaton/strategies/strategyParameters';
import type { StrategyRegistry } from '../../src/services/automaton/strategies/registry';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../src/services/subscription/eventRegistry';

/** The 11 starter stables (review/CATALOGUE.md §3–§13), fixed by decision 39. */
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

export const HEAVY_POPULATION_SIZE = 100;
export const GENERATED_ENTRY_COUNT = HEAVY_POPULATION_SIZE - STARTER_CATALOGUE_KEYS.length;
export const GENERATED_KEY_PREFIX = 'heavy55-';
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

const pad3 = (value: number): string => String(value).padStart(3, '0');

/** The starter entries, read by Catalogue_Key from the repository catalogue (structure checked; context rules run in Catalogue_Sync). */
export function loadStarterEntries(directory: string = CATALOGUE_DIRECTORY): CatalogueEntry[] {
  return STARTER_CATALOGUE_KEYS.map((key) => {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(directory, `${key}.json`), 'utf8'));
    return catalogueEntryShape.parse(raw);
  });
}

/** The generated entries (89), deterministic. */
export function generatedEntries(starters: readonly CatalogueEntry[], strategies: StrategyRegistry): CatalogueEntry[] {
  const pool: CatalogueBlueprint[] = starters.flatMap((entry) => entry.blueprints);
  const entries: CatalogueEntry[] = [];
  for (let index = 0; index < GENERATED_ENTRY_COUNT; index += 1) {
    const number = pad3(index + 1);
    const strategyKey = HEAVY_STRATEGY_KEYS[index % HEAVY_STRATEGY_KEYS.length];
    const version = strategies.latestVersion(strategyKey);
    const strategy = version === undefined ? undefined : strategies.getStrategy(strategyKey, version);
    if (!strategy || version === undefined) throw new Error(`Strategy ${strategyKey} is not in the registry`);
    const robotsTarget = highestRobotsTarget(strategy.buildOrder, defaultParameters(strategy.buildOrder)) ?? 1;
    const spare = index % 4 === 3 ? 1 : 0;
    const blueprintCount = Math.min(MAX_BLUEPRINTS, robotsTarget + spare);
    const blueprints: CatalogueBlueprint[] = Array.from({ length: blueprintCount }, (_, s) => {
      const template = pool[(index * 7 + s) % pool.length];
      return {
        ...template,
        slot: s + 1,
        robotName: `Heavy ${number} Unit ${s + 1}`,
        buildFocus: BUILD_FOCUS_KEYS[(index + s) % BUILD_FOCUS_KEYS.length],
      };
    });
    const teamCounts = requiredTeamNameCountsFor(strategy, blueprintCount);
    const rotation = index % SUBSCRIBABLE_EVENT_TYPES.length;
    entries.push({
      schemaVersion: CATALOGUE_SCHEMA_VERSION,
      catalogueKey: `${GENERATED_KEY_PREFIX}${number}`,
      stableName: `Heavy Works ${number}`,
      franchise: 'Heavy test population',
      backstory: `Generated stable ${number} of the Spec #55 heavy simulation.`,
      strategy: { key: strategyKey, version, targetOverrides: {} },
      teamNames: {
        twoVsTwo: Array.from({ length: teamCounts.twoVsTwo }, (_, i) => `Heavy ${number} Pair ${i + 1}`),
        threeVsThree: Array.from({ length: teamCounts.threeVsThree }, (_, i) => `Heavy ${number} Trio ${i + 1}`),
      },
      eventOrder: [...SUBSCRIBABLE_EVENT_TYPES.slice(rotation), ...SUBSCRIBABLE_EVENT_TYPES.slice(0, rotation)],
      blueprints,
    });
  }
  return entries;
}

/** Write entries as `{catalogueKey}.json` into a fresh directory (for Catalogue_Sync). */
export function writeCatalogueDirectory(directory: string, entries: readonly CatalogueEntry[]): void {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of entries) {
    fs.writeFileSync(path.join(directory, `${entry.catalogueKey}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  }
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
