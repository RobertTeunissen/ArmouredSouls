/**
 * The admin portal's one stable-type filter (`?stables=`): Players /
 * Automatons / Generated / All. Mirrors `app/backend/src/utils/stableScope.ts`.
 *
 * Players are human stables without system and test accounts; Generated is
 * every generated (bot) stable, including the seeded `test_user_*` stables.
 * The Dashboard and Meta used `?filter=real|auto|automaton|all` before; those
 * links still read correctly.
 */

export const STABLE_SCOPES = ['players', 'automatons', 'generated', 'all'] as const;
export type StableScope = (typeof STABLE_SCOPES)[number];

export const STABLE_SCOPE_LABELS: Readonly<Record<StableScope, string>> = {
  players: 'Players',
  automatons: 'Automatons',
  generated: 'Generated',
  all: 'All',
};

export const STABLE_SCOPE_HELP: Readonly<Record<StableScope, string>> = {
  players: 'Human players only: no generated bots, Automatons or test accounts.',
  automatons: 'Computer-run Automaton stables.',
  generated: 'Generated bot stables, including the seeded test stables.',
  all: 'Every stable.',
};

/** Old `?filter=` values of the Dashboard and Meta. */
const LEGACY_FILTER: Readonly<Record<string, StableScope>> = {
  real: 'players',
  auto: 'generated',
  automaton: 'automatons',
  all: 'all',
};

/** The `?stables=` value (or an old `?filter=` one) among `allowed`, else `fallback`. */
export function readStableScope<T extends StableScope>(
  params: URLSearchParams,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = params.get('stables') ?? LEGACY_FILTER[params.get('filter') ?? ''] ?? null;
  return allowed.find((scope) => scope === raw) ?? fallback;
}

/** Write the scope into the URL; the page's default is left out, and an old `?filter=` is dropped. */
export function writeStableScope(params: URLSearchParams, scope: StableScope, fallback: StableScope): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('filter');
  if (scope === fallback) next.delete('stables');
  else next.set('stables', scope);
  return next;
}
