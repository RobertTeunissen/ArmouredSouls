/**
 * Repository_Images (Spec #55, R10.2, design §16, task 8.6): every file
 * under `app/frontend/public/assets/automatons/` belongs to an existing
 * Catalogue_Key and a Blueprint_Slot of that entry, is named `{slot}.webp`
 * and is a 512 × 512 px WebP. Hidden files (`.DS_Store`) are ignored;
 * missing images are allowed.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { REPOSITORY_IMAGE_DIRECTORY, loadCatalogueDirectory } from '../automatonCatalogueService';
import { seedCatalogueContext } from './helpers/catalogueTestSupport';

const visible = (name: string): boolean => !name.startsWith('.');
const slotsByKey = new Map(loadCatalogueDirectory(seedCatalogueContext()).entries
  .map(({ entry }) => [entry.catalogueKey, new Set(entry.blueprints.map((b) => b.slot))]));

const files: { key: string; file: string; absolute: string }[] = fs.readdirSync(REPOSITORY_IMAGE_DIRECTORY)
  .filter(visible)
  .flatMap((key) => {
    const folder = path.join(REPOSITORY_IMAGE_DIRECTORY, key);
    if (!fs.statSync(folder).isDirectory()) return [{ key: '', file: key, absolute: folder }];
    return fs.readdirSync(folder).filter(visible).map((file) => ({ key, file, absolute: path.join(folder, file) }));
  });

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
    const slots = slotsByKey.get(f.key);
    expect(slots).toBeDefined();
    const match = /^(\d{1,2})\.webp$/.exec(f.file);
    expect(match).not.toBeNull();
    expect(slots?.has(Number(match?.[1]))).toBe(true);
  });

  it.each(files.filter((f) => f.key !== '').map((f) => [`${f.key}/${f.file}`, f] as const))('%s is a 512 × 512 WebP', async (_name, f) => {
    const buffer = fs.readFileSync(f.absolute);
    expect(isWebp(buffer)).toBe(true);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([512, 512]);
  });

  it('ignores hidden files such as .DS_Store', () => {
    expect(visible('.DS_Store')).toBe(false);
    expect(files.some((f) => f.file.startsWith('.'))).toBe(false);
  });
});
