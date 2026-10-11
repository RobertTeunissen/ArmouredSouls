/**
 * Spec #55 integration support for the Admin_Automaton_Control router: one
 * HTTP server per suite, an admin and a player token, and polling reads of
 * the admin audit log (`recordAction` is fire-and-forget).
 *
 * Only tests use this.
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/lib/prisma';
import adminAutomatonsRoutes from '../../src/routes/adminAutomatons';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';

export const AUTOMATON_ADMIN_BASE = '/api/admin/automatons';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface AuditRow {
  id: number;
  operationType: string;
  operationResult: string;
  resultSummary: unknown;
}

export interface AdminApiHarness {
  server: http.Server;
  adminId: number;
  playerId: number;
  adminToken: string;
  playerToken: string;
  /** A request to `{base}{url}` with the admin token (or `token`; `null` for none). */
  api(method: HttpMethod, url: string, token?: string | null): request.Test;
  /** Audit entries of this admin, oldest first. */
  audit(): Promise<AuditRow[]>;
  /** Wait until the admin has at least `count` audit entries (or the time runs out), then return them. */
  auditAtLeast(count: number): Promise<AuditRow[]>;
  /** The audit count after giving fire-and-forget writes time to land. */
  settledAuditCount(): Promise<number>;
  close(): Promise<void>;
}

/** Start the router on an ephemeral port with a fresh admin and player. `tag` must be digits/letters only. */
export async function startAdminApi(tag: string): Promise<AdminApiHarness> {
  const app = express();
  app.use(express.json());
  app.use(AUTOMATON_ADMIN_BASE, adminAutomatonsRoutes);
  app.use(errorHandler);
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const admin = await prisma.user.create({ data: { username: `t55a_admin_${tag}`.slice(0, 50), passwordHash: 'unused', role: 'admin' } });
  const player = await prisma.user.create({ data: { username: `t55a_player_${tag}`.slice(0, 50), passwordHash: 'unused', role: 'user' } });
  const adminToken = generateToken({ id: String(admin.id), username: admin.username, role: 'admin', tokenVersion: 0 });
  const playerToken = generateToken({ id: String(player.id), username: player.username, role: 'user', tokenVersion: 0 });

  const audit = async (): Promise<AuditRow[]> => {
    const rows = await prisma.adminAuditLog.findMany({ where: { adminUserId: admin.id }, orderBy: { id: 'asc' } });
    return rows.map((r) => ({ id: r.id, operationType: r.operationType, operationResult: r.operationResult, resultSummary: r.resultSummary }));
  };

  return {
    server,
    adminId: admin.id,
    playerId: player.id,
    adminToken,
    playerToken,
    api(method, url, token = adminToken) {
      const req = request(server)[method](`${AUTOMATON_ADMIN_BASE}${url}`);
      return token === null ? req : req.set('Authorization', `Bearer ${token}`);
    },
    audit,
    async auditAtLeast(count) {
      for (let i = 0; i < 40; i++) {
        const rows = await audit();
        if (rows.length >= count) return rows;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return audit();
    },
    async settledAuditCount() {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return prisma.adminAuditLog.count({ where: { adminUserId: admin.id } });
    },
    async close() {
      await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, player.id] } } });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Digits only, so a generated name can never trip the profanity filter. */
export function runTag(): string {
  return `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
}
