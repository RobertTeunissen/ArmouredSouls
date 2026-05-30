/**
 * Seed script: Create changelog entry for the Cron Schedule Restructure (Spec #36).
 *
 * Creates a published changelog entry announcing daily cadence for all battle events,
 * midnight settlement, and subscription gating.
 * Idempotent — skips if an entry with sourceRef "36-cron-schedule-restructure" already exists.
 *
 * Usage:
 *   npx tsx app/backend/scripts/seed-cron-restructure-changelog.ts
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const SOURCE_REF = '36-cron-schedule-restructure';

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
        title: 'Daily Battle Schedule — All Events Now Run Every Day',
        body: [
          'The battle schedule has been restructured. All events now run daily, and settlement moves to midnight UTC.',
          '',
          '**What changed:**',
          '• **Tag Team** now runs every day (previously every other cycle). Matches are scheduled with 24-hour lead time.',
          '• **King of the Hill** now runs every day (previously Mon/Wed/Fri only). Zone rotation uses cycle number instead of weekday.',
          '• **Settlement** moves from 23:00 UTC to 00:00 UTC (midnight), cleanly closing each cycle.',
          '• **1v1 League** moves to 08:00 UTC (previously 20:00 UTC).',
          '• **1v1 Tournament** moves to 10:00 UTC (previously 08:00 UTC).',
          '',
          '**Why daily?**',
          'With the Booking Office (Event Subscriptions) now live, each Stable chooses which events to participate in. Daily cadence means no mode is penalised by frequency — your choice of events is what matters, not which days they happen to run.',
          '',
          '**Subscriptions gate participation:**',
          'Your robots only participate in events they are subscribed to via the Booking Office. Moving to daily cadence does not increase your battle volume unless you choose to subscribe to more events.',
          '',
          '**New daily schedule (UTC):**',
          '• 08:00 — 1v1 League',
          '• 10:00 — 1v1 Tournament',
          '• 11:00 — Tag Team',
          '• 13:00 — King of the Hill',
          '• 00:00 — Settlement (cycle close)',
          '',
          'Reserved slots for future battle modes (Team Battles, Grand Melee) are pre-allocated but inactive until those modes ship.',
        ].join('\n'),
        category: 'feature',
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
