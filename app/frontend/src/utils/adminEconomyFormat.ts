/** Labels of the admin Economy page's stable scopes. */
import type { EconomyStableScope } from './adminEconomyApi';
import { STABLE_SCOPE_LABELS } from './adminStableScope';

export const SCOPE_LABELS: Readonly<Record<EconomyStableScope, string>> = STABLE_SCOPE_LABELS;

const SCOPE_NOUN: Readonly<Record<EconomyStableScope, string>> = {
  players: 'human stables',
  automatons: 'Automaton stables',
  generated: 'generated stables',
  all: 'all stables',
};

export function scopeNoun(scope: EconomyStableScope): string {
  return SCOPE_NOUN[scope];
}
