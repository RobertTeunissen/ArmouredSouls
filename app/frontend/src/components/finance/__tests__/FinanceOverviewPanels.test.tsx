import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionEffectTrend } from '../ActionEffectTrend';
import { FullDamageRepairReference } from '../FullDamageRepairReference';
import { PrestigeEarningPower } from '../PrestigeEarningPower';
import { PrestigeMilestoneForecast } from '../PrestigeMilestoneForecast';
import { RevenueGrowthForecast } from '../RevenueGrowthForecast';
import { OVERVIEW_RESPONSE, PROVENANCE } from './fixtures';

describe('Finance Center overview evidence panels', () => {
  it('labels partial-current revenue growth as provisional and asymmetric', () => {
    render(<RevenueGrowthForecast growth={OVERVIEW_RESPONSE.data.revenueGrowth} />);
    expect(screen.getByText(/Actual earned Credits only/)).toBeInTheDocument();
    expect(screen.getByText(/Provisional and asymmetric/)).toBeInTheDocument();
    expect(screen.getByText(/investment proceeds and purchases are excluded/)).toBeInTheDocument();
  });

  it('withholds exact growth when comparison evidence is limited and names the evidence defect', () => {
    render(<RevenueGrowthForecast growth={{
      ...OVERVIEW_RESPONSE.data.revenueGrowth,
      amountDelta: null,
      percentDelta: null,
      limitations: [{
        code: 'missing_financial_pair',
        message: 'A prior-cycle financial pair is missing.',
        affectedCycleNumber: 4,
        affectedSourceReference: 'FIN-MISSING',
      }],
    }} />);

    expect(screen.getByText(/Revenue comparison unavailable because its financial evidence is incomplete/)).toBeInTheDocument();
    expect(screen.getByText('Cycle 4: A prior-cycle financial pair is missing.')).toBeInTheDocument();
    expect(screen.queryByText(/versus Cycle/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous earned Credits/)).not.toBeInTheDocument();
  });

  it('keeps the full-damage reference theoretical, read-only, and useful for a zero roster', () => {
    const { rerender } = render(<FullDamageRepairReference reference={OVERVIEW_RESPONSE.data.repairReference} />);
    expect(screen.getByText(/not a quote, charge, or required action/)).toBeInTheDocument();
    expect(screen.getByText(/Current Repair Bay discount context: 15%/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    rerender(<FullDamageRepairReference reference={{ ...OVERVIEW_RESPONSE.data.repairReference, activeRobotCount: 0, automatic: { amount: 0, robotCount: 0 }, manual: { amount: 0, robotCount: 0, saving: 0 } }} />);
    expect(screen.getByText(/No active robots are available/)).toBeInTheDocument();
  });

  it('renders named forecast limitations and explains prestige without treating it as currency', () => {
    const unavailable = { ...OVERVIEW_RESPONSE.data.prestigeForecast, status: 'no_positive_pace' as const, estimatedCycles: null, averagePerCompletedCycle: null };
    render(<><PrestigeMilestoneForecast forecast={unavailable} /><PrestigeEarningPower forecast={unavailable} /></>);
    expect(screen.getByText(/No positive prestige pace/)).toBeInTheDocument();
    expect(screen.getByText(/prestige itself is never currency/)).toBeInTheDocument();
    expect(screen.getByText(/roster expansion level plus one/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('states that recorded drivers are evidence rather than unsupported causation', () => {
    render(<ActionEffectTrend drivers={[{
      kind: 'facility_upgrade',
      label: 'Streaming Studio upgraded',
      description: 'The upgrade and movement were both recorded.',
      amountDelta: null,
      sourceReference: 'FS-DRIVER',
      occurredAt: PROVENANCE.asOf,
      provenance: PROVENANCE,
    }]} />);
    expect(screen.getByText(/do not prove that one event caused another result/)).toBeInTheDocument();
    expect(screen.getByText(/Reference FS-DRIVER/)).toBeInTheDocument();
  });
});

describe('Finance Center panel labelling', () => {
  it('generates unique accessible labels when overview and history growth panels coexist', () => {
    const { container } = render(
      <>
        <RevenueGrowthForecast growth={OVERVIEW_RESPONSE.data.revenueGrowth} />
        <RevenueGrowthForecast growth={OVERVIEW_RESPONSE.data.revenueGrowth} />
      </>,
    );
    const sections = Array.from(container.querySelectorAll<HTMLElement>('section[aria-labelledby]'));
    const ids = sections.map((section) => section.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
  });
});
