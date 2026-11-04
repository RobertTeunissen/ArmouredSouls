import {
  hasAllocatedTuning,
  hpPercentOf,
  lowestHpPercent,
  isLowestElo,
  yieldedRobotNames,
  lastStandingSurvivorId,
} from '../battleAchievementContext';

describe('battleAchievementContext', () => {
  describe('hasAllocatedTuning', () => {
    it('is false without an allocation or with only zero/undefined values', () => {
      expect(hasAllocatedTuning(undefined)).toBe(false);
      expect(hasAllocatedTuning({})).toBe(false);
      expect(hasAllocatedTuning({ combatPower: 0, armorPlating: undefined })).toBe(false);
    });

    it('is true when any attribute has points', () => {
      expect(hasAllocatedTuning({ combatPower: 0, armorPlating: 3 })).toBe(true);
    });
  });

  describe('hpPercentOf', () => {
    it('returns HP as a percentage of max HP', () => {
      expect(hpPercentOf(800, 1000)).toBe(80);
      expect(hpPercentOf(1000, 1000)).toBe(100);
      expect(hpPercentOf(0, 1000)).toBe(0);
    });

    it('returns 0 when max HP is unknown', () => {
      expect(hpPercentOf(50, 0)).toBe(0);
    });
  });
});


describe('lowestHpPercent', () => {
  const events = [
    { robotHP: { Alpha: 900, Beta: 1000 } },
    { type: 'movement' },
    { robotHP: { Alpha: 30, Beta: 700 } },
    { robotHP: { Alpha: 400, Beta: 650 } },
  ];

  it('returns the lowest HP the robot reached, as % of max HP', () => {
    expect(lowestHpPercent(events, 'Alpha', 1000, 400)).toBe(3);
  });

  it('never reports more than the final HP', () => {
    expect(lowestHpPercent(events, 'Beta', 1000, 100)).toBe(10);
  });

  it('falls back to the final HP without events or a matching robot', () => {
    expect(lowestHpPercent(undefined, 'Alpha', 1000, 500)).toBe(50);
    expect(lowestHpPercent(events, 'Gamma', 1000, 500)).toBe(50);
  });
});

describe('isLowestElo', () => {
  const field = [{ id: 1, elo: 1100 }, { id: 2, elo: 1250 }, { id: 3, elo: 1300 }];

  it('is true only for the strictly lowest-rated robot', () => {
    expect(isLowestElo(1, field)).toBe(true);
    expect(isLowestElo(2, field)).toBe(false);
  });

  it('is false on a tie or a field of one', () => {
    expect(isLowestElo(1, [...field, { id: 4, elo: 1100 }])).toBe(false);
    expect(isLowestElo(1, [{ id: 1, elo: 1000 }])).toBe(false);
  });
});

describe('yieldedRobotNames', () => {
  it('collects the robots named by yield events', () => {
    const events = [
      { type: 'attack', attacker: 'Alpha', defender: 'Beta' },
      { type: 'yield', defender: 'Beta' },
      { type: 'destroyed', attacker: 'Alpha', defender: 'Gamma' },
      { type: 'yield', defender: 'Delta' },
    ];
    expect([...yieldedRobotNames(events)].sort()).toEqual(['Beta', 'Delta']);
  });

  it('ignores time-limit yield events, which name no robot', () => {
    expect(yieldedRobotNames([{ type: 'yield', message: 'Time limit reached - Draw!' }]).size).toBe(0);
    expect(yieldedRobotNames(undefined).size).toBe(0);
  });
});

describe('lastStandingSurvivorId', () => {
  it('reads the survivor from the last_standing event', () => {
    const events = [
      { type: 'score_tick' },
      { type: 'last_standing', kpiData: { survivorId: 42, countdown: 10 } },
      { type: 'match_end', kpiData: { winnerId: 7 } },
    ];
    expect(lastStandingSurvivorId(events)).toBe(42);
  });

  it('is null when the phase never started or nobody survived it', () => {
    expect(lastStandingSurvivorId([{ type: 'match_end' }])).toBeNull();
    expect(lastStandingSurvivorId([{ type: 'last_standing', kpiData: {} }])).toBeNull();
  });
});
