import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';
import { formatFinanceInstant } from '../../utils/financeTime';
import type { RobotDetailResponse, RobotFinancialEvent } from '../../utils/financeApi';

interface RobotDeploymentDetailProps {
  response: RobotDetailResponse;
  onPageChange: (page: number) => void;
}

function eventLabel(event: RobotFinancialEvent): string {
  switch (event.eventKind) {
    case 'battle_income': return 'Battle income';
    case 'bye_income': return 'Bye income';
    case 'streaming_revenue': return 'Streaming revenue';
    case 'repair_cost': return event.repairType === 'manual' ? 'Manual repair' : 'Automatic repair';
  }
}

export function RobotDeploymentDetail({ response, onPageChange }: RobotDeploymentDetailProps): React.ReactElement {
  const { items, page, pageSubtotal, fullPeriodTotal, robot, exposure } = response.data;
  const repairs = items.filter((event) => event.eventKind === 'repair_cost');
  const manualRepairs = repairs.filter((event) => event.repairType === 'manual');
  const automaticRepairs = repairs.filter((event) => event.repairType === 'automatic');
  const repairAmount = (events: RobotFinancialEvent[]): number => events.reduce((total, event) => total + Math.abs(event.amount), 0);

  return (
    <section id={`robot-detail-${robot.robotId}`} className="mt-4 rounded-lg border border-primary/20 bg-surface p-4" aria-label={`${robot.robotName} financial detail`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Financial events</h3>
          <p className="text-sm text-secondary">Full-period total: <span className="font-semibold text-white tabular-nums">{formatCurrency(fullPeriodTotal)}</span></p>
        </div>
        <Link to="/booking-office" className="inline-flex min-h-11 min-w-11 items-center text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Manage subscriptions
        </Link>
      </div>

      <p className="mt-3 rounded-md bg-background/50 p-3 text-sm text-secondary">
        This loaded page is a transport slice and need not equal the full-period headline. All pages combined reconcile to the itemised period detail.
      </p>

      <section className="mt-4" aria-labelledby={`exposure-${robot.robotId}`}>
        <h4 id={`exposure-${robot.robotId}`} className="font-medium">Current event exposure</h4>
        <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-background/40 p-3"><dt className="text-sm text-secondary">Subscriptions</dt><dd>{exposure.subscriptions.length === 0 ? 'None' : exposure.subscriptions.join(', ')}</dd></div>
          <div className="rounded-md bg-background/40 p-3"><dt className="text-sm text-secondary">Held obligations</dt><dd className="tabular-nums">{exposure.outstandingObligations}</dd></div>
          <div className="rounded-md bg-background/40 p-3"><dt className="text-sm text-secondary">Team role</dt><dd>{exposure.teamMembership ? `${exposure.teamMembership.teamName} · ${exposure.teamMembership.role}` : 'No team'}</dd></div>
          <div className="rounded-md bg-background/40 p-3"><dt className="text-sm text-secondary">Next scheduled event</dt><dd>{exposure.scheduledEvents[0] ? `${exposure.scheduledEvents[0].eventType} · ${formatFinanceInstant(exposure.scheduledEvents[0].scheduledFor)}` : 'None scheduled'}</dd></div>
        </dl>
      </section>

      <section className="mt-4" aria-labelledby={`repair-split-${robot.robotId}`}>
        <h4 id={`repair-split-${robot.robotId}`} className="font-medium">Loaded-page repair split</h4>
        <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-background/40 p-3"><dt className="text-sm text-secondary">Manual repairs</dt><dd className="font-semibold tabular-nums">{formatCurrency(repairAmount(manualRepairs))} · {manualRepairs.length} event{manualRepairs.length === 1 ? '' : 's'}</dd></div>
          <div className="rounded-md bg-background/40 p-3"><dt className="text-sm text-secondary">Automatic repairs</dt><dd className="font-semibold tabular-nums">{formatCurrency(repairAmount(automaticRepairs))} · {automaticRepairs.length} event{automaticRepairs.length === 1 ? '' : 's'}</dd></div>
        </dl>
      </section>

      <section className="mt-4" aria-labelledby={`event-list-${robot.robotId}`}>
        <h4 id={`event-list-${robot.robotId}`} className="font-medium">Event evidence</h4>
        {items.length === 0 ? (
          <p className="mt-2 rounded-md bg-background/40 p-3 text-sm text-secondary">No financial activity was recorded on this page.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map((event) => (
              <li key={event.sourceReference} className="rounded-md border border-white/10 bg-background/40 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{eventLabel(event)}</p>
                    <p className="text-sm text-secondary">
                      {event.mode ?? 'No battle mode'}{event.eventKind === 'bye_income' ? ' · Bye (not a fought match)' : event.fought ? ' · Fought match' : ''}
                    </p>
                    <time className="text-xs text-tertiary" dateTime={event.occurredAt}>{formatFinanceInstant(event.occurredAt)}</time>
                    <p className="break-all text-xs text-tertiary">Allocation evidence {event.sourceReference}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{event.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(event.amount))}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-secondary">Page {page.page} of {Math.max(page.totalPages, 1)} · {page.totalItems} events</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page.page - 1)}
            disabled={page.page <= 1}
            className="min-h-11 min-w-11 rounded-md border border-white/20 px-4 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page.page + 1)}
            disabled={!page.hasNextPage}
            className="min-h-11 min-w-11 rounded-md border border-white/20 px-4 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Next
          </button>
        </div>
      </div>
      {pageSubtotal === undefined ? null : <p className="mt-2 text-sm text-secondary">Loaded-page subtotal: <span className="tabular-nums text-white">{formatCurrency(pageSubtotal)}</span></p>}
    </section>
  );
}

export default RobotDeploymentDetail;
