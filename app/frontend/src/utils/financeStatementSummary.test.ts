import { describe, expect, it } from 'vitest';
import type { FinanceTaxonomy, ItemisedStatementLine, RepairStatementLine } from './financeApi';
import { summarizeStatementLines } from './financeStatementSummary';

const provenance = {
  evidenceKind: 'actual' as const,
  finality: 'completed_historical' as const,
  basis: 'report_period' as const,
  asOf: '2026-09-13T00:00:00.000Z',
};

function line(
  taxonomy: FinanceTaxonomy,
  label: string,
  amount: number,
): ItemisedStatementLine {
  return {
    taxonomy,
    label,
    amount,
    sourceReference: `FIN-${label}-${amount}`,
    provenance,
  };
}

function repairLine(
  repairType: 'manual' | 'automatic',
  amount: number,
  eventCount: number,
): RepairStatementLine {
  return {
    ...line('repair_cost', `${repairType} repair`, -amount),
    taxonomy: 'repair_cost',
    repairType,
    eventCount,
  };
}

describe('summarizeStatementLines', () => {
  it('groups ordinary categories and sums each line as one event', () => {
    const summaries = summarizeStatementLines([
      line('battle_income', 'Battle / bye income', 100),
      line('battle_income', 'Battle / bye income', 250),
      line('streaming_revenue', 'Streaming revenue', 75),
    ]);

    expect(summaries).toEqual([
      { key: 'battle_income:Battle / bye income', label: 'Battle / bye income', amount: 350, count: 2 },
      { key: 'streaming_revenue:Streaming revenue', label: 'Streaming revenue', amount: 75, count: 1 },
    ]);
  });

  it('keeps operating components separate while grouping repeated components', () => {
    const summaries = summarizeStatementLines([
      line('operating_costs', 'Merchandising Hub', -100),
      line('operating_costs', 'Merchandising Hub', -50),
      line('operating_costs', 'Streaming Studio', -25),
    ]);

    expect(summaries).toEqual([
      { key: 'operating_costs:Merchandising Hub', label: 'Merchandising Hub', amount: 150, count: 2 },
      { key: 'operating_costs:Streaming Studio', label: 'Streaming Studio', amount: 25, count: 1 },
    ]);
  });

  it('groups repairs by subtype and sums persisted event counts', () => {
    const summaries = summarizeStatementLines([
      repairLine('manual', 100, 2),
      repairLine('manual', 50, 3),
      repairLine('automatic', 75, 1),
    ]);

    expect(summaries).toEqual([
      { key: 'repair_cost:manual', label: 'Manual repairs', amount: 150, count: 5 },
      { key: 'repair_cost:automatic', label: 'Automatic repairs', amount: 75, count: 1 },
    ]);
  });
});
