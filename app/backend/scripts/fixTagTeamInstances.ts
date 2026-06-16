/**
 * One-shot fix: Rebalance tag team league instances after migration.
 *
 * The Prisma migration set tagTeamLeagueId = 'bronze_1' for ALL 2v2 teams,
 * stuffing all teams into a single instance. This script redistributes them
 * evenly across instances (max 50 teams per instance).
 *
 * Usage:
 *   pnpm exec tsx scripts/fixTagTeamInstances.ts
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const MAX_TEAMS_PER_INSTANCE = 50;
const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

async function main(): Promise<void> {
  console.log('[FixTagTeamInstances] Starting tag team instance rebalancing...\n');

  for (const tier of TIERS) {
    const teams = await prisma.teamBattle.findMany({
      where: { tagTeamLeague: tier, teamSize: 2 },
      orderBy: [{ tagTeamLp: 'desc' }, { id: 'asc' }],
      select: { id: true, tagTeamLeagueId: true },
    });

    if (teams.length === 0) {
      console.log(`[${tier}] No teams, skipping`);
      continue;
    }

    const targetInstanceCount = Math.ceil(teams.length / MAX_TEAMS_PER_INSTANCE);
    console.log(`[${tier}] ${teams.length} teams → distributing across ${targetInstanceCount} instances`);

    let movedCount = 0;
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const targetInstanceNumber = (i % targetInstanceCount) + 1;
      const targetInstanceId = `${tier}_${targetInstanceNumber}`;

      if (team.tagTeamLeagueId !== targetInstanceId) {
        await prisma.teamBattle.update({
          where: { id: team.id },
          data: { tagTeamLeagueId: targetInstanceId },
        });
        movedCount++;
      }
    }

    console.log(`[${tier}] Moved ${movedCount} teams\n`);
  }

  console.log('[FixTagTeamInstances] Done!');
}

main()
  .catch((err) => {
    console.error('[FixTagTeamInstances] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
