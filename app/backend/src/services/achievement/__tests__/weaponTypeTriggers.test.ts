/**
 * Weapon-type achievements (issue #601).
 *
 * S1 Bleep Bloop, S2 Get to the Choppa and S3 Sword Art Online say "Equip a
 * robot with a … weapon", but they unlocked on buying one: they shared the
 * `weapon_type` trigger with E7 Mall Cop ("Buy your first shield"), which the
 * purchase event evaluates. They now have their own trigger that only the
 * equip event selects, and it reads the robot's equipped slots.
 */

const mockPrisma = {
  robot: { count: jest.fn() },
  weaponInventory: { count: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../../utils/robotCalculations', () => ({ calculateEffectiveStatsWithStance: jest.fn() }));

import { ACHIEVEMENTS, type AchievementDefinition } from '../../../config/achievements';
import { EVENT_TRIGGER_MAP } from '../achievementTypes';
import { evaluateTrigger } from '../triggerEvaluator';

const byId = (id: string): AchievementDefinition => {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement) throw new Error(`no achievement ${id}`);
  return achievement;
};

/** Achievement ids the event would evaluate. */
const candidates = (event: keyof typeof EVENT_TRIGGER_MAP): string[] =>
  ACHIEVEMENTS.filter((a) => (EVENT_TRIGGER_MAP[event] as readonly string[]).includes(a.triggerType)).map((a) => a.id);

beforeEach(() => jest.clearAllMocks());

describe('weapon-type achievement triggers', () => {
  it('buying a weapon no longer evaluates the "equip" achievements, but still Mall Cop', () => {
    const onPurchase = candidates('weapon_purchased');
    expect(onPurchase).toEqual(expect.arrayContaining(['E7']));
    expect(onPurchase).not.toContain('S1');
    expect(onPurchase).not.toContain('S2');
    expect(onPurchase).not.toContain('S3');
  });

  it('equipping a weapon evaluates S1–S3, not Mall Cop', () => {
    const onEquip = candidates('weapon_equipped');
    expect(onEquip).toEqual(expect.arrayContaining(['S1', 'S2', 'S3']));
    expect(onEquip).not.toContain('E7');
  });

  it.each([
    ['S1', 'energy'],
    ['S2', 'ballistic'],
    ['S3', 'melee'],
  ])('%s checks the robot\'s main and offhand slots for a %s weapon', async (id, weaponType) => {
    mockPrisma.robot.count.mockResolvedValue(1);

    const unlocked = await evaluateTrigger(byId(id), 4, 9, { type: 'weapon_equipped', data: { robotId: 9, slot: 'main' } }, null, null);

    expect(unlocked).toBe(true);
    expect(mockPrisma.robot.count).toHaveBeenCalledWith({
      where: {
        id: 9,
        userId: 4,
        OR: [
          { mainWeapon: { weapon: { weaponType } } },
          { offhandWeapon: { weapon: { weaponType } } },
        ],
      },
    });
    // Owning one in storage is not the condition.
    expect(mockPrisma.weaponInventory.count).not.toHaveBeenCalled();
  });

  it('stays locked when the robot has no weapon of that type equipped', async () => {
    mockPrisma.robot.count.mockResolvedValue(0);
    await expect(
      evaluateTrigger(byId('S3'), 4, 9, { type: 'weapon_equipped', data: { robotId: 9, slot: 'offhand' } }, null, null),
    ).resolves.toBe(false);
  });

  it('stays locked without a robot', async () => {
    await expect(evaluateTrigger(byId('S1'), 4, null, { type: 'weapon_equipped', data: {} }, null, null)).resolves.toBe(false);
    expect(mockPrisma.robot.count).not.toHaveBeenCalled();
  });

  it('Mall Cop still unlocks on buying a shield', async () => {
    const buy = (weaponType: string): Promise<boolean> =>
      evaluateTrigger(byId('E7'), 4, null, { type: 'weapon_purchased', data: { weaponType } }, null, null);
    await expect(buy('shield')).resolves.toBe(true);
    await expect(buy('melee')).resolves.toBe(false);
  });
});
