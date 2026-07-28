/**
 * Property tests for Image_Library ownership closure (Spec #45 design Property 11).
 *
 * Uploads pass through content moderation and could be anything, so letting one
 * player address another player's file is both a copyright and an abuse problem.
 * These tests assert the closure holds for crafted paths, not just tidy ones.
 */

import fc from 'fast-check';
import { assertOwnership, uploadUrlPrefix } from '../imageLibraryService';
import { SeasonError, SeasonErrorCode } from '../../../errors';

const PREFIX = uploadUrlPrefix();

/** A plausible stored filename: UUID-shaped plus .webp. */
const filenameArb = fc
  .string({ minLength: 32, maxLength: 32, unit: fc.constantFrom(...'0123456789abcdef'.split('')) })
  .map((h: string) =>
    `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}.webp`,
  );

const userIdArb = fc.integer({ min: 1, max: 100_000 });

function expectDenied(fn: () => unknown): void {
  try {
    fn();
    throw new Error('Expected access to be denied');
  } catch (error) {
    expect(error).toBeInstanceOf(SeasonError);
    expect((error as SeasonError).code).toBe(SeasonErrorCode.IMAGE_NOT_OWNED);
    // The message must not reveal whether the file exists.
    expect((error as SeasonError).message).toBe('Access denied');
  }
}

describe('Image_Library — Property 11: ownership closure', () => {
  it('should accept a path inside the caller\u2019s own directory', () => {
    fc.assert(
      fc.property(userIdArb, filenameArb, (userId, filename) => {
        const path = `${PREFIX}/${userId}/${filename}`;
        expect(() => assertOwnership(userId, path)).not.toThrow();
      }),
      { numRuns: 200 },
    );
  });

  it('should deny a path belonging to any other user', () => {
    fc.assert(
      fc.property(userIdArb, userIdArb, filenameArb, (a, b, filename) => {
        fc.pre(a !== b);
        expectDenied(() => assertOwnership(a, `${PREFIX}/${b}/${filename}`));
      }),
      { numRuns: 200 },
    );
  });

  it('should deny traversal sequences that climb out of the own directory', () => {
    fc.assert(
      fc.property(userIdArb, userIdArb, filenameArb, (a, b, filename) => {
        fc.pre(a !== b);
        const traversals = [
          `${PREFIX}/${a}/../${b}/${filename}`,
          `${PREFIX}/${a}/../../${b}/${filename}`,
          `${PREFIX}/${a}/subdir/../../${b}/${filename}`,
        ];
        for (const path of traversals) {
          expectDenied(() => assertOwnership(a, path));
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should deny paths outside the uploads tree entirely', () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const outside = [
          '/etc/passwd',
          '/assets/robots/wimpbot_512x512.webp',
          '/uploads/other-dir/file.webp',
          `/uploads/user-robots/${userId}`, // directory itself, not a file under it
          '',
        ];
        for (const path of outside) {
          expectDenied(() => assertOwnership(userId, path));
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should deny a user id that merely prefixes the caller\u2019s id', () => {
    // Directory 1 must not be reachable by user 12 via a prefix match.
    expectDenied(() => assertOwnership(12, `${PREFIX}/1/abc.webp`));
    expectDenied(() => assertOwnership(1, `${PREFIX}/12/abc.webp`));
  });

  it('should never grant access to the shared static asset directory', () => {
    // Generated_Stable robots reference build assets that no player owns.
    expectDenied(() => assertOwnership(1, '/assets/robots/expertbot_512x512.webp'));
  });
});
