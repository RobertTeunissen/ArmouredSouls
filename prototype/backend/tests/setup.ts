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
}, 120000); // 2 minute timeout for initial seeding

// Global teardown - runs once after all tests in this worker
afterAll(async () => {
  await prisma.$disconnect();
});
