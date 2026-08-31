/**
 * Unit tests for errorHandler middleware
 *
 * Tests cover:
 * 1. AppError handling - returns correct statusCode, code, message, and details
 * 2. Prisma error mapping - P2002→409, P2025→404, P2003→400, P2014→400
 * 3. Unknown error fallback - returns 500 with INTERNAL_ERROR
 * 4. Production mode redaction - hides stack traces in production/acceptance environments
 * 5. Non-production - adds one fixed hint, and still no stack or raw message
 *
 * @module tests/middleware/errorHandler
 */

import { Request, Response, NextFunction } from 'express';

// Mock the logger BEFORE importing the errorHandler
const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// The handler branches on `getConfig().nodeEnv`. Mocked rather than driven through
// `process.env` + `_resetConfigForTesting`, for two reasons: `getConfig()` memoises, so
// setting the variable alone has no effect and every environment-dependent test here
// silently ran under the ambient environment; and a genuine reload under
// `NODE_ENV=production` fails validation on the development JWT_SECRET and calls
// `process.exit(1)`, taking the worker with it.
let mockNodeEnv = 'test';
jest.mock('../../src/config/env', () => ({
  getConfig: () => ({ nodeEnv: mockNodeEnv }),
}));

// Import after mocking
import { errorHandler } from '../../src/middleware/errorHandler';
import { AppError } from '../../src/errors/AppError';

describe('errorHandler middleware', () => {

  /** Point the mocked config at an environment. */
  const setNodeEnv = (value: string | undefined): void => {
    mockNodeEnv = value ?? '';
  };

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/test',
    };

    // Create mock response with chainable status and json
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    // Create mock next function
    mockNext = jest.fn();
  });

  describe('AppError handling', () => {
    test('should return correct statusCode from AppError', () => {
      const error = new AppError('TEST_ERROR', 'Test error message', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    test('should return correct code from AppError', () => {
      const error = new AppError('CUSTOM_CODE', 'Test error message', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CUSTOM_CODE',
        })
      );
    });

    test('should return correct message from AppError', () => {
      const error = new AppError('TEST_ERROR', 'Custom error message', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Custom error message',
        })
      );
    });

    test('should include details when provided in AppError', () => {
      const details = { field: 'username', reason: 'already exists' };
      const error = new AppError('VALIDATION_ERROR', 'Validation failed', 400, details);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: { field: 'username', reason: 'already exists' },
        })
      );
    });

    test('should not include details key when details is undefined', () => {
      const error = new AppError('NO_DETAILS', 'Error without details', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('details');
      expect(callArg).toEqual({
        error: 'Error without details',
        code: 'NO_DETAILS',
      });
    });

    test('should handle AppError with default statusCode (400)', () => {
      const error = new AppError('DEFAULT_STATUS', 'Default status error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    test('should handle various HTTP status codes', () => {
      const statusCodes = [400, 401, 403, 404, 409, 422, 500];

      statusCodes.forEach((statusCode) => {
        jest.clearAllMocks();
        const error = new AppError('STATUS_TEST', 'Status test', statusCode);

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(statusCode);
      });
    });

    test('should log AppError with warn level', () => {
      const error = new AppError('LOG_TEST', 'Log test error', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith('App error', {
        code: 'LOG_TEST',
        status: 400,
        method: 'GET',
        path: '/api/test',
      });
    });

    test('should handle AppError with array details', () => {
      const details = ['error1', 'error2', 'error3'];
      const error = new AppError('ARRAY_DETAILS', 'Multiple errors', 400, details);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: ['error1', 'error2', 'error3'],
        })
      );
    });
  });

  describe('Prisma error mapping', () => {
    // Helper to create a mock Prisma error
    function createPrismaError(code: string, message: string): Error {
      const error = new Error(message);
      Object.defineProperty(error, 'constructor', {
        value: { name: 'PrismaClientKnownRequestError' },
      });
      (error as any).code = code;
      return error;
    }

    test('should map P2002 (unique constraint) to 409 Conflict', () => {
      const error = createPrismaError('P2002', 'Unique constraint failed on the fields: (`email`)');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_UNIQUE_VIOLATION',
        })
      );
    });

    test('should map P2025 (record not found) to 404 Not Found', () => {
      const error = createPrismaError('P2025', 'Record to update not found.');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_RECORD_NOT_FOUND',
        })
      );
    });

    test('should map P2003 (foreign key constraint) to 400 Bad Request', () => {
      const error = createPrismaError('P2003', 'Foreign key constraint failed on the field: `userId`');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_FOREIGN_KEY_VIOLATION',
        })
      );
    });

    test('should map P2014 (relation violation) to 400 Bad Request', () => {
      const error = createPrismaError('P2014', 'The change you are trying to make would violate the required relation');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DATABASE_RELATION_VIOLATION',
        })
      );
    });

    test('should NOT reflect the original Prisma error message to the client', () => {
      const originalMessage = 'Unique constraint failed on the fields: (`email`)';
      const error = createPrismaError('P2002', originalMessage);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      // Inverted deliberately. The handler returns a generic message derived from the
      // mapped code and logs the Prisma text instead, because a Prisma message can echo
      // submitted values — the column names and, for some codes, the value itself. This
      // test asserted the opposite, from before that hardening; it had never run.
      const body = jsonMock.mock.calls[0][0];
      expect(body).toEqual({ error: 'database unique violation', code: 'DATABASE_UNIQUE_VIOLATION' });
      expect(JSON.stringify(body)).not.toContain('email');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Prisma error',
        expect.objectContaining({ prismaMessage: originalMessage }),
      );
    });

    test('should log Prisma error with warn level', () => {
      const error = createPrismaError('P2002', 'Unique constraint failed');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      // `prismaMessage` is part of the log entry: it is where the detail goes now that
      // the response no longer carries it.
      expect(mockLogger.warn).toHaveBeenCalledWith('Prisma error', {
        prismaCode: 'P2002',
        mapped: 'DATABASE_UNIQUE_VIOLATION',
        prismaMessage: 'Unique constraint failed',
        method: 'GET',
        path: '/api/test',
      });
    });

    test('should fall through to unknown error for unmapped Prisma codes', () => {
      const error = createPrismaError('P9999', 'Unknown Prisma error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });

  describe('Unknown error fallback', () => {
    afterEach(() => {
      setNodeEnv('test');
    });

    test('should return 500 status for unknown errors', () => {
      setNodeEnv('development');
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    test('should return INTERNAL_ERROR code for unknown errors', () => {
      setNodeEnv('development');
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
        })
      );
    });

    test('should return generic error message for unknown errors', () => {
      setNodeEnv('development');
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
        })
      );
    });

    test('should log unknown error with error level', () => {
      setNodeEnv('development');
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled error', {
        message: 'Something went wrong',
        stack: expect.any(String),
        method: 'GET',
        path: '/api/test',
      });
    });

    test('should handle errors without stack trace', () => {
      setNodeEnv('development');
      const error = new Error('No stack error');
      delete error.stack;

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
        })
      );
    });
  });

  describe('Production mode redaction', () => {
    afterEach(() => {
      setNodeEnv('test');
    });

    test('should hide stack trace in production environment', () => {
      setNodeEnv('production');
      const error = new Error('Production error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('stack');
      expect(callArg).not.toHaveProperty('message');
      expect(callArg).toEqual({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      });
    });

    test('should hide stack trace in acceptance environment', () => {
      setNodeEnv('acceptance');
      const error = new Error('Acceptance error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('stack');
      expect(callArg).not.toHaveProperty('message');
      expect(callArg).toEqual({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
      });
    });

    test('should not expose internal error details in production', () => {
      setNodeEnv('production');
      const error = new Error('Database connection failed: password incorrect');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg.error).toBe('Internal Server Error');
      expect(JSON.stringify(callArg)).not.toContain('password');
      expect(JSON.stringify(callArg)).not.toContain('Database connection failed');
    });
  });

  describe('Development mode', () => {
    afterEach(() => {
      setNodeEnv('test');
    });

    // These four asserted a stack trace and the raw error text in the response body
    // outside production. That was removed deliberately: an unknown error's message can
    // contain submitted input, so reflecting it is an XSS vector, and a stack discloses
    // paths. Non-production now differs from production by one fixed sentence and
    // nothing else. Inverted rather than deleted so the hardening is pinned.
    const NON_PRODUCTION_HINT = 'An unexpected error occurred. Check server logs for details.';

    test('should add only a fixed hint outside production, never a stack', () => {
      setNodeEnv('development');
      const error = new Error('Development error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        message: NON_PRODUCTION_HINT,
      });
    });

    test('should NOT reflect the original error message outside production', () => {
      setNodeEnv('development');
      const error = new Error('Detailed development error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const body = jsonMock.mock.calls[0][0];
      expect(JSON.stringify(body)).not.toContain('Detailed development error');
      expect(body.message).toBe(NON_PRODUCTION_HINT);
    });

    test('should behave the same in the test environment', () => {
      setNodeEnv('test');
      const error = new Error('Test environment error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const body = jsonMock.mock.calls[0][0];
      expect(body).not.toHaveProperty('stack');
      expect(body.message).toBe(NON_PRODUCTION_HINT);
    });

    test('should behave the same when NODE_ENV is undefined', () => {
      setNodeEnv(undefined);
      const error = new Error('No env error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const body = jsonMock.mock.calls[0][0];
      expect(body).not.toHaveProperty('stack');
      expect(body.message).toBe(NON_PRODUCTION_HINT);
    });
  });

  describe('Request context logging', () => {
    test('should log request method and path for AppError', () => {
      mockRequest.method = 'POST';
      mockRequest.originalUrl = '/api/users/create';
      const error = new AppError('TEST_ERROR', 'Test', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith('App error', expect.objectContaining({
        method: 'POST',
        path: '/api/users/create',
      }));
    });

    test('should log request method and path for unknown errors', () => {
      setNodeEnv('development');
      mockRequest.method = 'DELETE';
      mockRequest.originalUrl = '/api/robots/123';
      const error = new Error('Unknown error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled error', expect.objectContaining({
        method: 'DELETE',
        path: '/api/robots/123',
      }));
    });
  });

  describe('Edge cases', () => {
    test('should handle error with empty message', () => {
      const error = new AppError('EMPTY_MSG', '', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '',
          code: 'EMPTY_MSG',
        })
      );
    });

    test('should handle AppError subclass', () => {
      // Create a subclass of AppError
      class CustomError extends AppError {
        constructor(message: string) {
          super('CUSTOM_ERROR', message, 422);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Custom error message',
          code: 'CUSTOM_ERROR',
        })
      );
    });

    test('should not call next function', () => {
      const error = new AppError('TEST', 'Test', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
