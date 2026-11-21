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
  type PracticeBattleRequest,
} from './practiceArenaService';

export {
  recordPracticeRequest,
} from './practiceArenaUsageService';
