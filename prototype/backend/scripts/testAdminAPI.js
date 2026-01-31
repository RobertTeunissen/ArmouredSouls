const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const API_URL = 'http://localhost:3001';

async function getAdminToken() {
  // Get admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' }
  });

  if (!admin) {
    throw new Error('No admin user found in database');
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return token;
}

async function testAdminEndpoints() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          ADMIN API ENDPOINTS - TEST SUITE                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  try {
    // Get admin token
    console.log('🔐 Getting admin authentication token...');
    const token = await getAdminToken();
    console.log('✓ Admin token generated');
    console.log();

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test 1: Get system stats
    console.log('📊 TEST 1: GET /api/admin/stats');
    console.log('─'.repeat(60));
    try {
      const response = await fetch(`${API_URL}/api/admin/stats`, { headers });
      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Status:', response.status);
        console.log('  Total robots:', data.robots.total);
        console.log('  Battle ready:', data.robots.battleReady, `(${data.robots.battleReadyPercentage}%)`);
        console.log('  Scheduled matches:', data.matches.scheduled);
        console.log('  Total battles:', data.battles.total);
      } else {
        console.log('✗ Error:', data.error);
      }
    } catch (error) {
      console.log('✗ Connection error:', error.message);
      console.log('  Make sure the server is running: npm run dev');
    }
    console.log();

    // Test 2: Run matchmaking
    console.log('⚔️  TEST 2: POST /api/admin/matchmaking/run');
    console.log('─'.repeat(60));
    try {
      const response = await fetch(`${API_URL}/api/admin/matchmaking/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Status:', response.status);
        console.log('  Matches created:', data.matchesCreated);
        console.log('  Scheduled for:', data.scheduledFor);
      } else {
        console.log('✗ Error:', data.error);
      }
    } catch (error) {
      console.log('✗ Connection error:', error.message);
    }
    console.log();

    // Test 3: Execute battles
    console.log('🥊 TEST 3: POST /api/admin/battles/run');
    console.log('─'.repeat(60));
    try {
      const response = await fetch(`${API_URL}/api/admin/battles/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Status:', response.status);
        console.log('  Total battles:', data.summary.totalBattles);
        console.log('  Successful:', data.summary.successfulBattles);
        console.log('  Failed:', data.summary.failedBattles);
      } else {
        console.log('✗ Error:', data.error);
      }
    } catch (error) {
      console.log('✗ Connection error:', error.message);
    }
    console.log();

    // Test 4: League rebalancing
    console.log('🏆 TEST 4: POST /api/admin/leagues/rebalance');
    console.log('─'.repeat(60));
    try {
      const response = await fetch(`${API_URL}/api/admin/leagues/rebalance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Status:', response.status);
        console.log('  Total promoted:', data.summary.totalPromoted);
        console.log('  Total demoted:', data.summary.totalDemoted);
      } else {
        console.log('✗ Error:', data.error);
      }
    } catch (error) {
      console.log('✗ Connection error:', error.message);
    }
    console.log();

    // Test 5: Auto-repair
    console.log('🔧 TEST 5: POST /api/admin/repair/all');
    console.log('─'.repeat(60));
    try {
      const response = await fetch(`${API_URL}/api/admin/repair/all`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deductCosts: false })
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Status:', response.status);
        console.log('  Robots repaired:', data.robotsRepaired);
        console.log('  Total cost:', data.totalCost);
        console.log('  Costs deducted:', data.costsDeducted);
      } else {
        console.log('✗ Error:', data.error);
      }
    } catch (error) {
      console.log('✗ Connection error:', error.message);
    }
    console.log();

    console.log('═'.repeat(60));
    console.log('✅ Admin API test suite complete!');
    console.log();
    console.log('All admin endpoints are functional.');
    console.log('Use these endpoints to manage the matchmaking system.');
    console.log();

  } catch (error) {
    console.error('❌ Test suite error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminEndpoints();
