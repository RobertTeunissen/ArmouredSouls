/**
 * Booking Office Migration Script
 *
 * One-off migration that grants every existing Stable a Booking Office Level 1
 * (free, never lowering an existing higher level) and creates Subscriptions for
 * every existing robot to all four current battle modes (league, tournament,
 * tag_team, koth).
 *
 * Invocation: npm run migrate:booking-office
 *
 * Behaviour:
 * - Standalone script with own PrismaClient + PrismaPg adapter
 * - Processes Stables in batches of 50 to avoid memory pressure
 * - Each Stable processed in its own transaction (idempotent via upsert + skipDuplicates)
 * - On per-Stable error: logs, continues, includes in summary
 * - Emits structured JSON summary at end
 * - Exits with code 1 if any Stable failed
 *
 * Idempotent: re-running produces the same state (upsert with GREATEST for facility,
 * createMany with skipDuplicates for subscriptions).
 */
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

// ── Constants ────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const EVENT_TYPES = ['league', 'tournament', 'tag_team', 'koth'] as const;

// ── Types ────────────────────────────────────────────────────────────

interface MigrationSummary {
  stablesProcessed: number;
  facilitiesGranted: number;
  subscriptionsCreated: number;
  errors: { stableId: number; error: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate-booking-office] ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter, log: ['error'] });

  const summary: MigrationSummary = {
    stablesProcessed: 0,
    facilitiesGranted: 0,
    subscriptionsCreated: 0,
    errors: [],
  };

  try {
    console.log('[migrate-booking-office] Starting migration...');

    // Fetch all Stables (Users)
    const stables = await prisma.user.findMany({ select: { id: true } });
    console.log(`[migrate-booking-office] Found ${stables.length} Stables to process`);

    const batches = chunk(stables, BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(
        `[migrate-booking-office] Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} Stables)`,
      );

      // Process each Stable in the batch sequentially to avoid connection pressure
      for (const stable of batch) {
        try {
          const result = await prisma.$transaction(async (tx) => {
            let facilityGranted = false;
            let subsCreated = 0;

            // 1. Upsert booking_office facility to at least L1 (never lower existing)
            const existing = await tx.facility.findUnique({
              where: { userId_facilityType: { userId: stable.id, facilityType: 'booking_office' } },
            });

            if (!existing) {
              // Create at level 1
              await tx.facility.create({
                data: {
                  userId: stable.id,
                  facilityType: 'booking_office',
                  level: 1,
                  maxLevel: 10,
                },
              });
              facilityGranted = true;
            } else if (existing.level < 1) {
              // Raise to level 1 (never lower)
              await tx.facility.update({
                where: { userId_facilityType: { userId: stable.id, facilityType: 'booking_office' } },
                data: { level: 1 },
              });
              facilityGranted = true;
            }
            // If existing.level >= 1, leave it as-is

            // 2. Get all robots for this Stable
            const robots = await tx.robot.findMany({
              where: { userId: stable.id },
              select: { id: true },
            });

            // 3. Insert 4 subscriptions per robot (skip duplicates for idempotency)
            for (const robot of robots) {
              const result = await tx.subscription.createMany({
                data: EVENT_TYPES.map((eventType) => ({
                  robotId: robot.id,
                  eventType,
                  status: 'active',
                })),
                skipDuplicates: true,
              });
              subsCreated += result.count;
            }

            // 4. Audit log for this Stable
            const lastEntry = await tx.auditLog.findFirst({
              where: { cycleNumber: 0 },
              orderBy: { sequenceNumber: 'desc' },
              select: { sequenceNumber: true },
            });
            const sequenceNumber = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

            await tx.auditLog.create({
              data: {
                cycleNumber: 0,
                eventType: 'booking_office_migration',
                sequenceNumber,
                userId: stable.id,
                payload: {
                  action: 'migrate_booking_office',
                  facilityGranted,
                  robotCount: robots.length,
                  subscriptionsCreated: subsCreated,
                },
              },
            });

            return { facilityGranted, subsCreated };
          });

          summary.stablesProcessed++;
          if (result.facilityGranted) {
            summary.facilitiesGranted++;
          }
          summary.subscriptionsCreated += result.subsCreated;

          console.log(
            `[migrate-booking-office] Stable ${stable.id}: facility=${result.facilityGranted ? 'granted' : 'unchanged'}, subscriptions=${result.subsCreated}`,
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          summary.errors.push({ stableId: stable.id, error: errorMsg });
          console.error(`[migrate-booking-office] ERROR Stable ${stable.id}: ${errorMsg}`);
        }
      }
    }

    // 5. Emit structured summary
    console.log('\n[migrate-booking-office] === MIGRATION SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }

  // 6. Exit code 1 if any Stable failed
  if (summary.errors.length > 0) {
    console.error(
      `\n[migrate-booking-office] Completed with ${summary.errors.length} error(s). Exiting with code 1.`,
    );
    process.exit(1);
  }

  console.log('\n[migrate-booking-office] Migration completed successfully.');
}

main().catch((err) => {
  console.error('[migrate-booking-office] Fatal error:', err);
  process.exit(1);
});
