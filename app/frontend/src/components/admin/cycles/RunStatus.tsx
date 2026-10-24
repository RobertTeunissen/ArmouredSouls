/**
 * A run's status as coloured text with an icon. Running and queued pulse
 * (unless reduced motion is preferred). Colour is never the only signal: the
 * label is always written out.
 */
import type { ReactNode } from 'react';
import type { SchedulerRunStatus } from '../../../utils/adminCycleApi';
import { STATUS_LABELS } from '../../../utils/adminCycleFormat';

const TONE: Readonly<Record<SchedulerRunStatus | 'missed', { text: string; icon: string }>> = {
  queued: { text: 'text-warning', icon: '◌' },
  running: { text: 'text-warning', icon: '●' },
  success: { text: 'text-success', icon: '✓' },
  skipped: { text: 'text-secondary', icon: '–' },
  failed: { text: 'text-error', icon: '✗' },
  interrupted: { text: 'text-error', icon: '✗' },
  missed: { text: 'text-warning', icon: '⚠' },
};

export function RunStatus({ status }: { status: SchedulerRunStatus | 'missed' }): ReactNode {
  const tone = TONE[status];
  const active = status === 'running' || status === 'queued';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${tone.text} ${status === 'missed' || status === 'failed' || status === 'interrupted' ? 'font-semibold' : ''}`}>
      <span aria-hidden="true" className={active ? 'animate-pulse motion-reduce:animate-none' : ''}>{tone.icon}</span>
      {status === 'missed' ? 'Missed' : STATUS_LABELS[status]}
    </span>
  );
}
