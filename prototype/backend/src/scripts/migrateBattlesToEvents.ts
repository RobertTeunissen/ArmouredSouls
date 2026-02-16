/**
 * Migration Script: Battle Table to Audit Log Events
 * 
 * Converts existing Battle table rows to battle_complete events in the audit log.
 * This is a one-time migration for the event sourcing architecture.
 * 
 * Requirements: 11.5 (Backward compatibility)
 */

import prisma from '../lib/prisma';
import { EventType } from '../services/eventLogger';
import { Prisma } from '@prisma/client';

interface MigrationStats {
  totalBattles: number;
  migratedBattles: number;
  skippedBattles: number;
  errors: string[];
}

/**
 * Estimate cycle number from battle creation timestamp
 * Since we don't have explicit cycle numbers in old battles,
 * we'll assign them based on creation date order
 */
async function estimateCycleNumbers(battles: any[]): Promise<Map<number, number>> {
  const cycleMap = new Map<number, number>();
  
  // Get current cycle metadata
  const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  const currentCycle = metadata?.totalCycles || 0;
  
  if (battles.length === 0) {
    return cycleMap;
  }
  
  // Sort battles by creation date
  const sortedBattles = [...battles].sort((a, b) => 
    a.createdAt.getTime() - b.createdAt.getTime()
  );
  
  // Group battles by date (assuming one cycle per day in early prototype)
  const battlesByDate = new Map<string, number[]>();
  for (const battle of sortedBattles) {
    const dateKey = battle.createdAt.toISOString().split('T')[0];
    if (!battlesByDate.has(dateKey)) {
      battlesByDate.set(dateKey, []);
    }
    battlesByDate.get(dateKey)!.push(battle.id);
  }
  
  // Assign cycle numbers (starting from 1 for oldest battles)
  let cycleNumber = 1;
  const sortedDates = Array.from(battlesByDate.keys()).sort();
  
  for (const date of sortedDates) {
    const battleIds = battlesByDate.get(date)!;
    for (const battleId of battleIds) {
      cycleMap.set(battleId, cycleNumber);
    }
    cycleNumber++;
  }
  
  console.log(`Estimated ${cycleMap.size} battles across ${cycleNumber - 1} cycles`);
  
  return cycleMap;
}

/**
 * Get next sequence number for a cycle
 */
async function getNextSequenceNumber(cycleNumber: number): Promise<number> {
  const lastEvent = await prisma.auditLog.findFirst({
    where: { cycleNumber },
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true },
  });
  
  return lastEvent ? lastEvent.sequenceNumber + 1 : 1;
}

/**
 * Convert a Battle record to a battle_complete event payload
 */
function battleToEventPayload(battle: any): Record<string, any> {
  return {
    battleId: battle.id,
    robot1Id: battle.robot1Id,
    robot2Id: battle.robot2Id,
    winnerId: battle.winnerId,
    
    // ELO
    robot1ELOBefore: battle.robot1ELOBefore,
    robot1ELOAfter: battle.robot1ELOAfter,
    robot2ELOBefore: battle.robot2ELOBefore,
    robot2ELOAfter: battle.robot2ELOAfter,
    eloChange: battle.eloChange,
    
    // Damage
    robot1DamageDealt: battle.robot1DamageDealt,
    robot2DamageDealt: battle.robot2DamageDealt,
    robot1FinalHP: battle.robot1FinalHP,
    robot2FinalHP: battle.robot2FinalHP,
    robot1FinalShield: battle.robot1FinalShield,
    robot2FinalShield: battle.robot2FinalShield,
    
    // Rewards
    winnerReward: battle.winnerReward || 0,
    loserReward: battle.loserReward || 0,
    robot1PrestigeAwarded: battle.robot1PrestigeAwarded,
    robot2PrestigeAwarded: battle.robot2PrestigeAwarded,
    robot1FameAwarded: battle.robot1FameAwarded,
    robot2FameAwarded: battle.robot2FameAwarded,
    
    // Costs
    robot1RepairCost: battle.robot1RepairCost || 0,
    robot2RepairCost: battle.robot2RepairCost || 0,
    
    // Battle details
    durationSeconds: battle.durationSeconds,
    battleType: battle.battleType,
    leagueType: battle.leagueType,
    robot1Yielded: battle.robot1Yielded,
    robot2Yielded: battle.robot2Yielded,
    robot1Destroyed: battle.robot1Destroyed,
    robot2Destroyed: battle.robot2Destroyed,
    
    // Tag team (if applicable)
    team1ActiveRobotId: battle.team1ActiveRobotId,
    team1ReserveRobotId: battle.team1ReserveRobotId,
    team2ActiveRobotId: battle.team2ActiveRobotId,
    team2ReserveRobotId: battle.team2ReserveRobotId,
    team1TagOutTime: battle.team1TagOutTime,
    team2TagOutTime: battle.team2TagOutTime,
    
    // Tag team per-robot stats
    team1ActiveDamageDealt: battle.team1ActiveDamageDealt,
    team1ReserveDamageDealt: battle.team1ReserveDamageDealt,
    team2ActiveDamageDealt: battle.team2ActiveDamageDealt,
    team2ReserveDamageDealt: battle.team2ReserveDamageDealt,
    team1ActiveFameAwarded: battle.team1ActiveFameAwarded,
    team1ReserveFameAwarded: battle.team1ReserveFameAwarded,
    team2ActiveFameAwarded: battle.team2ActiveFameAwarded,
    team2ReserveFameAwarded: battle.team2ReserveFameAwarded,
    
    // Tournament reference
    tournamentId: battle.tournamentId,
    tournamentRound: battle.tournamentRound,
  };
}

/**
 * Migrate a single battle to an audit log event
 */
async function migrateBattle(
  battle: any,
  cycleNumber: number,
  sequenceNumber: number
): Promise<void> {
  const payload = battleToEventPayload(battle);
  
  await prisma.auditLog.create({
    data: {
      cycleNumber,
      eventType: EventType.BATTLE_COMPLETE,
      eventTimestamp: battle.createdAt,
      sequenceNumber,
      userId: battle.userId,
      robotId: battle.robot1Id, // Primary robot for this battle
      payload: payload as Prisma.JsonObject,
    },
  });
}

/**
 * Main migration function
 */
export async function migrateBattlesToEvents(
  options: {
    dryRun?: boolean;
    batchSize?: number;
    verbose?: boolean;
  } = {}
): Promise<MigrationStats> {
  const { dryRun = false, batchSize = 100, verbose = false } = options;
  
  const stats: MigrationStats = {
    totalBattles: 0,
    migratedBattles: 0,
    skippedBattles: 0,
    errors: [],
  };
  
  console.log('=== Battle to Event Log Migration ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('');
  
  try {
    // Count total battles
    stats.totalBattles = await prisma.battle.count();
    console.log(`Found ${stats.totalBattles} battles to migrate`);
    
    if (stats.totalBattles === 0) {
      console.log('No battles to migrate. Migration complete.');
      return stats;
    }
    
    // Check if any battles are already migrated
    const existingEvents = await prisma.auditLog.count({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });
    
    if (existingEvents > 0) {
      console.log(`Warning: Found ${existingEvents} existing battle_complete events`);
      console.log('Skipping already migrated battles...');
    }
    
    // Fetch all battles (in batches for large datasets)
    let offset = 0;
    let processedCount = 0;
    
    while (offset < stats.totalBattles) {
      const battles = await prisma.battle.findMany({
        take: batchSize,
        skip: offset,
        orderBy: { createdAt: 'asc' },
      });
      
      if (battles.length === 0) break;
      
      // Estimate cycle numbers for this batch
      const cycleMap = await estimateCycleNumbers(battles);
      
      // Migrate each battle
      for (const battle of battles) {
        try {
          // Check if this battle is already migrated
          const existing = await prisma.auditLog.findFirst({
            where: {
              eventType: EventType.BATTLE_COMPLETE,
              payload: {
                path: ['battleId'],
                equals: battle.id,
              },
            },
          });
          
          if (existing) {
            stats.skippedBattles++;
            if (verbose) {
              console.log(`Skipped battle ${battle.id} (already migrated)`);
            }
            continue;
          }
          
          const cycleNumber = cycleMap.get(battle.id) || 1;
          const sequenceNumber = await getNextSequenceNumber(cycleNumber);
          
          if (!dryRun) {
            await migrateBattle(battle, cycleNumber, sequenceNumber);
          }
          
          stats.migratedBattles++;
          processedCount++;
          
          if (verbose || processedCount % 50 === 0) {
            console.log(`Migrated battle ${battle.id} to cycle ${cycleNumber} (${processedCount}/${stats.totalBattles})`);
          }
        } catch (error) {
          const errorMsg = `Failed to migrate battle ${battle.id}: ${error}`;
          stats.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }
      
      offset += batchSize;
    }
    
    console.log('');
    console.log('=== Migration Complete ===');
    console.log(`Total battles: ${stats.totalBattles}`);
    console.log(`Migrated: ${stats.migratedBattles}`);
    console.log(`Skipped: ${stats.skippedBattles}`);
    console.log(`Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('');
      console.log('Errors:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (dryRun) {
      console.log('');
      console.log('DRY RUN: No changes were made to the database');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
  
  return stats;
}

/**
 * Verify migration integrity
 */
export async function verifyMigration(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  console.log('=== Verifying Migration Integrity ===');
  
  const issues: string[] = [];
  
  try {
    // Count battles and events
    const battleCount = await prisma.battle.count();
    const eventCount = await prisma.auditLog.count({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });
    
    console.log(`Battles in database: ${battleCount}`);
    console.log(`Battle events in audit log: ${eventCount}`);
    
    if (battleCount !== eventCount) {
      issues.push(`Mismatch: ${battleCount} battles but ${eventCount} events`);
    }
    
    // Verify all battles have corresponding events
    const battles = await prisma.battle.findMany({
      select: { id: true },
    });
    
    for (const battle of battles) {
      const event = await prisma.auditLog.findFirst({
        where: {
          eventType: EventType.BATTLE_COMPLETE,
          payload: {
            path: ['battleId'],
            equals: battle.id,
          },
        },
      });
      
      if (!event) {
        issues.push(`Battle ${battle.id} has no corresponding event`);
      }
    }
    
    // Check for duplicate events
    const duplicates = await prisma.$queryRaw<Array<{ battleId: number; count: bigint }>>`
      SELECT 
        (payload->>'battleId')::int as "battleId",
        COUNT(*) as count
      FROM audit_logs
      WHERE event_type = ${EventType.BATTLE_COMPLETE}
      GROUP BY payload->>'battleId'
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length > 0) {
      duplicates.forEach(dup => {
        issues.push(`Battle ${dup.battleId} has ${dup.count} duplicate events`);
      });
    }
    
    console.log('');
    if (issues.length === 0) {
      console.log('✓ Migration integrity verified - all checks passed');
    } else {
      console.log(`✗ Found ${issues.length} integrity issues:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
    issues.push(`Verification error: ${error}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  const verbose = args.includes('--verbose');
  
  (async () => {
    try {
      if (verify) {
        await verifyMigration();
      } else {
        await migrateBattlesToEvents({ dryRun, verbose });
        
        // Auto-verify after migration
        console.log('');
        await verifyMigration();
      }
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Migration script failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
}
