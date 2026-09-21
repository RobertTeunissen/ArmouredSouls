import type { FinanceTaxonomy, ItemisedStatementLine, RepairStatementLine } from './financeApi';

export interface StatementCategorySummary {
  key: string;
  label: string;
  amount: number;
  count: number;
}

type StatementLine = ItemisedStatementLine | RepairStatementLine;

const CATEGORY_LABELS: Partial<Record<FinanceTaxonomy, string>> = {
  battle_income: 'Battle / bye income',
  streaming_revenue: 'Streaming revenue',
  passive_income: 'Merchandising income',
  achievement_reward: 'Achievement reward',
  weapon_sale: 'Weapon sale',
  facility_upgrade: 'Facility upgrade',
  weapon_purchase: 'Weapon purchase',
  weapon_refinement: 'Weapon Refinement',
  robot_creation: 'Robot creation',
  attribute_upgrade: 'Attribute upgrade',
};

function isRepairLine(line: StatementLine): line is RepairStatementLine {
  return line.taxonomy === 'repair_cost' && 'repairType' in line;
}

function getSummaryLabel(line: StatementLine): string {
  if (isRepairLine(line)) return line.repairType === 'manual' ? 'Manual repairs' : 'Automatic repairs';
  if (line.taxonomy === 'operating_costs') return line.label;
  return CATEGORY_LABELS[line.taxonomy] ?? line.label;
}

function getCategoryKey(line: StatementLine): string {
  if (isRepairLine(line)) return `${line.taxonomy}:${line.repairType}`;
  return `${line.taxonomy}:${getSummaryLabel(line)}`;
}

/**
 * Collapse itemised statement evidence into player-facing category summaries.
 *
 * The report remains itemised for reconciliation and detail views. This helper
 * only changes the Finance Statement presentation: repair eventCount is summed
 * while every other line represents one financial event.
 */
export function summarizeStatementLines(
  lines: readonly StatementLine[],
): StatementCategorySummary[] {
  const summaries = new Map<string, StatementCategorySummary>();

  for (const line of lines) {
    const key = getCategoryKey(line);
    const existing = summaries.get(key);
    const amount = Math.abs(line.amount);
    const count = isRepairLine(line) ? line.eventCount : 1;

    if (existing) {
      existing.amount += amount;
      existing.count += count;
    } else {
      summaries.set(key, {
        key,
        label: getSummaryLabel(line),
        amount,
        count,
      });
    }
  }

  return [...summaries.values()];
}
