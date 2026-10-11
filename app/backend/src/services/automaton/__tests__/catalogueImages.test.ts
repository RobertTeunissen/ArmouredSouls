/**
 * Repository_Images (Spec #55, R10.2, design §16, task 8.6; Spec #57 R4.4,
 * R5.2): every file under `app/frontend/public/assets/automatons/` belongs to
 * an existing Catalogue_Key and a Blueprint_Slot of that entry, is named
 * `{slot}.webp` and is a 512 × 512 px WebP. Hidden files (`.DS_Store`) are
 * ignored; missing images are allowed. The temporary-directory cases prove
 * the rule for an Expansion_Stable fixture: an existing slot is accepted, a
 * slot beyond the entry's blueprints is rejected.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { REPOSITORY_IMAGE_DIRECTORY, loadCatalogueDirectory } from '../automatonCatalogueService';
import { imageFolderProblems, listImageFiles, seedCatalogueContext, validEntry } from './helpers/catalogueTestSupport';

const slotsByKey = new Map(loadCatalogueDirectory(seedCatalogueContext()).entries
  .map(({ entry }) => [entry.catalogueKey, new Set(entry.blueprints.map((b) => b.slot))]));

const files = listImageFiles(REPOSITORY_IMAGE_DIRECTORY);

function isWebp(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

describe('Repository_Images (R10.2)', () => {
  it('finds the committed images', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no loose files at the top level', () => {
    expect(files.filter((f) => f.key === '').map((f) => f.file)).toEqual([]);
  });

  it.each(files.filter((f) => f.key !== '').map((f) => [`${f.key}/${f.file}`, f] as const))('%s matches a Catalogue_Key and Blueprint_Slot', (_name, f) => {
    expect(imageFolderProblems([f], slotsByKey)).toEqual([]);
  });

  it.each(files.filter((f) => f.key !== '').map((f) => [`${f.key}/${f.file}`, f] as const))('%s is a 512 × 512 WebP', async (_name, f) => {
    const buffer = fs.readFileSync(f.absolute);
    expect(isWebp(buffer)).toBe(true);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([512, 512]);
  });

  it('ignores hidden files such as .DS_Store', () => {
    expect(files.some((f) => f.file.startsWith('.'))).toBe(false);
  });
});

describe('temporary directory (R5.2)', () => {
  // An Expansion_Stable fixture with two blueprints (slots 1 and 2).
  const fixture = validEntry({ catalogueKey: 'expansion-fixture-works', stableName: 'Expansion Fixture Works' });
  const fixtureSlots = new Map([[fixture.catalogueKey, new Set(fixture.blueprints.map((b) => b.slot))]]);
  let dir = '';
  let webp: Buffer = Buffer.alloc(0);

  const writeImage = (root: string, slot: number): void => {
    const folder = path.join(dir, root, fixture.catalogueKey);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, `${slot}.webp`), webp);
  };

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(__dirname, '.tmp-catalogue-images-'));
    webp = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#808080' } }).webp().toBuffer();
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts an image of an existing expansion slot', async () => {
    writeImage('accepted', 1);
    fs.writeFileSync(path.join(dir, 'accepted', fixture.catalogueKey, '.DS_Store'), '');
    const listed = listImageFiles(path.join(dir, 'accepted'));
    expect(listed.map((f) => `${f.key}/${f.file}`)).toEqual([`${fixture.catalogueKey}/1.webp`]);
    expect(imageFolderProblems(listed, fixtureSlots)).toEqual([]);
    const meta = await sharp(fs.readFileSync(listed[0].absolute)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 512, 512]);
  });

  it('rejects an image for a slot beyond the entry\'s blueprints', () => {
    writeImage('rejected', 1);
    writeImage('rejected', 3);
    const problems = imageFolderProblems(listImageFiles(path.join(dir, 'rejected')), fixtureSlots);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${fixture.catalogueKey}/3.webp`);
    expect(problems[0]).toContain('beyond the entry\'s blueprints');
  });

  it('rejects a folder without a Catalogue_Entry and a file not named {slot}.webp', () => {
    const folder = path.join(dir, 'unknown', 'no-such-stable');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, '1.webp'), webp);
    writeImage('unknown', 1);
    fs.writeFileSync(path.join(dir, 'unknown', fixture.catalogueKey, 'portrait.webp'), webp);
    const problems = imageFolderProblems(listImageFiles(path.join(dir, 'unknown')), fixtureSlots);
    expect(problems).toEqual([
      `${fixture.catalogueKey}/portrait.webp: not named {slot}.webp`,
      'no-such-stable/1.webp: folder has no Catalogue_Entry with this Catalogue_Key',
    ]);
  });
});
