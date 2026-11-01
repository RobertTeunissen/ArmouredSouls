/**
 * Security & Moderation admin services against a real database: stored
 * signals and their overview (buckets, stables, sources and failed-login
 * bursts, the dashboard item, retention), and the uploaded-image inventory
 * (record, backfill, list, detail, cleanup preview, remove).
 *
 * Signal totals are database-wide, so totals are compared before and after
 * this suite's own rows. The image tests write real files under
 * uploads/user-robots/{testUserId}/ and delete them afterwards. The full
 * cleanup run is unit-tested only: it sweeps the whole uploads directory.
 */

import { promises as fs } from 'fs';
import prisma from '../../src/lib/prisma';
import { persistSecuritySignal } from '../../src/services/security/securityEventStore';
import { getSecurityAttention, getSecurityOverview, pruneSecurityEvents } from '../../src/services/security/securityOverviewService';
import { recordUpload, syncUploadedImages } from '../../src/services/moderation/uploadedImageService';
import { fileStorageService } from '../../src/services/moderation/fileStorageService';
import { getImageDetail, getImagesOverview, listImagesInUse, previewCleanup, removeImage } from '../../src/services/moderation/adminImagesService';

const TAG = `asm${Date.now() % 1_000_000}`;
const IP_BURST = `${TAG}-ip-burst`;
const IP_QUIET = `${TAG}-ip-quiet`;
const createdUsers: number[] = [];
const files: string[] = [];
const auditIds: bigint[] = [];
const ROBOT = { currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0 };

async function user(name: string, role = 'user'): Promise<number> {
  const row = await prisma.user.create({
    data: { username: `${TAG}_${name}`, passwordHash: 'test-hash', stableName: `${TAG} ${name}`.slice(0, 30), role },
  });
  createdUsers.push(row.id);
  return row.id;
}

async function waitFor<T>(read: () => Promise<T | null>, timeoutMs = 3000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== null) return value;
    if (Date.now() > until) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

let player: number;
let admin: number;

beforeAll(async () => {
  player = await user('player');
  admin = await user('admin', 'admin');
});

afterAll(async () => {
  await prisma.securityEvent.deleteMany({ where: { OR: [{ sourceIp: { startsWith: TAG } }, { userId: { in: createdUsers } }] } });
  await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } });
  await prisma.adminAuditLog.deleteMany({ where: { adminUserId: { in: createdUsers } } });
  await prisma.uploadedImage.deleteMany({ where: { userId: { in: createdUsers } } });
  await prisma.robot.deleteMany({ where: { userId: { in: createdUsers } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  // Only the files this suite wrote. A fresh test database reuses low user ids,
  // so a user directory may hold a developer's own local uploads: never remove
  // a directory recursively, only when it is empty.
  for (const url of files) await fs.rm(fileStorageService.getAbsolutePath(url), { force: true });
  for (const id of createdUsers) await fs.rmdir(fileStorageService.getAbsolutePath(`/uploads/user-robots/${id}`)).catch(() => undefined);
});

describe('Security signals', () => {
  it('stores a signal written through the store', async () => {
    persistSecuritySignal({ signal: 'rate_limit', sourceIp: IP_QUIET, endpoint: '/api/auth/login?x=1' });
    const row = await waitFor(() => prisma.securityEvent.findFirst({ where: { sourceIp: IP_QUIET, signal: 'rate_limit' } }));
    // The query string never reaches the table.
    expect(row.endpoint).toBe('/api/auth/login');
    expect(row.userId).toBeNull();
  });

  it('summarises signals per type, per stable and per source, with failed-login bursts', async () => {
    const before = await getSecurityOverview('7d');
    const attentionBefore = await getSecurityAttention();
    const base = Date.now() - 2 * 60 * 60 * 1000;
    // Six failed logins on the player's account from one IP inside 10 minutes: a burst.
    await prisma.securityEvent.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        signal: 'failed_login', userId: player, sourceIp: IP_BURST, endpoint: '/api/auth/login',
        occurredAt: new Date(base + i * 2 * 60 * 1000), details: { reason: 'wrong_password' },
      })),
    });
    await prisma.securityEvent.createMany({
      data: [
        { signal: 'ownership_violation', userId: player, endpoint: '/api/robots/1', details: { resourceType: 'robot', resourceId: 1 }, occurredAt: new Date(base) },
        { signal: 'malformed_request', sourceIp: IP_QUIET, endpoint: '/api/auth/register', details: { violationType: 'invalid_body' }, occurredAt: new Date(base) },
      ],
    });
    const audit = await prisma.auditLog.create({
      data: { cycleNumber: 0, sequenceNumber: 900_000_000 + (Date.now() % 1_000_000), eventType: 'image_moderation_rejection', userId: player, payload: { reason: 'nsfw' }, eventTimestamp: new Date(base) },
    });
    auditIds.push(audit.id);

    const after = await getSecurityOverview('7d');
    const total = (o: typeof after, s: string): number => o.signals.find((x) => x.signal === s)?.total ?? 0;
    expect(total(after, 'failed_login') - total(before, 'failed_login')).toBe(6);
    expect(total(after, 'ownership_violation') - total(before, 'ownership_violation')).toBe(1);
    expect(total(after, 'nsfw_block') - total(before, 'nsfw_block')).toBe(1);
    expect(after.buckets).toHaveLength(7);
    for (const s of after.signals) expect(s.perBucket.reduce((a, b) => a + b, 0)).toBe(s.total);

    const stable = after.stables.find((s) => s.userId === player);
    expect(stable).toMatchObject({ stableName: `${TAG} player`, stableType: 'human', counts: { failed_login: 6, ownership_violation: 1 } });

    const burst = after.sources.find((s) => s.sourceIp === IP_BURST);
    expect(burst).toMatchObject({ failedLogins: 6, accountsTried: 1, malformedRequests: 0, endpoints: ['/api/auth/login'] });
    expect(burst?.burst?.count).toBe(6);
    const quiet = after.sources.find((s) => s.sourceIp === IP_QUIET);
    expect(quiet).toMatchObject({ failedLogins: 0, malformedRequests: 1, rateLimitHits: 1, burst: null });

    // Dashboard: the burst and the ownership violation are worth a look.
    const attentionAfter = await getSecurityAttention();
    expect(attentionAfter.alerts - attentionBefore.alerts).toBe(2);
    expect(attentionAfter.signals - attentionBefore.signals).toBe(8);

    const hourly = await getSecurityOverview('24h');
    expect(hourly.bucket).toBe('hour');
    expect(hourly.buckets).toHaveLength(24);
  });

  it('drops signals older than 90 days', async () => {
    await prisma.securityEvent.create({ data: { signal: 'rate_limit', sourceIp: `${TAG}-old`, occurredAt: new Date(Date.now() - 91 * 86_400_000) } });
    await pruneSecurityEvents();
    expect(await prisma.securityEvent.count({ where: { sourceIp: `${TAG}-old` } })).toBe(0);
  });
});

describe('Uploaded images', () => {
  let recordedUrl: string;
  let backfilledUrl: string;
  let recordedId: number;
  const missingUrl = (): string => `/uploads/user-robots/${player}/${TAG}-missing.webp`;

  beforeAll(async () => {
    recordedUrl = await fileStorageService.storeImage(player, Buffer.from('webp-a'));
    backfilledUrl = await fileStorageService.storeImage(player, Buffer.from('webp-bb'));
    files.push(recordedUrl, backfilledUrl);
    await recordUpload({
      imageUrl: recordedUrl, userId: player, fileSize: 6,
      moderationScores: { drawing: 0.31, hentai: 0.02, neutral: 0.62, porn: 0.01, sexy: 0.04 },
      robotLikenessScore: 0.4, uploadedAnyway: true,
    });
    await prisma.robot.createMany({
      data: [
        { ...ROBOT, userId: player, name: `${TAG} Warden`, imageUrl: recordedUrl },
        { ...ROBOT, userId: player, name: `${TAG} Warden II`, imageUrl: recordedUrl },
        { ...ROBOT, userId: player, name: `${TAG} Ghost`, imageUrl: missingUrl() },
      ],
    });
    recordedId = (await prisma.uploadedImage.findUniqueOrThrow({ where: { imageUrl: recordedUrl } })).id;
  });

  it('backfills a file without a row, with no scores', async () => {
    await syncUploadedImages();
    const row = await prisma.uploadedImage.findUniqueOrThrow({ where: { imageUrl: backfilledUrl } });
    expect(row).toMatchObject({ userId: player, fileSize: 7, moderationScores: null, uploadedAnyway: false });
  });

  it('lists images in use with their robots, filter and search', async () => {
    const all = await listImagesInUse('all', TAG, 1);
    expect(all.images).toHaveLength(1);
    expect(all.images[0]).toMatchObject({ id: recordedId, robotCount: 2, robotNames: [`${TAG} Warden`, `${TAG} Warden II`], uploadedAnyway: true, owner: { userId: player } });
    expect((await listImagesInUse('anyway', TAG, 1)).images.map((i) => i.id)).toEqual([recordedId]);
    expect((await listImagesInUse('all', `${TAG}-nothing`, 1)).total).toBe(0);
  });

  it('shows the detail with scores and thresholds', async () => {
    const detail = await getImageDetail(recordedId);
    expect(detail.robots.map((r) => r.name)).toEqual([`${TAG} Warden`, `${TAG} Warden II`]);
    expect(detail.moderation?.scores.neutral).toBe(0.62);
    expect(detail.thresholds).toEqual({ nsfw: { porn: 0.3, hentai: 0.3, sexy: 0.5 }, robotLikeness: 0.6 });
    expect(detail.library.saved).toBe(2);
  });

  it('counts the missing reference in the overview and the cleanup preview', async () => {
    const overview = await getImagesOverview();
    expect(overview.storage.missing.robots).toBeGreaterThanOrEqual(1);
    expect(overview.inUse.images).toBeGreaterThanOrEqual(1);
    const preview = await previewCleanup();
    expect(preview.missing.paths).toContain(missingUrl());
    // A retained image in a live user's directory is never an orphan.
    expect(preview.orphanFiles.map((f) => f.imageUrl)).not.toContain(backfilledUrl);
  });

  it('removes an image: robots lose it, the file and row are gone, the action is audited', async () => {
    const result = await removeImage(admin, recordedId, 'explicit content past the filter');
    expect(result).toEqual({ imageUrl: recordedUrl, robotsCleared: 2, archivedCleared: 0 });
    expect(await prisma.robot.count({ where: { imageUrl: recordedUrl } })).toBe(0);
    expect(await prisma.uploadedImage.findUnique({ where: { id: recordedId } })).toBeNull();
    await expect(fs.access(fileStorageService.getAbsolutePath(recordedUrl))).rejects.toThrow();
    const audit = await waitFor(() => prisma.adminAuditLog.findFirst({ where: { adminUserId: admin, operationType: 'image_removed' } }));
    expect(audit.resultSummary).toMatchObject({ imageUrl: recordedUrl, ownerUserId: player, reason: 'explicit content past the filter' });
    await expect(getImageDetail(recordedId)).rejects.toMatchObject({ code: 'IMAGE_NOT_FOUND', statusCode: 404 });
  });
});
