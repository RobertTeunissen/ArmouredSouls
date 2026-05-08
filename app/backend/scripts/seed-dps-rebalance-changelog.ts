/**
 * Seed script: Create changelog entry for the DPS Rebalance (Spec #31).
 *
 * Creates a published changelog entry announcing the combat rebalance.
 * Idempotent — skips if an entry with sourceRef "31-weapon-dps-rebalance" already exists.
 *
 * Usage:
 *   npx ts-node app/backend/scripts/seed-dps-rebalance-changelog.ts
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const SOURCE_REF = '31-weapon-dps-rebalance';

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error'] });

  try {
    // Check for existing entry (idempotency)
    const existing = await prisma.changelogEntry.findFirst({
      where: { sourceRef: SOURCE_REF },
    });

    if (existing) {
      console.log(`Changelog entry already exists (id=${existing.id}). Skipping.`);
      return;
    }

    const entry = await prisma.changelogEntry.create({
      data: {
        title: 'Combat Rebalance v2 — Attributes Matter',
        body: [
          'Weapon damage has been compressed so that attribute investment is now a competitive strategy.',
          'All loadout types (dual wield, two-handed, weapon+shield, single) are now viable.',
          'Battles last slightly longer, giving defensive builds time to shine.',
          'Weapon prices are unchanged.',
          '',
          'Top-tier weapons now have distinct combat profiles:',
          '• Vibro Mace — fast brawler (2s cooldown)',
          '• Volt Sabre — balanced standard (3s)',
          '• Nova Caster — moderate burst (3.5s)',
          '• Particle Lance — heavy burst (4s)',
          '',
          'Your robot\'s training now matters just as much as its weapon.',
        ].join('\n'),
        category: 'balance',
        status: 'published',
        publishDate: new Date(),
        sourceType: 'spec',
        sourceRef: SOURCE_REF,
      },
    });

    console.log(`✓ Created changelog entry: "${entry.title}" (id=${entry.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
