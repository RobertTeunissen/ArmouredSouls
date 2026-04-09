/**
 * Robot weapon equip/unequip transaction logic.
 *
 * Extracted from the robots route to keep handlers thin.
 */

import prisma from '../../lib/prisma';
import { canEquipToSlot, validateOffhandEquipment, isSlotAvailable, validateNoDuplicateEquip } from '../../utils/weaponValidation';
import { calculateMaxHP, calculateMaxShield } from '../../utils/robotCalculations';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';

const WEAPON_INCLUDE = {
  mainWeapon: { include: { weapon: true as const } },
  offhandWeapon: { include: { weapon: true as const } },
} as const;

/** Recalculate HP/Shield after weapon change and persist. */
async function recalcStats(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  robotId: number,
  equipped: Awaited<ReturnType<typeof prisma.robot.update>>,
) {
  const hp = calculateMaxHP(equipped as Parameters<typeof calculateMaxHP>[0]);
  const shield = calculateMaxShield(equipped as Parameters<typeof calculateMaxShield>[0]);

  return tx.robot.update({
    where: { id: robotId },
    data: {
      maxHP: hp,
      maxShield: shield,
      currentHP: Math.min((equipped as { currentHP: number }).currentHP, hp),
      currentShield: Math.min((equipped as { currentShield: number }).currentShield, shield),
    },
    include: WEAPON_INCLUDE,
  });
}

/** Equip a weapon to the main slot inside a transaction. */
export async function equipMainWeapon(userId: number, robotId: number, weaponInvIdNum: number) {
  return prisma.$transaction(async (tx) => {
    const robot = await tx.robot.findFirst({
      where: { id: robotId, userId },
      include: WEAPON_INCLUDE,
    });
    if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);

    const weaponInv = await tx.weaponInventory.findFirst({
      where: { id: weaponInvIdNum, userId },
      include: {
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });
    if (!weaponInv) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Weapon not found in your inventory', 404);

    const allEquipped = weaponInv.robotsMain.concat(weaponInv.robotsOffhand);
    const equippedToOther = allEquipped.find(r => r.id !== robotId);
    if (equippedToOther) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Weapon is already equipped to ${equippedToOther.name}`, 400);

    const dupCheck = validateNoDuplicateEquip(weaponInvIdNum, 'main', robot);
    if (!dupCheck.valid) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, dupCheck.reason!, 400);

    const slotCheck = canEquipToSlot(weaponInv.weapon, 'main', robot.loadoutType);
    if (!slotCheck.canEquip) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, slotCheck.reason!, 400);

    const equipped = await tx.robot.update({
      where: { id: robotId },
      data: { mainWeaponId: weaponInvIdNum },
      include: WEAPON_INCLUDE,
    });

    return recalcStats(tx, robotId, equipped);
  });
}

/** Equip a weapon to the offhand slot inside a transaction. */
export async function equipOffhandWeapon(userId: number, robotId: number, weaponInvIdNum: number) {
  return prisma.$transaction(async (tx) => {
    const robot = await tx.robot.findFirst({
      where: { id: robotId, userId },
      include: WEAPON_INCLUDE,
    });
    if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);

    if (!isSlotAvailable('offhand', robot.loadoutType)) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Offhand slot not available for ${robot.loadoutType} loadout`, 400);
    }

    const weaponInv = await tx.weaponInventory.findFirst({
      where: { id: weaponInvIdNum, userId },
      include: {
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });
    if (!weaponInv) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Weapon not found in your inventory', 404);

    const allEquipped = weaponInv.robotsMain.concat(weaponInv.robotsOffhand);
    const equippedToOther = allEquipped.find(r => r.id !== robotId);
    if (equippedToOther) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Weapon is already equipped to ${equippedToOther.name}`, 400);

    const dupCheck = validateNoDuplicateEquip(weaponInvIdNum, 'offhand', robot);
    if (!dupCheck.valid) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, dupCheck.reason!, 400);

    const slotCheck = canEquipToSlot(weaponInv.weapon, 'offhand', robot.loadoutType);
    if (!slotCheck.canEquip) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, slotCheck.reason!, 400);

    const offhandCheck = validateOffhandEquipment(weaponInv.weapon, robot.mainWeaponId !== null, robot.loadoutType);
    if (!offhandCheck.valid) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, offhandCheck.reason!, 400);

    const equipped = await tx.robot.update({
      where: { id: robotId },
      data: { offhandWeaponId: weaponInvIdNum },
      include: WEAPON_INCLUDE,
    });

    return recalcStats(tx, robotId, equipped);
  });
}

/** Unequip main weapon and recalculate stats. */
export async function unequipMainWeapon(userId: number, robotId: number) {
  const robot = await prisma.robot.findFirst({
    where: { id: robotId, userId },
    include: WEAPON_INCLUDE,
  });
  if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  if (!robot.mainWeaponId) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No main weapon equipped', 400);

  const unequipped = await prisma.robot.update({
    where: { id: robotId },
    data: { mainWeaponId: null },
    include: WEAPON_INCLUDE,
  });

  const newMaxHP = calculateMaxHP(unequipped);
  const newMaxShield = calculateMaxShield(unequipped);

  return prisma.robot.update({
    where: { id: robotId },
    data: {
      maxHP: newMaxHP,
      maxShield: newMaxShield,
      currentHP: Math.min(unequipped.currentHP, newMaxHP),
      currentShield: Math.min(unequipped.currentShield, newMaxShield),
    },
    include: WEAPON_INCLUDE,
  });
}

/** Unequip offhand weapon and recalculate stats. */
export async function unequipOffhandWeapon(userId: number, robotId: number) {
  const robot = await prisma.robot.findFirst({
    where: { id: robotId, userId },
    include: WEAPON_INCLUDE,
  });
  if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  if (!robot.offhandWeaponId) throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No offhand weapon equipped', 400);

  const unequipped = await prisma.robot.update({
    where: { id: robotId },
    data: { offhandWeaponId: null },
    include: WEAPON_INCLUDE,
  });

  const newMaxHP = calculateMaxHP(unequipped);
  const newMaxShield = calculateMaxShield(unequipped);

  return prisma.robot.update({
    where: { id: robotId },
    data: {
      maxHP: newMaxHP,
      maxShield: newMaxShield,
      currentHP: Math.min(unequipped.currentHP, newMaxHP),
      currentShield: Math.min(unequipped.currentShield, newMaxShield),
    },
    include: WEAPON_INCLUDE,
  });
}

/** Change loadout type, validating weapon compatibility. */
export async function changeLoadoutType(userId: number, robotId: number, loadoutType: string) {
  const robot = await prisma.robot.findFirst({
    where: { id: robotId, userId },
    include: WEAPON_INCLUDE,
  });
  if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);

  const { canChangeLoadout } = await import('../../utils/weaponValidation');
  const validation = canChangeLoadout(
    loadoutType,
    robot.mainWeapon?.weapon || null,
    robot.offhandWeapon?.weapon || null
  );

  if (!validation.canChange) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
      'Cannot change loadout type. Please unequip incompatible weapons before changing loadout type',
      400,
      { conflicts: validation.conflicts }
    );
  }

  const loadoutRobot = await prisma.robot.update({
    where: { id: robotId },
    data: { loadoutType },
    include: WEAPON_INCLUDE,
  });

  const newMaxHP = calculateMaxHP(loadoutRobot);
  const newMaxShield = calculateMaxShield(loadoutRobot);

  return prisma.robot.update({
    where: { id: robotId },
    data: {
      maxHP: newMaxHP,
      maxShield: newMaxShield,
      currentHP: Math.min(loadoutRobot.currentHP, newMaxHP),
      currentShield: Math.min(loadoutRobot.currentShield, newMaxShield),
    },
    include: WEAPON_INCLUDE,
  });
}
