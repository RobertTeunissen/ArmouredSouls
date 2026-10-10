/**
 * Spec #55 task 8.4 (R6.14, R10.7, R10.8) — Catalogue_Export and
 * Catalogue_Unpack: export → unpack → schema-valid round trip (entries carry
 * no image field; admin uploads land on their Repository_Image path),
 * `--force` handling, and Strategy_Definition_File unpacking that never
 * overwrites a strategy file. All files go to scratch directories beside this
 * file, removed afterwards.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma from '../../src/lib/prisma';
import { exportCatalogue } from '../../src/services/automaton/catalogueExport';
import { runCatalogueUnpackCli, unpackDocument } from '../../src/services/automaton/catalogueUnpack';
import { runCatalogueSyncCli } from '../../src/services/automaton/catalogueSync';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { loadCatalogueDirectory } from '../../src/services/automaton/automatonCatalogueService';
import { SEED_WEAPON_MAP } from '../../src/services/automaton/strategies/__tests__/helpers/strategyTestSupport';
import { validEntry } from '../../src/services/automaton/__tests__/helpers/catalogueTestSupport';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SCRATCH = path.join(__dirname, `.t55export-${suffix}`);
const DRAFT_KEY = `t55e-draft-${suffix}`;
const userIds: number[] = [];
let activeKey = '';
let uploadBytes: Buffer;

const scratch = (...parts: string[]): string => {
  const dir = path.join(SCRATCH, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const silentIo = () => {
  const errors: string[] = [];
  return { errors, out: () => undefined, err: (line: string) => { errors.push(line); } };
};

let previousSummary: unknown;

beforeAll(async () => {
  const row = await prisma.automatonProgramSetting.findUnique({ where: { id: 1 }, select: { lastSyncSummary: true } });
  previousSummary = row?.lastSyncSummary ?? null;

  // A Draft_Automaton from a catalogue file, with a Goal_Target override.
  const catalogue = scratch('sync');
  fs.writeFileSync(path.join(catalogue, `${DRAFT_KEY}.json`), JSON.stringify(validEntry({
    catalogueKey: DRAFT_KEY,
    stableName: `T55 Export ${suffix}`,
    strategy: { key: 'duo', version: 1, targetOverrides: { 11: 3 } },
  })));
  expect(await runCatalogueSyncCli([], { catalogueDirectory: catalogue, imageDirectory: scratch('noimages'), alertConflicts: async () => undefined }, silentIo())).toBe(0);

  // An Active_Automaton whose slot-1 blueprint has an admin upload.
  const stable = await createAutomatonStable({
    tag: `exp${suffix}`,
    balance: 0,
    strategyKey: 'duo',
    teamNames: { twoVsTwo: ['Export Pair'], threeVsThree: [] },
    blueprints: [
      {
        slotIndex: 1, robotName: `T55 Exp A ${suffix}`, loadoutType: 'two_handed',
        weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
        refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
      },
      {
        slotIndex: 2, robotName: `T55 Exp B ${suffix}`, loadoutType: 'single',
        weaponPath: [{ main: 'Laser Pistol' }],
        refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
      },
    ],
  });
  userIds.push(stable.userId);
  activeKey = stable.catalogueKey;
  const uuid = '3e1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';
  uploadBytes = await sharp({ create: { width: 512, height: 512, channels: 3, background: { r: 200, g: 10, b: 10 } } }).webp().toBuffer();
  fs.writeFileSync(path.join(scratch('uploads', 'automatons', activeKey), `${uuid}.webp`), uploadBytes);
  await prisma.automatonRobotBlueprint.update({ where: { id: stable.blueprintIds.get(1) }, data: { imageUrl: `/uploads/automatons/${activeKey}/${uuid}.webp` } });
  await prisma.automatonRobotBlueprint.update({ where: { id: stable.blueprintIds.get(2) }, data: { imageUrl: `/assets/automatons/${activeKey}/2.webp` } });
});

afterAll(async () => {
  await prisma.automatonProfile.deleteMany({ where: { catalogueKey: DRAFT_KEY } });
  await deleteAutomatonStables(userIds);
  await prisma.$executeRaw`UPDATE "automaton_program_settings" SET "last_sync_summary" = ${previousSummary === null ? null : JSON.stringify(previousSummary)}::jsonb WHERE "id" = 1`;
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  await prisma.$disconnect();
});

const exportOurs = () => exportCatalogue({ keys: [DRAFT_KEY, activeKey], uploadsDirectory: path.join(SCRATCH, 'uploads'), environment: 'test' });

describe('Catalogue_Export (R10.7)', () => {
  it('exports one entry per profile, the active stable name, overrides, and only admin uploads as images', async () => {
    const document = await exportOurs();
    expect(document).toMatchObject({ schemaVersion: 1, environment: 'test' });
    expect(document.entries.map((e) => e.catalogueKey)).toEqual([DRAFT_KEY, activeKey].sort());
    const draft = document.entries.find((e) => e.catalogueKey === DRAFT_KEY);
    const active = document.entries.find((e) => e.catalogueKey === activeKey);
    expect(draft?.stableName).toBe(`T55 Export ${suffix}`);
    expect(draft?.strategy).toEqual({ key: 'duo', version: 1, targetOverrides: { 11: 3 } });
    const user = await prisma.user.findUnique({ where: { id: userIds[0] }, select: { stableName: true } });
    expect(active?.stableName).toBe(user?.stableName);
    expect(JSON.stringify(document.entries)).not.toMatch(/image/i);
    expect(Object.keys(document.images)).toEqual([`${activeKey}/1`]);
    expect(Buffer.from(document.images[`${activeKey}/1`], 'base64').equals(uploadBytes)).toBe(true);
  });
});

describe('Catalogue_Unpack (R10.8)', () => {
  it('round trip: unpacked files are schema-valid and admin uploads land on the Repository_Image path', async () => {
    const document = await exportOurs();
    const catalogue = scratch('unpack', 'catalogue');
    const images = scratch('unpack', 'images');
    const result = unpackDocument(document, { weapons: SEED_WEAPON_MAP, strategies: getStrategyRegistry(), catalogueDirectory: catalogue, imageDirectory: images });
    expect(result).toMatchObject({ ok: true, kind: 'catalogue' });
    expect(fs.readdirSync(catalogue).sort()).toEqual([`${DRAFT_KEY}.json`, `${activeKey}.json`].sort());
    expect(fs.readFileSync(path.join(images, activeKey, '1.webp')).equals(uploadBytes)).toBe(true);
    expect(fs.existsSync(path.join(images, activeKey, '2.webp'))).toBe(false);
    const load = loadCatalogueDirectory({ weapons: SEED_WEAPON_MAP, strategies: getStrategyRegistry() }, catalogue);
    expect(load.problems).toEqual([]);
    expect(load.entries).toHaveLength(2);
  });

  it('refuses to overwrite catalogue files or images without --force, and overwrites with it', async () => {
    const document = await exportOurs();
    const file = path.join(SCRATCH, 'export.json');
    fs.writeFileSync(file, JSON.stringify(document));
    const catalogue = scratch('force', 'catalogue');
    const images = scratch('force', 'images');
    const options = { weapons: SEED_WEAPON_MAP, strategies: getStrategyRegistry(), catalogueDirectory: catalogue, imageDirectory: images };
    expect(runCatalogueUnpackCli([file], options, silentIo())).toBe(0);
    const target = path.join(catalogue, `${DRAFT_KEY}.json`);
    fs.writeFileSync(target, '{"edited":true}');

    const refused = silentIo();
    expect(runCatalogueUnpackCli([file], options, refused)).toBe(1);
    expect(refused.errors.join('\n')).toMatch(/already exists \(use --force/);
    expect(fs.readFileSync(target, 'utf8')).toBe('{"edited":true}');

    expect(runCatalogueUnpackCli([file, '--force'], options, silentIo())).toBe(0);
    expect(JSON.parse(fs.readFileSync(target, 'utf8')).catalogueKey).toBe(DRAFT_KEY);
  });

  it('rejects an invalid entry and writes nothing', () => {
    const catalogue = scratch('invalid', 'catalogue');
    const document = { schemaVersion: 1, exportedAt: 'now', environment: 'test', entries: [{ ...validEntry(), image: 'x.webp' }], images: {} };
    expect(unpackDocument(document, { weapons: SEED_WEAPON_MAP, strategies: getStrategyRegistry(), catalogueDirectory: catalogue, imageDirectory: scratch('invalid', 'images') }))
      .toMatchObject({ ok: false, reason: 'invalid' });
    expect(fs.readdirSync(catalogue)).toEqual([]);
  });
});

describe('Catalogue_Unpack of a Strategy_Definition_File (R6.14)', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/services/automaton/strategies/__tests__/fixtures/fixture.v1.json'), 'utf8')) as Record<string, unknown>;

  it('writes a valid strategy file to {key}.v{version}.json and never overwrites it, even with --force', () => {
    const strategies = scratch('strategies');
    const options = { weapons: SEED_WEAPON_MAP, strategyDirectory: strategies };
    expect(unpackDocument(fixture, options)).toEqual({ ok: true, kind: 'strategy', written: [path.join(strategies, 'fixture.v1.json')] });
    expect(JSON.parse(fs.readFileSync(path.join(strategies, 'fixture.v1.json'), 'utf8'))).toEqual(fixture);

    fs.writeFileSync(path.join(strategies, 'fixture.v1.json'), '{"kept":true}');
    expect(unpackDocument(fixture, { ...options, force: true })).toMatchObject({ ok: false, reason: 'exists' });
    expect(fs.readFileSync(path.join(strategies, 'fixture.v1.json'), 'utf8')).toBe('{"kept":true}');
  });

  it('rejects an invalid strategy file with no write', () => {
    const strategies = scratch('strategies-invalid');
    expect(unpackDocument({ ...fixture, buildOrder: [] }, { weapons: SEED_WEAPON_MAP, strategyDirectory: strategies })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(fs.readdirSync(strategies)).toEqual([]);
  });
});
