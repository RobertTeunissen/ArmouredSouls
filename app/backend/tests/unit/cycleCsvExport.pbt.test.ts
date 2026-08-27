/**
 * Property 24: The Cycle_Battle_Export header and every row agree on eleven fields.
 *
 * Spec #48 Requirement 9 criteria 13 and 14. The export used to declare twelve
 * columns, one of which (`repair_cost`) was populated from a payload field nothing
 * ever wrote, so it emitted `0` on every row. This pins the shape at eleven and
 * pins that no repair column has crept back.
 *
 * Feature: 48-dashboard-overview-row, Property 24: The Cycle_Battle_Export header and every row agree on eleven fields
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'services',
  'cycle',
  'cycleCsvExportService.ts',
);

const source = fs.readFileSync(SERVICE_PATH, 'utf-8');

/** The header string literal declared in the service. */
function extractHeader(): string {
  const match = /const header = '([^']+)'/.exec(source);
  if (match === null) throw new Error('Could not find the CSV header literal');
  return match[1].replace(/\\n$/, '');
}

/** The template literal that builds one data row. */
function extractRowTemplate(): string {
  const match = /return `(\$\{row\.[\s\S]*?)`;/.exec(source);
  if (match === null) throw new Error('Could not find the CSV row template');
  return match[1];
}

describe('Property 24: header and row shape agree at eleven fields', () => {
  const EXPECTED_COLUMNS = [
    'cycle',
    'battle_id',
    'robot_id',
    'robot_name',
    'opponent_id',
    'opponent_name',
    'result',
    'winnings',
    'streaming_revenue',
    'prestige_awarded',
    'fame_awarded',
  ];

  it('declares exactly eleven columns, in the documented order', () => {
    const columns = extractHeader().split(',');
    expect(columns).toEqual(EXPECTED_COLUMNS);
    expect(columns).toHaveLength(11);
  });

  it('emits exactly eleven comma-separated values per row', () => {
    const template = extractRowTemplate();
    // Count top-level separators: the template is `${...},${...},...` so the number
    // of interpolations equals the number of fields.
    const interpolations = template.match(/\$\{/g) ?? [];
    expect(interpolations).toHaveLength(11);
  });

  it('no longer declares a repair column anywhere in the export', () => {
    // Requirement 9 criterion 13. The comment block explaining the removal mentions
    // `repair_cost`, so only look at the code lines.
    const codeLines = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    const joined = codeLines.join('\n');

    expect(joined).not.toMatch(/repair_cost\s*:/);
    expect(joined).not.toMatch(/row\.repair_cost/);
    expect(joined).not.toMatch(/payload\.repairCost/);
  });

  it('keeps the header and the row builder in step for any column count', () => {
    // A generative guard against the two drifting: whatever the header says, the row
    // template must interpolate the same number of values.
    fc.assert(
      fc.property(fc.constant(null), () => {
        const headerCount = extractHeader().split(',').length;
        const rowCount = (extractRowTemplate().match(/\$\{/g) ?? []).length;
        expect(rowCount).toBe(headerCount);
      }),
      { numRuns: 10 },
    );
  });
});
