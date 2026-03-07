/**
 * Jest Setup File
 * Loads environment variables and ensures weapons are seeded before tests run
 */

import { config } from 'dotenv';
import path from 'path';
import prisma from '../src/lib/prisma';
import { WEAPON_DEFINITIONS, upsertWeapon } from '../prisma/seed';

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '../.env') });

// Global setup - runs once before all tests
beforeAll(async () => {
  // Ensure weapons are seeded (required for tests that create robots)
  for (const def of WEAPON_DEFINITIONS) {
    await upsertWeapon({ ...def });
  }
});

// Global teardown - runs once after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
