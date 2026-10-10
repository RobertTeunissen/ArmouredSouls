/**
 * Spec #55 integration fixtures: an Active_Automaton (User with
 * `stableType = automaton` plus its Automaton_Profile and Robot_Blueprints)
 * built directly in the database, and the matching cleanup.
 *
 * Only tests use this; production Activation is task 9.1.
 */
import prisma from '../../src/lib/prisma';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../src/services/subscription/eventRegistry';
import type { EventOrder, RefinementStep, TeamNames, WeaponStage } from '../../src/types/automaton';

export interface BlueprintFixture {
  slotIndex: number;
  robotName: string;
  imageUrl?: string | null;
  loadoutType: 'single' | 'weapon_shield' | 'dual_wield' | 'two_handed';
  stance?: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold?: number;
  buildFocus?: string;
  weaponPath: WeaponStage[];
  refinementPlan?: RefinementStep[];
}

export interface AutomatonStableFixtureOptions {
  /** Unique per test run; used for the username, stable name and Catalogue_Key. */
  tag: string;
  balance: number;
  prestige?: number;
  blueprints: BlueprintFixture[];
  teamNames?: TeamNames;
  eventOrder?: EventOrder;
  strategyKey?: string;
}

export interface AutomatonStableFixture {
  userId: number;
  profileId: number;
  catalogueKey: string;
  /** Blueprint id per Blueprint_Slot. */
  blueprintIds: Map<number, number>;
  teamNames: TeamNames;
  eventOrder: EventOrder;
}

export async function createAutomatonStable(options: AutomatonStableFixtureOptions): Promise<AutomatonStableFixture> {
  const teamNames = options.teamNames ?? { twoVsTwo: [], threeVsThree: [] };
  const eventOrder = options.eventOrder ?? [...SUBSCRIBABLE_EVENT_TYPES];
  const catalogueKey = `t-${options.tag}`.toLowerCase().slice(0, 40);
  const user = await prisma.user.create({
    data: {
      // Not `auto…`: other suites clean up generated users with
      // `startsWith: 'auto_'`, which Postgres LIKE also matches for `automaton_…`.
      username: `t55amt_${options.tag}`.slice(0, 50),
      passwordHash: 'unusable',
      stableName: `Auto ${options.tag}`.slice(0, 30),
      stableType: 'automaton',
      isGenerated: false,
      hasCompletedOnboarding: true,
      currency: options.balance,
      prestige: options.prestige ?? 0,
    },
  });
  const profile = await prisma.automatonProfile.create({
    data: {
      catalogueKey,
      userId: user.id,
      franchise: 'Test franchise',
      backstory: 'Test backstory',
      strategyKey: options.strategyKey ?? 'swarm',
      strategyVersion: 1,
      strategyParameters: { targets: {} },
      teamNames: teamNames as unknown as object,
      eventOrder: eventOrder as unknown as object,
      status: 'active',
      origin: 'admin',
      activatedAt: new Date(),
      blueprints: {
        create: options.blueprints.map((b) => ({
          slotIndex: b.slotIndex,
          robotName: b.robotName,
          imageUrl: b.imageUrl ?? null,
          loadoutType: b.loadoutType,
          stance: b.stance ?? 'balanced',
          yieldThreshold: b.yieldThreshold ?? 10,
          buildFocus: b.buildFocus ?? 'bruiser',
          weaponPath: b.weaponPath as unknown as object,
          refinementPlan: (b.refinementPlan ?? []) as unknown as object,
        })),
      },
    },
    include: { blueprints: true },
  });
  return {
    userId: user.id,
    profileId: profile.id,
    catalogueKey,
    blueprintIds: new Map(profile.blueprints.map((b) => [b.slotIndex, b.id])),
    teamNames,
    eventOrder,
  };
}

/** Delete the stables (profiles, standings, users) the fixtures created. */
export async function deleteAutomatonStables(userIds: readonly number[]): Promise<void> {
  if (userIds.length === 0) return;
  const robots = await prisma.robot.findMany({ where: { userId: { in: [...userIds] } }, select: { id: true } });
  const teams = await prisma.teamBattle.findMany({ where: { stableId: { in: [...userIds] } }, select: { id: true } });
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } } });
  await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teams.map((t) => t.id) } } });
  await prisma.automatonProfile.deleteMany({ where: { userId: { in: [...userIds] } } });
  await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
}

export interface DraftProfileFixtureOptions {
  catalogueKey: string;
  plannedStableName: string;
  strategyKey: string;
  strategyVersion?: number;
  strategyParameters?: { targets: Record<string, number> };
  /** Blueprint_Slots to fill with a valid two-handed blueprint. */
  slots: number[];
  teamNames?: TeamNames;
}

/** A Draft_Automaton with blueprints in the given slots, written directly (no User). */
export async function createDraftProfile(options: DraftProfileFixtureOptions): Promise<{ profileId: number; catalogueKey: string }> {
  const profile = await prisma.automatonProfile.create({
    data: {
      catalogueKey: options.catalogueKey,
      plannedStableName: options.plannedStableName,
      franchise: 'Test franchise',
      backstory: 'Test backstory',
      strategyKey: options.strategyKey,
      strategyVersion: options.strategyVersion ?? 1,
      strategyParameters: (options.strategyParameters ?? { targets: {} }) as unknown as object,
      teamNames: (options.teamNames ?? { twoVsTwo: [], threeVsThree: [] }) as unknown as object,
      eventOrder: [...SUBSCRIBABLE_EVENT_TYPES] as unknown as object,
      status: 'draft',
      origin: 'admin',
      blueprints: {
        create: options.slots.map((slotIndex) => ({
          slotIndex,
          robotName: `Fx Hammer ${slotIndex}`,
          loadoutType: 'two_handed',
          stance: 'balanced',
          yieldThreshold: 10,
          buildFocus: 'bruiser',
          weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }] as unknown as object,
          refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }] as unknown as object,
        })),
      },
    },
  });
  return { profileId: profile.id, catalogueKey: profile.catalogueKey };
}
