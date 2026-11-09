/**
 * PUT /api/robots/:id/appearance — real database.
 *
 * An uploaded image can only be applied from the caller's own Image_Library
 * (uploads/user-robots/<callerId>/) and must still exist; presets stay open.
 * Until Nov 2026 `assertSelectable` existed but the route never called it, so
 * another stable's upload path was accepted.
 *
 * The test writes one image file per user and deletes only those files (never
 * a whole upload directory: low ids on a throwaway DB collide with local dev
 * uploads).
 */
import path from 'path';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import request from 'supertest';
import express from 'express';
import type { Server } from 'http';
import prisma from '../../src/lib/prisma';
import robotRoutes from '../../src/routes/robots';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';

const UPLOAD_BASE_DIR = path.resolve(__dirname, '../../uploads/user-robots');

const app = express();
app.use(express.json());
app.use('/api/robots', robotRoutes);
app.use(errorHandler);

async function writeUpload(userId: number): Promise<{ url: string; file: string }> {
  const dir = path.join(UPLOAD_BASE_DIR, String(userId));
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.webp`;
  const file = path.join(dir, name);
  await fs.writeFile(file, Buffer.from('RIFF0000WEBP'));
  return { url: `/uploads/user-robots/${userId}/${name}`, file };
}

describe('PUT /api/robots/:id/appearance image ownership', () => {
  let server: Server;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let ownerToken: string;
  let robotId: number;
  const userIds: number[] = [];
  const files: string[] = [];
  let ownUpload: string;
  let otherUpload: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const owner = await prisma.user.create({ data: { username: `ap_o_${suffix}`, passwordHash: 'x', role: 'user' } });
    const other = await prisma.user.create({ data: { username: `ap_x_${suffix}`, passwordHash: 'x', role: 'user' } });
    userIds.push(owner.id, other.id);
    ownerToken = generateToken({ id: String(owner.id), username: owner.username, role: 'user', tokenVersion: 0 });
    const robot = await prisma.robot.create({
      data: { name: `AP Bot ${suffix}`, userId: owner.id, currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10 },
    });
    robotId = robot.id;
    const own = await writeUpload(owner.id);
    const theirs = await writeUpload(other.id);
    files.push(own.file, theirs.file);
    ownUpload = own.url;
    otherUpload = theirs.url;
  });

  afterAll(async () => {
    for (const file of files) await fs.unlink(file).catch(() => undefined);
    for (const id of userIds) await fs.rmdir(path.join(UPLOAD_BASE_DIR, String(id))).catch(() => undefined);
    await prisma.robot.deleteMany({ where: { id: robotId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const put = (imageUrl: string) => request(server)
    .put(`/api/robots/${robotId}/appearance`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ imageUrl });

  it('applies the caller\'s own upload', async () => {
    const res = await put(ownUpload);
    expect(res.status).toBe(200);
    expect(res.body.robot.imageUrl).toBe(ownUpload);
  });

  it('rejects another stable\'s upload with a generic 403 and leaves the robot unchanged', async () => {
    const res = await put(otherUpload);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Access denied');
    const robot = await prisma.robot.findUnique({ where: { id: robotId }, select: { imageUrl: true } });
    expect(robot?.imageUrl).toBe(ownUpload);
  });

  it('rejects an own-directory path whose file does not exist', async () => {
    const userId = userIds[0];
    const res = await put(`/uploads/user-robots/${userId}/${randomUUID()}.webp`);
    expect(res.status).toBe(403);
  });

  it('still accepts a bundled preset', async () => {
    const res = await put('/assets/robots/robot-chassis-humanoid-dual_red_blade_mech.webp');
    expect(res.status).toBe(200);
  });
});
