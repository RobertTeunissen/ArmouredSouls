const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllPurchases() {
  try {
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' },
      include: {
        robots: {
          select: { id: true, name: true }
        }
      }
    });
    
    console.log(`Player1 current balance: ₡${player1.currency.toLocaleString()}`);
    console.log(`Player1 robots: ${player1.robots.map(r => r.name).join(', ')}`);
    
    // Check attribute upgrades
    console.log('\n=== Attribute Upgrades (Cycle 0) ===\n');
    const attrUpgrades = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        eventType: 'attribute_upgrade',
      }
    });
    
    console.log(`Total attribute upgrades in cycle 0: ${attrUpgrades.length}`);
    
    // Check if any are for player1's robots
    const player1RobotIds = player1.robots.map(r => r.id);
    const player1AttrUpgrades = attrUpgrades.filter(e => 
      player1RobotIds.includes(e.robotId)
    );
    
    console.log(`Player1's attribute upgrades: ${player1AttrUpgrades.length}`);
    
    if (player1AttrUpgrades.length > 0) {
      const totalCost = player1AttrUpgrades.reduce((sum, e) => 
        sum + (e.payload?.cost || 0), 0
      );
      console.log(`Total cost: ₡${totalCost.toLocaleString()}`);
      
      player1AttrUpgrades.slice(0, 5).forEach(e => {
        console.log(`  - Robot ${e.robotId}: ${e.payload?.attributeName} ${e.payload?.oldValue} → ${e.payload?.newValue}, cost: ₡${e.payload?.cost}`);
      });
    }
    
    // Check robot purchases
    console.log('\n=== Robot Purchases ===\n');
    const robotPurchases = await prisma.auditLog.findMany({
      where: {
        eventType: 'robot_purchase',
      }
    });
    
    console.log(`Total robot purchases logged: ${robotPurchases.length}`);
    
    // Calculate what SHOULD have been spent
    console.log('\n=== Expected Spending ===\n');
    console.log('Starting balance: ₡3,000,000');
    console.log('Current balance: ₡' + player1.currency.toLocaleString());
    console.log('Expected spending: ₡' + (3000000 - player1.currency).toLocaleString());
    
    console.log('\n=== Actual Logged Spending (Cycle 0) ===\n');
    const allCycle0 = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        OR: [
          { userId: player1.id },
          { robotId: { in: player1RobotIds } }
        ]
      }
    });
    
    const purchaseEvents = allCycle0.filter(e => 
      e.eventType.includes('purchase') || e.eventType.includes('upgrade')
    );
    
    const totalLogged = purchaseEvents.reduce((sum, e) => 
      sum + (e.payload?.cost || 0), 0
    );
    
    console.log(`Total logged: ₡${totalLogged.toLocaleString()}`);
    console.log(`Missing: ₡${(3000000 - player1.currency - totalLogged).toLocaleString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPurchases();
