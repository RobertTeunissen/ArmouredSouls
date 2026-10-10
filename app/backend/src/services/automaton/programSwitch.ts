/**
 * Program_Switch (Spec #55, R2.7, R2.8, design D7, task 6.1).
 *
 * One global switch in the single-row table `automaton_program_settings`
 * (id = 1, seeded by the migration, default on). While it is off every due
 * Automaton_Turn is recorded `skipped` / `program_off` and nothing is bought
 * or upkept; robots keep their subscriptions, teams and scheduled matches.
 * A change applies from the next Turn_Step: `runTurnStep` reads the switch
 * once at its start.
 *
 * The admin audit entry for a change (R2.8) is written by the admin route
 * that calls `setProgramSwitch` (task 9.x), which receives the old and new
 * value from it.
 */
import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';

/** The single settings row id. */
export const PROGRAM_SETTINGS_ID = 1;

export interface ProgramSwitchState {
  turnsEnabled: boolean;
  updatedAt: Date;
  updatedByUserId: number | null;
}

export interface ProgramSwitchChange {
  previous: boolean;
  current: boolean;
  updatedAt: Date;
}

type SettingsDb = Pick<Prisma.TransactionClient, 'automatonProgramSetting'>;

/**
 * The settings row, created with the defaults if a reset removed it (the
 * migration seeds it; `upsert` keeps the read safe on an empty table).
 */
export async function ensureProgramSettings(db: SettingsDb = prisma): Promise<ProgramSwitchState> {
  const select = { turnsEnabled: true, updatedAt: true, updatedByUserId: true } as const;
  const existing = await db.automatonProgramSetting.findUnique({ where: { id: PROGRAM_SETTINGS_ID }, select });
  if (existing) return existing;
  // Read-then-insert (not upsert), so a read never touches `updatedAt`.
  await db.automatonProgramSetting.createMany({ data: [{ id: PROGRAM_SETTINGS_ID }], skipDuplicates: true });
  return db.automatonProgramSetting.findUniqueOrThrow({ where: { id: PROGRAM_SETTINGS_ID }, select });
}

/** The current Program_Switch state (R2.7). */
export async function getProgramSwitch(db: SettingsDb = prisma): Promise<ProgramSwitchState> {
  return ensureProgramSettings(db);
}

/** Whether Automaton_Turns may run (read once per Turn_Step). */
export async function isProgramEnabled(db: SettingsDb = prisma): Promise<boolean> {
  return (await ensureProgramSettings(db)).turnsEnabled;
}

/**
 * Set the Program_Switch (R2.8). Returns the old and new value for the
 * caller's audit entry. Setting the current value is allowed and reported as
 * unchanged (`previous === current`).
 */
export async function setProgramSwitch(enabled: boolean, adminUserId: number): Promise<ProgramSwitchChange> {
  return prisma.$transaction(async (tx) => {
    const before = await ensureProgramSettings(tx);
    const after = await tx.automatonProgramSetting.update({
      where: { id: PROGRAM_SETTINGS_ID },
      data: { turnsEnabled: enabled, updatedByUserId: adminUserId },
      select: { turnsEnabled: true, updatedAt: true },
    });
    return { previous: before.turnsEnabled, current: after.turnsEnabled, updatedAt: after.updatedAt };
  });
}
