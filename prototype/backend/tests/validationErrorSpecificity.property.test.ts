// Feature: user-registration-module, Property 22: Validation Error Specificity
import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';

dotenv.config();

// Create test app with auth routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

const NUM_RUNS = 10;

// Valid generators for fields that are NOT being tested (so only the target field triggers an error)
function validUsernameArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 3,
      maxLength: 15,
    })
    .map((chars) => chars.join(''));
}

function validEmailArbitrary(): fc.Arbitrary<string> {
  const localPart = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 3 })
    .map((chars) => chars.join(''));
  const domain = fc.constantFrom('a', 'b', 'x', 'z');
  const tld = fc.constantFrom('co', 'io');
  return fc.tuple(localPart, domain, tld).map(([l, d, t]) => `${l}@${d}.${t}`);
}

function validPasswordArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'.split(''),
      ),
      { minLength: 8, maxLength: 32 },
    )
    .map((chars) => chars.join(''));
}

function validStableNameArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')), {
      minLength: 3,
      maxLength: 20,
    })
    .map((chars) => chars.join('').trim() || 'DefaultStable');
}

describe('Validation Error Specificity - Property Tests', () => {
  describe('Property 22: Validation Error Specificity', () => {
    /**
     * **Validates: Requirements 9.2**
     * For any validation error (invalid format, length violation, missing field),
     * the system should return a specific error message describing which validation
     * rule was violated.
     */

    // ---- Username validation errors ----

    test('too-short username returns error mentioning "Username" and "at least 3 characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
            minLength: 1,
            maxLength: 2,
          }).map((chars) => chars.join('')),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          validStableNameArbitrary(),
          async (shortUsername, email, password, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username: shortUsername, email, password, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Username');
            expect(res.body.error).toContain('at least 3 characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('too-long username returns error mentioning "Username" and "20 characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
            minLength: 21,
            maxLength: 40,
          }).map((chars) => chars.join('')),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          validStableNameArbitrary(),
          async (longUsername, email, password, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username: longUsername, email, password, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Username');
            expect(res.body.error).toContain('20 characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('invalid username characters returns error mentioning "Username" and "can only contain"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
              minLength: 2,
              maxLength: 18,
            }),
            fc.constantFrom(...'!@#$%^&*()+=[]{}|;:,.<>?/~ '.split('')),
          ).map(([validChars, invalidChar]) => {
            const pos = Math.floor(validChars.length / 2);
            const arr = [...validChars];
            arr.splice(pos, 0, invalidChar);
            return arr.join('');
          }),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          validStableNameArbitrary(),
          async (invalidUsername, email, password, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username: invalidUsername, email, password, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Username');
            expect(res.body.error).toContain('can only contain');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    // ---- Email validation errors ----

    test('too-short email returns error mentioning "Email" and "at least 3 characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
            minLength: 1,
            maxLength: 2,
          }).map((chars) => chars.join('')),
          validUsernameArbitrary(),
          validPasswordArbitrary(),
          validStableNameArbitrary(),
          async (shortEmail, username, password, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email: shortEmail, password, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Email');
            expect(res.body.error).toContain('at least 3 characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('too-long email returns error mentioning "Email" and "50 characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
            minLength: 51,
            maxLength: 70,
          }).map((chars) => chars.join('')),
          validUsernameArbitrary(),
          validPasswordArbitrary(),
          validStableNameArbitrary(),
          async (longEmail, username, password, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email: longEmail, password, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Email');
            expect(res.body.error).toContain('50 characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('invalid email characters returns error mentioning "Email" and "invalid characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')), {
              minLength: 2,
              maxLength: 18,
            }),
            fc.constantFrom(...'!#$%^&*()+=[]{}|;:,<>?/~ '.split('')),
          ).map(([validChars, invalidChar]) => {
            const pos = Math.floor(validChars.length / 2);
            const arr = [...validChars];
            arr.splice(pos, 0, invalidChar);
            return arr.join('');
          }),
          validUsernameArbitrary(),
          validPasswordArbitrary(),
          validStableNameArbitrary(),
          async (invalidEmail, username, password, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email: invalidEmail, password, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Email');
            expect(res.body.error).toContain('invalid characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    // ---- Password validation errors ----

    test('too-short password returns error mentioning "Password" and "at least 8 characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
            { minLength: 1, maxLength: 7 },
          ).map((chars) => chars.join('')),
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validStableNameArbitrary(),
          async (shortPassword, username, email, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password: shortPassword, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Password');
            expect(res.body.error).toContain('at least 8 characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('too-long password returns error mentioning "Password" and "128 characters"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
            { minLength: 129, maxLength: 160 },
          ).map((chars) => chars.join('')),
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validStableNameArbitrary(),
          async (longPassword, username, email, stableName) => {
            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password: longPassword, stableName });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Password');
            expect(res.body.error).toContain('128 characters');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    // ---- Missing fields ----

    test('missing fields returns error mentioning "required"', async () => {
      const missingFieldArbitrary = fc.oneof(
        // Missing username
        fc.record({
          email: validEmailArbitrary(),
          password: validPasswordArbitrary(),
        }),
        // Missing email
        fc.record({
          username: validUsernameArbitrary(),
          password: validPasswordArbitrary(),
        }),
        // Missing password
        fc.record({
          username: validUsernameArbitrary(),
          email: validEmailArbitrary(),
        }),
        // Missing all
        fc.constant({}),
        // Missing username and email
        fc.record({
          password: validPasswordArbitrary(),
        }),
        // Missing username and password
        fc.record({
          email: validEmailArbitrary(),
        }),
        // Missing email and password
        fc.record({
          username: validUsernameArbitrary(),
        }),
      );

      await fc.assert(
        fc.asyncProperty(missingFieldArbitrary, async (body) => {
          const res = await request(app)
            .post('/api/auth/register')
            .send(body);

          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty('error');
          expect(res.body.error.toLowerCase()).toContain('required');
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
