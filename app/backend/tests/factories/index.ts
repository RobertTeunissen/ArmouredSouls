/**
 * Test Factories — Database Unification (Spec #40)
 *
 * Plain object factories for unit testing the unified models.
 * These return typed objects matching Prisma model shapes without hitting the database.
 */

export {
  createStanding,
  createStandingForMode,
  STANDINGS_MODES,
  TIERS,
} from './standingFactory';
export type { Standing, StandingsMode } from './standingFactory';

export {
  createScheduledMatch,
  createMatchWithParticipants,
  createScheduledMatchParticipant,
  MATCH_TYPES,
  LEAGUE_MATCH_TYPES,
  TOURNAMENT_MATCH_TYPES,
} from './scheduledMatchFactory';
export type { ScheduledMatch, ScheduledMatchParticipant, MatchType } from './scheduledMatchFactory';

export {
  createLedgerEntry,
  createLedgerEntryForType,
  TRANSACTION_TYPES,
  INCOME_TYPES,
  EXPENSE_TYPES,
} from './financialLedgerFactory';
export type { FinancialLedger, TransactionType } from './financialLedgerFactory';

export {
  createCacheEntry,
  createLeaderboard,
  LEADERBOARD_CATEGORIES,
} from './leaderboardCacheFactory';
export type { LeaderboardCache, LeaderboardCategory } from './leaderboardCacheFactory';

export {
  createParticipant,
  createTagTeamParticipants,
  createKothParticipants,
  create1v1Participants,
  PARTICIPANT_ROLES,
} from './battleParticipantFactory';
export type { BattleParticipant, ParticipantRole } from './battleParticipantFactory';
