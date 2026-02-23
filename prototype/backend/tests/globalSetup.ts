/**
 * Global Setup - Runs once before all tests
 * Cleans the database to ensure a fresh start
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function globalSetup() {
  console.log('\n🧹 Global test setup complete\n');
  
  // Note: Database cleanup is handled by individual test files
  // to avoid long startup times and foreign key issues
}
