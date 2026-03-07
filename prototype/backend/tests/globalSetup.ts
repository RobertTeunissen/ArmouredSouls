/**
 * Global Setup - Runs once before all tests
 * Cleans the database to ensure a fresh start
 */

import prisma from '../src/lib/prisma';


export default async function globalSetup() {
  // Global test setup complete
  
  // Note: Database cleanup is handled by individual test files
  // to avoid long startup times and foreign key issues
}
