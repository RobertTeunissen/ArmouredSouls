/**
 * Image retention guarantees (Spec #45 R30).
 *
 * These assert the *absence* of deletions, which is easy to regress: three
 * separate code paths used to eagerly delete a player's uploaded file, and each
 * one silently destroyed artwork that archived seasons still referenced.
 *
 * Regression guards, kept as source-level assertions because the alternative is
 * a full HTTP + filesystem integration test for a property that is really about
 * which calls are absent.
 */

import { readFileSync } from 'fs';
import path from 'path';

const BACKEND_SRC = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return readFileSync(path.join(BACKEND_SRC, relativePath), 'utf8');
}

describe('Image retention — R30.1, R30.19', () => {
  it('should not delete uploaded images during an account reset', () => {
    const source = read('services/common/resetService.ts');

    // The eager deleteImage loop was removed: images belong to the player's
    // Image_Library and survive a reset so they can be reused next season.
    expect(source).not.toMatch(/fileStorageService\.deleteImage/);
    expect(source).toMatch(/Image_Library/);
  });

  it('should not delete the previous upload when a robot switches to a preset', () => {
    const source = read('routes/robots.ts');

    // Switching appearance must not destroy artwork that archived seasons may
    // reference. Players delete images explicitly through the Image_Library.
    expect(source).not.toMatch(/fileStorageService\.deleteImage/);
  });

  it('should not delete uploaded images during a season purge', () => {
    const source = read('services/season/seasonPurgeService.ts');

    // The purge deletes `robots` rows but retains their image files.
    expect(source).not.toMatch(/deleteImage/);
    expect(source).toMatch(/retained/);
  });

  it('should build the orphan referenced set from archives as well as live robots', () => {
    const source = read('services/moderation/imageLibraryService.ts');

    // Without archive paths in the referenced set, the nightly sweep would
    // delete exactly the files the archive depends on — retention would appear
    // to work at rollover and fail days later.
    expect(source).toMatch(/robotSeasonArchive\.findMany/);
    expect(source).toMatch(/cleanupSeasonOrphans/);
  });

  it('should confine every file operation to the uploads directory', () => {
    const source = read('services/moderation/imageLibraryService.ts');

    // Generated_Stable robots reference shared build assets under /assets/robots/,
    // which nothing here may touch. Strip comments before asserting so the
    // explanatory doc block does not count as a reference.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/\/uploads\/user-robots/);
    expect(code).not.toMatch(/\/assets\/robots/);
  });

  it('should enforce the retained-image cap at the upload site', () => {
    const source = read('services/moderation/imageUploadHandlers.ts');

    // The cap function existed but was never called, so the limit was not
    // actually enforced anywhere.
    expect(source).toMatch(/assertUploadCapacity/);
  });
});
