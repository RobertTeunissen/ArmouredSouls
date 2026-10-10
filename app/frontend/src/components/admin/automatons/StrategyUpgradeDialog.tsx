/**
 * Strategy_Version upgrade dialog (Spec #55, R6.6, PLAYER_FACING_TEXT §6.4a,
 * design §14.0a, task 10.4): a dry-run first (old → new Goal_Targets per
 * stable, "new goal" / "clamped" / "removed", and the stables that cannot be
 * upgraded with their reason), then the confirmed upgrade of the chosen
 * stables. A stable that fails stays on its version and raises an alert.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  confirmUpgrade,
  dryRunUpgrade,
  type LabelledTargetChange,
  type LibraryStrategy,
  type UpgradeConfirmation,
  type UpgradeEvaluation,
} from '../../../utils/automatonAdminApi';
import { ActionButton, Dialog, Notice } from './ui';
import { errorText } from './requestErrors';
import { targetText, upgradeResultText } from './automatonText';

export interface StrategyUpgradeDialogProps {
  strategy: LibraryStrategy;
  onClose: () => void;
  onUpgraded: () => void;
}

/** Position of a Goal id `{key}.v{n}.{position}.{type}…`. */
function positionOf(goalId: string | null): string {
  if (!goalId) return '—';
  const position = Number(goalId.split('.')[2]);
  return Number.isFinite(position) ? String(position) : '—';
}

function valueText(change: LabelledTargetChange, value: number | null): string {
  if (value === null) return '—';
  return targetText({ type: change.type, isMax: change.type === 'attributes' && value === 50 }, value);
}

function versionsText(profiles: readonly UpgradeEvaluation[]): string {
  return [...new Set(profiles.map((p) => `v${p.fromVersion}`))].join(', ');
}

export function StrategyUpgradeDialog({ strategy, onClose, onUpgraded }: StrategyUpgradeDialogProps): ReactNode {
  const toVersion = strategy.latestVersion;
  const [profiles, setProfiles] = useState<UpgradeEvaluation[] | null>(null);
  const [choice, setChoice] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpgradeConfirmation | null>(null);

  useEffect(() => {
    let cancelled = false;
    dryRunUpgrade(strategy.key, { toVersion })
      .then((dry) => { if (!cancelled) setProfiles(dry.profiles); })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err, 'The upgrade could not be checked.')); });
    return () => { cancelled = true; };
  }, [strategy.key, toVersion]);

  const selected = useMemo(
    () => (profiles ?? []).filter((p) => choice === 'all' || p.catalogueKey === choice),
    [profiles, choice],
  );
  const passing = selected.filter((p) => p.passes);
  const failing = selected.filter((p) => !p.passes);
  const shown = selected.find((p) => p.passes) ?? selected[0];
  const oldVersions = versionsText(profiles ?? []);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const confirmed = await confirmUpgrade(strategy.key, { toVersion, ...(choice === 'all' ? {} : { catalogueKeys: [choice] }) });
      setResult(confirmed);
      onUpgraded();
    } catch (err) {
      setError(errorText(err, 'The upgrade failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Upgrade ${strategy.displayName} stables to v${toVersion}`}
      onClose={onClose}
      actions={result ? (
        <ActionButton variant="primary" onClick={onClose}>Close</ActionButton>
      ) : (
        <>
          <ActionButton onClick={onClose} disabled={busy}>Cancel</ActionButton>
          <ActionButton variant="primary" disabled={busy || passing.length === 0} onClick={() => void confirm()}>
            Upgrade {passing.length} stables
          </ActionButton>
        </>
      )}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {result ? (
        <Notice tone={result.rejected.length > 0 ? 'error' : 'success'}>{upgradeResultText(result)}</Notice>
      ) : profiles === null ? (
        !error && <p>Loading…</p>
      ) : profiles.length === 0 ? (
        <p>All stables are on v{toVersion}.</p>
      ) : (
        <>
          <fieldset className="space-y-1">
            <legend className="sr-only">Stables to upgrade</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="upgrade-choice" value="all" checked={choice === 'all'} onChange={() => setChoice('all')} />
              All {profiles.length} stables on {oldVersions}
            </label>
            {profiles.map((p) => (
              <label key={p.catalogueKey} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="upgrade-choice" value={p.catalogueKey} checked={choice === p.catalogueKey} onChange={() => setChoice(p.catalogueKey)} />
                This stable: {p.stableName}
              </label>
            ))}
          </fieldset>

          {shown && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    <th scope="col" className="py-1 pr-2 font-medium">Goal (# v{shown.fromVersion} → v{shown.toVersion})</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Old target</th>
                    <th scope="col" className="py-1 pr-2 font-medium">New target</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.changes.map((change, index) => (
                    <tr key={`${change.fromGoalId ?? 'new'}-${change.toGoalId ?? 'removed'}-${index}`} className="border-b border-white/5">
                      <td className="py-1 pr-2">{change.label} ({positionOf(change.fromGoalId)} → {change.position ?? '—'})</td>
                      <td className="py-1 pr-2">{valueText(change, change.oldTarget)}</td>
                      <td className="py-1 pr-2">
                        {change.status === 'removed' ? 'removed' : valueText(change, change.newTarget)}
                        {change.status === 'new' && <span className="ml-1 text-xs text-amber-200">new goal</span>}
                        {change.status === 'clamped' && <span className="ml-1 text-xs text-amber-200">clamped</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shown && <p>Shown for {shown.stableName}; each stable keeps its own targets. Changes apply from the next settlement.</p>}
          {failing.length > 0 && (
            <>
              <ul className="space-y-1">
                {failing.map((p) => (
                  <li key={p.catalogueKey} className="text-red-300">{p.stableName}: not upgraded — {p.rejection?.reason ?? ''}</li>
                ))}
              </ul>
              {passing.length > 0 && (
                <p>
                  {passing.length} of {selected.length} stables can be upgraded. The others stay on {versionsText(failing)} until fixed; you will get an alert for each. The button upgrades the {passing.length}.
                </p>
              )}
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
