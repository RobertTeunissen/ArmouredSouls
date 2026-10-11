/**
 * Status_Bar (Spec #55, R11.11, PLAYER_FACING_TEXT §6.2, task 10.2): the
 * Program_Switch, when the Automatons last acted, failures and Need_Attention,
 * above the sections on every tab. Turning the switch off asks first.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { AutomatonStatusBar as StatusBarData } from '../../../utils/automatonAdminApi';
import { ConfirmDialog, FOCUS_RING, Notice } from './ui';
import { errorText } from './requestErrors';
import { formatSeconds, formatShortDateTime } from './automatonText';

export interface AutomatonStatusBarProps {
  status: StatusBarData | null;
  onToggle: (turnsEnabled: boolean) => Promise<void>;
  onShowNeedsAttention: () => void;
}

export function AutomatonStatusBar({ status, onToggle, onShowNeedsAttention }: AutomatonStatusBarProps): ReactNode {
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status) {
    return <div className="rounded-lg border border-white/10 bg-surface p-4 text-sm text-secondary">Loading…</div>;
  }
  const enabled = status.program.turnsEnabled;

  const apply = async (next: boolean): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onToggle(next);
      setConfirmOff(false);
    } catch (err) {
      setError(errorText(err, 'The switch could not be changed.'));
    } finally {
      setBusy(false);
    }
  };

  const step = status.lastStep;
  const lastActed = step
    ? `${step.label}${step.finishedAt ? ` · ${formatShortDateTime(step.finishedAt)}` : ''}`
    : 'Never';

  return (
    <div data-testid="automaton-status-bar" className="rounded-lg border border-white/10 bg-surface p-4 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Automatons act each cycle"
            disabled={busy}
            onClick={() => (enabled ? setConfirmOff(true) : void apply(true))}
            className={`relative inline-flex shrink-0 min-h-11 min-w-16 items-center rounded-full px-1 transition-colors motion-reduce:transition-none ${FOCUS_RING} ${enabled ? 'bg-green-600' : 'bg-white/20'}`}
          >
            <span aria-hidden="true" className={`h-8 w-8 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Automatons act each cycle</p>
            <p className="text-xs text-secondary">{enabled ? 'On' : 'Off — Automatons buy nothing; their robots keep fighting their current events'}</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-secondary">Last acted</p>
          <p className="text-sm font-semibold text-white">{lastActed}</p>
          {step && <p className="text-xs text-secondary">{step.processed} stables · {formatSeconds(step.durationMs)}</p>}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-secondary">Failed last cycle</p>
          {status.failedCount === 0 ? (
            <p className="text-sm font-semibold text-white">None</p>
          ) : (
            <button type="button" onClick={onShowNeedsAttention} className={`min-h-11 text-left text-sm font-semibold text-red-300 underline ${FOCUS_RING}`}>
              {status.failedCount} stables
            </button>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-secondary">Needs attention</p>
          {status.needAttentionCount === 0 ? (
            <p className="text-sm font-semibold text-white">All OK</p>
          ) : (
            <button type="button" onClick={onShowNeedsAttention} className={`min-h-11 text-left text-sm font-semibold text-amber-200 underline ${FOCUS_RING}`}>
              {status.needAttentionCount} stables →
            </button>
          )}
        </div>
      </div>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      {confirmOff && (
        <ConfirmDialog
          title="Stop all Automatons?"
          message="Their robots keep fighting, but no Automaton will buy, upgrade or re-subscribe anything until you turn this back on."
          confirmLabel="Stop Automatons"
          destructive
          busy={busy}
          onConfirm={() => void apply(false)}
          onCancel={() => setConfirmOff(false)}
        />
      )}
    </div>
  );
}
