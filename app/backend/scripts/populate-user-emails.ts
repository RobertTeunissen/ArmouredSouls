/**
 * Script to populate existing users with placeholder emails
 * 
 * This script:
 * 1. Finds all users without an email address
 * 2. Generates placeholder emails in format {user_id}@leg.local
 * 3. Updates the database
 * 4. Verifies all users now have emails
 * 
 * Note: Uses user ID instead of username to ensure emails fit within
 * the VARCHAR(20) constraint. Format: {user_id}@leg.local
 * 
 * Usage:
 *   npx tsx scripts/populate-user-emails.ts
 * 
 * Requirements: 1.5
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function main() {
  console.log('🔍 Checking for users without email addresses...\n');

  // Count users without emails
  const usersWithoutEmail = await prisma.user.count({
    where: {
      email: null,
    },
  });

  console.log(`Found ${usersWithoutEmail} users without email addresses`);

  if (usersWithoutEmail === 0) {
    console.log('✅ All users already have email addresses. Nothing to do.');
    return;
  }

  console.log('\n📝 Generating placeholder emails...\n');

  // Fetch users without emails
  const users = await prisma.user.findMany({
    where: {
      email: null,
    },
    select: {
      id: true,
      username: true,
    },
  });

  // Update each user with placeholder email
  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const placeholderEmail = `${user.id}@leg.local`;
    
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: placeholderEmail },
      });
      
      console.log(`✓ Updated user ${user.username} (ID: ${user.id}) → ${placeholderEmail}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to update user ${user.username} (ID: ${user.id}):`, error);
      errorCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Successfully updated: ${successCount} users`);
  if (errorCount > 0) {
    console.log(`  ❌ Failed to update: ${errorCount} users`);
  }

  // Verification
  console.log('\n🔍 Verifying results...\n');

  const totalUsers = await prisma.user.count();
  const usersWithEmail = await prisma.user.count({
    where: {
      email: { not: null },
    },
  });
  const usersWithPlaceholder = await prisma.user.count({
    where: {
      email: { endsWith: '@leg.local' },
    },
  });

  console.log('Verification Results:');
  console.log(`  Total users: ${totalUsers}`);
  console.log(`  Users with email: ${usersWithEmail}`);
  console.log(`  Users with placeholder email: ${usersWithPlaceholder}`);
  console.log(`  Users without email: ${totalUsers - usersWithEmail}`);

  if (usersWithEmail === totalUsers) {
    console.log('\n✅ SUCCESS: All users now have email addresses!');
  } else {
    console.log('\n⚠️  WARNING: Some users still do not have email addresses.');
  }

  // Show sample of updated users
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
    take: 5,
  });

  sampleUsers.forEach((user) => {
    console.log(`  ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
  });
}

main()
  .catch((error) => {
    console.error('❌ Error running migration script:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
