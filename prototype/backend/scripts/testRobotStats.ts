#!/usr/bin/env tsx

/**
 * Example script demonstrating how to use the Admin Robot Statistics endpoint
 * 
 * Usage:
 *   tsx scripts/testRobotStats.ts
 * 
 * Prerequisites:
 *   - Backend server running on http://localhost:3001
 *   - Admin user created (username: admin, password: adminpass)
 *   - Some robots in the database with battle history
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

interface RobotStatsResponse {
  summary: {
    totalRobots: number;
    robotsWithBattles: number;
    totalBattles: number;
    overallWinRate: number;
    averageElo: number;
  };
  attributeStats: Record<string, {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    lowerBound: number;
    upperBound: number;
  }>;
  outliers: Record<string, Array<{
    id: number;
    name: string;
    value: number;
    league: string;
    elo: number;
    winRate: number;
  }>>;
  statsByLeague: Record<string, any>;
  winRateAnalysis: Record<string, Array<{
    quintile: number;
    avgValue: number;
    avgWinRate: number;
    sampleSize: number;
  }>>;
  topPerformers: Record<string, any[]>;
  bottomPerformers: Record<string, any[]>;
}

async function loginAsAdmin(): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'adminpass'
    });
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error);
    throw new Error('Failed to login as admin');
  }
}

async function getRobotStats(token: string): Promise<RobotStatsResponse> {
  try {
    const response = await axios.get(`${API_BASE}/admin/stats/robots`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch robot stats:', error);
    throw error;
  }
}

function printSummary(stats: RobotStatsResponse): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 ROBOT STATISTICS SUMMARY');
  console.log('='.repeat(70));
  
  const { summary } = stats;
  console.log(`\nTotal Robots: ${summary.totalRobots}`);
  console.log(`Robots with Battles: ${summary.robotsWithBattles}`);
  console.log(`Total Battles: ${summary.totalBattles}`);
  console.log(`Overall Win Rate: ${summary.overallWinRate.toFixed(2)}%`);
  console.log(`Average ELO: ${summary.averageElo}`);
}

function printAttributeStats(stats: RobotStatsResponse): void {
  console.log('\n' + '='.repeat(70));
  console.log('📈 ATTRIBUTE STATISTICS');
  console.log('='.repeat(70));
  
  const topAttributes = ['combatPower', 'targetingSystems', 'hullIntegrity', 'armorPlating', 'evasionThrusters'];
  
  console.log('\nTop 5 Attributes (Combat Systems & Defense):');
  console.log('-'.repeat(70));
  console.log('Attribute'.padEnd(20) + 'Mean'.padStart(8) + 'Median'.padStart(8) + 'StdDev'.padStart(8) + 'Min'.padStart(8) + 'Max'.padStart(8));
  console.log('-'.repeat(70));
  
  for (const attr of topAttributes) {
    const s = stats.attributeStats[attr];
    if (s) {
      console.log(
        attr.padEnd(20) +
        s.mean.toFixed(2).padStart(8) +
        s.median.toFixed(2).padStart(8) +
        s.stdDev.toFixed(2).padStart(8) +
        s.min.toFixed(2).padStart(8) +
        s.max.toFixed(2).padStart(8)
      );
    }
  }
}

function printOutliers(stats: RobotStatsResponse): void {
  console.log('\n' + '='.repeat(70));
  console.log('⚠️  OUTLIER DETECTION');
  console.log('='.repeat(70));
  
  const outlierCount = Object.keys(stats.outliers).length;
  console.log(`\nAttributes with outliers: ${outlierCount}`);
  
  if (outlierCount > 0) {
    for (const [attr, robots] of Object.entries(stats.outliers).slice(0, 3)) {
      console.log(`\n${attr} (${robots.length} outliers):`);
      console.log('-'.repeat(70));
      
      for (const robot of robots.slice(0, 3)) {
        console.log(`  • ${robot.name} (ID: ${robot.id})`);
        console.log(`    Value: ${robot.value} | League: ${robot.league} | ELO: ${robot.elo} | Win Rate: ${robot.winRate}%`);
      }
    }
  } else {
    console.log('\nNo outliers detected.');
  }
}

function printWinRateAnalysis(stats: RobotStatsResponse): void {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 WIN RATE CORRELATION ANALYSIS');
  console.log('='.repeat(70));
  
  // Find attributes with strongest correlation
  const correlations: Array<{ attr: string; spread: number; q1: number; q5: number }> = [];
  
  for (const [attr, quintiles] of Object.entries(stats.winRateAnalysis)) {
    if (quintiles.length >= 5) {
      const q1WinRate = quintiles[0].avgWinRate;
      const q5WinRate = quintiles[4].avgWinRate;
      const spread = q5WinRate - q1WinRate;
      correlations.push({ attr, spread, q1: q1WinRate, q5: q5WinRate });
    }
  }
  
  correlations.sort((a, b) => b.spread - a.spread);
  
  console.log('\nTop 5 Attributes by Win Rate Impact:');
  console.log('-'.repeat(70));
  console.log('Attribute'.padEnd(20) + 'Q1 Win%'.padStart(10) + 'Q5 Win%'.padStart(10) + 'Spread'.padStart(10));
  console.log('-'.repeat(70));
  
  for (const item of correlations.slice(0, 5)) {
    console.log(
      item.attr.padEnd(20) +
      item.q1.toFixed(1).padStart(10) +
      item.q5.toFixed(1).padStart(10) +
      item.spread.toFixed(1).padStart(10)
    );
  }
  
  console.log('\nInterpretation:');
  console.log('  • Spread > 20%: Strong impact on win rate (may be overpowered)');
  console.log('  • Spread 10-20%: Moderate impact (balanced)');
  console.log('  • Spread < 10%: Weak impact (may need buff)');
}

function printLeagueComparison(stats: RobotStatsResponse): void {
  console.log('\n' + '='.repeat(70));
  console.log('🏆 LEAGUE TIER COMPARISON');
  console.log('='.repeat(70));
  
  const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
  const attr = 'combatPower'; // Example attribute
  
  console.log(`\n${attr} progression across leagues:`);
  console.log('-'.repeat(70));
  console.log('League'.padEnd(15) + 'Count'.padStart(8) + 'Avg ELO'.padStart(10) + 'Mean'.padStart(10) + 'Median'.padStart(10));
  console.log('-'.repeat(70));
  
  for (const league of leagues) {
    const leagueData = stats.statsByLeague[league];
    if (leagueData) {
      const attrData = leagueData.attributes[attr];
      console.log(
        league.padEnd(15) +
        leagueData.count.toString().padStart(8) +
        leagueData.averageElo.toString().padStart(10) +
        (attrData ? attrData.mean.toFixed(2).padStart(10) : 'N/A'.padStart(10)) +
        (attrData ? attrData.median.toFixed(2).padStart(10) : 'N/A'.padStart(10))
      );
    }
  }
}

function printTopPerformers(stats: RobotStatsResponse): void {
  console.log('\n' + '='.repeat(70));
  console.log('🌟 TOP PERFORMERS');
  console.log('='.repeat(70));
  
  const attr = 'combatPower'; // Example attribute
  const topRobots = stats.topPerformers[attr];
  
  if (topRobots && topRobots.length > 0) {
    console.log(`\nTop 5 robots by ${attr}:`);
    console.log('-'.repeat(70));
    
    for (let i = 0; i < Math.min(5, topRobots.length); i++) {
      const robot = topRobots[i];
      console.log(`${i + 1}. ${robot.name} (${robot.value})`);
      console.log(`   League: ${robot.league} | ELO: ${robot.elo} | Win Rate: ${robot.winRate}%`);
    }
  }
}

async function main(): Promise<void> {
  try {
    console.log('🤖 Admin Robot Statistics Test Script');
    console.log('Connecting to:', API_BASE);
    
    // Step 1: Login
    console.log('\n🔐 Logging in as admin...');
    const token = await loginAsAdmin();
    console.log('✅ Login successful');
    
    // Step 2: Fetch stats
    console.log('\n📊 Fetching robot statistics...');
    const stats = await getRobotStats(token);
    console.log('✅ Statistics retrieved');
    
    // Step 3: Display results
    printSummary(stats);
    printAttributeStats(stats);
    printOutliers(stats);
    printWinRateAnalysis(stats);
    printLeagueComparison(stats);
    printTopPerformers(stats);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Analysis complete!');
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main();
