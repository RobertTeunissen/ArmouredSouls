/**
 * T20 — copy for the unequip confirmation (design §9.2, rule 10).
 */
import { describe, it, expect } from 'vitest';
import { buildUnequipForfeitWarning, buildUnequipSingleFallbackWarning } from '../unequipWarning';

describe('buildUnequipForfeitWarning', () => {
  it('names the robot and every booked event, and says the matches will be forfeited', () => {
    expect(buildUnequipForfeitWarning('Iron Duke', ['1v1 League', 'King of the Hill'])).toBe(
      'Iron Duke has booked matches (1v1 League, King of the Hill). Without a main weapon it will forfeit them unless re-armed before they run.',
    );
  });

  it('handles a single booked event', () => {
    expect(buildUnequipForfeitWarning('Iron Duke', ['Tag Team'])).toBe(
      'Iron Duke has booked matches (Tag Team). Without a main weapon it will forfeit them unless re-armed before they run.',
    );
  });
});

describe('buildUnequipSingleFallbackWarning', () => {
  it('says the booked matches are fought with a single weapon', () => {
    expect(buildUnequipSingleFallbackWarning('Iron Duke', ['1v1 League', 'Grand Melee'])).toBe(
      'Iron Duke has booked matches (1v1 League, Grand Melee). Without an offhand it will fight them with a single weapon.',
    );
  });
});
