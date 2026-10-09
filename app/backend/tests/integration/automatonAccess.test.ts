/**
 * Spec #55 task 1.5 — Automaton access blocking (R2.9, R2.10, R2.11).
 *
 * Real database. An Automaton_Stable has no usable credentials:
 * - `POST /api/auth/login` answers with the generic 401 before comparing the password;
 * - `authenticateToken` rejects any token for it on the standard 401 path;
 * - `resetPassword` throws `AUTOMATON_ACCOUNT_LOCKED` and changes nothing.
 * Human behaviour on all three paths is unchanged.
 */
import http from 'node:http';
import express, { Response } from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma';
import authRoutes from '../../src/routes/auth';
import { authenticateToken, AuthRequest } from '../../src/middleware/auth';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';
import { resetPassword } from '../../src/services/auth/passwordResetService';

const PASSWORD = 'CorrectHorse1!';
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/protected', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.user?.userId });
});
app.use(errorHandler);

describe('Automaton access blocking (Spec #55 R2.9–R2.11)', () => {
  let server: http.Server;
  let automatonId: number;
  let humanId: number;
  const automatonUsername = `automaton_acc_${suffix}`;
  const humanUsername = `human_acc_${suffix}`;

  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    // The Automaton row gets a real hash of a known password so the test can
    // prove that even the correct password does not log in.
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const automaton = await prisma.user.create({
      data: {
        username: automatonUsername,
        passwordHash,
        stableName: `AccAuto${suffix}`.slice(0, 30),
        stableType: 'automaton',
        isGenerated: false,
        hasCompletedOnboarding: true,
      },
    });
    automatonId = automaton.id;

    const human = await prisma.user.create({
      data: { username: humanUsername, passwordHash, stableType: 'human' },
    });
    humanId = human.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { eventType: 'admin_password_reset', userId: humanId },
    });
    await prisma.user.deleteMany({ where: { id: { in: [automatonId, humanId] } } });
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('rejects an Automaton with the generic 401 before comparing the password', async () => {
      const compareSpy = jest.spyOn(bcrypt, 'compare');

      const res = await request(server)
        .post('/api/auth/login')
        .send({ identifier: automatonUsername, password: PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      expect(res.body.token).toBeUndefined();
      expect(compareSpy).not.toHaveBeenCalled();
    });

    it('answers an Automaton exactly like an unknown user', async () => {
      const [automatonRes, unknownRes] = await Promise.all([
        request(server).post('/api/auth/login').send({ identifier: automatonUsername, password: PASSWORD }),
        request(server).post('/api/auth/login').send({ identifier: `nobody_${suffix}`, password: PASSWORD }),
      ]);

      expect(automatonRes.status).toBe(unknownRes.status);
      expect(automatonRes.body).toEqual(unknownRes.body);
    });

    it('still logs a human in with the right password and rejects a wrong one', async () => {
      const ok = await request(server)
        .post('/api/auth/login')
        .send({ identifier: humanUsername, password: PASSWORD });
      expect(ok.status).toBe(200);
      expect(typeof ok.body.token).toBe('string');

      const bad = await request(server)
        .post('/api/auth/login')
        .send({ identifier: humanUsername, password: 'wrong-password' });
      expect(bad.status).toBe(401);
      expect(bad.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('authenticateToken', () => {
    it('rejects a token issued for an Automaton with the standard 401', async () => {
      const token = generateToken({ id: String(automatonId), username: automatonUsername, role: 'user', tokenVersion: 0 });

      const res = await request(server).get('/api/protected').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid or expired token' });
    });

    it('accepts a valid human token', async () => {
      const token = generateToken({ id: String(humanId), username: humanUsername, role: 'user', tokenVersion: 0 });

      const res = await request(server).get('/api/protected').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(humanId);
    });
  });

  describe('resetPassword', () => {
    it('rejects an Automaton with AUTOMATON_ACCOUNT_LOCKED and changes nothing', async () => {
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: automatonId },
        select: { passwordHash: true, tokenVersion: true },
      });
      const auditBefore = await prisma.auditLog.count({ where: { eventType: 'admin_password_reset' } });

      await expect(
        resetPassword(automatonId, 'NewPassword1!', { initiatorId: humanId, resetType: 'admin' }),
      ).rejects.toMatchObject({ code: 'AUTOMATON_ACCOUNT_LOCKED', statusCode: 409 });

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: automatonId },
        select: { passwordHash: true, tokenVersion: true },
      });
      expect(after).toEqual(before);
      expect(await prisma.auditLog.count({ where: { eventType: 'admin_password_reset' } })).toBe(auditBefore);
    });

    it('still resets a human password and bumps tokenVersion', async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: humanId }, select: { tokenVersion: true } });

      await resetPassword(humanId, 'NewPassword1!', { initiatorId: humanId, resetType: 'admin' });

      const after = await prisma.user.findUniqueOrThrow({ where: { id: humanId }, select: { tokenVersion: true } });
      expect(after.tokenVersion).toBe(before.tokenVersion + 1);
    });
  });
});
