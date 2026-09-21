import { searchQuerySchema } from '../search';
import {
  MAXIMUM_QUERY_LENGTH,
  MINIMUM_QUERY_LENGTH,
} from '../../services/search/searchTypes';

describe('searchQuerySchema', () => {
  it('should trim only the outer whitespace and preserve valid short queries', () => {
    expect(searchQuerySchema.parse({ q: '  a b  ' })).toEqual({ q: 'a b' });
    expect(MINIMUM_QUERY_LENGTH).toBe(2);
  });

  it('should accept the maximum length after trimming', () => {
    const query = 'x'.repeat(MAXIMUM_QUERY_LENGTH);

    expect(searchQuerySchema.safeParse({ q: `  ${query}  ` }).success).toBe(true);
  });

  it('should reject a query longer than the trimmed maximum', () => {
    const result = searchQuerySchema.safeParse({
      q: `  ${'x'.repeat(MAXIMUM_QUERY_LENGTH + 1)}  `,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        `Search query cannot exceed ${MAXIMUM_QUERY_LENGTH} characters`,
      );
    }
  });

  it.each([
    ['missing q', {}],
    ['repeated q', { q: ['first', 'second'] }],
    ['non-string q', { q: 42 }],
    ['unknown query field', { q: 'valid', owner: 'other-user' }],
  ])('should reject %s before a service can search', (_caseName, input) => {
    const result = searchQuerySchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.every((issue) => !issue.message.includes('other-user'))).toBe(true);
    }
  });

  it('should allow whitespace-only input as a normalized short query', () => {
    expect(searchQuerySchema.parse({ q: '   ' })).toEqual({ q: '' });
  });
});
