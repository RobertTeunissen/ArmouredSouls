/** Labels of the admin Economy page's stable scopes. */
import type { EconomyStableScope } from './adminEconomyApi';

export const SCOPE_LABELS: Readonly<Record<EconomyStableScope, string>> = {
  players: 'Players',
  automatons: 'Automatons',
  generated: 'Generated',
  all: 'All',
};

const SCOPE_NOUN: Readonly<Record<EconomyStableScope, string>> = {
  players: 'human stables',
  automatons: 'Automaton stables',
  generated: 'generated stables',
  all: 'all stables',
};

export function scopeNoun(scope: EconomyStableScope): string {
  return SCOPE_NOUN[scope];
}
