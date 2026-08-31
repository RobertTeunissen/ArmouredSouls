/**
 * Jest Setup File (Integration Tests)
 *
 * Loads environment variables and ensures weapons are seeded once per worker.
 * Uses a simple flag to avoid re-seeding weapons on every test file,
 * which was causing 60s+ timeouts due to ~90 DB round-trips per file.
 */

import { config } from 'dotenv';
import path from 'path';
import prisma from '../src/lib/prisma';
import { WEAPON_DEFINITIONS, upsertWeapon } from '../prisma/seed';

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '../.env') });

let weaponsSeeded = false;

// Global setup - runs once before all tests in this worker
beforeAll(async () => {
  if (!weaponsSeeded) {
    // Check if weapons already exist (fast single query)
    const existingCount = await prisma.weapon.count();
    if (existingCount < WEAPON_DEFINITIONS.length) {
      // Batch upsert only if weapons are missing
      for (const def of WEAPON_DEFINITIONS) {
        await upsertWeapon({ ...def });
      }
    }
    weaponsSeeded = true;
  }

  // ─── Purge orphaned competition rows (Spec #51) ───────────────────────────
  //
  // `standings` and `subscriptions` are the two tables a suite can leave behind without
  // noticing. `standings` is polymorphic (`entity_type` + `entity_id`) so it has NO foreign
  // key to `robots` or `team_battles` and is never cascaded; a suite that deletes its robots
  // and teams but not its standings leaves rows referencing entities that no longer exist.
  //
  // Those rows are not inert. Matchmaking, `getEligibleTeams` and `assignLeagueInstance` all
  // scope from `standings`, so phantom entities inflate instance occupancy and change which
  // instance a new entity is placed in. One measured example: 141 `league_2v2` standings rows
  // against 0 `team_battles` pushed `bronze_1` to capacity, so `teamBattleCompleteCycle`'s
  // teams were assigned to `bronze_2` and it failed with "Expected bronze_1, Received
  // bronze_2" — a fact about accumulated garbage, not about matchmaking. 1,303 orphaned rows
  // had built up in total.
  //
  // Only ORPHANS are removed — rows whose entity is already gone, which nothing can
  // legitimately read. A suite's own live rows are untouched, so this cannot mask a suite's
  // teardown bug the way a blanket `deleteMany({})` would.
  await prisma.$executeRaw`
    DELETE FROM standings s
    WHERE (s.entity_type = 'team'  AND NOT EXISTS (SELECT 1 FROM team_battles t WHERE t.id = s.entity_id))
       OR (s.entity_type = 'robot' AND NOT EXISTS (SELECT 1 FROM robots r       WHERE r.id = s.entity_id))
  `;
  await prisma.$executeRaw`
    DELETE FROM subscriptions sub
    WHERE NOT EXISTS (SELECT 1 FROM robots r WHERE r.id = sub.robot_id)
  `;
}, 120000); // 2 minute timeout for initial seeding

// Global teardown - runs once after all tests in this worker
afterAll(async () => {
  await prisma.$disconnect();
});
