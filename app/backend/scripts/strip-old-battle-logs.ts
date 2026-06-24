/**
 * Strip Old Battle Logs — Phase 1 of Spec #39
 *
 * Sets battle_log = NULL for all battles older than 7 days that still have
 * a battle_log value. Only safe to run AFTER the backfill script has populated
 * battle_summaries for all battles.
 *
 * Run: npx tsx scripts/strip-old-battle-logs.ts
 *
 * Options via env vars:
 *   RETENTION_DAYS=7 (default)
 *   BATCH_SIZE=1000 (default)
 *   DRY_RUN=true (print what would be done without modifying)
 *   SKIP_VACUUM=true (skip VACUUM at the end)
 *
 * Safe to re-run: already-NULLed rows are skipped by the WHERE clause.
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS || '7', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const SKIP_VACUUM = process.env.SKIP_VACUUM === 'true';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
  console.log(`[retention] Stripping battle_log for battles older than ${cutoff.toISOString()}`);
  console.log(`[retention] Batch size: ${BATCH_SIZE}, Dry run: ${DRY_RUN}`);

  // Safety check: verify summaries exist for the battles we're about to strip
  const battlesMissingSummary = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM battles b
    WHERE b.created_at < ${cutoff}
      AND b.battle_log IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM battle_summaries bs WHERE bs.battle_id = b.id)
  `;
  const missingCount = Number(battlesMissingSummary[0].count);
  if (missingCount > 0) {
    console.error(`[retention] ABORT: ${missingCount} battles older than cutoff have no summary. Run backfill first.`);
    process.exit(1);
  }

  let totalProcessed = 0;
  const startTime = Date.now();

  while (true) {
    // Find next batch
    const batch = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM battles
      WHERE created_at < ${cutoff}
        AND battle_log IS NOT NULL
      ORDER BY id ASC
      LIMIT ${BATCH_SIZE}
    `;

    if (batch.length === 0) break;

    if (!DRY_RUN) {
      const ids = batch.map(b => b.id);
      await prisma.$executeRaw`
        UPDATE battles SET battle_log = NULL WHERE id = ANY(${ids}::int[])
      `;
    }

    totalProcessed += batch.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[retention] ${DRY_RUN ? 'Would strip' : 'Stripped'} ${totalProcessed} battles (${elapsed}s)`);

    await sleep(100);
  }

  if (totalProcessed === 0) {
    console.log('[retention] No battles to strip — all within retention window or already NULLed.');
    return;
  }

  console.log(`[retention] ${DRY_RUN ? 'Would strip' : 'Stripped'} ${totalProcessed} total battles.`);

  // VACUUM to reclaim TOAST space
  if (!DRY_RUN && !SKIP_VACUUM) {
    console.log('[retention] Running VACUUM on battles table to reclaim TOAST space...');
    console.log('[retention] This may take several minutes. Do not interrupt.');
    await prisma.$executeRawUnsafe('VACUUM (VERBOSE) battles');
    console.log('[retention] VACUUM complete.');
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[retention] Done in ${totalElapsed}s. Estimated space reclaimed: ~${Math.round(totalProcessed * 0.9)}MB`);
}

main()
  .catch(err => { console.error('[retention] Fatal error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
