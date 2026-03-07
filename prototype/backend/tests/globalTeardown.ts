/**
 * Global Teardown - Runs once after all tests
 * Cleans up any remaining test data
 */

import prisma from '../src/lib/prisma';


export default async function globalTeardown() {
  // Global test teardown complete
  
  // Note: Database cleanup is handled by individual test files
}
