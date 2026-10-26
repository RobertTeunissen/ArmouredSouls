jest.mock('../../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { comparePayouts, cycleFromEntries, payoutInputs, type LedgerEntry } from '../battlePayoutCheck';
import type { ParticipantFact } from '../battleFacts';
import type { StableRef } from '../battleTypes';

const playerStable: StableRef = { userId: 1, name: 'Rustbucket Co.', stableType: 'human' };
const automatonStable: StableRef = { userId: 2, name: 'Ferrum Works', stableType: 'automaton' };

const participant = (robotId: number, stable: StableRef, credits: number, streamingRevenue: number): ParticipantFact => ({
  robotId, robotName: `R${robotId}`, team: stable.userId, role: null, placement: null,
  destroyed: false, yielded: false, forfeited: false, eloBefore: 1500, eloAfter: 1500,
  credits, streamingRevenue, prestigeAwarded: 0, fameAwarded: 0, damageDealt: 0, finalHP: 0, maxHP: 100, stable,
});

const entry = (id: number, transactionType: LedgerEntry['transactionType'], userId: number, amount: number, metadata: Record<string, unknown> | null = null): LedgerEntry => ({
  id, transactionType, userId, robotId: transactionType === 'streaming_revenue' ? id : null, amount, cycleNumber: 47, metadata,
});

const participants = [
  participant(10, playerStable, 9000, 1240),
  participant(11, playerStable, 9000, 1105),
  participant(20, automatonStable, 27000, 1380),
  participant(21, automatonStable, 27000, 1310),
];

const incomeMeta = { participationFloor: 18000, winComponent: 36000, teamSize: 2, modifiers: [], formula: 'battle_income', formulaVersion: '1', outcome: 'win' };

describe('comparePayouts', () => {
  it('matches when the ledger equals the participant totals per stable', () => {
    const check = comparePayouts(participants, [
      entry(1, 'battle_income', 1, 18000),
      entry(2, 'battle_income', 2, 54000, incomeMeta),
      entry(3, 'streaming_revenue', 1, 1240), entry(4, 'streaming_revenue', 1, 1105),
      entry(5, 'streaming_revenue', 2, 1380), entry(6, 'streaming_revenue', 2, 1310),
    ]);
    expect(check.status).toBe('match');
    expect(check.ledgerEntries).toBe(6);
    const ferrum = check.stables.find(s => s.stable.userId === 2)!;
    expect(ferrum).toMatchObject({
      battleIncome: { participants: 54000, ledger: 54000 },
      streaming: { participants: 2690, ledger: 2690 },
      status: 'match',
    });
    expect(ferrum.inputs).toMatchObject({ participationFloor: 18000, winComponent: 36000, teamSize: 2, formula: 'battle_income' });
  });

  it('flags a mismatch with both amounts', () => {
    const check = comparePayouts(participants, [
      entry(1, 'battle_income', 1, 18000),
      entry(2, 'battle_income', 2, 52000),
      entry(3, 'streaming_revenue', 1, 2345),
      entry(5, 'streaming_revenue', 2, 2690),
    ]);
    expect(check.status).toBe('mismatch');
    expect(check.stables.find(s => s.stable.userId === 2)).toMatchObject({
      battleIncome: { participants: 54000, ledger: 52000 },
      status: 'mismatch',
    });
  });

  it('reports a stable whose credited income has no ledger entry as missing', () => {
    const check = comparePayouts(participants, [
      entry(1, 'battle_income', 1, 18000),
      entry(3, 'streaming_revenue', 1, 2345),
      entry(5, 'streaming_revenue', 2, 2690),
    ]);
    expect(check.status).toBe('missing');
    expect(check.stables.find(s => s.stable.userId === 2)?.status).toBe('missing');
  });

  it('is unavailable when no ledger entry was found at all', () => {
    expect(comparePayouts(participants, []).status).toBe('unavailable');
    expect(comparePayouts([], []).status).toBe('unavailable');
  });

  it('treats zero credits without ledger rows as a match', () => {
    const check = comparePayouts([participant(30, playerStable, 0, 0)], [entry(9, 'battle_income', 2, 100)]);
    expect(check.stables[0].status).toBe('match');
  });
});

describe('payoutInputs / cycleFromEntries', () => {
  it('reads only well-typed inputs', () => {
    expect(payoutInputs({ participationFloor: '1', winComponent: 5, modifiers: 'x' })).toEqual({
      participationFloor: null, winComponent: 5, teamSize: null, modifiers: [], formula: null, formulaVersion: null, outcome: null,
    });
    expect(payoutInputs(null)).toBeNull();
  });

  it('takes the cycle from the ledger rows', () => {
    expect(cycleFromEntries([entry(1, 'battle_income', 1, 1)])).toBe(47);
    expect(cycleFromEntries([])).toBeNull();
  });
});
