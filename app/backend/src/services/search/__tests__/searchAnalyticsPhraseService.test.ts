/**
 * Unit tests for the pure parts of the phrase table and CSV export.
 */
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../season/seasonService', () => ({ getCurrentSeason: jest.fn() }));
jest.mock('../searchAnalyticsStore', () => ({ hasSearchAnalyticsPersistenceFailure: jest.fn() }));

import { csvCell, escapeLikePattern, toPhraseRow, toPhrasesCsv } from '../searchAnalyticsPhraseService';

const statsRow = (overrides: Record<string, unknown> = {}) => ({
  phrase: 'laser cannon',
  searches: BigInt(24),
  no_results: BigInt(0),
  returned_robots: true,
  returned_stables: false,
  returned_guide: true,
  tracked: BigInt(14),
  selected_robots: BigInt(10),
  selected_stables: BigInt(0),
  selected_guide: BigInt(2),
  all_searches: BigInt(412),
  ...overrides,
});

describe('escapeLikePattern', () => {
  it('escapes backslash, percent and underscore', () => {
    expect(escapeLikePattern('50%_off\\now')).toBe('50\\%\\_off\\\\now');
    expect(escapeLikePattern('plain')).toBe('plain');
  });
});

describe('toPhraseRow', () => {
  it('maps shares, rates, returned categories and the most chosen category', () => {
    expect(toPhraseRow(statsRow())).toEqual({
      phrase: 'laser cannon',
      searches: 24,
      share: 5.8,
      noResultRate: 0,
      returned: { robots: true, stables: false, guide: true },
      mostChosen: { category: 'robots', share: 71.4 },
    });
  });

  it('distinguishes "not tracked" from "nothing opened"', () => {
    expect(toPhraseRow(statsRow({ tracked: BigInt(0), selected_robots: BigInt(0), selected_guide: BigInt(0) })).mostChosen).toBeNull();
    expect(toPhraseRow(statsRow({ selected_robots: BigInt(0), selected_guide: BigInt(0) })).mostChosen)
      .toEqual({ category: null, share: 0 });
  });

  it('keeps robots → stables → guide order on ties', () => {
    expect(toPhraseRow(statsRow({ selected_robots: BigInt(3), selected_stables: BigInt(3), selected_guide: BigInt(3) })).mostChosen?.category)
      .toBe('robots');
  });
});

describe('CSV', () => {
  it('quotes cells and doubles embedded quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(12)).toBe('"12"');
  });

  it('neutralises spreadsheet formulas', () => {
    for (const formula of ['=SUM(A1)', '+1', '-1', '@cmd', '\tx', '\rx']) {
      expect(csvCell(formula).startsWith('"\'')).toBe(true);
    }
  });

  it('renders a header and one CRLF-separated line per row', () => {
    const csv = toPhrasesCsv([
      toPhraseRow(statsRow()),
      toPhraseRow(statsRow({ phrase: '=evil', returned_robots: false, returned_guide: false, tracked: BigInt(0) })),
    ]);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('"Phrase","Searches","Share %","No-result %","Returned","Mostly chosen","Chosen %"');
    expect(lines[1]).toBe('"laser cannon","24","5.8","0","R G","robots","71.4"');
    expect(lines[2]).toBe('"\'=evil","24","5.8","0","","not tracked",""');
  });
});
