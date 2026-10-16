import {
  getEngagementRole,
  getDisengageDuration,
  isMeleeCommitActive,
  updateDisengage,
  isDisengageActive,
  BURST_SPEED_MULTIPLIER,
  DisengageState,
  MeleeCommitInput,
} from '../../src/services/arena/engagementCycle';
import { getPatienceLimit } from '../../src/services/arena/movementAI';

/** Unit tests for the #520 engagement cycle (roles, melee commit, ranged disengage). */

function freshDisengage(): DisengageState {
  return { lastMeleeHitTakenAt: null, disengageBurstUntil: 0, disengageReadyAt: 0 };
}

function commitInput(overrides: Partial<MeleeCommitInput> = {}): MeleeCommitInput {
  return {
    role: 'melee',
    opponentRole: 'ranged',
    patienceTimer: 15,
    patienceLimit: 12.5,
    distance: 8,
    ...overrides,
  };
}

describe('engagementCycle', () => {
  it('uses a 1.30 burst multiplier', () => {
    expect(BURST_SPEED_MULTIPLIER).toBe(1.30);
  });

  describe('getEngagementRole', () => {
    it('maps the melee band to the melee role and every other band to ranged', () => {
      expect(getEngagementRole('melee')).toBe('melee');
      expect(getEngagementRole('short')).toBe('ranged');
      expect(getEngagementRole('mid')).toBe('ranged');
      expect(getEngagementRole('long')).toBe('ranged');
    });
  });

  describe('isMeleeCommitActive', () => {
    it('is active past the patience limit, beyond reach, against a ranged opponent', () => {
      expect(isMeleeCommitActive(commitInput())).toBe(true);
    });

    it('is active exactly at the patience limit', () => {
      expect(isMeleeCommitActive(commitInput({ patienceTimer: 12.5 }))).toBe(true);
    });

    it('is inactive before the patience limit', () => {
      expect(isMeleeCommitActive(commitInput({ patienceTimer: 12.4 }))).toBe(false);
    });

    it('ends within melee reach (distance ≤ 2)', () => {
      expect(isMeleeCommitActive(commitInput({ distance: 2 }))).toBe(false);
      expect(isMeleeCommitActive(commitInput({ distance: 1 }))).toBe(false);
    });

    it('is inactive against a melee opponent or without an opponent', () => {
      expect(isMeleeCommitActive(commitInput({ opponentRole: 'melee' }))).toBe(false);
      expect(isMeleeCommitActive(commitInput({ opponentRole: null }))).toBe(false);
    });

    it('is inactive for a ranged-role robot', () => {
      expect(isMeleeCommitActive(commitInput({ role: 'ranged' }))).toBe(false);
    });
  });

  describe('getDisengageDuration', () => {
    it('is 2 s + 0.04 s per Evasion Thrusters point', () => {
      expect(getDisengageDuration(25)).toBeCloseTo(3.0, 10);
      expect(getDisengageDuration(50)).toBeCloseTo(4.0, 10);
      expect(getDisengageDuration(0)).toBeCloseTo(2.0, 10);
    });

    it('is uncapped', () => {
      expect(getDisengageDuration(100)).toBeCloseTo(6.0, 10);
    });
  });

  describe('updateDisengage / isDisengageActive', () => {
    const cooldown = getPatienceLimit(0.5); // 12.5 s

    it('does nothing before any melee hit', () => {
      const s = freshDisengage();
      updateDisengage(s, { role: 'ranged', currentTime: 5, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBe(0);
      expect(isDisengageActive(s, 5)).toBe(false);
    });

    it('starts a burst on the first melee hit and sets the cooldown to one patience window', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, { role: 'ranged', currentTime: 5.1, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBeCloseTo(8.1, 10);
      expect(s.disengageReadyAt).toBeCloseTo(8.1 + cooldown, 10);
      expect(s.disengageReadyAt - s.disengageBurstUntil).toBeCloseTo(getPatienceLimit(0.5), 10);
      expect(isDisengageActive(s, 5.1)).toBe(true);
      expect(isDisengageActive(s, 8.0)).toBe(true);
      expect(isDisengageActive(s, 8.1)).toBe(false);
    });

    it('lasts 4.0 s at Evasion Thrusters 50', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 10;
      updateDisengage(s, { role: 'ranged', currentTime: 10, evasionThrusters: 50, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil - 10).toBeCloseTo(4.0, 10);
    });

    it('does not trigger for a melee-role robot', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, { role: 'melee', currentTime: 5.1, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBe(0);
    });

    it('does not restart on a second melee hit during the burst', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, { role: 'ranged', currentTime: 5, evasionThrusters: 25, cooldownSeconds: cooldown });
      const until = s.disengageBurstUntil;
      const readyAt = s.disengageReadyAt;
      s.lastMeleeHitTakenAt = 6;
      updateDisengage(s, { role: 'ranged', currentTime: 6.1, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBe(until);
      expect(s.disengageReadyAt).toBe(readyAt);
    });

    it('does not restart on a melee hit during the cooldown', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, { role: 'ranged', currentTime: 5, evasionThrusters: 25, cooldownSeconds: cooldown });
      const until = s.disengageBurstUntil; // 8
      const readyAt = s.disengageReadyAt; // 20.5
      s.lastMeleeHitTakenAt = 15;
      updateDisengage(s, { role: 'ranged', currentTime: 15.1, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBe(until);
      expect(s.disengageReadyAt).toBe(readyAt);
      expect(isDisengageActive(s, 15.1)).toBe(false);
      // The ignored hit stays ignored after the cooldown expires
      updateDisengage(s, { role: 'ranged', currentTime: 25, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBe(until);
    });

    it('starts a new burst on a melee hit after the cooldown', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, { role: 'ranged', currentTime: 5, evasionThrusters: 25, cooldownSeconds: cooldown });
      const readyAt = s.disengageReadyAt;
      s.lastMeleeHitTakenAt = readyAt + 1;
      updateDisengage(s, { role: 'ranged', currentTime: readyAt + 1.1, evasionThrusters: 25, cooldownSeconds: cooldown });
      expect(s.disengageBurstUntil).toBeCloseTo(readyAt + 1.1 + 3, 10);
      expect(isDisengageActive(s, readyAt + 1.1)).toBe(true);
    });
  });
});
