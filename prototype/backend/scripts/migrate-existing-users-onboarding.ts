/**
 * Data Migration Script: Mark Existing Users as Onboarding Complete
 * 
 * This script updates all existing users to mark them as having completed
 * the onboarding process. This is necessary when deploying the onboarding
 * feature to avoid forcing existing players through the tutorial.
 * 
 * Run this script ONCE after deploying the onboarding schema changes.
 * 
 * Usage:
 *   npx tsx scripts/migrate-existing-users-onboarding.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingUsers() {
  console.log('Starting data migration: Mark existing users as onboarding complete');
  console.log('='.repeat(70));

  try {
    // Count total users before migration
    const totalUsers = await prisma.user.count();
    console.log(`\nTotal users in database: ${totalUsers}`);

    if (totalUsers === 0) {
      console.log('\nNo users found. Migration not needed.');
      return;
    }

    // Find users who haven't been marked as completed yet
    const usersToUpdate = await prisma.user.count({
      where: {
        hasCompletedOnboarding: false
      }
    });

    console.log(`Users to update: ${usersToUpdate}`);

    if (usersToUpdate === 0) {
      console.log('\nAll users already marked as completed. Migration not needed.');
      return;
    }

    // Update all existing users to mark onboarding as completed
    const result = await prisma.user.updateMany({
      where: {
        hasCompletedOnboarding: false
      },
      data: {
        hasCompletedOnboarding: true,
        onboardingSkipped: false,
        onboardingCompletedAt: new Date()
      }
    });

    console.log(`\n✓ Successfully updated ${result.count} users`);
    console.log('  - hasCompletedOnboarding: true');
    console.log('  - onboardingSkipped: false');
    console.log('  - onboardingCompletedAt: current timestamp');

    // Verify the migration
    const verifyCount = await prisma.user.count({
      where: {
        hasCompletedOnboarding: true
      }
    });

    console.log(`\nVerification: ${verifyCount}/${totalUsers} users marked as completed`);

    if (verifyCount === totalUsers) {
      console.log('✓ Migration successful - all users updated');
    } else {
      console.warn('⚠ Warning: Some users may not have been updated');
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(70));
  console.log('Migration complete');
}

// Run the migration
migrateExistingUsers()
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed with error:', error);
    process.exit(1);
  });
