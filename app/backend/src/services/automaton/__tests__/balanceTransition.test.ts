import { balanceTransition } from '../turnRecords';

describe('balanceTransition (negative-balance alert)', () => {
  it('classifies a start balance against the previous turn', () => {
    expect(balanceTransition(-1, 0)).toBe('turned_negative');
    expect(balanceTransition(-1, null)).toBe('turned_negative');
    expect(balanceTransition(-1, -5)).toBe('still_negative');
    expect(balanceTransition(0, -5)).toBe('recovered');
    expect(balanceTransition(10, null)).toBe('non_negative');
    expect(balanceTransition(10, 3)).toBe('non_negative');
  });
});
