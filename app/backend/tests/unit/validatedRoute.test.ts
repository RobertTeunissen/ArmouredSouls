/**
 * Unit tests for `validated()` (middleware/schemaValidator.ts): a route handler
 * receives the values `validateRequest` parsed, typed by their schemas, and a
 * rejected handler still reaches `errorHandler`.
 */

jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    trackRateLimitViolation: jest.fn(),
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    setStableName: jest.fn(),
  },
}));

import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validated } from '../../src/middleware/schemaValidator';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AppError } from '../../src/errors/AppError';
import { positiveIntParam } from '../../src/utils/securityValidation';

const paramsSchema = z.object({ id: positiveIntParam });
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});
const bodySchema = z.object({ name: z.string().min(1) });

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/items/:id', ...validated({ params: paramsSchema, query: querySchema }, (_req, res, { params, query }) => {
    // Typed: params.id and query.page are numbers, query.active a boolean.
    const id: number = params.id;
    const page: number = query.page;
    res.json({ id, idType: typeof id, page, active: query.active ?? null });
  }));
  app.post('/items', ...validated({ body: bodySchema }, (_req, res, { body, params, query }) => {
    res.status(201).json({ name: body.name, params: params ?? null, query: query ?? null });
  }));
  app.get('/fail/:id', ...validated({ params: paramsSchema }, async (_req, _res, { params }) => {
    throw new AppError('NOT_FOUND', `Item ${params.id} not found`, 404);
  }));
  app.use(errorHandler);
  return app;
}

describe('validated()', () => {
  const app = buildApp();

  it('hands the handler the parsed params and query', async () => {
    const res = await request(app).get('/items/42?page=3&active=true');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 42, idType: 'number', page: 3, active: true });
  });

  it('applies schema defaults', async () => {
    const res = await request(app).get('/items/7');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 7, page: 1, active: null });
  });

  it('rejects invalid input before the handler runs', async () => {
    const res = await request(app).get('/items/abc');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('passes only parts that have a schema, with unknown body fields stripped', async () => {
    const res = await request(app).post('/items').send({ name: 'Alpha', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'Alpha', params: null, query: null });
  });

  it('forwards a thrown AppError to the error handler', async () => {
    const res = await request(app).get('/fail/5');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Item 5 not found', code: 'NOT_FOUND' });
  });
});
