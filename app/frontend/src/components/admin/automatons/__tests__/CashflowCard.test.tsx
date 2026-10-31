import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CashflowCard } from '../CashflowCard';
import { deriveStablesView } from '../stablesView';
import { PROFILES } from './fixtures';

const api = vi.hoisted(() => ({ getProfileCashflow: vi.fn() }));
vi.mock('../../../../utils/automatonAdminApi', () => api);

describe('CashflowCard', () => {
  beforeEach(() => { api.getProfileCashflow.mockReset(); });

  it('draws one column per cycle and sums the window', async () => {
    api.getProfileCashflow.mockResolvedValue({
      points: [
        { cycle: 87, balance: 12_000, earned: 90_000, runningCosts: 60_000, bought: 0 },
        { cycle: 88, balance: -42_000, earned: 70_000, runningCosts: 80_000, bought: 44_000 },
      ],
      earned: 160_000, runningCosts: 140_000, bought: 44_000, lowBalanceCycles: 1,
    });
    render(<CashflowCard catalogueKey="clone-legion" active />);
    const chart = await screen.findByRole('img');
    expect(chart).toHaveAccessibleName(/cycle 87 earned ₡90,000, running costs ₡60,000, bought ₡0, balance ₡12,000; cycle 88 earned ₡70,000/);
    expect(screen.getByText('Earned ₡160,000')).toBeInTheDocument();
    expect(screen.getByText('Bought ₡44,000')).toBeInTheDocument();
    expect(screen.getByText('Balance after cycle 88: −₡42,000')).toHaveClass('text-red-300');
    expect(api.getProfileCashflow).toHaveBeenCalledWith('clone-legion');
  });

  it('does not ask for a draft and says why', () => {
    render(<CashflowCard catalogueKey="grim-reaper" active={false} />);
    expect(screen.getByText('A draft has no ledger yet.')).toBeInTheDocument();
    expect(api.getProfileCashflow).not.toHaveBeenCalled();
  });

  it('shows a failed request', async () => {
    api.getProfileCashflow.mockRejectedValueOnce(new Error('boom'));
    render(<CashflowCard catalogueKey="clone-legion" active />);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});

describe('stablesView reason filter', () => {
  it('keeps only stables with the reason, and ignores the reason without the attention chip', () => {
    const base = { strategy: null, query: '', sort: null } as const;
    expect(deriveStablesView(PROFILES, { ...base, filter: 'attention', reason: 'balance_negative' }).rows.map((r) => r.catalogueKey)).toEqual(['decepticon-armada']);
    expect(deriveStablesView(PROFILES, { ...base, filter: 'attention', reason: 'nothing_bought' }).rows).toEqual([]);
    expect(deriveStablesView(PROFILES, { ...base, filter: 'all', reason: 'nothing_bought' }).rows).toHaveLength(3);
  });
});
