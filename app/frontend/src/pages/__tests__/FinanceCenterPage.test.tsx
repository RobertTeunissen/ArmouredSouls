import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FinanceCenterPage from '../FinanceCenterPage';
import {
  getFinanceHistory,
  getFinanceOverview,
  getRobotFinancialEvents,
  getRobotFinancialSummaries,
} from '../../utils/financeApi';
import {
  HISTORY_RESPONSE,
  OVERVIEW_RESPONSE,
  ROBOT_DETAIL_RESPONSE,
  ROBOT_SUMMARY_RESPONSE,
} from '../../components/finance/__tests__/fixtures';

vi.mock('../../components/Navigation', () => ({ default: () => <nav aria-label="Player navigation" /> }));
vi.mock('../../utils/financeApi', async () => {
  const actual = await vi.importActual<typeof import('../../utils/financeApi')>('../../utils/financeApi');
  return {
    ...actual,
    getFinanceOverview: vi.fn(),
    getFinanceHistory: vi.fn(),
    getRobotFinancialSummaries: vi.fn(),
    getRobotFinancialEvents: vi.fn(),
  };
});

const mockedOverview = vi.mocked(getFinanceOverview);
const mockedHistory = vi.mocked(getFinanceHistory);
const mockedRobotSummaries = vi.mocked(getRobotFinancialSummaries);
const mockedRobotEvents = vi.mocked(getRobotFinancialEvents);

function renderPage(entry = '/income'): void {
  render(<MemoryRouter initialEntries={[entry]}><FinanceCenterPage /></MemoryRouter>);
}

describe('FinanceCenterPage', () => {
  beforeEach(() => {
    mockedOverview.mockResolvedValue(OVERVIEW_RESPONSE);
    mockedHistory.mockResolvedValue(HISTORY_RESPONSE);
    mockedRobotSummaries.mockResolvedValue(ROBOT_SUMMARY_RESPONSE);
    mockedRobotEvents.mockResolvedValue(ROBOT_DETAIL_RESPONSE);
  });

  it('loads only the overview initially and labels preparation Cycle 1 as provisional', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Finance Center' })).toBeInTheDocument();
    expect(await screen.findByText(/Season 1 · Cycle 1 · Preparation · Provisional/)).toBeInTheDocument();
    expect(mockedOverview).toHaveBeenCalledTimes(1);
    expect(mockedHistory).not.toHaveBeenCalled();
    expect(mockedRobotSummaries).not.toHaveBeenCalled();
    expect(screen.getByText(/Version 1 identifies the response schema/)).toBeInTheDocument();
  });

  it('shows same-view current currency when an empty Current report has no provable closing balance', async () => {
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      reconciliation: {
        ...OVERVIEW_RESPONSE.reconciliation,
        firstOrderKey: null,
        lastOrderKey: null,
        financialRecordCount: 0,
        openingBalance: null,
        signedMovement: 0,
        earnedCredits: 0,
        investmentProceeds: 0,
        runningCosts: 0,
        investmentPurchases: 0,
        closingBalance: null,
        equationDifference: null,
        currentCurrencyConfirmation: 1_000,
      },
      data: {
        ...OVERVIEW_RESPONSE.data,
        statement: {
          ...OVERVIEW_RESPONSE.data.statement,
          openingBalance: null,
          earnedCredits: 0,
          investmentProceeds: 0,
          runningCosts: 0,
          investmentPurchases: 0,
          netCashMovement: 0,
          closingBalance: null,
          earnedLines: [],
          investmentProceedLines: [],
          runningCostLines: [],
          investmentPurchaseLines: [],
        },
      },
    });
    renderPage('/income?scope=current');

    const currentBalanceTile = (await screen.findByText('Current balance')).parentElement;
    expect(currentBalanceTile).not.toBeNull();
    expect(within(currentBalanceTile as HTMLElement).getByText('₡1,000')).toBeInTheDocument();

    const statementClosing = screen.getByText('Closing balance').parentElement;
    expect(statementClosing).not.toBeNull();
    expect(within(statementClosing as HTMLElement).getByText('Unavailable')).toBeInTheDocument();
  });

  it('uses current context for Season to date rather than its last ledger boundary', async () => {
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      period: {
        ...OVERVIEW_RESPONSE.period,
        scope: 'season_to_date',
        fromCycle: 1,
        toCycle: 4,
        activeCycle: 4,
        containsCurrentCycle: true,
      },
      reconciliation: {
        ...OVERVIEW_RESPONSE.reconciliation,
        closingBalance: 900,
        currentCurrencyConfirmation: 1_000,
      },
      data: {
        ...OVERVIEW_RESPONSE.data,
        statement: { ...OVERVIEW_RESPONSE.data.statement, closingBalance: 900 },
      },
    });
    renderPage('/income?scope=season_to_date');

    const balanceTile = (await screen.findByText('Current balance')).parentElement;
    expect(balanceTile).not.toBeNull();
    expect(within(balanceTile as HTMLElement).getByText('₡1,000')).toBeInTheDocument();
    expect(within(balanceTile as HTMLElement).queryByText('₡900')).not.toBeInTheDocument();
  });

  it('uses the evidence-backed closing balance for a completed-only report', async () => {
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      period: {
        ...OVERVIEW_RESPONSE.period,
        scope: 'last_completed',
        activeCycle: 2,
        containsCurrentCycle: false,
        finality: 'completed_historical',
      },
      reconciliation: {
        ...OVERVIEW_RESPONSE.reconciliation,
        status: 'reconciled',
        closingBalance: 900,
        currentCurrencyConfirmation: null,
      },
      data: {
        ...OVERVIEW_RESPONSE.data,
        statement: { ...OVERVIEW_RESPONSE.data.statement, closingBalance: 900 },
      },
    });
    renderPage('/income?scope=last_completed');

    const balanceLabels = await screen.findAllByText('Closing balance');
    const balanceTile = balanceLabels.find((label) => label.classList.contains('text-sm'))?.parentElement;
    expect(balanceTile).not.toBeNull();
    expect(within(balanceTile as HTMLElement).getByText('₡900')).toBeInTheDocument();
    expect(screen.queryByText('Current balance')).not.toBeInTheDocument();
  });

  it('lazy-loads history independently and supports Arrow/Home/End tab focus', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Season 1 · Cycle 1/);
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    overviewTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus();
    await waitFor(() => expect(mockedHistory).toHaveBeenCalledTimes(1));
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Robot deployment' })).toHaveFocus();
    await waitFor(() => expect(mockedRobotSummaries).toHaveBeenCalledTimes(1));
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
  });

  it('associates custom-range errors with fields, focuses the first error, and sends no invalid request', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Season 1 · Cycle 1/);
    await user.selectOptions(screen.getByLabelText('Period'), 'custom');
    await user.click(screen.getByRole('button', { name: 'Apply range' }));
    const from = screen.getByLabelText('From cycle');
    expect(from).toHaveAttribute('aria-invalid', 'true');
    expect(from).toHaveFocus();
    expect(screen.getByText(/From cycle is required/)).toBeInTheDocument();
    expect(mockedOverview).toHaveBeenCalledTimes(1);
  });

  it('rejects a 101-cycle custom range, focuses To cycle, and sends no request', async () => {
    const user = userEvent.setup();
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      period: { ...OVERVIEW_RESPONSE.period, activeCycle: 202, fromCycle: 202, toCycle: 202 },
    });
    renderPage();
    await screen.findByText(/Season 1 · Cycle 202/);
    mockedOverview.mockClear();

    await user.selectOptions(screen.getByLabelText('Period'), 'custom');
    await user.type(screen.getByLabelText('From cycle'), '1');
    await user.type(screen.getByLabelText('To cycle'), '101');
    await user.click(screen.getByRole('button', { name: 'Apply range' }));

    const toCycle = screen.getByLabelText('To cycle');
    expect(toCycle).toHaveAttribute('aria-invalid', 'true');
    expect(toCycle).toHaveFocus();
    expect(screen.getByText('Cycle range cannot exceed 100 cycles')).toBeInTheDocument();
    expect(mockedOverview).not.toHaveBeenCalled();
  });

  it('accepts an exactly 100-cycle custom range', async () => {
    const user = userEvent.setup();
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      period: { ...OVERVIEW_RESPONSE.period, activeCycle: 202, fromCycle: 202, toCycle: 202 },
    });
    renderPage();
    await screen.findByText(/Season 1 · Cycle 202/);
    mockedOverview.mockClear();

    await user.selectOptions(screen.getByLabelText('Period'), 'custom');
    await user.type(screen.getByLabelText('From cycle'), '2');
    await user.type(screen.getByLabelText('To cycle'), '101');
    await user.click(screen.getByRole('button', { name: 'Apply range' }));

    await waitFor(() => expect(mockedOverview).toHaveBeenCalledWith(
      { scope: 'custom', fromCycle: 2, toCycle: 101 },
      expect.any(AbortSignal),
    ));
    expect(screen.queryByText('Cycle range cannot exceed 100 cycles')).not.toBeInTheDocument();
  });

  it('does not request an oversized custom range supplied through the URL', async () => {
    renderPage('/income?scope=custom&fromCycle=1&toCycle=101');

    await screen.findByRole('heading', { name: 'Finance Center' });
    expect(mockedOverview).toHaveBeenCalledWith({ scope: 'current' }, expect.any(AbortSignal));
    expect(mockedOverview).not.toHaveBeenCalledWith(
      { scope: 'custom', fromCycle: 1, toCycle: 101 },
      expect.any(AbortSignal),
    );
  });

  it('offers Refresh only for the current cycle', async () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/income?scope=current']}><FinanceCenterPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Refresh current cycle' })).toBeInTheDocument();
    unmount();
    renderPage('/income?scope=last_completed');
    await screen.findByRole('heading', { name: 'Finance Center' });
    expect(screen.queryByRole('button', { name: 'Refresh current cycle' })).not.toBeInTheDocument();
  });

  it('refreshes only overview on the Overview tab and marks the reload as fresh', async () => {
    const user = userEvent.setup();
    renderPage('/income?scope=current');
    await screen.findByText('Finance statement');

    await user.click(screen.getByRole('button', { name: 'Refresh current cycle' }));

    await waitFor(() => expect(mockedOverview).toHaveBeenCalledTimes(2));
    expect(mockedOverview).toHaveBeenLastCalledWith(
      { scope: 'current' },
      expect.any(AbortSignal),
      { fresh: true },
    );
    expect(mockedHistory).not.toHaveBeenCalled();
    expect(mockedRobotSummaries).not.toHaveBeenCalled();
  });

  it('refreshes overview and History together without loading Robot deployment', async () => {
    const user = userEvent.setup();
    renderPage('/income?scope=current&tab=history');
    await waitFor(() => expect(mockedHistory).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Refresh current cycle' }));

    await waitFor(() => {
      expect(mockedOverview).toHaveBeenCalledTimes(2);
      expect(mockedHistory).toHaveBeenCalledTimes(2);
    });
    expect(mockedOverview).toHaveBeenLastCalledWith(
      { scope: 'current' },
      expect.any(AbortSignal),
      { fresh: true },
    );
    expect(mockedHistory).toHaveBeenLastCalledWith(
      { scope: 'current' },
      expect.any(AbortSignal),
      { fresh: true },
    );
    expect(mockedRobotSummaries).not.toHaveBeenCalled();
  });

  it('refreshes overview, Robot summaries, and open detail without loading History', async () => {
    const user = userEvent.setup();
    renderPage('/income?scope=current&tab=robots');
    await screen.findByRole('heading', { name: 'Atlas' });
    await user.click(screen.getByRole('button', { name: 'View details' }));
    await screen.findByRole('heading', { name: 'Financial events' });

    await user.click(screen.getByRole('button', { name: 'Refresh current cycle' }));

    await waitFor(() => {
      expect(mockedOverview).toHaveBeenCalledTimes(2);
      expect(mockedRobotSummaries).toHaveBeenCalledTimes(2);
      expect(mockedRobotEvents).toHaveBeenCalledTimes(2);
    });
    expect(mockedRobotSummaries).toHaveBeenLastCalledWith(
      { scope: 'current' },
      expect.any(AbortSignal),
      { fresh: true },
    );
    expect(mockedRobotEvents).toHaveBeenLastCalledWith(
      7,
      { scope: 'current' },
      1,
      20,
      expect.any(AbortSignal),
      { fresh: true },
    );
    expect(mockedHistory).not.toHaveBeenCalled();
  });

  it('translates legacy lastNCycles state and synchronizes the visible custom controls', async () => {
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      period: { ...OVERVIEW_RESPONSE.period, activeCycle: 12, fromCycle: 12, toCycle: 12 },
    });
    renderPage('/income?tab=history&lastNCycles=3');

    await waitFor(() => expect(screen.getByLabelText('Period')).toHaveValue('custom'));
    expect(screen.getByLabelText('From cycle')).toHaveValue('9');
    expect(screen.getByLabelText('To cycle')).toHaveValue('11');
    await waitFor(() => expect(mockedHistory).toHaveBeenCalledWith(
      { scope: 'custom', fromCycle: 9, toCycle: 11 },
      expect.any(AbortSignal),
    ));
  });

  it('requests season-to-date exactly and keeps overview available when history fails', async () => {
    const user = userEvent.setup();
    mockedHistory.mockRejectedValueOnce(new Error('History is temporarily unavailable.'));
    renderPage('/income?tab=history&scope=season_to_date');

    expect(await screen.findByRole('alert')).toHaveTextContent('History is temporarily unavailable.');
    expect(mockedOverview).toHaveBeenCalledWith({ scope: 'season_to_date' }, expect.any(AbortSignal));
    expect(mockedHistory).toHaveBeenCalledWith({ scope: 'season_to_date' }, expect.any(AbortSignal));

    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Finance statement')).toBeVisible();
    expect(screen.getByText(/Provisional and asymmetric/)).toBeVisible();
  });

  it('retries overview independently without loading inactive report resources', async () => {
    const user = userEvent.setup();
    mockedOverview.mockRejectedValueOnce(new Error('Overview is temporarily unavailable.'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Overview is temporarily unavailable.');
    expect(mockedHistory).not.toHaveBeenCalled();
    expect(mockedRobotSummaries).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Retry overview' }));
    await waitFor(() => expect(mockedOverview).toHaveBeenCalledTimes(2));
    expect(mockedOverview).toHaveBeenLastCalledWith(
      { scope: 'current' },
      expect.any(AbortSignal),
    );
    expect(await screen.findByText('Finance statement')).toBeInTheDocument();
    expect(mockedHistory).not.toHaveBeenCalled();
    expect(mockedRobotSummaries).not.toHaveBeenCalled();
  });

  it('retries robot results and event detail without requesting history or exposing spending actions', async () => {
    const user = userEvent.setup();
    mockedRobotSummaries.mockRejectedValueOnce(new Error('Robot deployment is temporarily unavailable.'));
    mockedRobotEvents.mockRejectedValueOnce(new Error('Robot events are temporarily unavailable.'));
    renderPage('/income?tab=robots');

    expect(await screen.findByRole('alert')).toHaveTextContent('Robot deployment is temporarily unavailable.');
    expect(mockedHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Retry robot results' }));
    expect(await screen.findByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(mockedRobotSummaries).toHaveBeenCalledTimes(2);
    expect(mockedRobotSummaries).toHaveBeenLastCalledWith(
      { scope: 'current' },
      expect.any(AbortSignal),
    );

    await user.click(screen.getByRole('button', { name: 'View details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Robot events are temporarily unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry event detail' }));
    expect(await screen.findByRole('heading', { name: 'Financial events' })).toBeInTheDocument();
    expect(mockedRobotEvents).toHaveBeenCalledTimes(2);
    expect(mockedRobotEvents).toHaveBeenLastCalledWith(
      7,
      { scope: 'current' },
      1,
      20,
      expect.any(AbortSignal),
    );
    expect(mockedHistory).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /repair|upgrade|purchase|sell|refine|team/i })).not.toBeInTheDocument();
  });

  it('focuses the asynchronously loaded prestige context for the dashboard deep link', async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });

    try {
      renderPage('/income?tab=overview#prestige-power-heading');
      const heading = await screen.findByRole('heading', { name: 'Prestige earning power' });
      await waitFor(() => expect(heading).toHaveFocus());
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView });
    }
  });

  it('does not call a quiet mature-cycle report an early-season state', async () => {
    mockedOverview.mockResolvedValue({
      ...OVERVIEW_RESPONSE,
      period: { ...OVERVIEW_RESPONSE.period, activeCycle: 12, fromCycle: 12, toCycle: 12 },
      reconciliation: { ...OVERVIEW_RESPONSE.reconciliation, financialRecordCount: 0 },
      data: {
        ...OVERVIEW_RESPONSE.data,
        repairReference: {
          ...OVERVIEW_RESPONSE.data.repairReference,
          activeRobotCount: 0,
          automatic: { amount: 0, robotCount: 0 },
          manual: { amount: 0, robotCount: 0, saving: 0 },
        },
        prestigeForecast: {
          ...OVERVIEW_RESPONSE.data.prestigeForecast,
          status: 'insufficient_history',
          estimatedCycles: null,
        },
      },
    });
    renderPage();

    expect(await screen.findByText(/Season 1 · Cycle 12/)).toBeInTheDocument();
    expect(screen.queryByText('Your first financial cycle is underway')).not.toBeInTheDocument();
  });
});
