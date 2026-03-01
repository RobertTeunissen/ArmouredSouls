import { PrismaClient } from '@prisma/client';

// Use a singleton pattern to ensure only one Prisma Client instance
// This is especially important for tests to avoid "too many connections" errors
declare global {
   
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
