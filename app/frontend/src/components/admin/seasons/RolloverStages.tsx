/**
 * The five rollover stages as an ordered list: status icon and label (never
 * colour alone), duration or elapsed time, and the stage's one-line detail.
 * The purge stage shows a bar while generated stables are being deleted.
 */
import type { ReactNode } from 'react';
import type { RolloverRunSummary, RolloverStageProgress } from '../../../utils/seasonApi';
import { elapsedSince, formatDuration } from '../../../utils/adminCycleFormat';
import { STAGE_DESCRIPTIONS, STAGE_LABELS } from '../../../utils/adminSeasonFormat';

const STATUS: Readonly<Record<RolloverStageProgress['status'], { icon: string; label: string; tone: string }>> = {
  pending: { icon: '○', label: 'Waiting', tone: 'text-tertiary' },
  running: { icon: '●', label: 'Running', tone: 'text-warning' },
  done: { icon: '✓', label: 'Done', tone: 'text-success' },
  skipped: { icon: '–', label: 'Skipped', tone: 'text-secondary' },
  failed: { icon: '✗', label: 'Failed', tone: 'text-error' },
};

function timing(stage: RolloverStageProgress, now: Date): string | null {
  if (stage.status === 'running') return `${elapsedSince(stage.startedAt, now)} so far`;
  if (stage.startedAt && stage.finishedAt) return formatDuration(new Date(stage.finishedAt).getTime() - new Date(stage.startedAt).getTime());
  return null;
}

export interface RolloverStagesProps {
  progress: RolloverRunSummary;
  now: Date;
  /** Show what each stage does under its label (the running view). */
  describe?: boolean;
}

export function RolloverStages({ progress, now, describe = false }: RolloverStagesProps): ReactNode {
  const generated = progress.generatedStables;
  return (
    <ol className="space-y-2" aria-label="Rollover stages">
      {progress.stages.map((stage, index) => {
        const status = STATUS[stage.status];
        const time = timing(stage, now);
        const showBar = stage.stage === 'purge' && stage.status === 'running' && generated !== null && generated.total > 0 && generated.deleted < generated.total;
        return (
          <li
            key={stage.stage}
            className={`rounded-lg border px-4 py-3 ${stage.status === 'running' ? 'border-warning/50 bg-warning/[0.06]' : stage.status === 'failed' ? 'border-error/40 bg-error/[0.06]' : 'border-white/10 bg-surface-elevated'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex items-baseline gap-2">
                <span aria-hidden="true" className={`${status.tone} ${stage.status === 'running' ? 'animate-pulse motion-reduce:animate-none' : ''}`}>{status.icon}</span>
                <span className="text-sm font-medium text-white">{index + 1}. {STAGE_LABELS[stage.stage]}</span>
                <span className={`text-xs ${status.tone}`}>{status.label}</span>
              </span>
              {time && <span className="text-xs tabular-nums text-secondary">{time}</span>}
            </div>
            {describe && stage.status === 'pending' && <p className="mt-1 text-xs text-tertiary">{STAGE_DESCRIPTIONS[stage.stage]}</p>}
            {stage.detail && <p className={`mt-1 break-words text-xs ${stage.status === 'failed' ? 'text-error' : 'text-secondary'}`}>{stage.detail}</p>}
            {showBar && (
              <div
                role="progressbar"
                aria-label="Generated stables deleted"
                aria-valuemin={0}
                aria-valuemax={generated.total}
                aria-valuenow={generated.deleted}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
              >
                <div className="h-full rounded-full bg-warning" style={{ width: `${(generated.deleted / generated.total) * 100}%` }} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
