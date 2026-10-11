/**
 * Strategy_Builder — draft preview (Spec #55, R6.12, PLAYER_FACING_TEXT §6.4b,
 * task 10.4): per-Goal statuses of the draft on a chosen stable, and what a
 * fresh ₡3,000,000 stable with that stable's blueprints would buy first.
 * Read-only: nothing is bought and no stable uses the draft.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { previewStrategyDraft, type DraftPreview, type ProfileListItem } from '../../../utils/automatonAdminApi';
import { ActionButton, Card, Field, INPUT_CLASS, Notice, Pill } from './ui';
import { errorText, issueMessages } from './requestErrors';
import { STATUS_LABELS, formatCredits, goalWithTarget, statusDetailText } from './automatonText';

export interface DraftPreviewPanelProps {
  draftId: number;
  profiles: ProfileListItem[];
  disabled: boolean;
}

export function DraftPreviewPanel({ draftId, profiles, disabled }: DraftPreviewPanelProps): ReactNode {
  const [catalogueKey, setCatalogueKey] = useState(profiles[0]?.catalogueKey ?? '');
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    if (!catalogueKey) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewStrategyDraft(draftId, catalogueKey));
    } catch (err) {
      setPreview(null);
      setError([errorText(err, 'The preview could not be computed.'), ...issueMessages(err)].join(' '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Preview draft" actions={<ActionButton variant="ghost" disabled={disabled || busy || !catalogueKey} onClick={() => void run()}>Preview draft</ActionButton>}>
      <div className="space-y-3 text-sm">
        <Field label="Preview on">
          {(props) => (
            <select {...props} className={INPUT_CLASS} value={catalogueKey} onChange={(e) => setCatalogueKey(e.target.value)}>
              {profiles.map((p) => <option key={p.catalogueKey} value={p.catalogueKey}>{p.stableName}</option>)}
            </select>
          )}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        {preview && (
          <>
            <ul className="space-y-1">
              {preview.profile.goals.map((goal) => {
                const detail = statusDetailText(goal, preview.profile.actions);
                return (
                  <li key={goal.goalId} className="flex flex-wrap items-center gap-2">
                    <Pill tone={goal.status}>{STATUS_LABELS[goal.status]}{goal.gated ? ' 🔒' : ''}</Pill>
                    <span>{goal.position} {goalWithTarget(goal, goal.target)}</span>
                    {detail && <span className="text-xs text-secondary">· {detail}</span>}
                  </li>
                );
              })}
            </ul>
            <div>
              <p className="font-semibold text-white">New stable with ₡3,000,000 would buy first:</p>
              <ol className="mt-1 list-decimal pl-5 space-y-0.5">
                {preview.freshStable.purchases.map((p, i) => (
                  <li key={`${p.goalId}-${i}`}>{p.label} · {formatCredits(p.cost)}</li>
                ))}
              </ol>
            </div>
          </>
        )}
        <p className="text-xs text-secondary">This is a preview. Nothing has been bought and no stable uses this draft.</p>
      </div>
    </Card>
  );
}
