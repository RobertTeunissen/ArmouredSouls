/**
 * The repository Strategy_Registry (Spec #55, design §14.0): every file of
 * `config/automaton-strategies` with the approved Build_Focus weights, loaded
 * once. The server startup check has validated the files before first use.
 * Kept apart from the turn runner so the catalogue tooling can use it without
 * loading the turn and cycle modules.
 */
import { BUILD_FOCUS_WEIGHTS } from '../buildFocus';
import { loadStrategyRegistry, type StrategyRegistry } from './registry';

let defaultRegistry: StrategyRegistry | null = null;

/** The repository Strategy_Registry, loaded once. */
export function getStrategyRegistry(): StrategyRegistry {
  if (!defaultRegistry) defaultRegistry = loadStrategyRegistry({ weightTable: BUILD_FOCUS_WEIGHTS });
  return defaultRegistry;
}
