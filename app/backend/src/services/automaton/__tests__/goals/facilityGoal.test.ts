import { bookingOfficeUsefulLevel, createFacilityGoal } from '../../goals/facilityGoal';
import { context, facilities, robot, stable, team } from '../helpers/automatonFixtures';

const repairBay = createFacilityGoal('test.v1.07.facility.repair_bay', 'repair_bay');
const bookingOffice = createFacilityGoal('test.v1.02.facility.booking_office', 'booking_office');

describe('facility Goal (R5.2, R5.3, R5.12)', () => {
  it('is Satisfied at the target and skipped at target 0', () => {
    const facts = stable({ facilities: facilities({ repair_bay: 3 }) });
    expect(repairBay.evaluate(facts, context(facts, { target: 3 })).kind).toBe('satisfied');
    expect(repairBay.evaluate(stable(), context(stable(), { target: 0 })).kind).toBe('satisfied');
  });

  it('buys the next level when affordable, including at exactly balance = cost', () => {
    const facts = stable({ facilities: facilities({ repair_bay: 2 }), balance: 150_000 });
    expect(repairBay.evaluate(facts, context(facts, { target: 5 }))).toEqual({
      kind: 'actionable',
      goalId: 'test.v1.07.facility.repair_bay',
      action: { kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 3, cost: 150_000 },
      cost: 150_000,
    });
  });

  it('saves when the next level costs more than the balance', () => {
    const facts = stable({ facilities: facilities({ repair_bay: 2 }), balance: 149_999 });
    expect(repairBay.evaluate(facts, context(facts, { target: 5 }))).toMatchObject({ kind: 'saving', cost: 150_000 });
  });

  it('is Blocked by the Prestige_Gate of the next level, not by credits', () => {
    const facts = stable({ facilities: facilities({ repair_bay: 3 }), prestige: 999, balance: 0 });
    expect(repairBay.evaluate(facts, context(facts, { target: 5 }))).toEqual({
      kind: 'blocked',
      goalId: 'test.v1.07.facility.repair_bay',
      reason: 'prestige_gate',
      detail: { facilityType: 'repair_bay', level: 4, prestigeRequired: 1000, prestigeHeld: 999 },
    });
  });

  it('is Blocked with max_level above the facility maximum', () => {
    const facts = stable({ facilities: facilities({ repair_bay: 10 }), prestige: 100_000 });
    expect(repairBay.evaluate(facts, context(facts, { target: 11 }))).toMatchObject({ kind: 'blocked', reason: 'max_level' });
  });

  describe('Booking Office useful level', () => {
    it('is 0 with no live robots, L1 for one robot', () => {
      expect(bookingOfficeUsefulLevel(stable())).toBe(0);
      expect(bookingOfficeUsefulLevel(stable({ robots: [robot(1)] }))).toBe(1);
    });

    it('is L1 for two robots before their team forms and L4 after', () => {
      expect(bookingOfficeUsefulLevel(stable({ robots: [robot(1), robot(2)] }))).toBe(1);
      expect(bookingOfficeUsefulLevel(stable({ robots: [robot(1), robot(2)], teams: [team(1, 2, [1001, 1002])] }))).toBe(4);
    });

    it('is L6 for robots in both a 2v2 and a 3v3 team', () => {
      const facts = stable({
        robots: [robot(1), robot(2), robot(3)],
        teams: [team(1, 2, [1001, 1002]), team(2, 3, [1001, 1002, 1003])],
      });
      expect(bookingOfficeUsefulLevel(facts)).toBe(6);
    });

    it('Satisfies a Booking Office Goal at the useful level and re-opens it when a team forms', () => {
      const before = stable({ facilities: facilities({ booking_office: 1 }), robots: [robot(1), robot(2)] });
      expect(bookingOffice.evaluate(before, context(before, { target: 4 })).kind).toBe('satisfied');
      const after = { ...before, teams: [team(1, 2, [1001, 1002])] };
      expect(bookingOffice.evaluate(after, context(after, { target: 4 }))).toMatchObject({
        kind: 'actionable', action: { facilityType: 'booking_office', toLevel: 2 },
      });
    });

    it('never buys a level with no live robots', () => {
      expect(bookingOffice.evaluate(stable(), context(stable(), { target: 6 })).kind).toBe('satisfied');
    });
  });
});
