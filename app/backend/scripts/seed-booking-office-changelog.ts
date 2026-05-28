/**
 * Seed script: Create changelog entry for the Booking Office Facility (Spec #35).
 *
 * Creates a published changelog entry announcing the Event Subscription System.
 * Idempotent — skips if an entry with sourceRef "35-booking-office-facility" already exists.
 *
 * Usage:
 *   npx tsx app/backend/scripts/seed-booking-office-changelog.ts
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const SOURCE_REF = '35-booking-office-facility';

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
        title: 'New Facility: Booking Office — Event Subscriptions',
        body: [
          'The Booking Office is now active! This new facility introduces the Event Subscription System — you now choose which battle events each robot participates in.',
          '',
          '**What changed:**',
          '• Every robot can subscribe to battle events: 1v1 League, 1v1 Tournament, Tag Team, and King of the Hill',
          '• Subscriptions are per-robot — specialise your robots for different event types',
          '• Switching is free and takes effect next cycle',
          '• Robots are locked from unsubscribing while they have a queued battle',
          '',
          '**For existing players (migration):**',
          '• Your Stable received a free Booking Office Level 1 (4 subscriptions per robot)',
          '• Every existing robot has been subscribed to all four events automatically',
          '• You lose nothing — all your robots continue participating in the same events as before',
          '• You can now customise per robot from the Robot Detail page or the Booking Office overview',
          '',
          '**For new players:**',
          '• During onboarding, you pick 3 subscriptions for your first robot (Level 0 cap = 3)',
          '• Default picks: League, Tournament, and KotH',
          '• Tag Team becomes available once you own a second robot',
          '• Purchase Booking Office Level 1 (₡75,000) to unlock a 4th subscription slot per robot',
          '',
          '**Booking Office levels:**',
          '• Level 0 (free): 3 subscriptions per robot',
          '• Each level adds +1 subscription per robot (up to 13 at Level 10)',
          '• Cost: ₡75,000 per level (linear)',
          '',
          'Manage your subscriptions from the Robot Detail page or the new Booking Office overview at /booking-office.',
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
