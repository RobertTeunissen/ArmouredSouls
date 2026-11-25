import type { ReactNode } from 'react';

interface LeaderboardBodyProps {
  loading: boolean;
  /** Message shown when the request failed, or null. */
  error: string | null;
  /** Number of rows loaded; 0 shows `emptyText`. */
  count: number;
  emptyText: string;
  /** Noun for the footer, e.g. "robots" in "Showing top 100 robots". */
  countNoun: string;
  /** Desktop table and mobile cards for the loaded rows. */
  children: ReactNode;
}

/** Loading, error, empty and footer states shared by the three leaderboards. */
function LeaderboardBody({ loading, error, count, emptyText, countNoun, children }: LeaderboardBodyProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-secondary">Loading leaderboard...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-6 text-error">
        {error}
      </div>
    );
  }
  return (
    <>
      <div className="bg-surface-elevated border border-white/10 rounded-lg overflow-hidden">
        {children}
        {count === 0 && <div className="text-center py-12 text-secondary">{emptyText}</div>}
      </div>
      {count > 0 && (
        <div className="mt-4 text-sm text-tertiary text-center">
          Showing top {count} {countNoun}
        </div>
      )}
    </>
  );
}

export default LeaderboardBody;
