import { describe, expect, it } from '@jest/globals';
import { safeRequestPath } from '../safeRequestPath';

describe('safeRequestPath', () => {
  it.each([
    '/api/search?q=secret',
    '/api/search/?q=secret',
    '/api/search///?q=secret',
    '/api/search/?q=secret#fragment',
    '/api/%73earch%2F?q=secret',
    '%2Fapi%2Fsearch%2F?q=secret',
    '//api//search///?q=secret',
  ])('redacts query strings from canonical search paths: %s', (path) => {
    expect(safeRequestPath(path)).toBe('/api/search');
  });

  it('does not expose encoded search query text from an equivalent path variant', () => {
    expect(safeRequestPath('/api/search%3Fq%3Dsecret%20phrase')).toBe('/api/search');
  });

  it('does not change unrelated paths', () => {
    expect(safeRequestPath('/api/robots/1?view=summary')).toBe('/api/robots/1?view=summary');
  });
});
