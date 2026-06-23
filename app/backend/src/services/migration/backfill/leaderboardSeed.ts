/**
 * Leaderboard Cache Seed Script
 * Runs leaderboardService.refreshAll() to populate the cache.
 */
import { leaderboardService } from '../../leaderboard/leaderboardService';
import logger from '../../../config/logger';

export async function seedLeaderboardCache(): Promise<void> {
  logger.info('[Backfill] Seeding leaderboard cache...');
  await leaderboardService.refreshAll();
  logger.info('[Backfill] Leaderboard cache seeded successfully');
}
