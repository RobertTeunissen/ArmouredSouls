const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRobotAttributes() {
  try {
    const robot = await prisma.robot.findFirst({
      where: { name: 'Morning Ride' }
    });

    console.log('\nMorning Ride attributes:');
    console.log('combatPower:', robot.combatPower, typeof robot.combatPower);
    console.log('targetingSystems:', robot.targetingSystems, typeof robot.targetingSystems);
    console.log('criticalSystems:', robot.criticalSystems, typeof robot.criticalSystems);
    
    // Try to convert
    console.log('\nConverted:');
    console.log('combatPower:', Number(robot.combatPower));
    console.log('targetingSystems:', Number(robot.targetingSystems));
    
    // Check if it's a Decimal
    console.log('\nIs Decimal?', robot.combatPower.constructor.name);
    
    // Try toString then Number
    console.log('\nUsing toString:');
    console.log('combatPower:', Number(robot.combatPower.toString()));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRobotAttributes();
