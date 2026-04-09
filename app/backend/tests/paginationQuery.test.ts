/**
 * Unit tests for the paginationQuery Zod schema.
 *
 * Validates: Requirements 9.1, 9.2
 */

import { paginationQuery } from '../src/utils/securityValidation';

describe('paginationQuery schema', () => {
  describe('valid input', () => {
    it('should accept valid page, limit, and search', () => {
      const result = paginationQuery.safeParse({ page: '2', limit: '50', search: 'robot' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 2, limit: 50, search: 'robot' });
      }
    });

    it('should accept numeric values (coerced from numbers)', () => {
      const result = paginationQuery.safeParse({ page: 3, limit: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 3, limit: 10 });
      }
    });

    it('should accept string values for page and limit (query param style)', () => {
      const result = paginationQuery.safeParse({ page: '1', limit: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20 });
      }
    });
  });

  describe('defaults', () => {
    it('should default page to 1 when omitted', () => {
      const result = paginationQuery.safeParse({ limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('should default limit to 20 when omitted', () => {
      const result = paginationQuery.safeParse({ page: '1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('should default both page and limit when empty object', () => {
      const result = paginationQuery.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20 });
      }
    });
  });

  describe('search field', () => {
    it('should allow search to be omitted', () => {
      const result = paginationQuery.safeParse({ page: '1', limit: '20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBeUndefined();
      }
    });

    it('should accept a valid search string', () => {
      const result = paginationQuery.safeParse({ search: 'test query' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('test query');
      }
    });

    it('should reject search strings longer than 200 characters', () => {
      const result = paginationQuery.safeParse({ search: 'a'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('should accept search strings exactly 200 characters', () => {
      const result = paginationQuery.safeParse({ search: 'a'.repeat(200) });
      expect(result.success).toBe(true);
    });
  });

  describe('boundary values', () => {
    it('should accept page = 1 (minimum positive int)', () => {
      const result = paginationQuery.safeParse({ page: '1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('should accept limit = 1 (minimum positive int)', () => {
      const result = paginationQuery.safeParse({ limit: '1' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(1);
      }
    });

    it('should accept limit = 100 (maximum)', () => {
      const result = paginationQuery.safeParse({ limit: '100' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it('should reject limit = 101 (exceeds max)', () => {
      const result = paginationQuery.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });
  });

  describe('rejection of invalid types', () => {
    it('should reject page = 0', () => {
      const result = paginationQuery.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const result = paginationQuery.safeParse({ page: '-1' });
      expect(result.success).toBe(false);
    });

    it('should reject limit = 0', () => {
      const result = paginationQuery.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const result = paginationQuery.safeParse({ limit: '-5' });
      expect(result.success).toBe(false);
    });

    it('should reject float page values', () => {
      const result = paginationQuery.safeParse({ page: '1.5' });
      expect(result.success).toBe(false);
    });

    it('should reject float limit values', () => {
      const result = paginationQuery.safeParse({ limit: '10.5' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric page strings', () => {
      const result = paginationQuery.safeParse({ page: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric limit strings', () => {
      const result = paginationQuery.safeParse({ limit: 'xyz' });
      expect(result.success).toBe(false);
    });
  });
});
