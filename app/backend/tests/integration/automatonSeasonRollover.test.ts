/**
 * Spec #55 task 7.4 — a full Season_Rollover with Active_Automatons, a
 * Draft_Automaton, a Generated_Stable and a Human_Stable (R1.5, R9.1–R9.8).
 *
 * HEAVY tier: the rollover archives, deletes generated stables, resets every
 * stable and truncates the history tables of the whole database, so it runs
 * only on a dedicated database (CI's heavy job, or a local
 * `armouredsouls_heavy`), never on a shared dev database.
 *
 * Asserts: Automaton users survive and are reset per the
 * Human_Reset_Contract; the Generated_Stable is deleted; profiles (incl.
 * Team_Names and Event_Order), blueprints, Goal_Targets, the Program_Switch
 * and `uploads/automatons/` files are unchanged; archive rows carry the
 * subject Stable_Type; Turn_Records of the completed season are purged; the
 * rollover's `season_open` turn and the next `preparation` turn rebuild each
 * Automaton from ₡3,000,000.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma from '../../src/lib/prisma';
import { getCurrentSeason, invalidateSeasonCache } from '../../src/services/season/seasonService';
import { executeSeasonRollover } from '../../src/services/season/seasonRolloverService';
import { runTurnStep } from '../../src/services/automaton/automatonTurnService';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import { getProgramSwitch } from '../../src/services/automaton/programSwitch';
import { activateProfile, addBlueprint, createDraft } from '../../src/services/automaton/automatonProfileService';
import { getAutomatonUploadDir, storeBlueprintImage } from '../../src/services/automaton/automatonImageService';
import { SUBSCRIBABLE_EVENT_TYPES, isRegisteredEvent, registerSubscribableEvent } from '../../src/services/subscription/eventRegistry';

jest.setTimeout(600_000);

const run = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const KEY_PREFIX = `t55r-${run}`;

const HAMMER = {
  robotName: 'Rz Hammer', loadoutType: 'two_handed' as const, stance: 'balanced' as const, yieldThreshold: 10, buildFocus: 'bruiser' as const,
  weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
  refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }],
};
const SHIELD = {
  robotName: 'Rz Shield', loadoutType: 'weapon_shield' as const, stance: 'defensive' as const, yieldThreshold: 20, buildFocus: 'warden' as const,
  weaponPath: [{ main: 'Laser Pistol', offhand: 'Light Shield' }, { main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
  refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }],
};

async function resetSeasonTables(): Promise<void> {
  await prisma.seasonAccolade.deleteMany({});
  await prisma.seasonStandingSnapshot.deleteMany({});
  await prisma.robotSeasonArchive.deleteMany({});
  await prisma.stableSeasonArchive.deleteMany({});
  await prisma.season.deleteMany({});
  invalidateSeasonCache();
}

async function seedStable(isGenerated: boolean, tag: string): Promise<number> {
  const user = await prisma.user.create({
    data: {
      username: isGenerated ? `auto_rz_${run}_${tag}` : `rz_human_${run}_${tag}`,
      passwordHash: 'unused', currency: 1_234_567, prestige: 4_200, stableName: `Rz ${tag} ${run}`.slice(0, 30), isGenerated,
    },
  });
  const robot = await prisma.robot.create({
    data: { userId: user.id, name: `Rz Robot ${tag} ${run}`, currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10, elo: 1350 },
  });
  await prisma.standing.create({
    data: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1', tier: 'gold', leagueInstanceId: 'gold_1', leaguePoints: 50 },
  });
  return user.id;
}

/** Everything a rollover must leave untouched (R9.3), as comparable JSON. */
async function preservedState(): Promise<string> {
  const profiles = await prisma.automatonProfile.findMany({
    where: { catalogueKey: { startsWith: KEY_PREFIX } },
    orderBy: { catalogueKey: 'asc' },
    include: { blueprints: { orderBy: { slotIndex: 'asc' } } },
  });
  const settings = await getProgramSwitch();
  return JSON.stringify({ profiles, turnsEnabled: settings.turnsEnabled });
}

function fileDigests(directory: string): Record<string, string> {
  if (!fs.existsSync(directory)) return {};
  const out: Record<string, string> = {};
  for (const name of fs.readdirSync(directory).sort()) {
    out[name] = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex');
  }
  return out;
}

describe('Season_Rollover with Automaton Stables (Spec #55 task 7.4)', () => {
  let previousSender: ReturnType<typeof setAlertSender>;
  const keys = { paragon: `${KEY_PREFIX}-par`, duo: `${KEY_PREFIX}-duo`, draft: `${KEY_PREFIX}-draft` };
  let automatonIds: number[] = [];
  let humanId: number;
  let generatedId: number;
  let completedSeason: number;
  let uploadDirectory: string;

  beforeAll(async () => {
    previousSender = setAlertSender(async () => undefined);
    // The registry is filled at app start-up; without it Event_Allocation's
    // setSubscriptionsForRobot rejects every event, and an Automaton robot is
    // in no competition (standings come from its first subscriptions).
    for (const type of SUBSCRIBABLE_EVENT_TYPES) if (!isRegisteredEvent(type)) registerSubscribableEvent({ type, label: type });
    await resetSeasonTables();
    await getCurrentSeason();
    await prisma.automatonProgramSetting.upsert({ where: { id: 1 }, update: { turnsEnabled: true, turnStepLeaseUntil: null }, create: { id: 1 } });

    await createDraft({ catalogueKey: keys.paragon, stableName: `Rz Paragon ${run}`, franchise: 'Test', backstory: 'Rollover test stable.', strategyKey: 'paragon' });
    await addBlueprint(keys.paragon, HAMMER);
    await createDraft({
      catalogueKey: keys.duo, stableName: `Rz Duo ${run}`, franchise: 'Test', backstory: 'Rollover test stable.', strategyKey: 'duo',
      eventOrder: ['league_2v2', 'tag_team', 'tournament_2v2', 'league_1v1', 'koth', 'grand_melee', 'tournament_1v1', 'league_3v3', 'tournament_3v3'],
    });
    await addBlueprint(keys.duo, HAMMER);
    await addBlueprint(keys.duo, { ...SHIELD, teamNames: { twoVsTwo: ['Rz Pair'], threeVsThree: [] } });
    await createDraft({ catalogueKey: keys.draft, stableName: `Rz Draft ${run}`, franchise: 'Test', backstory: 'Stays a draft.', strategyKey: 'paragon' });
    await addBlueprint(keys.draft, HAMMER);

    automatonIds = [(await activateProfile(keys.paragon)).result.userId, (await activateProfile(keys.duo)).result.userId];
    humanId = await seedStable(false, 'human');
    generatedId = await seedStable(true, 'bot');

    // An admin upload in the real Automaton_Image_Store (R9.8).
    const png = await sharp({ create: { width: 128, height: 128, channels: 3, background: { r: 200, g: 20, b: 20 } } }).png().toBuffer();
    await storeBlueprintImage(keys.paragon, 1, png, 'image/png');
    uploadDirectory = path.join(getAutomatonUploadDir(), keys.paragon);

    // One turn in the current season builds state the rollover must reset.
    completedSeason = (await getCurrentSeason()).seasonNumber;
    const summary = await runTurnStep({ trigger: 'settlement', seasonNumber: completedSeason, slot: 1, source: 'scheduler' });
    expect(summary.completed).toBeGreaterThanOrEqual(2);
  });

  afterAll(async () => {
    setAlertSender(previousSender);
    fs.rmSync(uploadDirectory, { recursive: true, force: true });
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
    await prisma.robot.deleteMany({ where: { userId: { in: [...automatonIds, humanId, generatedId] } } });
    await prisma.stableSeasonArchive.deleteMany({ where: { userId: { in: [...automatonIds, humanId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [...automatonIds, humanId, generatedId] } } });
    await resetSeasonTables();
    await prisma.$disconnect();
  });

  it('keeps Automatons and their configuration, deletes the Generated_Stable, archives Stable_Types, purges Turn_Records and rebuilds from ₡3,000,000', async () => {
    for (const userId of automatonIds) {
      expect(await prisma.robot.count({ where: { userId } })).toBeGreaterThan(0);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).currency).toBeLessThan(3_000_000);
    }
    const oldRobotIds = (await prisma.robot.findMany({ where: { userId: { in: automatonIds } }, select: { id: true } })).map((r) => r.id);
    const before = await preservedState();
    const filesBefore = fileDigests(uploadDirectory);
    expect(Object.keys(filesBefore)).toHaveLength(1);

    const rolloverStart = new Date();
    const result = await executeSeasonRollover({ trigger: 'admin', adminUserId: humanId });
    const newSeason = result.newSeasonNumber;
    expect(result.completedSeasonNumber).toBe(completedSeason);

    // R9.2: Automaton users survive; the Generated_Stable is deleted; the human stays.
    expect(await prisma.user.findUnique({ where: { id: generatedId } })).toBeNull();
    const human = await prisma.user.findUniqueOrThrow({ where: { id: humanId } });
    expect(human).toMatchObject({ currency: 3_000_000, prestige: 0 });
    for (const userId of automatonIds) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      // Prestige was reset too; Stage 4 and the season_open turn then earn achievements as for a player.
      expect(user).toMatchObject({ stableType: 'automaton', isGenerated: false, hasCompletedOnboarding: true });
    }
    // Human_Reset_Contract: last season's robots are gone (the turn below builds new ones).
    expect(await prisma.robot.count({ where: { id: { in: oldRobotIds } } })).toBe(0);

    // R9.3, R9.8: configuration, Program_Switch and admin uploads are untouched.
    expect(await preservedState()).toBe(before);
    expect(fileDigests(uploadDirectory)).toEqual(filesBefore);
    const draft = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey: keys.draft } });
    expect(draft).toMatchObject({ status: 'draft', userId: null });

    // R9.4: the archive carries the subject Stable_Type.
    const archives = await prisma.stableSeasonArchive.findMany({ where: { seasonNumber: completedSeason, userId: { in: [...automatonIds, humanId] } } });
    expect(archives.filter((a) => automatonIds.includes(a.userId)).map((a) => a.stableType)).toEqual(['automaton', 'automaton']);
    expect(archives.find((a) => a.userId === humanId)?.stableType).toBe('human');
    const automatonStableNames = (await prisma.user.findMany({ where: { id: { in: automatonIds } }, select: { stableName: true } })).map((u) => u.stableName ?? '');
    const snapshots = await prisma.seasonStandingSnapshot.findMany({ where: { seasonNumber: completedSeason, stableName: { in: automatonStableNames } } });
    expect(snapshots.length).toBeGreaterThan(0);
    for (const row of snapshots) expect(row).toMatchObject({ subjectStableType: 'automaton', isGeneratedSubject: false });
    const humanSnapshot = await prisma.seasonStandingSnapshot.findFirst({ where: { seasonNumber: completedSeason, stableName: human.stableName ?? '' } });
    expect(humanSnapshot?.subjectStableType).toBe('human');

    // R9.5: the completed season's Turn_Records are purged.
    const profiles = await prisma.automatonProfile.findMany({ where: { catalogueKey: { in: [keys.paragon, keys.duo] } }, select: { id: true } });
    const profileIds = profiles.map((p) => p.id);
    expect(await prisma.automatonTurn.count({ where: { profileId: { in: profileIds }, seasonNumber: completedSeason } })).toBe(0);

    // R9.1, R7.2: Stage 5 gave each Automaton its season_open turn, from ₡3,000,000.
    const opening = await prisma.automatonTurn.findMany({ where: { profileId: { in: profileIds }, seasonNumber: newSeason } });
    expect(opening.map((t) => [t.trigger, t.slot, t.status])).toEqual([['season_open', 0, 'completed'], ['season_open', 0, 'completed']]);
    const userOfProfile = new Map(
      (await prisma.automatonProfile.findMany({ where: { id: { in: profileIds } }, select: { id: true, userId: true } })).map((p) => [p.id, p.userId as number]),
    );
    for (const turn of opening) {
      // The reset sets ₡3,000,000; Stage 4 then re-awards the onboarding achievement as for a human (R9.7).
      const rewards = await prisma.financialLedger.aggregate({
        _sum: { amount: true },
        where: { userId: userOfProfile.get(turn.profileId), createdAt: { gte: rolloverStart, lt: turn.startedAt } },
      });
      expect(turn.startBalance).toBe(3_000_000 + (rewards._sum.amount ?? 0));
      expect(turn.creditsSpent).toBeGreaterThan(0);
    }
    for (const userId of automatonIds) expect(await prisma.robot.count({ where: { userId } })).toBeGreaterThan(0);
    expect(await prisma.automatonTurn.count({ where: { profileId: draft.id } })).toBe(0);

    // The next preparation day continues the build.
    const preparation = await runTurnStep({ trigger: 'preparation', seasonNumber: newSeason, slot: 1, source: 'scheduler' });
    expect(preparation.failed).toBe(0);
    const prepRows = await prisma.automatonTurn.findMany({ where: { profileId: { in: profileIds }, seasonNumber: newSeason, trigger: 'preparation' } });
    expect(prepRows.map((t) => t.status)).toEqual(['completed', 'completed']);
  });
});
