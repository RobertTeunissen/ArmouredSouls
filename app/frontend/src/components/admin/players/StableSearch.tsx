/**
 * Find any stable — a player, an Automaton or a generated stable — by #id,
 * username, email, stable name or robot name, and open its detail panel.
 * The Players list below covers human stables only.
 */
import { useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { ApiError } from '../../../utils/ApiError';
import { searchStables, type StableKind, type StableSearchResult } from '../../../utils/adminPlayersApi';
import { STABLE_KIND_LABELS, displayName } from '../../../utils/adminPlayersFormat';

export interface StableSearchProps {
  onOpen: (userId: number) => void;
}

const KIND_TONE: Readonly<Record<StableKind, string>> = {
  human: 'bg-primary/15 text-primary',
  automaton: 'bg-info/15 text-info',
  generated: 'bg-white/10 text-secondary',
};

export function StableKindTag({ kind }: { kind: StableKind }): ReactNode {
  return <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs ${KIND_TONE[kind]}`}>{STABLE_KIND_LABELS[kind]}</span>;
}

export function StableSearch({ onOpen }: StableSearchProps): ReactNode {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StableSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const q = query.trim();
    if (q === '') return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setSearching(true);
    setError(null);
    try {
      const found = await searchStables(q, current.signal);
      if (!current.signal.aborted) setResults(found);
    } catch (err) {
      if (!current.signal.aborted) setError((err instanceof ApiError && err.message) || 'The search failed.');
    } finally {
      if (!current.signal.aborted) setSearching(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-surface p-4">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor={inputId} className="sr-only">Find any stable</label>
        <input
          id={inputId}
          type="search"
          value={query}
          maxLength={50}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find any stable: player, Automaton or generated · name, stable, robot, email or #id"
          className={`min-h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white placeholder:text-secondary ${ADMIN_FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={searching || query.trim() === ''}
          className={`min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-background disabled:opacity-50 ${ADMIN_FOCUS_RING}`}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
      {results !== null && !error && (
        results.length === 0 ? (
          <p className="mt-3 text-sm text-secondary" role="status">No stable matches “{query.trim()}”.</p>
        ) : (
          <ul className="mt-3 space-y-1" aria-label="Search results">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => onOpen(result.id)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-elevated ${ADMIN_FOCUS_RING}`}
                >
                  <StableKindTag kind={result.stableKind} />
                  <span className="min-w-0 truncate font-semibold text-white">{displayName(result)}</span>
                  <span className="min-w-0 truncate text-secondary">@{result.username} · #{result.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
