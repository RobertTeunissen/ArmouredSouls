/**
 * StableNoteCard — the player's private, per-stable strategy note, shown on the
 * Command Center dashboard (#611).
 *
 * This is a read-only, non-dismissible panel: the note is persistent profile
 * state, not an alert, so it has no dismiss affordance and is edited on the
 * Profile page. It borrows the `info` variant styling from DashboardNotification
 * (left accent, icon, `bg-primary/10 border-primary`) so it sits visually among
 * the dashboard's notification stack.
 *
 * It renders nothing when the note is empty or whitespace-only — a stable with no
 * note takes up no space. Line breaks and paragraphs are preserved with
 * `whitespace-pre-wrap`.
 */

import { Link } from 'react-router-dom';

export interface StableNoteCardProps {
  /** The saved note. Null/empty/whitespace-only renders nothing. */
  note: string | null | undefined;
}

export function StableNoteCard({ note }: StableNoteCardProps): React.JSX.Element | null {
  if (!note || note.trim().length === 0) {
    return null;
  }

  return (
    <section
      className="p-4 rounded-lg border-l-4 bg-primary/10 border-primary"
      aria-label="Stable notes"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="text-2xl flex-shrink-0" aria-hidden="true">📝</span>
          <div className="min-w-0">
            <h2 className="font-semibold text-primary">Stable Notes</h2>
            <p className="text-sm text-white/90 mt-1 whitespace-pre-wrap break-words">{note}</p>
          </div>
        </div>
        <Link
          to="/profile"
          className="text-sm text-primary hover:underline flex-shrink-0 min-h-[44px] flex items-center"
        >
          Edit in Profile
        </Link>
      </div>
    </section>
  );
}

export default StableNoteCard;
