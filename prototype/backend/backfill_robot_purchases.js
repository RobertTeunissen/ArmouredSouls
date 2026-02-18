/**
 * Backfill Robot Purchase Events
 * 
 * This script creates audit log entries for robot purchases that happened
 * before event logging was implemented.
 * 
 * Run with: node backfill_robot_purchases.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROBOT_CREATION_COST = 500000;

async function backfillRobotPurchases() {
  try {
    console.log('=== Backfilling Robot Purchase Events ===\n');
    
    // Get all robots
    const robots = await prisma.robot.findMany({
      include: {
        user: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${robots.length} robots\n`);
    
    let backfilled = 0;
    let skipped = 0;
    
    for (const robot of robots) {
      // Check if there's already a credit_change event for this robot creation
      // We'll check for events around the robot creation time
      const existingEvent = await prisma.auditLog.findFirst({
        where: {
          userId: robot.userId,
          eventType: 'credit_change',
          eventTimestamp: {
            gte: new Date(robot.createdAt.getTime() - 1000), // 1 second before
            lte: new Date(robot.createdAt.getTime() + 1000), // 1 second after
          },
          payload: {
            path: ['amount'],
            equals: -ROBOT_CREATION_COST
          }
        }
      });
      
      if (existingEvent) {
        console.log(`✓ Robot "${robot.name}" (${robot.user.username}) - already logged`);
        skipped++;
        continue;
      }
      
      // Determine cycle number (0 for robots created before first cycle)
      const cycleNumber = 0; // All existing robots were created before cycles started
      
      // Get next sequence number for cycle 0
      const lastEvent = await prisma.auditLog.findFirst({
        where: { cycleNumber: 0 },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true }
      });
      
      const sequenceNumber = lastEvent ? lastEvent.sequenceNumber + 1 : 1;
      
      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          cycleNumber,
          eventType: 'credit_change',
          eventTimestamp: robot.createdAt,
          sequenceNumber,
          userId: robot.userId,
          robotId: robot.id,
          payload: {
            amount: -ROBOT_CREATION_COST,
            source: 'robot_creation',
            robotName: robot.name,
            note: 'Backfilled event'
          }
        }
      });
      
      console.log(`✓ Robot "${robot.name}" (${robot.user.username}) - backfilled ₡${ROBOT_CREATION_COST.toLocaleString()}`);
      backfilled++;
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Backfilled: ${backfilled}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${robots.length}`);
    
    if (backfilled > 0) {
      console.log('\n⚠️  IMPORTANT: Run cycle snapshot backfill to update cycle summaries!');
      console.log('   POST http://localhost:3001/api/admin/backfill-snapshots');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillRobotPurchases();
