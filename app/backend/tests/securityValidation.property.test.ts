/**
 * Property-based tests for security validation primitives.
 *
 * Feature: security-audit-guardrails
 */

import * as fc from 'fast-check';
import {
  safeName,
  safeSlug,
  stableName,
  positiveInt,
  positiveIntParam,
} from '../src/utils/securityValidation';

// --- Shared generators ---

/** Disallowed characters for injection testing */
const DISALLOWED_CHARS = '<>{}[]|\\^`~@#$%&*()+=;:"/?';

/** Generate a string from a specific character set within length bounds */
function stringFromChars(chars: string, minLen: number, maxLen: number): fc.Arbitrary<string> {
  return fc
    .array(
      fc.integer({ min: 0, max: chars.length - 1 }).map((i) => chars[i]),
      { minLength: minLen, maxLength: maxLen },
    )
    .map((arr) => arr.join(''));
}

/** Generate a string that contains at least one disallowed character */
function stringWithDisallowed(allowedChars: string, minLen: number, maxLen: number): fc.Arbitrary<string> {
  return fc
    .tuple(
      stringFromChars(allowedChars, Math.max(0, minLen - 1), maxLen - 1),
      fc.integer({ min: 0, max: DISALLOWED_CHARS.length - 1 }).map((i) => DISALLOWED_CHARS[i]),
    )
    .map(([base, bad]) => {
      const pos = Math.floor(base.length / 2);
      return base.slice(0, pos) + bad + base.slice(pos);
    });
}

// --- Property 2 ---

/**
 * Feature: security-audit-guardrails, Property 2: Character allowlist enforcement
 *
 * For any string input to a name field that contains at least one character
 * outside the defined allowlist pattern, the validation function shall reject
 * the input. Conversely, for any string composed entirely of allowed characters
 * within length bounds, the validation function shall accept it.
 *
 * **Validates: Requirements 1.4, 5.1, 9.2**
 */
describe('Property 2: Character allowlist enforcement', () => {
  const SAFE_NAME_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-'.!";
  const SAFE_SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
  const STABLE_NAME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-';

  describe('safeName', () => {
    it('accepts strings composed entirely of allowed characters within length bounds', () => {
      fc.assert(
        fc.property(stringFromChars(SAFE_NAME_CHARS, 1, 50), (input) => {
          const result = safeName.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('rejects strings containing disallowed characters', () => {
      fc.assert(
        fc.property(stringWithDisallowed(SAFE_NAME_CHARS, 1, 50), (input) => {
          const result = safeName.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('safeSlug', () => {
    it('accepts strings composed entirely of allowed slug characters within length bounds', () => {
      fc.assert(
        fc.property(stringFromChars(SAFE_SLUG_CHARS, 1, 100), (input) => {
          const result = safeSlug.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('rejects strings containing disallowed characters', () => {
      fc.assert(
        fc.property(stringWithDisallowed(SAFE_SLUG_CHARS, 1, 100), (input) => {
          const result = safeSlug.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('stableName', () => {
    it('accepts strings composed entirely of allowed stable name characters within length bounds', () => {
      fc.assert(
        fc.property(stringFromChars(STABLE_NAME_CHARS, 3, 30), (input) => {
          const result = stableName.safeParse(input);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('rejects strings containing disallowed characters', () => {
      fc.assert(
        fc.property(stringWithDisallowed(STABLE_NAME_CHARS, 3, 30), (input) => {
          const result = stableName.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });
});

// --- Property 3 ---

/**
 * Feature: security-audit-guardrails, Property 3: Numeric parameter validation
 *
 * For any request parameter or body field defined as a numeric type in the schema,
 * if the provided value is a non-numeric string, zero, negative, or a floating-point
 * number where an integer is expected, the validator shall reject the request.
 *
 * **Validates: Requirements 1.5, 4.5**
 */
describe('Property 3: Numeric parameter validation', () => {
  const NON_DIGIT_CHARS = 'abcdefghijklmnopqrstuvwxyz!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

  describe('positiveIntParam (string URL params)', () => {
    it('rejects non-numeric strings', () => {
      fc.assert(
        fc.property(stringFromChars(NON_DIGIT_CHARS, 1, 20), (input) => {
          const result = positiveIntParam.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('rejects zero', () => {
      const result = positiveIntParam.safeParse('0');
      expect(result.success).toBe(false);
    });

    it('rejects negative number strings', () => {
      fc.assert(
        fc.property(fc.integer({ min: -10000, max: -1 }), (n) => {
          const result = positiveIntParam.safeParse(String(n));
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('rejects float strings', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 99 })),
          ([whole, frac]) => {
            const result = positiveIntParam.safeParse(`${whole}.${frac}`);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('accepts valid positive integer strings', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999999 }), (n) => {
          const result = positiveIntParam.safeParse(String(n));
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(n);
          }
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('positiveInt (coerced number)', () => {
    it('rejects zero', () => {
      const result = positiveInt.safeParse(0);
      expect(result.success).toBe(false);
    });

    it('rejects negative numbers', () => {
      fc.assert(
        fc.property(fc.integer({ min: -100000, max: -1 }), (n) => {
          const result = positiveInt.safeParse(n);
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('rejects floats', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 99999.99, noNaN: true }).filter((n) => !Number.isInteger(n)),
          (n) => {
            const result = positiveInt.safeParse(n);
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('accepts positive integers', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999999 }), (n) => {
          const result = positiveInt.safeParse(n);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });
});


import { safeImageUrl } from '../src/utils/securityValidation';

// --- Property 10 ---

/**
 * Feature: security-audit-guardrails, Property 10: Image URL strict validation
 *
 * For any string provided as an imageUrl that contains a javascript: URI,
 * a data: URI, path traversal sequences (../), or does not match the strict
 * HTTPS URL pattern, the validator shall reject it.
 *
 * **Validates: Requirements 5.2**
 */
describe('Property 10: Image URL strict validation', () => {
  it('rejects javascript: URIs', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (payload) => {
        const url = `javascript:${payload}`;
        const result = safeImageUrl.safeParse(url);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects data: URIs', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (payload) => {
        const url = `data:${payload}`;
        const result = safeImageUrl.safeParse(url);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects URLs with path traversal sequences', () => {
    const traversalPatterns = ['../', '..\\', '%2e%2e/', '%2e%2e%2f', '..%2f'];
    fc.assert(
      fc.property(
        fc.constantFrom(...traversalPatterns),
        fc.string({ minLength: 1, maxLength: 20 }),
        (traversal, suffix) => {
          const url = `https://example.com/${traversal}${suffix}`;
          const result = safeImageUrl.safeParse(url);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects HTTP (non-HTTPS) URLs', () => {
    fc.assert(
      fc.property(
        stringFromChars('abcdefghijklmnopqrstuvwxyz', 3, 10),
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789', 1, 20),
        (domain, path) => {
          const url = `http://${domain}.com/${path}`;
          const result = safeImageUrl.safeParse(url);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts valid HTTPS image URLs', () => {
    fc.assert(
      fc.property(
        stringFromChars('abcdefghijklmnopqrstuvwxyz', 3, 10),
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 1, 20),
        (domain, path) => {
          const url = `https://${domain}.com/${path}`;
          const result = safeImageUrl.safeParse(url);
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('allows undefined (optional field)', () => {
    const result = safeImageUrl.safeParse(undefined);
    expect(result.success).toBe(true);
  });
});


import { orderByColumn } from '../src/utils/securityValidation';

// --- Property 11 ---

/**
 * Feature: security-audit-guardrails, Property 11: ORDER BY allowlist mapping
 *
 * For any user-supplied ORDER BY column value, if the value is not in the
 * predefined allowlist, the system shall use the default safe column.
 * For any value that is in the allowlist, the system shall use that value unchanged.
 *
 * **Validates: Requirements 5.3**
 */
describe('Property 11: ORDER BY allowlist mapping', () => {
  const ALLOWED_COLUMNS = ['name', 'createdAt', 'wins', 'losses', 'elo'] as const;
  const DEFAULT_COLUMN = 'createdAt';
  const orderBySchema = orderByColumn(ALLOWED_COLUMNS, DEFAULT_COLUMN);

  it('returns the default column for values not in the allowlist', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !(ALLOWED_COLUMNS as readonly string[]).includes(s),
        ),
        (input) => {
          const result = orderBySchema.safeParse(input);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(DEFAULT_COLUMN);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns the input unchanged when it matches an allowed column', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALLOWED_COLUMNS), (col) => {
        const result = orderBySchema.safeParse(col);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(col);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('returns the default column for undefined input', () => {
    const result = orderBySchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(DEFAULT_COLUMN);
    }
  });

  it('rejects SQL injection attempts by falling back to default', () => {
    const injectionAttempts = [
      'name; DROP TABLE users',
      "name' OR '1'='1",
      'name UNION SELECT * FROM users',
      '1; DELETE FROM robots --',
    ];
    fc.assert(
      fc.property(fc.constantFrom(...injectionAttempts), (input) => {
        const result = orderBySchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(DEFAULT_COLUMN);
        }
      }),
      { numRuns: 50 },
    );
  });
});


// --- Property 19 ---

/**
 * Feature: security-audit-guardrails, Property 19: Slug path traversal prevention
 *
 * For any URL path parameter used as a slug that contains characters outside
 * /^[a-zA-Z0-9_-]+$/ (including .., /, %2e, or other traversal sequences),
 * the validator shall reject the request with HTTP 400.
 *
 * **Validates: Requirements 5.6**
 */
describe('Property 19: Slug path traversal prevention', () => {
  it('rejects slugs containing path traversal sequences (..)', () => {
    fc.assert(
      fc.property(
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 0, 10),
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 0, 10),
        (prefix, suffix) => {
          const slug = `${prefix}..${suffix}`;
          const result = safeSlug.safeParse(slug);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rejects slugs containing forward slashes', () => {
    fc.assert(
      fc.property(
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 1, 10),
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 1, 10),
        (prefix, suffix) => {
          const slug = `${prefix}/${suffix}`;
          const result = safeSlug.safeParse(slug);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rejects slugs containing percent-encoded traversal (%2e)', () => {
    const encodedPatterns = ['%2e', '%2E', '%2f', '%2F', '%00'];
    fc.assert(
      fc.property(
        fc.constantFrom(...encodedPatterns),
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 1, 10),
        (encoded, suffix) => {
          const slug = `${encoded}${suffix}`;
          const result = safeSlug.safeParse(slug);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects slugs containing spaces, dots, or special characters', () => {
    const badChars = ['.', ' ', '\\', '~', '`', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
    fc.assert(
      fc.property(
        fc.constantFrom(...badChars),
        stringFromChars('abcdefghijklmnopqrstuvwxyz0123456789_-', 1, 10),
        (bad, base) => {
          const slug = `${base}${bad}`;
          const result = safeSlug.safeParse(slug);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts valid slugs with only alphanumeric, hyphens, and underscores', () => {
    const SAFE_SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
    fc.assert(
      fc.property(stringFromChars(SAFE_SLUG_CHARS, 1, 100), (slug) => {
        const result = safeSlug.safeParse(slug);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
