/**
 * Typed confirmation of a rollover. The admin types the confirmation phrase;
 * the season number is sent for them (the server refuses a stale one). The
 * dialog repeats what will happen, with the preview's counts when loaded.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { RolloverPreview } from '../../../utils/seasonApi';
import { formatCount } from '../../../utils/adminSeasonFormat';
import { ActionButton, Dialog, INPUT_CLASS } from '../automatons/ui';

export const CONFIRM_PHRASE = 'CONFIRM_ROLLOVER';

const plural = (count: number, noun: string): string => `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;

export interface RolloverConfirmDialogProps {
  /** The season the dialog was opened for. */
  seasonNumber: number;
  /**
   * That season is no longer current, or a rollover started meanwhile: the
   * confirm button stays disabled and the admin has to reopen the dialog.
   */
  stale?: boolean;
  preview: RolloverPreview | null;
  busy: boolean;
  /** Why the last attempt did not start, shown in the dialog. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RolloverConfirmDialog({ seasonNumber, stale = false, preview, busy, error, onConfirm, onCancel }: RolloverConfirmDialogProps): ReactNode {
  const [text, setText] = useState('');
  const inputId = useId();
  const helpId = useId();
  const matches = text === CONFIRM_PHRASE;
  const canConfirm = matches && !busy && !stale;
  const rows = preview ? Object.values(preview.rowsToPurge).reduce((sum, value) => sum + value, 0) : null;

  return (
    <Dialog
      title={`Roll over Season ${seasonNumber}?`}
      onClose={onCancel}
      actions={(
        <>
          <ActionButton onClick={onCancel} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant="danger" onClick={onConfirm} disabled={!canConfirm}>
            {busy ? 'Starting…' : `Roll over Season ${seasonNumber}`}
          </ActionButton>
        </>
      )}
    >
      <p>This cannot be undone. It closes Season {seasonNumber} and opens Season {seasonNumber + 1} in its preparation phase:</p>
      <ul className="list-disc space-y-1 pl-5">
        {preview ? (
          <>
            <li>Archives {plural(preview.breakdown.human.stables + preview.breakdown.automaton.stables, 'stable')}, then resets them.</li>
            <li>Deletes {plural(preview.breakdown.generated.stables, 'generated stable')} and {plural(preview.breakdown.generated.robots, 'robot')}.</li>
            {preview.dormantHumanStables.count > 0 && (
              <li>Deletes {plural(preview.dormantHumanStables.count, 'human stable')} with no login this season.</li>
            )}
            <li>Empties {plural(rows ?? 0, 'row')} of season history.</li>
          </>
        ) : (
          <>
            <li>Archives every stable, then resets human and Automaton stables.</li>
            <li>Deletes every generated stable and empties season history.</li>
          </>
        )}
        <li>Runs in the background; scheduled jobs wait for it.</li>
      </ul>
      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-white">
          Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
        </label>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canConfirm) onConfirm();
          }}
          aria-describedby={helpId}
          className={`${INPUT_CLASS} font-mono`}
        />
        <p id={helpId} className="mt-1 text-xs text-tertiary">The season number ({seasonNumber}) is sent with it.</p>
      </div>
      {stale && (
        <p role="alert" className="text-sm text-error">
          Season {seasonNumber} is no longer the current season, or a rollover has started. Close this dialog and check the page again.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </Dialog>
  );
}
