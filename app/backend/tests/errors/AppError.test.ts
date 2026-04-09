/**
 * Unit tests for AppError base class
 *
 * Tests cover:
 * 1. Constructor sets all properties correctly (code, message, statusCode, details)
 * 2. Default statusCode is 400 when not provided
 * 3. Prototype chain is correct (instanceof AppError and instanceof Error both return true)
 * 4. The name property is set to 'AppError'
 * 5. Optional details parameter works correctly (undefined when not provided, set when provided)
 *
 * @module tests/errors/AppError
 */

import { AppError } from '../../src/errors/AppError';

describe('AppError', () => {
  describe('constructor', () => {
    test('should set all properties correctly when all arguments provided', () => {
      const code = 'TEST_ERROR';
      const message = 'Test error message';
      const statusCode = 404;
      const details = { field: 'username', reason: 'already exists' };

      const error = new AppError(code, message, statusCode, details);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.details).toEqual(details);
    });

    test('should set code and message correctly with minimal arguments', () => {
      const code = 'MINIMAL_ERROR';
      const message = 'Minimal error message';

      const error = new AppError(code, message);

      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
    });
  });

  describe('default statusCode', () => {
    test('should default statusCode to 400 when not provided', () => {
      const error = new AppError('DEFAULT_STATUS', 'Error with default status');

      expect(error.statusCode).toBe(400);
    });

    test('should use provided statusCode when explicitly set', () => {
      const error = new AppError('CUSTOM_STATUS', 'Error with custom status', 500);

      expect(error.statusCode).toBe(500);
    });

    test('should accept various HTTP status codes', () => {
      const statusCodes = [400, 401, 403, 404, 409, 422, 500, 502, 503];

      statusCodes.forEach((statusCode) => {
        const error = new AppError('STATUS_TEST', 'Status test', statusCode);
        expect(error.statusCode).toBe(statusCode);
      });
    });
  });

  describe('prototype chain', () => {
    test('should be instanceof AppError', () => {
      const error = new AppError('PROTO_TEST', 'Prototype test');

      expect(error instanceof AppError).toBe(true);
    });

    test('should be instanceof Error', () => {
      const error = new AppError('PROTO_TEST', 'Prototype test');

      expect(error instanceof Error).toBe(true);
    });

    test('should have Error in prototype chain', () => {
      const error = new AppError('CHAIN_TEST', 'Chain test');

      expect(Object.getPrototypeOf(Object.getPrototypeOf(error))).toBe(Error.prototype);
    });
  });

  describe('name property', () => {
    test('should have name set to AppError', () => {
      const error = new AppError('NAME_TEST', 'Name test');

      expect(error.name).toBe('AppError');
    });

    test('should have name property that is a string', () => {
      const error = new AppError('NAME_TYPE_TEST', 'Name type test');

      expect(typeof error.name).toBe('string');
    });
  });

  describe('details parameter', () => {
    test('should be undefined when not provided', () => {
      const error = new AppError('NO_DETAILS', 'Error without details');

      expect(error.details).toBeUndefined();
    });

    test('should be undefined when explicitly passed undefined', () => {
      const error = new AppError('EXPLICIT_UNDEFINED', 'Error with explicit undefined', 400, undefined);

      expect(error.details).toBeUndefined();
    });

    test('should accept object as details', () => {
      const details = { field: 'email', value: 'invalid@' };
      const error = new AppError('OBJECT_DETAILS', 'Error with object details', 400, details);

      expect(error.details).toEqual(details);
    });

    test('should accept array as details', () => {
      const details = ['error1', 'error2', 'error3'];
      const error = new AppError('ARRAY_DETAILS', 'Error with array details', 400, details);

      expect(error.details).toEqual(details);
    });

    test('should accept string as details', () => {
      const details = 'Additional error information';
      const error = new AppError('STRING_DETAILS', 'Error with string details', 400, details);

      expect(error.details).toBe(details);
    });

    test('should accept number as details', () => {
      const details = 42;
      const error = new AppError('NUMBER_DETAILS', 'Error with number details', 400, details);

      expect(error.details).toBe(details);
    });

    test('should accept null as details', () => {
      const error = new AppError('NULL_DETAILS', 'Error with null details', 400, null);

      expect(error.details).toBeNull();
    });

    test('should accept nested object as details', () => {
      const details = {
        validation: {
          fields: ['username', 'email'],
          errors: [
            { field: 'username', message: 'too short' },
            { field: 'email', message: 'invalid format' },
          ],
        },
      };
      const error = new AppError('NESTED_DETAILS', 'Error with nested details', 400, details);

      expect(error.details).toEqual(details);
    });
  });

  describe('error behavior', () => {
    test('should be throwable', () => {
      expect(() => {
        throw new AppError('THROWABLE', 'This error can be thrown');
      }).toThrow(AppError);
    });

    test('should be catchable as Error', () => {
      try {
        throw new AppError('CATCHABLE', 'This error can be caught');
      } catch (e) {
        expect(e instanceof Error).toBe(true);
      }
    });

    test('should preserve message when caught', () => {
      const message = 'Preserved message';
      try {
        throw new AppError('PRESERVE_MSG', message);
      } catch (e) {
        expect((e as Error).message).toBe(message);
      }
    });

    test('should have stack trace', () => {
      const error = new AppError('STACK_TEST', 'Error with stack');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('AppError');
    });
  });
});
