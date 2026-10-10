/**
 * Spec #55 task 8.2 (R2.1, R10.3, R10.4, R10.5, R11.8) — Catalogue_Sync
 * through its script entry (`runCatalogueSyncCli`) with an injected
 * catalogue and Repository_Image directory (scratch directories beside this
 * file, removed afterwards). Only the Catalogue_Keys of this run are touched;
 * the stored sync summary is restored in `afterAll`.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../../src/lib/prisma';
import { runCatalogueSyncCli, type CatalogueCliIo } from '../../src/services/automaton/catalogueSync';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import type { CatalogueEntry } from '../../src/services/automaton/automatonCatalogueService';
import type { CatalogueSyncSummary } from '../../src/types/automaton';
import { validEntry } from '../../src/services/automaton/__tests__/helpers/catalogueTestSupport';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SCRATCH = path.join(__dirname, `.t55sync-${suffix}`);
const keys: string[] = [];
const userIds: number[] = [];

const keyFor = (tag: string): string => {
  const key = `t55s-${tag}-${suffix}`.slice(0, 40);
  keys.push(key);
  return key;
};

function entryFor(key: string, stableName: string): CatalogueEntry {
  return validEntry({ catalogueKey: key, stableName });
}

interface Dirs { catalogue: string; images: string }

function dirs(name: string): Dirs {
  const base = path.join(SCRATCH, name);
  const result = { catalogue: path.join(base, 'catalogue'), images: path.join(base, 'images') };
  fs.mkdirSync(result.catalogue, { recursive: true });
  fs.mkdirSync(result.images, { recursive: true });
  return result;
}

function writeEntry(d: Dirs, entry: CatalogueEntry | Record<string, unknown>, file?: string): void {
  const key = (entry as { catalogueKey: string }).catalogueKey;
  fs.writeFileSync(path.join(d.catalogue, file ?? `${key}.json`), JSON.stringify(entry));
}

/** Catalogue_Sync only checks that a Repository_Image file exists; the bytes are a WebP header. */
const WEBP_STUB = Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1');

async function writeImage(d: Dirs, key: string, slot: number): Promise<void> {
  fs.mkdirSync(path.join(d.images, key), { recursive: true });
  fs.writeFileSync(path.join(d.images, key, `${slot}.webp`), WEBP_STUB);
}

function captureIo(): CatalogueCliIo & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, out: (line) => lines.push(line), err: (line) => errors.push(line) };
}

const alerts: string[][] = [];
async function run(d: Dirs, argv: string[] = []): Promise<{ code: number; io: ReturnType<typeof captureIo> }> {
  const io = captureIo();
  const code = await runCatalogueSyncCli(argv, {
    catalogueDirectory: d.catalogue,
    imageDirectory: d.images,
    strategies: getStrategyRegistry(),
    alertConflicts: async (conflicts) => { alerts.push([...conflicts]); },
  }, io);
  return { code, io };
}

async function storedSummary(): Promise<CatalogueSyncSummary | null> {
  const row = await prisma.automatonProgramSetting.findUnique({ where: { id: 1 }, select: { lastSyncSummary: true } });
  return (row?.lastSyncSummary ?? null) as unknown as CatalogueSyncSummary | null;
}

const profileOf = (catalogueKey: string) => prisma.automatonProfile.findUnique({
  where: { catalogueKey },
  include: { blueprints: { orderBy: { slotIndex: 'asc' } } },
});

let previousSummary: unknown;

beforeAll(async () => {
  const row = await prisma.automatonProgramSetting.findUnique({ where: { id: 1 }, select: { lastSyncSummary: true } });
  previousSummary = row?.lastSyncSummary ?? null;
});

afterAll(async () => {
  await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { in: keys } } });
  await deleteAutomatonStables(userIds);
  await prisma.$executeRaw`UPDATE "automaton_program_settings" SET "last_sync_summary" = ${previousSummary === null ? null : JSON.stringify(previousSummary)}::jsonb WHERE "id" = 1`;
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('Catalogue_Sync (R10.3–R10.5)', () => {
  it('first run creates Draft_Automatons with Repository_Images where files exist; second run changes nothing', async () => {
    const d = dirs('first');
    const withImage = keyFor('img');
    const withoutImage = keyFor('noimg');
    writeEntry(d, entryFor(withImage, `T55 Sync Img ${suffix}`));
    writeEntry(d, entryFor(withoutImage, `T55 Sync None ${suffix}`));
    await writeImage(d, withImage, 1);

    const first = await run(d);
    expect(first.code).toBe(0);
    const profile = await profileOf(withImage);
    expect(profile).toMatchObject({ status: 'draft', origin: 'catalogue', userId: null, plannedStableName: `T55 Sync Img ${suffix}`, strategyKey: 'duo', strategyVersion: 1 });
    expect(profile?.blueprints.map((b) => b.imageUrl)).toEqual([`/assets/automatons/${withImage}/1.webp`, null]);
    expect(profile?.strategyParameters).toMatchObject({ targets: { 'duo.v1.13.robots': 2 } });
    expect(profile?.blueprints[1].refinementPlan).toEqual(entryFor(withImage, 'x').blueprints[1].refinementPlan);
    expect((await profileOf(withoutImage))?.blueprints.every((b) => b.imageUrl === null)).toBe(true);
    const summary = await storedSummary();
    expect(summary).toMatchObject({ added: [withImage, withoutImage].sort(), present: [], filled: [], conflicts: [] });

    const before = await profileOf(withImage);
    const second = await run(d);
    expect(second.code).toBe(0);
    expect(await storedSummary()).toMatchObject({ added: [], present: [withImage, withoutImage].sort(), filled: [], conflicts: [] });
    expect((await profileOf(withImage))?.updatedAt).toEqual(before?.updatedAt);
  });

  it('leaves an edited profile untouched apart from filling an image; never overwrites an image that is set', async () => {
    const d = dirs('edited');
    const key = keyFor('edit');
    writeEntry(d, entryFor(key, `T55 Sync Edit ${suffix}`));
    await run(d);
    const created = await profileOf(key);
    const adminUpload = `/uploads/automatons/${key}/0f2c9d0e-1111-4222-8333-444455556666.webp`;
    await prisma.automatonProfile.update({ where: { catalogueKey: key }, data: { franchise: 'Edited by admin' } });
    await prisma.automatonRobotBlueprint.update({ where: { id: created?.blueprints[0].id }, data: { imageUrl: adminUpload } });
    await writeImage(d, key, 1);
    await writeImage(d, key, 2);

    const result = await run(d);
    expect(result.code).toBe(0);
    const after = await profileOf(key);
    expect(after?.franchise).toBe('Edited by admin');
    expect(after?.blueprints.map((b) => b.imageUrl)).toEqual([adminUpload, `/assets/automatons/${key}/2.webp`]);
    expect((await storedSummary())?.filled).toEqual([{ catalogueKey: key, slot: 2, imageUrl: `/assets/automatons/${key}/2.webp` }]);

    // A filled Repository_Image is not replaced either: nothing to fill now.
    await run(d);
    expect((await storedSummary())?.filled).toEqual([]);
  });

  it('fills a live robot without an image in the same step and keeps a robot that has one', async () => {
    const d = dirs('live');
    const stable = await createAutomatonStable({
      tag: `sync${suffix}`,
      balance: 0,
      strategyKey: 'duo',
      blueprints: [
        { slotIndex: 1, robotName: `T55 Live A ${suffix}`, loadoutType: 'two_handed', weaponPath: [{ main: 'Heavy Hammer' }] },
        { slotIndex: 2, robotName: `T55 Live B ${suffix}`, loadoutType: 'two_handed', weaponPath: [{ main: 'Heavy Hammer' }] },
      ],
    });
    userIds.push(stable.userId);
    const robot = (slot: number, imageUrl: string | null) => prisma.robot.create({
      data: {
        userId: stable.userId, name: `T55 Live ${slot} ${suffix}`, currentHP: 55, maxHP: 55, currentShield: 4, maxShield: 4,
        automatonBlueprintId: stable.blueprintIds.get(slot), automatonSlotIndex: slot, imageUrl,
      },
    });
    const bare = await robot(1, null);
    const pictured = await robot(2, '/uploads/user-robots/kept.webp');
    writeEntry(d, entryFor(stable.catalogueKey, `T55 Sync Live ${suffix}`));
    await writeImage(d, stable.catalogueKey, 1);
    await writeImage(d, stable.catalogueKey, 2);

    expect((await run(d)).code).toBe(0);
    const url = (slot: number) => `/assets/automatons/${stable.catalogueKey}/${slot}.webp`;
    expect((await profileOf(stable.catalogueKey))?.blueprints.map((b) => b.imageUrl)).toEqual([url(1), url(2)]);
    expect((await prisma.robot.findUnique({ where: { id: bare.id } }))?.imageUrl).toBe(url(1));
    expect((await prisma.robot.findUnique({ where: { id: pictured.id } }))?.imageUrl).toBe('/uploads/user-robots/kept.webp');
    // An existing (active) profile is never renamed or reconfigured by its file.
    expect((await profileOf(stable.catalogueKey))?.plannedStableName).toBeNull();
  });

  it('skips and reports a stable-name conflict, and alerts', async () => {
    const d = dirs('conflict');
    const human = await prisma.user.create({
      data: { username: `t55sync_h_${suffix}`, passwordHash: 'unusable', stableName: `T55 Taken ${suffix}` },
    });
    userIds.push(human.id);
    const key = keyFor('conf');
    writeEntry(d, entryFor(key, `T55 Taken ${suffix}`));
    alerts.length = 0;

    const result = await run(d);
    expect(result.code).toBe(0);
    expect(await profileOf(key)).toBeNull();
    expect((await storedSummary())?.conflicts).toEqual([{ catalogueKey: key, stableName: `T55 Taken ${suffix}`, reason: 'stable_name_taken' }]);
    expect(alerts).toEqual([[`${key}: stable name "T55 Taken ${suffix}" is taken`]]);
    expect(result.io.lines.join('\n')).toContain('conflict');
  });

  it('skips a stable name another Automaton_Profile plans (a draft), and alerts', async () => {
    const d = dirs('planned');
    const planner = keyFor('planner');
    await prisma.automatonProfile.create({
      data: {
        catalogueKey: planner, plannedStableName: `T55 Planned ${suffix}`, franchise: 'F', backstory: 'B', strategyKey: 'duo',
        strategyVersion: 1, strategyParameters: { targets: {} }, eventOrder: [], status: 'draft', origin: 'admin',
      },
    });
    const key = keyFor('conf2');
    writeEntry(d, entryFor(key, `T55 Planned ${suffix}`));
    alerts.length = 0;

    expect((await run(d)).code).toBe(0);
    expect(await profileOf(key)).toBeNull();
    expect((await storedSummary())?.conflicts).toEqual([{ catalogueKey: key, stableName: `T55 Planned ${suffix}`, reason: 'stable_name_taken' }]);
    expect(alerts).toEqual([[`${key}: stable name "T55 Planned ${suffix}" is taken`]]);
  });

  it('aborts with exit 1 and writes nothing when any file is invalid (R10.4)', async () => {
    const d = dirs('invalid');
    const good = keyFor('good');
    writeEntry(d, entryFor(good, `T55 Sync Good ${suffix}`));
    writeEntry(d, { ...entryFor(keyFor('bad'), `T55 Sync Bad ${suffix}`), image: 'nope.webp' });
    const before = await storedSummary();

    const result = await run(d);
    expect(result.code).toBe(1);
    expect(result.io.errors.join('\n')).toMatch(/nothing was written/);
    expect(await profileOf(good)).toBeNull();
    expect(await storedSummary()).toEqual(before);
  });

  it('dry run reports the drafts and fills it would make and writes nothing', async () => {
    const d = dirs('dry');
    const existing = keyFor('dryold');
    writeEntry(d, entryFor(existing, `T55 Sync Dry Old ${suffix}`));
    expect((await run(d)).code).toBe(0);
    const key = keyFor('drynew');
    writeEntry(d, entryFor(key, `T55 Sync Dry New ${suffix}`));
    await writeImage(d, key, 2);
    await writeImage(d, existing, 1);
    const before = await storedSummary();

    const result = await run(d, ['--dry-run']);
    expect(result.code).toBe(0);
    expect(result.io.lines[0]).toMatch(/dry run, nothing written.*would add 1, already present 1, images it would fill 1, conflicts 0/);
    expect(result.io.lines).toContain(`  would add draft: ${key} (Repository_Images for 1 of 2 blueprints)`);
    expect(result.io.lines).toContain(`  would fill image: ${existing} slot 1 → /assets/automatons/${existing}/1.webp`);
    expect(await profileOf(key)).toBeNull();
    expect((await profileOf(existing))?.blueprints[0].imageUrl).toBeNull();
    expect(await storedSummary()).toEqual(before);
  });

  it('rejects an unknown argument', async () => {
    const result = await run(dirs('args'), ['--force']);
    expect(result.code).toBe(1);
  });
});
