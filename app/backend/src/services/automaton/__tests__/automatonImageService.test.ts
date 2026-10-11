/**
 * Automaton_Image_Store path guards (Spec #55, R3.10, R11.6, task 9.2). The
 * upload itself (validation, 512×512 WebP, blueprint and live robot updated
 * together) is in `tests/integration/automatonProfile.test.ts`.
 */
import fs from 'fs';
import path from 'path';
import {
  AUTOMATON_UPLOAD_URL_PREFIX,
  deleteProfileImages,
  getAutomatonUploadDir,
  isAutomatonUploadUrl,
  resolveAutomatonImagePath,
  setAutomatonUploadDir,
} from '../automatonImageService';

const SCRATCH = path.join(__dirname, '.scratch-automaton-images');
const UUID_FILE = '0b9f4c1e-8d2a-4f3b-9c7d-1a2b3c4d5e6f.webp';
let previous: string;

beforeAll(() => {
  previous = setAutomatonUploadDir(SCRATCH);
});

afterAll(() => {
  setAutomatonUploadDir(previous);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
});

describe('resolveAutomatonImagePath', () => {
  it('resolves a key directory and a {uuid}.webp file inside the store', () => {
    expect(resolveAutomatonImagePath('clone-legion')).toBe(path.join(SCRATCH, 'clone-legion'));
    expect(resolveAutomatonImagePath('clone-legion', UUID_FILE)).toBe(path.join(SCRATCH, 'clone-legion', UUID_FILE));
  });

  it.each([
    ['../etc'],
    ['..'],
    ['clone/legion'],
    ['Clone-Legion'],
    ['ab'],
    ['a'.repeat(41)],
    ['%2e%2e'],
  ])('rejects the catalogue key %p', (key) => {
    expect(() => resolveAutomatonImagePath(key)).toThrow(expect.objectContaining({ code: 'AUTOMATON_IMAGE_INVALID' }));
  });

  it.each([
    ['../../secret.webp'],
    ['..'],
    ['image.png'],
    ['sub/0b9f4c1e-8d2a-4f3b-9c7d-1a2b3c4d5e6f.webp'],
    ['0B9F4C1E-8D2A-4F3B-9C7D-1A2B3C4D5E6F.webp'],
    [''],
  ])('rejects the file name %p', (fileName) => {
    expect(() => resolveAutomatonImagePath('clone-legion', fileName)).toThrow(expect.objectContaining({ code: 'AUTOMATON_IMAGE_INVALID' }));
  });
});

describe('isAutomatonUploadUrl', () => {
  it('accepts only uploads of the same key', () => {
    expect(isAutomatonUploadUrl(`${AUTOMATON_UPLOAD_URL_PREFIX}/clone-legion/${UUID_FILE}`, 'clone-legion')).toBe(true);
    expect(isAutomatonUploadUrl(`${AUTOMATON_UPLOAD_URL_PREFIX}/dalek-empire/${UUID_FILE}`, 'clone-legion')).toBe(false);
    expect(isAutomatonUploadUrl('/assets/automatons/clone-legion/1.webp', 'clone-legion')).toBe(false);
    expect(isAutomatonUploadUrl(`${AUTOMATON_UPLOAD_URL_PREFIX}/clone-legion/../${UUID_FILE}`, 'clone-legion')).toBe(false);
  });
});

describe('deleteProfileImages', () => {
  it('removes only the directory of that key', async () => {
    fs.mkdirSync(path.join(SCRATCH, 'draft-one'), { recursive: true });
    fs.mkdirSync(path.join(SCRATCH, 'other-key'), { recursive: true });
    fs.writeFileSync(path.join(SCRATCH, 'draft-one', UUID_FILE), 'x');
    fs.writeFileSync(path.join(SCRATCH, 'other-key', UUID_FILE), 'x');
    await deleteProfileImages('draft-one');
    expect(fs.existsSync(path.join(SCRATCH, 'draft-one'))).toBe(false);
    expect(fs.existsSync(path.join(SCRATCH, 'other-key', UUID_FILE))).toBe(true);
  });

  it('never throws for a missing directory or an invalid key', async () => {
    await expect(deleteProfileImages('never-uploaded')).resolves.toBeUndefined();
    await expect(deleteProfileImages('../x')).resolves.toBeUndefined();
    expect(getAutomatonUploadDir()).toBe(SCRATCH);
  });
});
