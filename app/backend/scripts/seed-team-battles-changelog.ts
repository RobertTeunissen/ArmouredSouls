/**
 * Seed script: Create changelog entry for Team Battles 2v2 and 3v3 (Spec #37).
 *
 * Creates a published changelog entry announcing the new Team Battle modes,
 * Team Coordination Attribute ally effects, and related system changes.
 * Idempotent — skips if an entry with sourceRef "37-team-battles-2v2-3v3" already exists.
 *
 * Usage:
 *   npx tsx app/backend/scripts/seed-team-battles-changelog.ts
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const SOURCE_REF = '37-team-battles-2v2-3v3';

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
        title: 'New Battle Modes: 2v2 and 3v3 Team Battles',
        body: [
          'Two new battle modes have arrived! Form teams of 2 or 3 robots and fight simultaneously in the arena — all robots active at once.',
          '',
          '**New modes:**',
          '• **2v2 League** — Register a team of 2 robots. All 4 robots fight simultaneously in the arena. Runs daily at 09:00 UTC.',
          '• **3v3 League** — Register a team of 3 robots. All 6 robots fight simultaneously in the arena. Runs daily at 14:00 UTC.',
          '',
          '**Team registration and management:**',
          '• Form persistent teams from your subscribed robots — name them, swap members, or disband',
          '• A robot can be on both a 2v2 team and a 3v3 team (they run in separate time slots)',
          '• Multiple teams per size are possible from the same Stable (e.g. 4 subscribed robots → 2 teams of 2)',
          '• Teams have their own League Points (Team_LP) and league tier — independent of individual robot standings',
          '',
          '**Team Coordination Attributes now drive ally effects:**',
          '• **Sync Protocols** — Focus fire damage bonus when multiple allies target the same enemy (up to +25%)',
          '• **Support Systems** — Passive ally shield regeneration (up to 0.80 shield/sec per ally)',
          '• **Formation Tactics** — Damage reduction when allies are within 8 grid units (up to 20%)',
          '• These attributes finally pay off in team combat! The existing 1v1 self-bonuses remain unchanged.',
          '',
          '**League standings:**',
          '• Separate league standings for 2v2 and 3v3 — same six-tier structure (Bronze through Champion)',
          '• Promotion and relegation based on Team_LP, same rules as 1v1',
          '• Team ELO computed from member robots — used for matchmaking within your tier',
          '',
          '**Rewards:**',
          '• 2v2 winners earn 2× the 1v1 reward per robot; 3v3 winners earn 3×',
          '• Each robot on the winning team earns full fame and prestige',
          '• ELO changes apply equally to all team members',
          '',
          '**Booking Office integration:**',
          '• Subscribe your robots to "2v2 League" and/or "3v3 League" via the Booking Office',
          '• 3v3 League requires 3+ robots in your Stable; 2v2 League requires 2+',
          '• Subscriptions count toward your per-robot cap — upgrade your Booking Office for more slots',
          '',
          '**New achievements:**',
          '• "Daft Punk" — Win your first 2v2 League battle',
          '• "Twins!" — Win 25 battles in 2v2 League',
          '• "Three Laws Safe" — Win your first 3v3 League battle',
          '• "Voltron" — Win 25 battles in 3v3 League',
          '• "Autobots, Roll Out!" now requires wins across all 4 categories: any league, tag team, any tournament, and KotH',
          '',
          '**Event type renames:**',
          '• "League" is now "1v1 League" (league_1v1) and "Tournament" is now "1v1 Tournament" (tournament_1v1) for clarity alongside the new team modes',
          '• Your existing subscriptions and battle history have been migrated automatically — no action needed',
          '',
          'Manage your teams from the new Team Battles page (/team-battles). Read the in-game guide for full details on team formation, coordination effects, and strategy tips.',
        ].join('\n'),
        category: 'feature',
        status: 'draft',
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
