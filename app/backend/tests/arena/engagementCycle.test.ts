import {
  getEngagementRole,
  getDisengageDuration,
  isMeleeCommitActive,
  updateDisengage,
  isDisengageActive,
  BURST_SPEED_MULTIPLIER,
  DISENGAGE_DELAY_SECONDS,
  DisengageState,
  MeleeCommitInput,
} from '../../src/services/arena/engagementCycle';
import { getPatienceLimit } from '../../src/services/arena/movementAI';
import { SIMULATION_TICK } from '../../src/services/battle/combat-simulator/combatTypes';

/** Unit tests for the #520 engagement cycle (roles, melee commit, ranged disengage). */

function freshDisengage(): DisengageState {
  return { lastMeleeHitTakenAt: null, disengageBurstUntil: 0, disengageReadyAt: 0, disengageScheduledAt: null };
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
    const ranged = (currentTime: number, evasionThrusters = 25) =>
      ({ role: 'ranged' as const, currentTime, evasionThrusters, cooldownSeconds: cooldown });

    /** First melee hit at 5 s, burst due at 7.5 s and started there (ET 25 → 3 s, until 10.5 s). */
    function startedBurst(): DisengageState {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, ranged(5.1));
      updateDisengage(s, ranged(7.5));
      return s;
    }

    it('delays the burst by 2.5 s (guaranteed exchange)', () => {
      expect(DISENGAGE_DELAY_SECONDS).toBe(2.5);
    });

    it('does nothing before any melee hit', () => {
      const s = freshDisengage();
      updateDisengage(s, ranged(5));
      expect(s.disengageBurstUntil).toBe(0);
      expect(s.disengageScheduledAt).toBeNull();
      expect(isDisengageActive(s, 5)).toBe(false);
    });

    it('schedules the burst 2.5 s after the first melee hit instead of starting it', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, ranged(5.1));
      expect(s.disengageScheduledAt).toBeCloseTo(7.5, 10);
      expect(s.disengageBurstUntil).toBe(0);
      expect(isDisengageActive(s, 5.1)).toBe(false);
      updateDisengage(s, ranged(7.4));
      expect(s.disengageBurstUntil).toBe(0);
      expect(isDisengageActive(s, 7.4)).toBe(false);
    });

    it('starts the burst at +2.5 s and sets the cooldown to one patience window', () => {
      const s = startedBurst();
      expect(s.disengageScheduledAt).toBeNull();
      expect(s.disengageBurstUntil).toBeCloseTo(10.5, 10);
      expect(s.disengageReadyAt).toBeCloseTo(10.5 + cooldown, 10);
      expect(s.disengageReadyAt - s.disengageBurstUntil).toBeCloseTo(getPatienceLimit(0.5), 10);
      expect(isDisengageActive(s, 7.5)).toBe(true);
      expect(isDisengageActive(s, 10.4)).toBe(true);
      expect(isDisengageActive(s, 10.5)).toBe(false);
    });

    it('does not move the schedule on a second melee hit during the delay', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, ranged(5.1));
      s.lastMeleeHitTakenAt = 6;
      updateDisengage(s, ranged(6.1));
      expect(s.disengageScheduledAt).toBeCloseTo(7.5, 10);
      updateDisengage(s, ranged(7.5));
      expect(s.disengageBurstUntil).toBeCloseTo(10.5, 10);
    });

    it('lasts 4.0 s from its start at Evasion Thrusters 50', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 10;
      updateDisengage(s, ranged(10.1, 50));
      updateDisengage(s, ranged(12.5, 50));
      expect(s.disengageBurstUntil - 12.5).toBeCloseTo(4.0, 10);
    });

    it('does not schedule for a melee-role robot', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, { ...ranged(5.1), role: 'melee' });
      updateDisengage(s, { ...ranged(7.5), role: 'melee' });
      expect(s.disengageScheduledAt).toBeNull();
      expect(s.disengageBurstUntil).toBe(0);
    });

    it('ignores melee hits during the burst and the cooldown, also after the cooldown expires', () => {
      const s = startedBurst();
      const until = s.disengageBurstUntil; // 10.5
      const readyAt = s.disengageReadyAt; // 23
      s.lastMeleeHitTakenAt = 8; // during the burst
      updateDisengage(s, ranged(8.1));
      expect(s.disengageScheduledAt).toBeNull();
      s.lastMeleeHitTakenAt = 15; // during the cooldown
      updateDisengage(s, ranged(15.1));
      expect(s.disengageScheduledAt).toBeNull();
      expect(s.disengageBurstUntil).toBe(until);
      expect(s.disengageReadyAt).toBe(readyAt);
      expect(isDisengageActive(s, 15.1)).toBe(false);
      // The ignored hit stays ignored after the cooldown expires
      updateDisengage(s, ranged(25));
      updateDisengage(s, ranged(27.6));
      expect(s.disengageScheduledAt).toBeNull();
      expect(s.disengageBurstUntil).toBe(until);
    });

    it('schedules a new burst 2.5 s after a melee hit taken after the cooldown', () => {
      const s = startedBurst();
      const readyAt = s.disengageReadyAt;
      s.lastMeleeHitTakenAt = readyAt + 1;
      updateDisengage(s, ranged(readyAt + 1.1));
      expect(s.disengageScheduledAt).toBeCloseTo(readyAt + 3.5, 10);
      expect(isDisengageActive(s, readyAt + 1.1)).toBe(false);
      updateDisengage(s, ranged(readyAt + 3.5));
      expect(s.disengageBurstUntil).toBeCloseTo(readyAt + 3.5 + 3, 10);
      expect(isDisengageActive(s, readyAt + 3.5)).toBe(true);
    });

    it('starts a scheduled burst even if the role has flipped to melee by then', () => {
      const s = freshDisengage();
      s.lastMeleeHitTakenAt = 5;
      updateDisengage(s, ranged(5.1));
      updateDisengage(s, { ...ranged(7.5), role: 'melee' });
      expect(s.disengageBurstUntil).toBeCloseTo(10.5, 10);
      expect(isDisengageActive(s, 7.5)).toBe(true);
    });

    it('starts exactly 25 ticks after the hit with the accumulated tick clock', () => {
      const s = freshDisengage();
      let t = 0;
      let firstActiveTick: number | null = null;
      for (let tick = 1; tick <= 200; tick++) {
        t += SIMULATION_TICK;
        updateDisengage(s, ranged(t));
        if (firstActiveTick === null && isDisengageActive(s, t)) firstActiveTick = tick;
        if (tick === 50) s.lastMeleeHitTakenAt = t; // hit resolved after this tick's movement
      }
      expect(firstActiveTick).toBe(75);
    });
  });
});
