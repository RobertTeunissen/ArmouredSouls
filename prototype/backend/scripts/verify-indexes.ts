/**
 * Verification script for audit logging indexes
 * Validates that all required indexes are present
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyIndexes() {
  console.log('🔍 Verifying audit logging indexes...\n');

  try {
    // Query to get all indexes for audit_logs and cycle_snapshots
    const indexes = await prisma.$queryRaw<Array<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>>`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND tablename IN ('audit_logs', 'cycle_snapshots')
      ORDER BY tablename, indexname;
    `;

    console.log('📊 Audit Logs Indexes:');
    const auditLogIndexes = indexes.filter(i => i.tablename === 'audit_logs');
    auditLogIndexes.forEach(idx => {
      console.log(`  ✓ ${idx.indexname}`);
    });

    console.log('\n📊 Cycle Snapshots Indexes:');
    const snapshotIndexes = indexes.filter(i => i.tablename === 'cycle_snapshots');
    snapshotIndexes.forEach(idx => {
      console.log(`  ✓ ${idx.indexname}`);
    });

    // Verify required indexes exist
    const requiredAuditLogIndexes = [
      'audit_logs_cycle_number_idx',
      'audit_logs_user_id_idx',
      'audit_logs_robot_id_idx',
      'audit_logs_event_type_idx',
      'audit_logs_event_timestamp_idx',
      'audit_logs_cycle_number_user_id_idx',
      'audit_logs_cycle_number_robot_id_idx',
      'audit_logs_cycle_number_event_type_idx',
      'audit_logs_cycle_number_sequence_number_key', // unique constraint
    ];

    const requiredSnapshotIndexes = [
      'cycle_snapshots_cycle_number_key', // unique constraint
      'cycle_snapshots_cycle_number_idx',
      'cycle_snapshots_start_time_idx',
    ];

    console.log('\n✅ Verification Results:');
    
    let allPresent = true;
    for (const required of requiredAuditLogIndexes) {
      const exists = auditLogIndexes.some(idx => idx.indexname === required);
      if (exists) {
        console.log(`  ✓ ${required}`);
      } else {
        console.log(`  ✗ MISSING: ${required}`);
        allPresent = false;
      }
    }

    for (const required of requiredSnapshotIndexes) {
      const exists = snapshotIndexes.some(idx => idx.indexname === required);
      if (exists) {
        console.log(`  ✓ ${required}`);
      } else {
        console.log(`  ✗ MISSING: ${required}`);
        allPresent = false;
      }
    }

    if (allPresent) {
      console.log('\n✅ All required indexes are present!');
    } else {
      console.log('\n❌ Some required indexes are missing!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Index verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyIndexes();
