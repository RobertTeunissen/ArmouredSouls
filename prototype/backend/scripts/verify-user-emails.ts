/**
 * Script to verify that all users have email addresses
 * 
 * This script checks:
 * 1. Total number of users
 * 2. Number of users with emails
 * 3. Number of users with placeholder emails
 * 4. Shows sample of users with placeholder emails
 * 
 * Usage:
 *   npx tsx scripts/verify-user-emails.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying user email addresses...\n');

  // Get counts
  const totalUsers = await prisma.user.count();
  const usersWithEmail = await prisma.user.count({
    where: {
      email: { not: null },
    },
  });
  const usersWithoutEmail = await prisma.user.count({
    where: {
      email: null,
    },
  });
  const usersWithPlaceholder = await prisma.user.count({
    where: {
      email: { endsWith: '@leg.local' },
    },
  });

  console.log('📊 Email Statistics:');
  console.log(`  Total users: ${totalUsers}`);
  console.log(`  Users with email: ${usersWithEmail}`);
  console.log(`  Users without email: ${usersWithoutEmail}`);
  console.log(`  Users with placeholder email: ${usersWithPlaceholder}`);

  // Calculate percentages
  const percentWithEmail = ((usersWithEmail / totalUsers) * 100).toFixed(2);
  const percentPlaceholder = ((usersWithPlaceholder / totalUsers) * 100).toFixed(2);

  console.log(`\n  ${percentWithEmail}% of users have email addresses`);
  console.log(`  ${percentPlaceholder}% of users have placeholder emails`);

  // Verification
  if (usersWithEmail === totalUsers) {
    console.log('\n✅ SUCCESS: All users have email addresses!');
  } else {
    console.log(`\n⚠️  WARNING: ${usersWithoutEmail} users still do not have email addresses.`);
  }

  // Show sample of users with placeholder emails
  if (usersWithPlaceholder > 0) {
    console.log('\n📋 Sample of users with placeholder emails:');
    const sampleUsers = await prisma.user.findMany({
      where: {
        email: { endsWith: '@leg.local' },
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
      take: 10,
    });

    sampleUsers.forEach((user) => {
      console.log(`  ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
    });

    if (usersWithPlaceholder > 10) {
      console.log(`  ... and ${usersWithPlaceholder - 10} more users with placeholder emails`);
    }
  }

  // Show sample of users with real emails (if any)
  const usersWithRealEmail = await prisma.user.count({
    where: {
      email: {
        not: {
          endsWith: '@leg.local',
        },
      },
    },
  });

  if (usersWithRealEmail > 0) {
    console.log('\n📧 Sample of users with real email addresses:');
    const sampleRealUsers = await prisma.user.findMany({
      where: {
        email: {
          not: {
            endsWith: '@leg.local',
          },
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
      take: 5,
    });

    sampleRealUsers.forEach((user) => {
      console.log(`  ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
    });
  }
}

main()
  .catch((error) => {
    console.error('❌ Error running verification script:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
