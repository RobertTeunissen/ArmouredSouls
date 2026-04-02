/**
 * Property-based tests for schema validation middleware.
 *
 * Feature: security-audit-guardrails
 */

import * as fc from 'fast-check';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validateRequest } from '../src/middleware/schemaValidator';
import { AppError } from '../src/errors/AppError';

/** Helper to create a mock Express request */
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {} as Record<string, string>,
    query: {},
    ...overrides,
  } as unknown as Request;
}

/** Helper to create a mock Express response */
function mockRes(): Response {
  return {} as Response;
}

/**
 * Feature: security-audit-guardrails, Property 1: Schema validation rejects invalid fields with structured error
 *
 * For any route with a defined Zod schema and for any request body/params/query
 * containing a field that violates the schema (wrong type, missing required field,
 * pattern mismatch), the middleware shall return HTTP 400 with a JSON response
 * containing code: 'VALIDATION_ERROR' and a details.fields array where each entry
 * includes the field name and violation message.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
describe('Property 1: Schema validation rejects invalid fields with structured error', () => {
  const testSchema = z.object({
    name: z.string().min(1).max(50),
    age: z.number().int().positive(),
    email: z.string().email(),
  });

  const paramsSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Must be a positive integer'),
  });

  it('rejects invalid body fields with VALIDATION_ERROR code and fields array', () => {
    const middleware = validateRequest({ body: testSchema });

    fc.assert(
      fc.property(
        fc.record({
          name: fc.oneof(fc.constant(''), fc.constant(null), fc.constant(123)),
          age: fc.oneof(fc.constant('not-a-number'), fc.constant(-5), fc.constant(3.14)),
          email: fc.oneof(fc.constant('not-an-email'), fc.constant(''), fc.constant(42)),
        }),
        (invalidBody) => {
          const req = mockReq({ body: invalidBody });
          const next = jest.fn();

          try {
            middleware(req, mockRes(), next);
            // If next was called, the middleware didn't throw — that's a failure
            expect(next).not.toHaveBeenCalled();
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.code).toBe('VALIDATION_ERROR');
            expect(appErr.statusCode).toBe(400);
            expect(appErr.details).toBeDefined();
            const details = appErr.details as { fields: Array<{ field: string; message: string }> };
            expect(Array.isArray(details.fields)).toBe(true);
            expect(details.fields.length).toBeGreaterThan(0);
            for (const f of details.fields) {
              expect(typeof f.field).toBe('string');
              expect(typeof f.message).toBe('string');
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects invalid params with VALIDATION_ERROR code and fields array', () => {
    const middleware = validateRequest({ params: paramsSchema });

    fc.assert(
      fc.property(
        fc.record({
          id: fc.oneof(
            fc.constant('abc'),
            fc.constant('-1'),
            fc.constant('3.14'),
            fc.constant(''),
            fc.constant('hello world'),
          ),
        }),
        (invalidParams) => {
          const req = mockReq({ params: invalidParams as Record<string, string> });
          const next = jest.fn();

          try {
            middleware(req, mockRes(), next);
            expect(next).not.toHaveBeenCalled();
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.code).toBe('VALIDATION_ERROR');
            expect(appErr.statusCode).toBe(400);
            const details = appErr.details as { fields: Array<{ field: string; message: string }> };
            expect(Array.isArray(details.fields)).toBe(true);
            expect(details.fields.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects strings exceeding max length with VALIDATION_ERROR', () => {
    const middleware = validateRequest({ body: testSchema });

    fc.assert(
      fc.property(
        fc.string({ minLength: 51, maxLength: 200 }),
        (longName) => {
          const req = mockReq({
            body: { name: longName, age: 25, email: 'test@example.com' },
          });
          const next = jest.fn();

          try {
            middleware(req, mockRes(), next);
            expect(next).not.toHaveBeenCalled();
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.code).toBe('VALIDATION_ERROR');
            expect(appErr.statusCode).toBe(400);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts valid bodies and calls next()', () => {
    const middleware = validateRequest({ body: testSchema });

    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.length >= 1),
          age: fc.integer({ min: 1, max: 1000 }),
          email: fc.constant('valid@example.com'),
        }),
        (validBody) => {
          const req = mockReq({ body: validBody });
          const next = jest.fn();

          middleware(req, mockRes(), next);
          expect(next).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: security-audit-guardrails, Property 4: Unknown field stripping (mass-assignment prevention)
 *
 * For any request body containing fields not defined in the route's Zod schema,
 * after validation the parsed body shall contain only the fields defined in the
 * schema. The extra fields shall not be present in the validated output.
 *
 * **Validates: Requirements 1.6**
 */
describe('Property 4: Unknown field stripping (mass-assignment prevention)', () => {
  const schema = z.object({
    name: z.string().min(1).max(50),
    age: z.number().int().positive(),
  });

  it('strips unknown fields from the validated body', () => {
    const middleware = validateRequest({ body: schema });

    fc.assert(
      fc.property(
        // Generate valid base fields
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.length >= 1),
          age: fc.integer({ min: 1, max: 1000 }),
        }),
        // Generate 1-5 extra fields with random keys and values
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((k) => k !== 'name' && k !== 'age'),
          fc.oneof(fc.string(), fc.integer(), fc.boolean()),
          { minKeys: 1, maxKeys: 5 },
        ),
        (validFields, extraFields) => {
          const bodyWithExtras = { ...validFields, ...extraFields };
          const req = mockReq({ body: bodyWithExtras });
          const next = jest.fn();

          middleware(req, mockRes(), next);

          expect(next).toHaveBeenCalled();
          // After validation, req.body should only contain schema-defined fields
          const resultKeys = Object.keys(req.body);
          expect(resultKeys).toContain('name');
          expect(resultKeys).toContain('age');
          // Extra fields must be stripped
          for (const extraKey of Object.keys(extraFields)) {
            expect(resultKeys).not.toContain(extraKey);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
