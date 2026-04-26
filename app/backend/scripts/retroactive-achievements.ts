/**
 * Retroactive Achievement Awards Script
 *
 * Run once before enabling the achievement feature on the frontend.
 * Evaluates all achievement conditions against existing player data
 * and awards any already-qualified achievements.
 *
 * The script uses the existing AchievementService.checkAndAward() which
 * handles idempotency — safe to run multiple times without duplicate awards.
 *
 * Usage: npx tsx scripts/retroactive-achievements.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { ACHIEVEMENTS } from '../src/config/achievements';
import { achievementService } from '../src/services/achievement';
import type { AchievementEventType } from '../src/services/achievement';

// Create standalone Prisma client for direct queries in this script
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main(): Promise<void> {
  console.log('=== Retroactive Achievement Awards ===');
  console.log(`Total achievements in config: ${ACHIEVEMENTS.length}`);

  // Load all users (excluding bye robot user)
  const users = await prisma.user.findMany({
    where: { NOT: { username: 'bye_robot_user' } },
    select: { id: true, username: true, stableName: true },
  });

  console.log(`Processing ${users.length} users...\n`);

  let totalAwards = 0;
  let totalCredits = 0;
  let totalPrestige = 0;

  for (const user of users) {
    try {
      // Load user's robots (excluding Bye Robot)
      const robots = await prisma.robot.findMany({
        where: { userId: user.id, name: { not: 'Bye Robot' } },
        select: { id: true, name: true },
      });

      let userAwards = 0;
      let userCredits = 0;
      let userPrestige = 0;

      // For each robot, check robot-level achievements via battle_complete event
      // This covers: wins, kills, elo, battles, streaks, stance/loadout wins,
      // prestige, fame, streaming revenue, lifetime earnings, currency, etc.
      for (const robot of robots) {
        const unlocked = await achievementService.checkAndAward(user.id, robot.id, {
          type: 'battle_complete',
          data: {
            won: false,
            destroyed: false,
            finalHpPercent: 100,
            eloDiff: 0,
            opponentElo: 0,
            yielded: false,
            opponentYielded: false,
            previousBattleLost: false,
            damageDealt: 0,
            opponentDamageDealt: 0,
            loadoutType: 'single',
            stance: 'balanced',
            yieldThreshold: 10,
            hasTuning: false,
            hasMainWeapon: true,
            battleType: 'league',
            battleDurationSeconds: 60,
          },
        });

        for (const a of unlocked) {
          userAwards++;
          userCredits += a.rewardCredits;
          userPrestige += a.rewardPrestige;
        }
      }

      // Check user-level achievements (no robot needed) via battle_complete
      // This covers prestige thresholds, currency, streaming revenue, etc.
      const userUnlocked = await achievementService.checkAndAward(user.id, null, {
        type: 'battle_complete',
        data: {
          won: false,
          destroyed: false,
          finalHpPercent: 100,
          eloDiff: 0,
          opponentElo: 0,
          yielded: false,
          opponentYielded: false,
          previousBattleLost: false,
          damageDealt: 0,
          opponentDamageDealt: 0,
          loadoutType: 'single',
          stance: 'balanced',
          yieldThreshold: 10,
          hasTuning: false,
          hasMainWeapon: true,
          battleType: 'league',
          battleDurationSeconds: 60,
        },
      });

      for (const a of userUnlocked) {
        userAwards++;
        userCredits += a.rewardCredits;
        userPrestige += a.rewardPrestige;
      }

      // Check non-battle event types that have cumulative trigger conditions
      // These cover: onboarding, weapon purchases, facility upgrades, robot count,
      // tuning allocation, practice battles, league promotions, tournament wins
      const nonBattleEventTypes: AchievementEventType[] = [
        'onboarding_complete',
        'weapon_purchased',
        'weapon_equipped',
        'facility_upgraded',
        'robot_created',
        'tuning_allocated',
        'practice_battle',
        'league_promotion',
        'tournament_complete',
        'attribute_upgraded',
        'stance_changed',
        'daily_finances',
      ];

      for (const eventType of nonBattleEventTypes) {
        // Use the first robot for robot-context events, null for user-level
        const contextRobotId = robots[0]?.id ?? null;
        const unlocked = await achievementService.checkAndAward(user.id, contextRobotId, {
          type: eventType,
          data: {},
        });

        for (const a of unlocked) {
          userAwards++;
          userCredits += a.rewardCredits;
          userPrestige += a.rewardPrestige;
        }
      }

      totalAwards += userAwards;
      totalCredits += userCredits;
      totalPrestige += userPrestige;

      const displayName = user.stableName || user.username;
      if (userAwards > 0) {
        console.log(
          `  User ${user.id} (${displayName}): ${userAwards} achievements, ` +
            `+₡${userCredits.toLocaleString()}, +${userPrestige} prestige`,
        );
      }
    } catch (error) {
      console.error(`  ERROR processing user ${user.id}: ${error}`);
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Total awards: ${totalAwards}`);
  console.log(`Total credits awarded: ₡${totalCredits.toLocaleString()}`);
  console.log(`Total prestige awarded: ${totalPrestige}`);
  console.log(`Users processed: ${users.length}`);
}

main()
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nRetroactive achievement migration failed:', error);
    process.exit(1);
  });
