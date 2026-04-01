import { describe, it, expect } from 'vitest';
import { ApiError } from '../ApiError';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should set all properties correctly', () => {
      const error = new ApiError('Test error message', 'TEST_CODE', 400, { field: 'value' });

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should set name to ApiError', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 500);

      expect(error.name).toBe('ApiError');
    });

    it('should handle optional details parameter when not provided', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 404);

      expect(error.details).toBeUndefined();
    });

    it('should handle details as undefined explicitly', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 404, undefined);

      expect(error.details).toBeUndefined();
    });

    it('should handle details as null', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 404, null);

      expect(error.details).toBeNull();
    });

    it('should handle complex details objects', () => {
      const complexDetails = {
        validationErrors: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      };

      const error = new ApiError('Validation failed', 'VALIDATION_ERROR', 422, complexDetails);

      expect(error.details).toEqual(complexDetails);
    });
  });

  describe('extends Error', () => {
    it('should be an instance of Error', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 500);

      expect(error).toBeInstanceOf(Error);
    });

    it('should have a stack trace', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 500);

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('instanceof checks', () => {
    it('should pass instanceof ApiError check', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 500);

      expect(error instanceof ApiError).toBe(true);
    });

    it('should allow distinguishing ApiError from regular Error', () => {
      const apiError = new ApiError('API error', 'API_CODE', 500);
      const regularError = new Error('Regular error');

      expect(apiError instanceof ApiError).toBe(true);
      expect(regularError instanceof ApiError).toBe(false);
    });

    it('should work in catch blocks for type narrowing', () => {
      const apiError = new ApiError('API error', 'API_CODE', 500);

      try {
        throw apiError;
      } catch (err) {
        if (err instanceof ApiError) {
          expect(err.code).toBe('API_CODE');
          expect(err.statusCode).toBe(500);
        } else {
          // This branch should not be reached
          expect(true).toBe(false);
        }
      }
    });
  });

  describe('readonly properties', () => {
    it('should have readonly code property', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 500);

      // TypeScript would prevent this at compile time, but we verify the value is set correctly
      expect(error.code).toBe('TEST_CODE');
    });

    it('should have readonly statusCode property', () => {
      const error = new ApiError('Test error', 'TEST_CODE', 404);

      expect(error.statusCode).toBe(404);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string message', () => {
      const error = new ApiError('', 'EMPTY_MESSAGE', 500);

      expect(error.message).toBe('');
    });

    it('should handle empty string code', () => {
      const error = new ApiError('Test error', '', 500);

      expect(error.code).toBe('');
    });

    it('should handle statusCode of 0', () => {
      const error = new ApiError('Network error', 'NETWORK_ERROR', 0);

      expect(error.statusCode).toBe(0);
    });

    it('should handle various HTTP status codes', () => {
      const codes = [200, 201, 400, 401, 403, 404, 422, 500, 502, 503];

      codes.forEach((statusCode) => {
        const error = new ApiError('Test', 'TEST', statusCode);
        expect(error.statusCode).toBe(statusCode);
      });
    });
  });
});
