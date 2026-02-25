/**
 * Global Teardown - Runs once after all tests
 * Cleans up any remaining test data
 */

import prisma from '../src/lib/prisma';


export default async function globalTeardown() {
  console.log('\n✅ Global test teardown complete\n');
  
  // Note: Database cleanup is handled by individual test files
}
