/**
 * Practice Arena — barrel file
 *
 * Re-exports the public API of the practice-arena domain.
 *
 * @module services/practice-arena
 */

export {
  executePracticeBattle,
  executePracticeBatch,
  getSparringPartnerDefinitions,
  type BotTier,
  type SparringPartnerConfig,
  type WhatIfOverrides,
  type BattleSlot,
  type PracticeBattleRequest,
  type PracticeBattleResult,
  type PracticeBatchResult,
  type SparringPartnerDefinition,
} from './practiceArenaService';

export {
  recordPracticeRequest,
  type PracticeOutcome,
} from './practiceArenaUsageService';
