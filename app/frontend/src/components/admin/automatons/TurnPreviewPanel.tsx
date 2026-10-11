/**
 * Editor — Turn_Preview summary "Next cycle" (Spec #55, R11.4,
 * PLAYER_FACING_TEXT §6.5, task 10.3): what the stable would buy if
 * settlement ran now, the Goal it ends on and the prestige gates further down.
 * Read-only: the preview buys nothing.
 */
import type { ReactNode } from 'react';
import type { ProfileTurnPreview } from '../../../utils/automatonAdminApi';
import { Card, Notice } from './ui';
import { formatCredits, gatedFurtherDownText, goalWithTarget, previewActionText } from './automatonText';

export interface TurnPreviewPanelProps {
  stableName: string;
  preview: ProfileTurnPreview | null;
  error: string | null;
  loading: boolean;
}

export function TurnPreviewPanel({ stableName, preview, error, loading }: TurnPreviewPanelProps): ReactNode {
  const goalById = new Map((preview?.goals ?? []).map((g) => [g.goalId, g]));
  const saving = preview?.goals.find((g) => g.status === 'saving');
  const gated = preview ? gatedFurtherDownText(preview.goals) : null;
  const lastPosition = preview?.goals.length ?? 0;

  return (
    <Card title="Next cycle">
      {error && <Notice tone="error">{error}</Notice>}
      {loading && <p className="text-sm text-secondary">Loading…</p>}
      {!preview && !loading && !error && <p className="text-sm text-secondary">Preview next cycle (refreshes the statuses in the build order)</p>}
      {preview && (
        <div className="space-y-2 text-sm">
          <p className="text-white">If settlement ran now, {stableName} would:</p>
          <ul className="space-y-1">
            {preview.actions.map((action, index) => (
              <li key={`${action.goalId}-${index}`} className="flex gap-2">
                <span className="text-green-300 font-medium">Buy</span>
                <span>{previewActionText(action, goalById.get(action.goalId))}</span>
              </li>
            ))}
            {saving && (
              <li className="flex gap-2">
                <span className="text-amber-200 font-medium">Save</span>
                <span>
                  Goal {saving.position} · {goalWithTarget(saving, saving.target)}: needs {formatCredits(saving.needed ?? 0)}, has {formatCredits(saving.available ?? 0)}.
                  {saving.position + 1 < lastPosition && ` Goals ${saving.position + 1}–${lastPosition} wait.`}
                  {saving.position + 1 === lastPosition && ` Goal ${lastPosition} waits.`}
                </span>
              </li>
            )}
          </ul>
          {gated && <p className="text-secondary">{gated}</p>}
          <p className="text-xs text-secondary">This is a preview. Nothing has been bought.</p>
        </div>
      )}
    </Card>
  );
}
