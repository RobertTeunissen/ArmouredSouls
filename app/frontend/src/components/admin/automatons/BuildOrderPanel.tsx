/**
 * Editor — Build order panel (Spec #55, R6.3, R6.4, R11.4, R11.10,
 * PLAYER_FACING_TEXT §6.5–§6.6, task 10.3): the numbered Build_Order in
 * priority order with an inline Goal_Target input within its bounds, the
 * Turn_Preview status per Goal (🔒 for prestige-gated Goals) and an
 * expandable plan on attributes Goals. A table-like grid from 768 px, one card
 * per Goal below.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { AttributePlanView, BuildOrderDescriptor, PreviewAction, PreviewGoal } from '../../../utils/automatonAdminApi';
import { ActionButton, Card, FOCUS_RING, INPUT_CLASS, Pill } from './ui';
import {
  BUILD_FOCUS_NAMES,
  GROUP_LABELS,
  STATUS_LABELS,
  boundsText,
  statusDetailText,
  targetError,
  targetText,
} from './automatonText';

export type BuildOrderRow = BuildOrderDescriptor & { target: number };

export interface BuildOrderPanelProps {
  heading: string;
  rows: BuildOrderRow[];
  targets: Record<string, number>;
  preview: { goals: PreviewGoal[]; actions: PreviewAction[] } | null;
  attributePlans: AttributePlanView[];
  previewing: boolean;
  onTargetChange: (goalId: string, target: number) => void;
  onPreview: () => void;
}

function StatusCell({ goal, actions }: { goal: PreviewGoal | undefined; actions: readonly PreviewAction[] }): ReactNode {
  if (!goal) return <span className="text-secondary">—</span>;
  const lock = goal.gated ? ' 🔒' : '';
  const detail = statusDetailText(goal, actions);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Pill tone={goal.status}>{STATUS_LABELS[goal.status]}{lock}</Pill>
      {detail && <span className="text-xs text-secondary">{detail}</span>}
    </span>
  );
}

function AttributePlan({ plan, target }: { plan: AttributePlanView; target: string }): ReactNode {
  return (
    <div className="mt-2 rounded-md border border-white/10 bg-background p-3 text-xs text-secondary space-y-1">
      <p>
        <b className="text-white">Plan for Attributes → {target}</b> (groups in Build Focus order; ▸ academy bought on the way)
      </p>
      {plan.robots.map((robot) => (
        <p key={robot.slot}>
          {robot.robotName} ({BUILD_FOCUS_NAMES[robot.buildFocus]}):{' '}
          {robot.groups.map((g, i) => (
            <span key={g.group}>
              {i > 0 && ' → '}
              {GROUP_LABELS[g.group]} {g.target}
              {g.buysAcademy && ` ▸ ${GROUP_LABELS[g.group]} Academy L${g.academyLevel}`}
            </span>
          ))}
        </p>
      ))}
      {plan.academies.length > 0 && (
        <p>Academies bought: {plan.academies.map((a) => `${GROUP_LABELS[a.group]} L${a.level}`).join(', ')}</p>
      )}
    </div>
  );
}

function TargetInput({ row, value, onChange }: { row: BuildOrderRow; value: number; onChange: (n: number) => void }): ReactNode {
  if (row.isMax) return <span className="text-white">Max</span>;
  const error = targetError(row, value);
  const prefix = row.type === 'facility' ? 'L' : '';
  const suffix = row.type === 'refine' ? 'steps' : row.type === 'weapons' && value >= 3 ? 'final' : '';
  return (
    <span className="flex items-center gap-1">
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <input
        type="number"
        inputMode="numeric"
        aria-label={`Target: ${row.position} ${row.label}`}
        aria-invalid={error ? true : undefined}
        min={row.bounds.min}
        max={row.bounds.max}
        step={1}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        className={`${INPUT_CLASS} w-20 ${error ? 'border-red-400' : ''}`}
      />
      {suffix && <span className="text-xs text-secondary">{suffix}</span>}
    </span>
  );
}

export function BuildOrderPanel({ heading, rows, targets, preview, attributePlans, previewing, onTargetChange, onPreview }: BuildOrderPanelProps): ReactNode {
  const [openPlans, setOpenPlans] = useState<ReadonlySet<string>>(new Set());
  const goalById = new Map((preview?.goals ?? []).map((g) => [g.goalId, g]));
  const planById = new Map(attributePlans.map((p) => [p.goalId, p]));
  const togglePlan = (goalId: string): void => {
    setOpenPlans((current) => {
      const next = new Set(current);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  return (
    <Card
      title={heading}
      actions={<ActionButton variant="ghost" onClick={onPreview} disabled={previewing}>Preview next cycle</ActionButton>}
    >
      <p className="text-sm text-secondary mb-3">
        What this stable buys, in order of priority: goal 1 first. Change a target to tune it; the order comes from the strategy. Changes apply from the next settlement.
      </p>
      <div role="table" aria-label="Build order" className="text-sm">
        <div role="rowgroup" className="hidden md:block">
          <div role="row" className="grid grid-cols-[2.5rem_minmax(8rem,1fr)_9rem_6rem_minmax(10rem,2fr)] gap-2 border-b border-white/10 py-2 text-left text-secondary">
            <span role="columnheader">#</span>
            <span role="columnheader">Goal</span>
            <span role="columnheader">Target</span>
            <span role="columnheader">Allowed</span>
            <span role="columnheader">Status (preview)</span>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => {
            const goal = goalById.get(row.goalId);
            const value = targets[row.goalId] ?? row.target;
            const error = targetError(row, value);
            const plan = planById.get(row.goalId);
            const open = openPlans.has(row.goalId);
            return (
              <div
                key={row.goalId}
                role="row"
                className={`grid grid-cols-[2.5rem_1fr] md:grid-cols-[2.5rem_minmax(8rem,1fr)_9rem_6rem_minmax(10rem,2fr)] gap-2 border-b border-white/5 py-2 items-center ${goal?.status === 'saving' ? 'bg-amber-900/20' : ''}`}
              >
                <span role="cell" className="text-secondary">{row.position}</span>
                <span role="cell" className="font-medium text-white">{row.label}</span>
                <span role="cell" className="col-start-2 md:col-start-auto">
                  <TargetInput row={row} value={value} onChange={(n) => onTargetChange(row.goalId, n)} />
                  {error && <span role="alert" className="block text-xs text-red-300">{error}</span>}
                </span>
                <span role="cell" className="col-start-2 md:col-start-auto text-secondary">
                  <span className="md:hidden">Allowed </span>{boundsText(row, row.bounds)}
                </span>
                <span role="cell" className="col-start-2 md:col-start-auto min-w-0">
                  <StatusCell goal={goal} actions={preview?.actions ?? []} />
                  {plan && (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => togglePlan(row.goalId)}
                      className={`ml-0 mt-1 min-h-11 text-xs text-primary underline ${FOCUS_RING}`}
                    >
                      {open ? '▾ Hide plan' : '▸ Show plan'}
                    </button>
                  )}
                </span>
                {plan && open && (
                  <div className="col-span-2 md:col-span-5 md:col-start-2">
                    <AttributePlan plan={plan} target={targetText(row, row.target)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-secondary">
        <span className="font-medium text-white">Legend</span>{' '}
        <Pill tone="done">Done</Pill> <Pill tone="bought">Bought</Pill> <Pill tone="saving">Saving</Pill> — stops here this cycle ·{' '}
        <Pill tone="blocked">Blocked 🔒</Pill> skipped, gated · <Pill tone="waiting">Waiting 🔒</Pill> will be blocked when reached
      </p>
    </Card>
  );
}
