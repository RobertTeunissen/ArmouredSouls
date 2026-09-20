import { describe, expect, it } from '@jest/globals';
import { safeRequestPath } from '../safeRequestPath';

describe('safeRequestPath', () => {
  it.each([
    '/api/search?q=secret',
    '/api/search/?q=secret',
    '/api/search///?q=secret',
  ])('redacts query strings from search paths including trailing slashes: %s', (path) => {
    expect(safeRequestPath(path)).toBe('/api/search');
  });

  it('does not change unrelated paths', () => {
    expect(safeRequestPath('/api/robots/1?view=summary')).toBe('/api/robots/1?view=summary');
  });
});
