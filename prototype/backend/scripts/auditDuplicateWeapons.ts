/**
 * Audit & fix script: Find robots with the same weapon in both main and offhand slots.
 *
 * Usage:
 *   npx tsx scripts/auditDuplicateWeapons.ts          # dry-run (report only)
 *   npx tsx scripts/auditDuplicateWeapons.ts --fix     # unequip the offhand duplicate
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--fix');

  // First, find robots that have both weapon slots filled (lightweight select)
  const robotsWithBothWeapons = await prisma.robot.findMany({
    where: {
      mainWeaponId: { not: null },
      offhandWeaponId: { not: null },
    },
    select: {
      id: true,
      name: true,
      userId: true,
      mainWeaponId: true,
      offhandWeaponId: true,
    },
  });

  const duplicateBasics = robotsWithBothWeapons.filter(
    robot => robot.mainWeaponId === robot.offhandWeaponId
  );

  if (duplicateBasics.length === 0) {
    console.log('✅ No robots found with duplicate weapon in both slots.');
    return;
  }

  // Load full details only for robots that actually have duplicate weapons
  const duplicates = await prisma.robot.findMany({
    where: {
      id: { in: duplicateBasics.map(robot => robot.id) },
    },
    include: {
      user: { select: { id: true, username: true } },
      mainWeapon: { include: { weapon: { select: { name: true } } } },
      offhandWeapon: { include: { weapon: { select: { name: true } } } },
    },
  });
  console.log(`⚠️  Found ${duplicates.length} robot(s) with the same weapon in both slots:\n`);

  for (const robot of duplicates) {
    const weaponName = robot.mainWeapon?.weapon?.name ?? 'Unknown';
    console.log(
      `  Robot #${robot.id} "${robot.name}" (user: ${robot.user.username}) — ` +
      `weapon "${weaponName}" (inventory #${robot.mainWeaponId}) in BOTH slots`
    );

    if (!dryRun) {
      // Fix: unequip the offhand, keeping the main weapon
      await prisma.robot.update({
        where: { id: robot.id },
        data: { offhandWeaponId: null },
      });
      console.log(`    → Fixed: offhand weapon cleared.`);
    }
  }

  if (dryRun) {
    console.log('\nThis was a dry run. Pass --fix to unequip the offhand duplicates.');
  } else {
    console.log(`\n✅ Fixed ${duplicates.length} robot(s).`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
