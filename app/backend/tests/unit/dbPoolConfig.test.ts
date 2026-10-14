/**
 * `resolveDbPoolMax` (lib/dbPoolConfig.ts): the backend pg pool size, read
 * by `lib/prisma.ts` and by the Automaton Turn_Step concurrency clamp.
 */
import { DEFAULT_DB_POOL_MAX, resolveDbPoolMax } from '../../src/lib/dbPoolConfig';

describe('resolveDbPoolMax', () => {
  const original = process.env.DB_POOL_MAX;

  afterEach(() => {
    if (original === undefined) delete process.env.DB_POOL_MAX;
    else process.env.DB_POOL_MAX = original;
  });

  it('defaults to 15', () => {
    expect(DEFAULT_DB_POOL_MAX).toBe(15);
    expect(resolveDbPoolMax(undefined)).toBe(15);
    expect(resolveDbPoolMax('')).toBe(15);
    expect(resolveDbPoolMax('  ')).toBe(15);
  });

  it('accepts a positive integer', () => {
    expect(resolveDbPoolMax('1')).toBe(1);
    expect(resolveDbPoolMax('7')).toBe(7);
    expect(resolveDbPoolMax(' 20 ')).toBe(20);
  });

  it.each(['0', '-3', '2.5', 'abc', '15abc', 'NaN', 'Infinity'])('falls back to 15 for %p', (raw) => {
    expect(resolveDbPoolMax(raw)).toBe(15);
  });

  it('reads DB_POOL_MAX from the environment by default', () => {
    process.env.DB_POOL_MAX = '9';
    expect(resolveDbPoolMax()).toBe(9);
    delete process.env.DB_POOL_MAX;
    expect(resolveDbPoolMax()).toBe(15);
  });
});
