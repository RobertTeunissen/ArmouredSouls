/**
 * Robot weapon equip/unequip and loadout-change transaction logic.
 *
 * Extracted from the robots route to keep handlers thin.
 */
import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import {
  canEquipToSlot,
  canChangeLoadout,
  validateOffhandEquipment,
  isSlotAvailable,
  validateNoDuplicateEquip,
} from '../../utils/weaponValidation';
import { calculateMaxHP, calculateMaxShield } from '../../utils/robotCalculations';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';

type WeaponSlot = 'main' | 'offhand';

// Spec #34: include refinements so the equip/unequip response carries
// rank prefix + slot bar data back to the frontend for immediate render.
const WEAPON_INCLUDE = {
  mainWeapon: { include: { weapon: true as const, refinements: { orderBy: { slotIndex: 'asc' as const } } } },
  offhandWeapon: { include: { weapon: true as const, refinements: { orderBy: { slotIndex: 'asc' as const } } } },
} as const;

type RobotWithEquipment = Prisma.RobotGetPayload<{ include: typeof WEAPON_INCLUDE }>;

const SLOT_COLUMN = { main: 'mainWeaponId', offhand: 'offhandWeaponId' } as const;

function invalid(message: string, status = 400): RobotError {
  return new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, message, status);
}

/** The caller's robot with its equipment, or ROBOT_NOT_FOUND. */
async function loadOwnedRobot(tx: Prisma.TransactionClient, userId: number, robotId: number): Promise<RobotWithEquipment> {
  const robot = await tx.robot.findFirst({ where: { id: robotId, userId }, include: WEAPON_INCLUDE });
  if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
  return robot;
}

/** Recalculate max HP/Shield after an equipment change, clamp current values, and persist. */
function recalcStats(tx: Prisma.TransactionClient, robot: RobotWithEquipment): Promise<RobotWithEquipment> {
  const hp = calculateMaxHP(robot);
  const shield = calculateMaxShield(robot);
  return tx.robot.update({
    where: { id: robot.id },
    data: {
      maxHP: hp,
      maxShield: shield,
      currentHP: Math.min(robot.currentHP, hp),
      currentShield: Math.min(robot.currentShield, shield),
    },
    include: WEAPON_INCLUDE,
  });
}

/** Equip an inventory weapon to one slot, validating ownership, slot and loadout rules. */
async function equipWeapon(userId: number, robotId: number, slot: WeaponSlot, weaponInvId: number): Promise<RobotWithEquipment> {
  return prisma.$transaction(async (tx) => {
    // Lock the weapon_inventory row to serialize against concurrent resale
    // (DELETE /api/weapon-inventory/:id). Without it the FK ON DELETE SET NULL
    // would silently null this robot's slot if a resale committed between our
    // read and our update. Lock order across the codebase: users row first (if
    // needed), then weapon_inventory. See app/backend/src/lib/creditGuard.ts.
    const lockedInvRows = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM weapon_inventory WHERE id = ${weaponInvId} FOR UPDATE
    `;
    if (lockedInvRows.length === 0) throw invalid('Weapon not found in your inventory', 404);

    const robot = await loadOwnedRobot(tx, userId, robotId);
    if (slot === 'offhand' && !isSlotAvailable('offhand', robot.loadoutType)) {
      throw invalid(`Offhand slot not available for ${robot.loadoutType} loadout`);
    }

    const weaponInv = await tx.weaponInventory.findFirst({
      where: { id: weaponInvId, userId },
      include: {
        weapon: true,
        robotsMain: { select: { id: true, name: true } },
        robotsOffhand: { select: { id: true, name: true } },
      },
    });
    if (!weaponInv) throw invalid('Weapon not found in your inventory', 404);

    const equippedToOther = weaponInv.robotsMain.concat(weaponInv.robotsOffhand).find(r => r.id !== robotId);
    if (equippedToOther) throw invalid(`Weapon is already equipped to ${equippedToOther.name}`);

    const dupCheck = validateNoDuplicateEquip(weaponInvId, slot, robot);
    if (!dupCheck.valid) throw invalid(dupCheck.reason!);
    const slotCheck = canEquipToSlot(weaponInv.weapon, slot, robot.loadoutType);
    if (!slotCheck.canEquip) throw invalid(slotCheck.reason!);
    if (slot === 'offhand') {
      const offhandCheck = validateOffhandEquipment(weaponInv.weapon, robot.mainWeaponId !== null, robot.loadoutType);
      if (!offhandCheck.valid) throw invalid(offhandCheck.reason!);
    }

    const equipped = await tx.robot.update({
      where: { id: robotId },
      data: { [SLOT_COLUMN[slot]]: weaponInvId },
      include: WEAPON_INCLUDE,
    });
    return recalcStats(tx, equipped);
  });
}

/** Empty one weapon slot and recalculate stats. */
async function unequipWeapon(userId: number, robotId: number, slot: WeaponSlot): Promise<RobotWithEquipment> {
  return prisma.$transaction(async (tx) => {
    const robot = await loadOwnedRobot(tx, userId, robotId);
    if (robot[SLOT_COLUMN[slot]] === null) throw invalid(`No ${slot} weapon equipped`);
    const unequipped = await tx.robot.update({
      where: { id: robotId },
      data: { [SLOT_COLUMN[slot]]: null },
      include: WEAPON_INCLUDE,
    });
    return recalcStats(tx, unequipped);
  });
}

/** Equip a weapon to the main slot inside a transaction. */
export function equipMainWeapon(userId: number, robotId: number, weaponInvId: number): Promise<RobotWithEquipment> {
  return equipWeapon(userId, robotId, 'main', weaponInvId);
}

/** Equip a weapon to the offhand slot inside a transaction. */
export function equipOffhandWeapon(userId: number, robotId: number, weaponInvId: number): Promise<RobotWithEquipment> {
  return equipWeapon(userId, robotId, 'offhand', weaponInvId);
}

/** Unequip the main weapon and recalculate stats. */
export function unequipMainWeapon(userId: number, robotId: number): Promise<RobotWithEquipment> {
  return unequipWeapon(userId, robotId, 'main');
}

/** Unequip the offhand weapon and recalculate stats. */
export function unequipOffhandWeapon(userId: number, robotId: number): Promise<RobotWithEquipment> {
  return unequipWeapon(userId, robotId, 'offhand');
}

/** Change loadout type, validating weapon compatibility. */
export async function changeLoadoutType(userId: number, robotId: number, loadoutType: string): Promise<RobotWithEquipment> {
  return prisma.$transaction(async (tx) => {
    const robot = await loadOwnedRobot(tx, userId, robotId);
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
    const loadoutRobot = await tx.robot.update({
      where: { id: robotId },
      data: { loadoutType },
      include: WEAPON_INCLUDE,
    });
    return recalcStats(tx, loadoutRobot);
  });
}
