/**
 * Backfill totalRepairsPaid from audit log
 * 
 * The audit_logs table has accurate repair cost records, but robot.total_repairs_paid
 * was reset during a database reseed. This script reconciles the values.
 * 
 * Run with: npx tsx src/scripts/backfill-repair-costs.ts
 */
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

async function backfill(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Backfilling totalRepairsPaid from audit log...\n');

    // Get all repair events grouped by robotId
    const repairEvents = await prisma.auditLog.findMany({
      where: { eventType: 'robot_repair' },
      select: { robotId: true, payload: true },
    });

    // Sum costs per robot
    const costsByRobot = new Map<number, number>();
    for (const evt of repairEvents) {
      const robotId = evt.robotId;
      if (!robotId) continue;
      const p = evt.payload as Record<string, unknown>;
      const cost = typeof p?.cost === 'number' ? p.cost : 0;
      costsByRobot.set(robotId, (costsByRobot.get(robotId) || 0) + cost);
    }

    console.log(`Found repair data for ${costsByRobot.size} robots from ${repairEvents.length} audit events`);

    let updated = 0;
    let skipped = 0;

    for (const [robotId, auditTotal] of costsByRobot.entries()) {
      // Check current value
      const robot = await prisma.robot.findUnique({
        where: { id: robotId },
        select: { id: true, name: true, totalRepairsPaid: true },
      });

      if (!robot) {
        skipped++;
        continue;
      }

      if (robot.totalRepairsPaid !== auditTotal) {
        await prisma.robot.update({
          where: { id: robotId },
          data: { totalRepairsPaid: auditTotal },
        });
        console.log(`  Updated Robot ${robotId} (${robot.name}): ₡${robot.totalRepairsPaid} → ₡${auditTotal}`);
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}`);

  } finally {
    await prisma.$disconnect();
  }
}

backfill().catch(console.error);
