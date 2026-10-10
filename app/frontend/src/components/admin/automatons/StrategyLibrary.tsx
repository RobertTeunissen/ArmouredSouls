/**
 * Strategies tab — Strategy_Library (Spec #55, R6.6, R6.9, R6.13,
 * PLAYER_FACING_TEXT §6.4a, task 10.4): one card per strategy with its
 * versions and the stables on each, the numbered Build_Order, New version and
 * Upgrade stables; New strategy; and the Strategy_Drafts on this environment.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DraftSummary, LibraryStrategy } from '../../../utils/automatonAdminApi';
import { ActionButton, Dialog, FOCUS_RING, Field, INPUT_CLASS, Notice } from './ui';
import { errorText } from './requestErrors';
import { boundsText, hasUpgradableStables, targetText } from './automatonText';

export interface StrategyLibraryProps {
  strategies: LibraryStrategy[] | null;
  drafts: DraftSummary[] | null;
  error: string | null;
  onNewStrategy: (input: { key: string; displayName: string }) => Promise<void>;
  onNewVersion: (strategy: LibraryStrategy) => Promise<void>;
  onUpgrade: (strategy: LibraryStrategy) => void;
  onOpenDraft: (draftId: number) => void;
}

function BuildOrderTable({ strategy }: { strategy: LibraryStrategy }): ReactNode {
  const latest = strategy.versions.find((v) => v.version === strategy.latestVersion) ?? strategy.versions[strategy.versions.length - 1];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-secondary border-b border-white/10">
            {['#', 'Goal', 'Default target', 'Allowed', 'What it buys'].map((h) => <th key={h} scope="col" className="py-1 pr-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {latest.buildOrder.map((goal) => (
            <tr key={goal.goalId} className="border-b border-white/5 align-top">
              <td className="py-1 pr-2">{goal.position}</td>
              <td className="py-1 pr-2">{goal.label}</td>
              <td className="py-1 pr-2">{targetText(goal, goal.defaultTarget)}</td>
              <td className="py-1 pr-2">Allowed {boundsText(goal, goal.bounds)}</td>
              <td className="py-1 pr-2 text-secondary">{goal.buys}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewStrategyDialog({ onCancel, onCreate }: { onCancel: () => void; onCreate: (input: { key: string; displayName: string }) => Promise<void> }): ReactNode {
  const [key, setKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ key, displayName });
    } catch (err) {
      setError(errorText(err, 'The draft could not be created.'));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="New strategy (blank)"
      onClose={onCancel}
      actions={(
        <>
          <ActionButton onClick={onCancel} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={busy || key.length === 0} onClick={() => void submit()}>New strategy</ActionButton>
        </>
      )}
    >
      <Field label="Strategy key" help="Permanent identifier, lowercase letters, digits and hyphens. A new version keeps the key.">
        {(props) => <input {...props} className={INPUT_CLASS} value={key} maxLength={40} onChange={(e) => setKey(e.target.value)} />}
      </Field>
      <Field label="Display name" help="Shown on the admin page only.">
        {(props) => <input {...props} className={INPUT_CLASS} value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />}
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
    </Dialog>
  );
}

export function StrategyLibrary({ strategies, drafts, error, onNewStrategy, onNewVersion, onUpgrade, onOpenDraft }: StrategyLibraryProps): ReactNode {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const toggle = (key: string): void => setOpen((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const newVersion = async (strategy: LibraryStrategy): Promise<void> => {
    setBusyKey(strategy.key);
    setActionError(null);
    try {
      await onNewVersion(strategy);
    } catch (err) {
      setActionError(errorText(err, 'The draft could not be created.'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Strategy library</h3>
          <p className="text-sm text-secondary max-w-3xl">Every strategy and version in the repository. Stables stay on their version until you upgrade them. New strategies reach stables through a pull request.</p>
        </div>
        <ActionButton variant="primary" className="w-full sm:w-auto" onClick={() => setCreating(true)}>New strategy</ActionButton>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {strategies === null ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {strategies.map((strategy) => (
            <section key={strategy.key} className="rounded-lg border border-white/10 bg-surface p-4 space-y-2 min-w-0">
              <h3 className="text-base font-semibold text-white">
                {strategy.displayName} · v{strategy.latestVersion} <span className="text-sm font-normal text-secondary">(latest)</span>
              </h3>
              <p className="text-sm text-secondary">{strategy.description}</p>
              <ul className="text-sm space-y-1">
                {[...strategy.versions].reverse().map((v) => (
                  <li key={v.version} className="flex justify-between gap-2">
                    <span>v{v.version}{v.latest ? ' (latest)' : ''}</span>
                    <span className="text-secondary">{v.profileCount} stables on v{v.version}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                aria-expanded={open.has(strategy.key)}
                onClick={() => toggle(strategy.key)}
                className={`min-h-11 text-sm text-primary underline ${FOCUS_RING}`}
              >
                {open.has(strategy.key) ? '▾ Hide build order' : '▸ Show build order'}
              </button>
              {open.has(strategy.key) && <BuildOrderTable strategy={strategy} />}
              <div className="flex flex-wrap gap-2">
                <ActionButton disabled={busyKey === strategy.key} onClick={() => void newVersion(strategy)}>New version</ActionButton>
                {hasUpgradableStables(strategy) && <ActionButton variant="ghost" onClick={() => onUpgrade(strategy)}>Upgrade stables</ActionButton>}
              </div>
            </section>
          ))}
          <section className="rounded-lg border border-white/10 bg-surface p-4 space-y-2 min-w-0">
            <h3 className="text-base font-semibold text-white">Drafts on this environment</h3>
            <p className="text-sm text-secondary">Drafts are never used by a stable.</p>
            {drafts === null ? (
              <p className="text-sm text-secondary">Loading…</p>
            ) : drafts.length === 0 ? (
              <p className="text-sm text-secondary">—</p>
            ) : (
              <ul className="space-y-1">
                {drafts.map((draft) => (
                  <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <button type="button" onClick={() => onOpenDraft(draft.id)} className={`min-h-11 min-w-11 text-primary hover:underline ${FOCUS_RING}`}>
                        {draft.displayName || draft.key} v{draft.version}
                      </button>
                      <span className="text-secondary"> · {draft.basedOn ? `from ${draft.basedOn.split('.').pop()}` : 'new strategy'}</span>
                    </span>
                    <span className={draft.ready ? 'text-green-300' : 'text-amber-200'}>{draft.ready ? 'ready to export' : `${draft.errorCount} errors`}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {creating && (
        <NewStrategyDialog
          onCancel={() => setCreating(false)}
          onCreate={async (input) => {
            await onNewStrategy(input);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
