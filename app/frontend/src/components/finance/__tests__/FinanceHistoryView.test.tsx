import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FinanceHistoryView } from '../FinanceHistoryView';
import type { FinanceHistoryPoint, FinanceHistoryResponse } from '../../../utils/financeApi';
import { HISTORY_RESPONSE, RECONCILIATION, STATEMENT } from './fixtures';

function historyResponse(): FinanceHistoryResponse {
  const completedProvenance = {
    ...HISTORY_RESPONSE.provenance[0],
    finality: 'completed_historical' as const,
  };
  const completedPoint: FinanceHistoryPoint = {
    cycleNumber: 1,
    statement: { ...STATEMENT, provenance: completedProvenance, earnedCredits: 40000, netCashMovement: 25000 },
    revenueGrowth: {
      ...HISTORY_RESPONSE.data.points[0].revenueGrowth,
      provenance: completedProvenance,
      currentEarnedCredits: 40000,
      previousEarnedCredits: null,
      amountDelta: null,
      percentDelta: null,
      comparedCycleNumber: null,
      comparisonBasis: 'completed_to_completed',
    },
    reconciliation: { ...RECONCILIATION, status: 'reconciled' },
    limitations: [],
    drivers: [],
  };
  const currentPoint: FinanceHistoryPoint = {
    ...HISTORY_RESPONSE.data.points[0],
    cycleNumber: 2,
    reconciliation: { ...RECONCILIATION, status: 'limited' },
    limitations: [{ code: 'administrative_anomaly', message: 'Current evidence is limited.' }],
    drivers: [{
      kind: 'financial_delta',
      label: 'Earned Credits changed',
      description: 'Recorded movement only; this does not prove causation.',
      amountDelta: 10000,
      sourceReference: 'FS-DRIVER',
      occurredAt: '2026-03-29T10:00:00.000Z',
      provenance: HISTORY_RESPONSE.provenance[0],
    }],
  };

  return {
    ...HISTORY_RESPONSE,
    period: {
      ...HISTORY_RESPONSE.period,
      scope: 'season_to_date',
      fromCycle: 1,
      toCycle: 2,
      activeCycle: 2,
      containsCurrentCycle: true,
    },
    data: { points: [completedPoint, currentPoint], selectedCycle: currentPoint },
  };
}

describe('FinanceHistoryView', () => {
  it('provides a labelled graph, complete table equivalent, provisional active point, and 44px controls', () => {
    render(<FinanceHistoryView response={historyResponse()} />);

    expect(screen.getByRole('img', { name: /^Net cash movement line graph/ })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Complete tabular equivalent of the net cash movement chart' });
    expect(within(table).getByText('Cycle 1')).toBeInTheDocument();
    expect(within(table).getByText('Partial through as-of · Provisional')).toBeInTheDocument();
    const activePoint = screen.getByRole('button', { name: /Cycle 2:.*partial and provisional/ });
    expect(activePoint).toHaveAttribute('aria-pressed', 'true');
    expect(activePoint.className).toContain('min-h-11');
    expect(activePoint.className).toContain('min-w-11');
  });

  it('updates the selected statement, growth comparison, and recorded drivers from keyboard-accessible controls', async () => {
    const user = userEvent.setup();
    render(<FinanceHistoryView response={historyResponse()} />);

    expect(screen.getByText('Cycle 2 statement')).toBeInTheDocument();
    expect(screen.getByText(/Net cash movement is up \+₡9,000 versus Cycle 1/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle 2 is partial.*remains provisional/)).toBeInTheDocument();
    expect(screen.getByText('Earned Credits changed')).toBeInTheDocument();
    const completedPoint = screen.getByRole('button', { name: /Cycle 1:/ });
    completedPoint.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('Cycle 1 statement')).toBeInTheDocument();
    expect(screen.getByText(/An immediately prior cycle is not available/)).toBeInTheDocument();
    expect(screen.getByText('A previous completed cycle is not available for comparison.')).toBeInTheDocument();
    expect(screen.queryByText('Earned Credits changed')).not.toBeInTheDocument();
    expect(screen.getByText('Selected Cycle 1')).toBeInTheDocument();
  });

  it('shows a completed point\'s evidence-limited growth state without an exact comparison', async () => {
    const user = userEvent.setup();
    const response = historyResponse();
    const limitation = {
      code: 'missing_financial_pair' as const,
      message: 'Completed-cycle evidence is incomplete.',
      affectedCycleNumber: 1,
      affectedSourceReference: 'FIN-CYCLE-1',
    };
    const completedPoint = response.data.points[0];
    const limitedCompletedPoint: FinanceHistoryPoint = {
      ...completedPoint,
      reconciliation: { ...completedPoint.reconciliation, status: 'limited' },
      limitations: [limitation],
      revenueGrowth: {
        ...completedPoint.revenueGrowth,
        amountDelta: null,
        percentDelta: null,
        limitations: [limitation],
      },
    };
    render(<FinanceHistoryView response={{
      ...response,
      data: {
        ...response.data,
        points: [limitedCompletedPoint, response.data.points[1]],
      },
    }} />);

    await user.click(screen.getByRole('button', { name: /Cycle 1:/ }));
    const growthPanel = screen.getByRole('heading', { name: 'Revenue growth' }).closest('section');
    expect(growthPanel).not.toBeNull();
    expect(within(growthPanel!).getByText(/Revenue comparison unavailable/)).toBeInTheDocument();
    expect(within(growthPanel!).getByText('Cycle 1: Completed-cycle evidence is incomplete.')).toBeInTheDocument();
    expect(within(growthPanel!).queryByText(/versus Cycle/)).not.toBeInTheDocument();
  });

  it('renders an explanatory early-history state instead of inventing values', () => {
    render(<FinanceHistoryView response={{ ...HISTORY_RESPONSE, data: { points: [], selectedCycle: null } }} />);
    expect(screen.getByText(/Use Current cycle now, or return after Cycle 1 closes/)).toBeInTheDocument();
    expect(screen.queryByTestId('finance-history-chart')).not.toBeInTheDocument();
  });
});
