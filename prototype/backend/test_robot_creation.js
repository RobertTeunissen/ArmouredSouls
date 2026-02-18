// Simulate what happens when creating a robot
const { PrismaClient } = require('@prisma/client');
const { eventLogger } = require('./dist/services/eventLogger');

const prisma = new PrismaClient();
const ROBOT_CREATION_COST = 500000;

async function testRobotCreation() {
  try {
    console.log('Testing robot creation logging...\n');
    
    // Get player2
    const user = await prisma.user.findUnique({
      where: { username: 'player2' }
    });
    
    console.log(`Player2 ID: ${user.id}`);
    console.log(`Player2 balance: ₡${user.currency.toLocaleString()}\n`);
    
    // Get cycle metadata
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 }
    });
    
    const currentCycle = cycleMetadata?.totalCycles || 0;
    console.log(`Current cycle: ${currentCycle}\n`);
    
    // Try to log a robot creation event
    console.log('Attempting to log robot creation event...');
    await eventLogger.logCreditChange(
      currentCycle,
      user.id,
      -ROBOT_CREATION_COST,
      user.currency - ROBOT_CREATION_COST,
      'other'
    );
    
    console.log('✅ Successfully logged robot creation event\n');
    
    // Verify it was logged
    const events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: currentCycle,
        userId: user.id,
        eventType: 'credit_change',
        payload: {
          path: ['amount'],
          equals: -ROBOT_CREATION_COST
        }
      }
    });
    
    console.log(`Found ${events.length} robot creation events in audit log`);
    if (events.length > 0) {
      console.log('Event details:', JSON.stringify(events[0].payload, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testRobotCreation();
